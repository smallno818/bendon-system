'use client';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

// 引入拆分出去的 UI 元件
import { AdminHeader } from '@/components/admin/AdminHeader';
import { StoreForm } from '@/components/admin/StoreForm';
import { StoreCard } from '@/components/admin/StoreCard';
import { EditMenuModal } from '@/components/admin/EditMenuModal';

// 型別定義
type Store = { id: number; name: string; image_url: string | null; phone: string | null; };
type Product = { id: number; store_id: number; name: string; price: number; };

export default function AdminPage() {
  // --- 狀態管理區 ---
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

  // --- 初始化 ---
  useEffect(() => {
    fetchStores();
  }, []);

  // --- 邏輯函數區 ---

  // 1. 取得店家列表
  const fetchStores = async () => {
    setLoading(true);
    const { data } = await supabase.from('stores').select('*').order('id', { ascending: true });
    if (data) setStores(data);
    setLoading(false);
  };

  // 2. 上傳店家圖片
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; 
    if (!file) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('stores_picture') 
      .upload(filePath, file);

    if (uploadError) {
      alert('圖片上傳失敗: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from('stores_picture').getPublicUrl(filePath);
    setNewStoreImage(data.publicUrl);
    setUploading(false);
  };

  // 3. 新增或更新店家
  const handleAddStore = async () => {
    if (!newStoreName.trim()) return alert('請輸入店名');
    
    // 檢查是否存在
    const { data: existingStore } = await supabase.from('stores').select('*').eq('name', newStoreName.trim()).single();
    
    // 決定要存入的電話和圖片 (有輸入用新的，沒輸入用舊的，都沒有用 null)
    const finalPhone = newStorePhone.trim() !== '' ? newStorePhone : (existingStore ? existingStore.phone : null);
    const finalImageUrl = newStoreImage !== '' ? newStoreImage : (existingStore ? existingStore.image_url : null);

    const { error } = await supabase.from('stores').upsert([{ 
      name: newStoreName.trim(), 
      image_url: finalImageUrl,
      phone: finalPhone
    }], { onConflict: 'name' });

    if (!error) {
      alert('✅ 儲存成功');
      setNewStoreName(''); setNewStoreImage(''); setNewStorePhone('');
      fetchStores();
    } else {
      alert('❌ 儲存失敗: ' + error.message);
    }
  };

  // 4. 刪除店家
  const handleDeleteStore = async (id: number, name: string, imageUrl: string | null) => {
    const confirm = window.confirm(`確定要刪除「${name}」嗎？`);
    if (!confirm) return;
    try {
      await supabase.from('products').delete().eq('store_id', id);
      await supabase.from('daily_status').delete().eq('active_store_id', id);
      if (imageUrl) {
        const fileName = imageUrl.split('/').pop();
        if (fileName) await supabase.storage.from('stores_picture').remove([fileName]);
      }
      await supabase.from('stores').delete().eq('id', id);
      fetchStores();
    } catch (e) { alert('刪除失敗'); }
  };

  // 5. 開啟編輯視窗
  const openEditModal = async (store: Store) => {
    setEditingStore(store);
    fetchMenu(store.id);
  };

  // 6. 取得菜單
  const fetchMenu = async (storeId: number) => {
    const { data } = await supabase.from('products').select('*').eq('store_id', storeId).order('id', { ascending: true });
    if (data) setMenuItems(data);
  };

  // 7. 新增單一品項
  const handleAddSingleItem = async () => {
    if (!newItemName || !newItemPrice || !editingStore) return;
    const { error } = await supabase.from('products').insert([{ 
      store_id: editingStore.id, 
      name: newItemName, 
      price: parseInt(newItemPrice) 
    }]);
    
    if (!error) {
      setNewItemName(''); 
      setNewItemPrice(''); 
      fetchMenu(editingStore.id);
    }
  };

  // 8. 刪除單一品項
  const handleDeleteItem = async (itemId: number) => {
    if (!editingStore) return;
    const { error } = await supabase.from('products').delete().eq('id', itemId);
    if (!error) fetchMenu(editingStore.id);
  };

  // 9. Excel 匯入
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
            price: parseInt(row[1]) 
          });
        }
      });
      
      const { error } = await supabase.from('products').upsert(productsToUpsert, { onConflict: 'store_id, name' });
      if (error) alert('匯入失敗:' + error.message);
      else {
        alert('✅ 匯入成功');
        fetchMenu(editingStore.id);
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- 畫面渲染區 ---
  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900 font-sans">
      <div className="max-w-5xl mx-auto">
        <AdminHeader />

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
          onClose={() => setEditingStore(null)}
          onExcelUpload={handleExcelUpload}
          onNameChange={setNewItemName}
          onPriceChange={setNewItemPrice}
          onAddItem={handleAddSingleItem}
          onDeleteItem={handleDeleteItem}
        />
      )}
    </div>
  );
}