'use client';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

// 引入 UI 元件
import { AdminHeader } from '@/components/admin/AdminHeader';
import { StoreForm } from '@/components/admin/StoreForm';
import { StoreCard } from '@/components/admin/StoreCard';
import { EditMenuModal } from '@/components/admin/EditMenuModal';
import { LoginPage } from '@/components/admin/LoginPage'; // ★ 新增：引入登入頁

// 型別定義
type Store = { id: number; name: string; image_url: string | null; phone: string | null; };
type Product = { id: number; store_id: number; name: string; price: number; };

export default function AdminPage() {
  // --- 權限狀態 ---
  const [session, setSession] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // --- 資料狀態 ---
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

  // --- 初始化：檢查登入狀態 ---
  useEffect(() => {
    // 1. 取得目前的 Session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecking(false);
      if (session) fetchStores(); // 如果已登入，直接抓資料
    });

    // 2. 監聽登入/登出狀態改變
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchStores();
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- 登出邏輯 ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // --- 既有的邏輯函數區 (保持不變) ---

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
    if (!window.confirm(`確定要刪除「${name}」嗎？`)) return;
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
      store_id: editingStore.id, name: newItemName, price: parseInt(newItemPrice) 
    }]);
    if (!error) { setNewItemName(''); setNewItemPrice(''); fetchMenu(editingStore.id); }
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
          productsToUpsert.push({ store_id: editingStore.id, name: row[0], price: parseInt(row[1]) });
        }
      });
      const { error } = await supabase.from('products').upsert(productsToUpsert, { onConflict: 'store_id, name' });
      if (error) alert('匯入失敗:' + error.message);
      else { alert('✅ 匯入成功'); fetchMenu(editingStore.id); }
    };
    reader.readAsBinaryString(file);
  };

  // --- ★ 權限判斷區塊 ---

  // 1. 如果還在檢查 Session，顯示載入中 (避免畫面閃爍)
  if (authChecking) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 font-bold">系統驗證中...</div>;
  }

  // 2. 如果沒有 Session，顯示登入頁面
  if (!session) {
    return <LoginPage />;
  }

  // 3. 有 Session，顯示原本的後台介面
  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* 把 Logout 函數傳給 Header */}
        <AdminHeader onLogout={handleLogout} />

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