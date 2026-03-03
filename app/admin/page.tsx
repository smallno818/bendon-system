'use client';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

// 引入 UI 元件
import { AdminHeader } from '@/components/admin/AdminHeader';
import { StoreForm } from '@/components/admin/StoreForm';
import { StoreCard } from '@/components/admin/StoreCard';
import { EditMenuModal } from '@/components/admin/EditMenuModal';
import { LoginPage } from '@/components/admin/LoginPage';

// 型別定義
type Store = { id: number; name: string; image_url: string | null; phone: string | null; };
type Product = { id: number; store_id: number; name: string; price: number; description: string | null; };

export default function AdminPage() {
  const [session, setSession] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 新增店家相關
  const [newStoreName, setNewStoreName] = useState('');
  const [newStorePhone, setNewStorePhone] = useState(''); 
  const [newStoreImage, setNewStoreImage] = useState(''); 
  const [uploading, setUploading] = useState(false);
  
  // 編輯菜單相關
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [menuItems, setMenuItems] = useState<Product[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemDescription, setNewItemDescription] = useState(''); 

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecking(false);
      if (session) {
        fetchStores();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchStores();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const fetchStores = async () => {
    setLoading(true);
    const { data } = await supabase.from('stores').select('*').order('id', { ascending: true });
    if (data) setStores(data);
    setLoading(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; 
    if (!file) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage.from('stores_picture').upload(filePath, file);

    if (uploadError) {
      alert('圖片上傳失敗: ' + uploadError.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from('stores_picture').getPublicUrl(filePath);
    setNewStoreImage(data.publicUrl);
    setUploading(false);
  };

  const handleAddStore = async () => {
    if (!newStoreName.trim()) return alert('請輸入店名');
    const { data: existingStore } = await supabase.from('stores').select('*').eq('name', newStoreName.trim()).single();
    const finalPhone = newStorePhone.trim() !== '' ? newStorePhone : (existingStore ? existingStore.phone : null);
    const finalImageUrl = newStoreImage !== '' ? newStoreImage : (existingStore ? existingStore.image_url : null);

    const { error } = await supabase.from('stores').upsert([{ 
      name: newStoreName.trim(), image_url: finalImageUrl, phone: finalPhone
    }], { onConflict: 'name' });

    if (!error) {
      alert('✅ 儲存成功');
      setNewStoreName(''); setNewStoreImage(''); setNewStorePhone('');
      fetchStores();
    } else {
      alert('❌ 儲存失敗: ' + error.message);
    }
  };

  const handleDeleteStore = async (id: number, name: string, imageUrl: string | null) => {
    // ★ 終極防呆：去資料庫檢查有沒有「任何還沒被關閉」的團購 (不管是否已結單)
    try {
      const { data: existingGroups, error: checkError } = await supabase
        .from('daily_groups')
        .select('id')
        .eq('store_id', id);

      if (checkError) throw checkError;

      // 只要這個店家在 daily_groups 裡面還有紀錄，代表前台還沒按「關閉此團」，就不准刪除！
      if (existingGroups && existingGroups.length > 0) {
        return alert(`❌ 無法刪除！\n「${name}」目前還有前台未關閉的團購（包含已結單但尚未請款清除的團）。\n請確認大家已請款完畢，並至前台「手動關閉」該店家的所有團購後，再嘗試刪除。`);
      }
    } catch (e: any) {
      return alert('檢查店家狀態時發生錯誤：' + e.message);
    }

    // ★ 防呆第二關：通過檢查後，才跳出最終確認刪除的提示
    if (!window.confirm(`⚠️ 警告：確定要徹底刪除「${name}」嗎？\n\n這將會連帶刪除該店家的「所有菜單」，且無法復原！`)) return;
    
    try {
      // 刪除順序：產品 -> 圖片 -> 店家本體 (因為前面擋掉了，所以確定沒有 daily_groups 關聯了)
      await supabase.from('products').delete().eq('store_id', id);
      
      if (imageUrl) {
        const fileName = imageUrl.split('/').pop();
        if (fileName) await supabase.storage.from('stores_picture').remove([fileName]);
      }
      await supabase.from('stores').delete().eq('id', id);
      fetchStores();
      
    } catch (e) { 
      alert('刪除失敗，請稍後再試。'); 
    }
  };

  const openEditModal = async (store: Store) => {
    setEditingStore(store);
    fetchMenu(store.id);
  };

  const fetchMenu = async (storeId: number) => {
    const { data } = await supabase.from('products').select('*').eq('store_id', storeId).order('id', { ascending: true });
    if (data) setMenuItems(data);
  };

  const handleAddSingleItem = async () => {
    if (!newItemName || !newItemPrice || !editingStore) return;
    const { error } = await supabase.from('products').insert([{ 
      store_id: editingStore.id, 
      name: newItemName, 
      price: parseFloat(newItemPrice),
      description: newItemDescription.trim() || null 
    }]);
    
    if (!error) {
      setNewItemName(''); 
      setNewItemPrice(''); 
      setNewItemDescription(''); 
      fetchMenu(editingStore.id);
    }
  };

  const handleUpdateItem = async (id: number, field: 'price' | 'description', value: string | number) => {
    if (!editingStore) return;
    
    if (field === 'price' && isNaN(Number(value))) return;

    const { error } = await supabase
      .from('products')
      .update({ [field]: value })
      .eq('id', id);

    if (!error) {
      fetchMenu(editingStore.id);
    } else {
      alert('更新失敗: ' + error.message);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!editingStore) return;
    const { error } = await supabase.from('products').delete().eq('id', itemId);
    if (!error) fetchMenu(editingStore.id);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editingStore) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const rawData: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      const productsToUpsert: any[] = [];
      rawData.forEach((row) => {
        if (row[0] && row[1]) {
          productsToUpsert.push({ 
            store_id: editingStore.id, 
            name: row[0], 
            price: parseFloat(row[1]),
            description: row[2] ? String(row[2]) : null 
          });
        }
      });
      const { error } = await supabase.from('products').upsert(productsToUpsert, { onConflict: 'store_id, name' });
      if (error) alert('匯入失敗:' + error.message);
      else { alert('✅ 匯入成功'); fetchMenu(editingStore.id); }
    };
    reader.readAsBinaryString(file);
  };

  if (authChecking) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 font-bold">系統驗證中...</div>;
  if (!session) return <LoginPage />;

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900 font-sans">
      <div className="max-w-5xl mx-auto">
        <AdminHeader onLogout={handleLogout} />

        {/* 移除開團管理，只保留店家維護 */}
        <StoreForm 
          name={newStoreName}
          phone={newStorePhone}
          uploading={uploading}
          imagePreview={newStoreImage}
          onNameChange={setNewStoreName}
          onPhoneChange={setNewStorePhone}
          onImageUpload={handleImageUpload}
          onSubmit={handleAddStore}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map(store => (
            <StoreCard 
              key={store.id}
              name={store.name}
              phone={store.phone}
              imageUrl={store.image_url}
              onEdit={() => openEditModal(store)}
              onDelete={() => handleDeleteStore(store.id, store.name, store.image_url)}
            />
          ))}
        </div>
      </div>

      {editingStore && (
        <EditMenuModal 
          storeName={editingStore.name}
          menuItems={menuItems}
          newItemName={newItemName}
          newItemPrice={newItemPrice}
          newItemDescription={newItemDescription} 
          onClose={() => setEditingStore(null)}
          onExcelUpload={handleExcelUpload}
          onNameChange={setNewItemName}
          onPriceChange={setNewItemPrice}
          onDescriptionChange={setNewItemDescription} 
          onAddItem={handleAddSingleItem}
          onDeleteItem={handleDeleteItem}
          onUpdateItem={handleUpdateItem} 
        />
      )}
    </div>
  );
}