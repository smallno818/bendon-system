'use client';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

type Store = {
  id: number;
  name: string;
  image_url: string | null;
  phone: string | null;
};

type Product = {
  id: number;
  store_id: number;
  name: string;
  price: number;
};

export default function AdminPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStorePhone, setNewStorePhone] = useState(''); 
  const [newStoreImage, setNewStoreImage] = useState(''); 
  const [uploading, setUploading] = useState(false);
  
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [menuItems, setMenuItems] = useState<Product[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStores();
  }, []);

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

  const handleAddStore = async () => {
    if (!newStoreName.trim()) return alert('請輸入店名');
    
    // 1. 先檢查這家店是否已存在
    const { data: existingStore } = await supabase
      .from('stores')
      .select('*')
      .eq('name', newStoreName.trim())
      .single();

    // 2. 智慧合併邏輯：有輸入才更新，沒輸入則保留舊值
    const finalPhone = newStorePhone.trim() !== '' 
      ? newStorePhone 
      : (existingStore ? existingStore.phone : null);

    const finalImageUrl = newStoreImage !== '' 
      ? newStoreImage 
      : (existingStore ? existingStore.image_url : null);

    // 3. 執行儲存
    const { error } = await supabase
      .from('stores')
      .upsert([
        { 
          name: newStoreName.trim(), 
          image_url: finalImageUrl,
          phone: finalPhone
        }
      ], { onConflict: 'name' });

    if (!error) {
      alert(existingStore ? '✅ 店家資訊已更新' : '✅ 新店家已新增');
      setNewStoreName('');
      setNewStoreImage('');
      setNewStorePhone('');
      fetchStores();
    } else {
      alert('❌ 儲存失敗: ' + error.message);
    }
  };

  const handleDeleteStore = async (id: number, name: string, imageUrl: string | null) => {
    const confirm = window.confirm(`確定要刪除「${name}」嗎？\n這會刪除該店家的所有資料與圖片！`);
    if (!confirm) return;

    try {
      await supabase.from('products').delete().eq('store_id', id);
      await supabase.from('daily_status').delete().eq('active_store_id', id);

      if (imageUrl) {
        const fileName = imageUrl.split('/').pop();
        if (fileName) {
          await supabase.storage.from('stores_picture').remove([fileName]);
        }
      }

      const { error } = await supabase.from('stores').delete().eq('id', id);
      if (!error) {
        alert('🗑️ 刪除成功');
        fetchStores();
      } else {
        throw error;
      }
    } catch (error: any) {
      alert('刪除失敗: ' + error.message);
    }
  };

  const openEditModal = async (store: Store) => {
    setEditingStore(store);
    fetchMenu(store.id);
  };

  const closeEditModal = () => {
    setEditingStore(null);
    setMenuItems([]);
  };

  const fetchMenu = async (storeId: number) => {
    const { data } = await supabase.from('products').select('*').eq('store_id', storeId).order('id', { ascending: true });
    if (data) setMenuItems(data);
  };

  const handleAddSingleItem = async () => {
    if (!newItemName || !newItemPrice || !editingStore) return alert('請輸入完整資訊');
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

  const handleDeleteItem = async (itemId: number) => {
    if (!window.confirm('確定刪除此品項？')) return;
    const { error } = await supabase.from('products').delete().eq('id', itemId);
    if (!error && editingStore) fetchMenu(editingStore.id);
  };

  const handleUpdatePrice = async (itemId: number, newPrice: number) => {
    await supabase.from('products').update({ price: newPrice }).eq('id', itemId);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editingStore) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const rawData: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wsname], { header: 1 });
      const productsToUpsert: any[] = [];
      rawData.forEach((row) => {
        if (row[0] && row[1] && (typeof row[1] === 'number' || !isNaN(parseInt(row[1])))) {
           productsToUpsert.push({ store_id: editingStore.id, name: row[0], price: parseInt(row[1]) });
        }
      });
      if (productsToUpsert.length === 0) return alert('Excel 格式錯誤或無資料');
      const { error } = await supabase.from('products').upsert(productsToUpsert, { onConflict: 'store_id, name' });
      if (error) alert('匯入失敗:' + error.message);
      else {
        alert(`✅ 匯入完成`);
        fetchMenu(editingStore.id);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">🛠️ 後台資料管理</h1>

        {/* 新增/更新區塊 */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-8">
          <h2 className="text-xl font-bold mb-4 text-gray-700">➕ 新增 / 更新店家</h2>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-bold text-gray-600 mb-1">店名 (必填)</label>
              <input 
                placeholder="例如: 悟饕池上便當" 
                value={newStoreName}
                onChange={e => setNewStoreName(e.target.value)}
                className="border border-gray-300 p-2 rounded h-10 w-full text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none" 
              />
            </div>
            <div className="flex-1 w-full">
              <label className="block text-sm font-bold text-gray-600 mb-1">店家電話 (選填)</label>
              <input 
                placeholder="例如: 02-12345678" 
                value={newStorePhone}
                onChange={e => setNewStorePhone(e.target.value)}
                className="border border-gray-300 p-2 rounded h-10 w-full text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none" 
              />
            </div>
            <div className="flex-1 w-full">
              <label className="block text-sm font-bold text-gray-600 mb-1">店家圖片</label>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="text-xs w-full mb-1" />
              {newStoreImage && <p className="text-xs text-green-600">✅ 圖片已就緒</p>}
            </div>
            <button 
              onClick={handleAddStore} 
              disabled={uploading} 
              className="px-6 h-10 rounded text-white font-bold bg-blue-600 hover:bg-blue-700 transition active:scale-95 disabled:bg-gray-400"
            >
              {uploading ? '上傳中...' : '儲存'}
            </button>
          </div>
        </div>

        {/* 店家清單 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map(store => (
            <div key={store.id} className="bg-white p-5 rounded-xl shadow border border-gray-200 hover:shadow-lg transition">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                   {store.image_url ? (
                     <img src={store.image_url} alt={store.name} className="w-full h-full object-cover" />
                   ) : (
                     <span className="flex items-center justify-center h-full text-gray-400 text-[10px]">無圖片</span>
                   )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <h3 className="text-lg font-bold text-gray-800 truncate">{store.name}</h3>
                  {/* ★ 重點：後台顯示電話號碼 */}
                  <div className="flex items-center gap-1 text-sm">
                    <span>📞</span>
                    {store.phone ? (
                      <span className="text-blue-600 font-semibold">{store.phone}</span>
                    ) : (
                      <span className="text-gray-400 italic">尚未設定電話</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-between gap-2">
                <button 
                  onClick={() => openEditModal(store)} 
                  className="flex-1 bg-green-50 text-green-700 py-2 rounded-lg hover:bg-green-100 font-bold transition"
                >
                  📝 管理菜單
                </button>
                <button 
                  onClick={() => handleDeleteStore(store.id, store.name, store.image_url)} 
                  className="bg-red-50 text-red-600 px-4 rounded-lg hover:bg-red-100 transition"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 菜單編輯 Modal (維持不變) */}
      {editingStore && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">正在編輯：{editingStore.name}</h2>
              <button onClick={closeEditModal} className="text-gray-400 hover:text-white text-2xl">×</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <label className="font-bold text-blue-800 block mb-2">批次匯入 / 更新 (Excel)</label>
                <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="text-sm" />
              </div>
              <div className="flex gap-2 mb-6 border-b pb-6">
                <input placeholder="品項名稱" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="border border-gray-300 p-2 rounded flex-1 text-gray-900 font-medium" />
                <input type="number" placeholder="價格" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} className="border border-gray-300 p-2 rounded w-24 text-gray-900 font-medium" />
                <button onClick={handleAddSingleItem} className="bg-orange-500 text-white px-4 rounded hover:bg-orange-600">＋ 新增</button>
              </div>
              <table className="w-full text-left">
                <thead className="bg-gray-100 text-gray-500 text-sm">
                  <tr><th className="p-2 pl-4">品項</th><th className="p-2 w-24">價格</th><th className="p-2 w-10"></th></tr>
                </thead>
                <tbody className="divide-y">
                  {menuItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-2 pl-4 text-gray-800 font-medium">{item.name}</td>
                      <td className="p-2"><input type="number" defaultValue={item.price} onBlur={(e) => handleUpdatePrice(item.id, parseInt(e.target.value))} className="border border-gray-300 rounded w-20 px-2 py-1 text-center text-gray-900 font-bold"/></td>
                      <td className="p-2 text-right"><button onClick={() => handleDeleteItem(item.id)} className="text-red-400 hover:text-red-600 px-2">×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t bg-gray-50 text-right"><button onClick={closeEditModal} className="bg-gray-300 text-gray-700 px-6 py-2 rounded">關閉</button></div>
          </div>
        </div>
      )}
    </div>
  );
}