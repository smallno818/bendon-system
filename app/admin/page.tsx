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
// ★ 新增 Group 定義
type Group = { id: number; store_id: number; end_time: string; store: Store };

export default function AdminPage() {
  const [session, setSession] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [stores, setStores] = useState<Store[]>([]);
  const [todayGroups, setTodayGroups] = useState<Group[]>([]); // ★ 今日開團列表
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

  // 開團設定相關
  const [selectedStoreId, setSelectedStoreId] = useState<number | ''>('');
  const [groupEndTime, setGroupEndTime] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecking(false);
      if (session) {
        fetchStores();
        fetchTodayGroups();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchStores();
        fetchTodayGroups();
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

  // ★ 取得今日所有開團
  const fetchTodayGroups = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('daily_groups')
      .select('*, store:stores(*)') // 關聯取得店家資料
      .eq('order_date', today)
      .order('id', { ascending: true });
    
    if (data) setTodayGroups(data as any);
  };

  // ★ 新增開團 (取代原本的設定單一店家)
  const handleAddGroup = async () => {
    if (!selectedStoreId) return alert('請選擇店家');
    if (!groupEndTime) return alert('請設定結單時間');

    const todayStr = new Date().toISOString().split('T')[0];
    const fullEndDateTime = new Date(groupEndTime).toISOString();

    if (new Date(fullEndDateTime).getTime() <= new Date().getTime()) {
      return alert('❌ 結單時間已經過了，請選擇未來的時間！');
    }

    const { error } = await supabase.from('daily_groups').insert([{
      order_date: todayStr,
      store_id: selectedStoreId,
      end_time: fullEndDateTime
    }]);

    if (!error) {
      alert('✅ 開團成功！');
      setSelectedStoreId('');
      setGroupEndTime('');
      fetchTodayGroups();
    } else {
      alert('❌ 開團失敗: ' + error.message);
    }
  };

  // ★ 刪除某個開團
  const handleDeleteGroup = async (groupId: number) => {
    if (!window.confirm('確定要取消這一團嗎？\n(相關訂單建議手動通知退款)')) return;
    
    // 先刪除關聯訂單 (Optional: 看你的需求，這裡假設直接刪除)
    await supabase.from('orders').delete().eq('group_id', groupId);
    // 再刪除團購
    const { error } = await supabase.from('daily_groups').delete().eq('id', groupId);
    
    if (!error) fetchTodayGroups();
    else alert('刪除失敗');
  };

  // ... (保留原本的圖片上傳、新增店家、編輯菜單邏輯，完全不用變) ...
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; 
    if (!file) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;
    const { error: uploadError } = await supabase.storage.from('stores_picture').upload(filePath, file);
    if (uploadError) { alert('圖片上傳失敗: ' + uploadError.message); setUploading(false); return; }
    const { data } = supabase.storage.from('stores_picture').getPublicUrl(filePath);
    setNewStoreImage(data.publicUrl);
    setUploading(false);
  };

  const handleAddStore = async () => {
    if (!newStoreName.trim()) return alert('請輸入店名');
    const { data: existingStore } = await supabase.from('stores').select('*').eq('name', newStoreName.trim()).single();
    const finalPhone = newStorePhone.trim() !== '' ? newStorePhone : (existingStore ? existingStore.phone : null);
    const finalImageUrl = newStoreImage !== '' ? newStoreImage : (existingStore ? existingStore.image_url : null);
    const { error } = await supabase.from('stores').upsert([{ name: newStoreName.trim(), image_url: finalImageUrl, phone: finalPhone }], { onConflict: 'name' });
    if (!error) { alert('✅ 儲存成功'); setNewStoreName(''); setNewStoreImage(''); setNewStorePhone(''); fetchStores(); } 
    else { alert('❌ 儲存失敗: ' + error.message); }
  };

  const handleDeleteStore = async (id: number, name: string, imageUrl: string | null) => {
    if (!window.confirm(`確定要刪除「${name}」嗎？`)) return;
    try {
      await supabase.from('products').delete().eq('store_id', id);
      // await supabase.from('daily_status').delete().eq('active_store_id', id); // 舊邏輯移除
      await supabase.from('daily_groups').delete().eq('store_id', id); // 新邏輯：刪除相關團購
      if (imageUrl) {
        const fileName = imageUrl.split('/').pop();
        if (fileName) await supabase.storage.from('stores_picture').remove([fileName]);
      }
      await supabase.from('stores').delete().eq('id', id);
      fetchStores();
    } catch (e) { alert('刪除失敗'); }
  };

  const openEditModal = async (store: Store) => { setEditingStore(store); fetchMenu(store.id); };
  const fetchMenu = async (storeId: number) => { const { data } = await supabase.from('products').select('*').eq('store_id', storeId).order('id', { ascending: true }); if (data) setMenuItems(data); };
  
  const handleAddSingleItem = async () => { if (!newItemName || !newItemPrice || !editingStore) return; const { error } = await supabase.from('products').insert([{ store_id: editingStore.id, name: newItemName, price: parseFloat(newItemPrice), description: newItemDescription.trim() || null }]); if (!error) { setNewItemName(''); setNewItemPrice(''); setNewItemDescription(''); fetchMenu(editingStore.id); } };
  const handleUpdateItem = async (id: number, field: 'price' | 'description', value: string | number) => { if (!editingStore) return; if (field === 'price' && isNaN(Number(value))) return; const { error } = await supabase.from('products').update({ [field]: value }).eq('id', id); if (!error) { fetchMenu(editingStore.id); } else { alert('更新失敗: ' + error.message); } };
  const handleDeleteItem = async (itemId: number) => { if (!editingStore) return; const { error } = await supabase.from('products').delete().eq('id', itemId); if (!error) fetchMenu(editingStore.id); };
  
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; e.target.value = ''; if (!file || !editingStore) return; const reader = new FileReader(); reader.onload = async (evt) => { const bstr = evt.target?.result; const wb = XLSX.read(bstr, { type: 'binary' }); const rawData: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }); const productsToUpsert: any[] = []; rawData.forEach((row) => { if (row[0] && row[1]) { productsToUpsert.push({ store_id: editingStore.id, name: row[0], price: parseFloat(row[1]), description: row[2] ? String(row[2]) : null }); } }); const { error } = await supabase.from('products').upsert(productsToUpsert, { onConflict: 'store_id, name' }); if (error) alert('匯入失敗:' + error.message); else { alert('✅ 匯入成功'); fetchMenu(editingStore.id); } }; reader.readAsBinaryString(file); };

  if (authChecking) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 font-bold">系統驗證中...</div>;
  if (!session) return <LoginPage />;

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900 font-sans">
      <div className="max-w-5xl mx-auto">
        <AdminHeader onLogout={handleLogout} />

        {/* ★ 新增：今日開團管理區塊 */}
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-8 rounded-2xl shadow-sm border border-indigo-100 mb-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-6 bg-indigo-600 rounded-full"></div>
            <h2 className="text-xl font-bold text-indigo-900">今日開團管理 (同時開多團)</h2>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-end mb-6">
            <div className="flex-1 w-full">
              <label className="text-sm font-bold text-indigo-700 ml-1 mb-1 block">選擇店家</label>
              <select 
                value={selectedStoreId} 
                onChange={(e) => setSelectedStoreId(Number(e.target.value))}
                className="w-full h-11 px-4 bg-white border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
              >
                <option value="">-- 請選擇 --</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex-1 w-full">
              <label className="text-sm font-bold text-indigo-700 ml-1 mb-1 block">結單時間</label>
              <input 
                type="datetime-local" 
                value={groupEndTime} 
                onChange={(e) => setGroupEndTime(e.target.value)} 
                className="w-full h-11 px-4 bg-white border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700" 
              />
            </div>
            <button 
              onClick={handleAddGroup}
              className="w-full md:w-auto px-8 h-11 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
            >
              ＋ 新增開團
            </button>
          </div>

          {/* 目前開團列表 */}
          <div className="space-y-3">
            {todayGroups.length === 0 ? (
              <p className="text-sm text-indigo-400 font-medium text-center py-4">今天還沒有開團喔，快選一家店開始吧！</p>
            ) : (
              todayGroups.map(group => (
                <div key={group.id} className="bg-white p-4 rounded-xl border border-indigo-100 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                    <img src={group.store.image_url || ''} className="w-12 h-12 rounded-lg object-cover bg-gray-100" />
                    <div>
                      <h3 className="font-bold text-slate-800">{group.store.name}</h3>
                      <p className="text-xs text-slate-500 font-bold">結單：{new Date(group.end_time).toLocaleString()}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteGroup(group.id)}
                    className="px-4 py-2 bg-rose-50 text-rose-600 rounded-lg font-bold text-sm hover:bg-rose-100 transition"
                  >
                    取消此團
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 店家維護與列表 (保持原本功能) */}
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