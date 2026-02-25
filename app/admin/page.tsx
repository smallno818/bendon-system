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
    const { data: existingStore } = await supabase.from('stores').select('*').eq('name', newStoreName.trim()).single();
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
    }
  };

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

  const openEditModal = async (store: Store) => {
    setEditingStore(store);
    fetchMenu(store.id);
  };

  const fetchMenu = async (storeId: number) => {
    const { data } = await supabase.from('products').select('*').eq('store_id', storeId).order('id', { ascending: true });
    if (data) setMenuItems(data);
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
        if (row[0] && row[1]) productsToUpsert.push({ store_id: editingStore.id, name: row[0], price: parseInt(row[1]) });
      });
      await supabase.from('products').upsert(productsToUpsert, { onConflict: 'store_id, name' });
      alert('✅ 匯入成功');
      fetchMenu(editingStore.id);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 text-gray-900">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🛠️ 後台資料管理</h1>

        {/* 店家新增區塊 */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-8 border border-gray-200">
          <h2 className="text-xl font-bold mb-4 text-gray-700">➕ 新增 / 更新店家</h2>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-bold text-gray-700 mb-1">店名</label>
              <input value={newStoreName} onChange={e => setNewStoreName(e.target.value)} className="border border-gray-300 p-2 rounded h-10 w-full font-medium" />
            </div>
            <div className="flex-1 w-full">
              <label className="block text-sm font-bold text-gray-700 mb-1">電話</label>
              <input value={newStorePhone} onChange={e => setNewStorePhone(e.target.value)} className="border border-gray-300 p-2 rounded h-10 w-full font-medium" />
            </div>
            
            {/* ★ 修正後的圖片上傳按鈕：變成大大的藍色按鈕 */}
            <div className="flex-1 w-full">
              <label className="block text-sm font-bold text-gray-700 mb-1">店家圖片</label>
              <label className="flex items-center justify-center h-10 px-4 bg-blue-50 text-blue-700 border border-blue-200 rounded cursor-pointer hover:bg-blue-100 font-bold transition">
                <span>{uploading ? '上傳中...' : '📁 選擇圖片'}</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>

            <button onClick={handleAddStore} className="px-8 h-10 rounded text-white font-bold bg-blue-600 hover:bg-blue-700 shadow-md transition">儲存店家</button>
          </div>
          {newStoreImage && <div className="mt-4 w-24 h-24 border rounded overflow-hidden"><img src={newStoreImage} className="w-full h-full object-cover" /></div>}
        </div>

        {/* 店家列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map(store => (
            <div key={store.id} className="bg-white p-5 rounded-xl shadow border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 bg-gray-100 rounded border flex-shrink-0">{store.image_url && <img src={store.image_url} className="w-full h-full object-cover" />}</div>
                <div className="overflow-hidden">
                  <h3 className="font-bold truncate">{store.name}</h3>
                  <p className="text-xs text-blue-600 font-bold">{store.phone || '無電話'}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEditModal(store)} className="flex-1 bg-green-600 text-white py-2 rounded font-bold hover:bg-green-700">管理菜單</button>
                <button onClick={() => handleDeleteStore(store.id, store.name, store.image_url)} className="bg-red-50 text-red-600 px-3 rounded hover:bg-red-100">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 菜單 Modal */}
      {editingStore && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">編輯菜單：{editingStore.name}</h2>
              <button onClick={() => setEditingStore(null)} className="text-2xl">×</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              
              {/* ★ 修正後的 Excel 匯入區塊：使用顯眼的按鈕設計 */}
              <div className="mb-8 p-4 bg-green-50 rounded-xl border border-green-200">
                <h3 className="font-bold text-green-800 mb-2 flex items-center gap-2">📊 批次匯入菜單 (Excel)</h3>
                <label className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg cursor-pointer hover:bg-green-700 shadow-md font-bold transition">
                  <span>📂 點擊選擇 Excel 檔案</span>
                  <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="hidden" />
                </label>
                <p className="text-xs text-green-600 mt-2">* 格式要求：第一欄為品項名稱，第二欄為價格</p>
              </div>

              {/* 手動新增 */}
              <div className="flex gap-2 mb-6 border-b pb-6">
                <input placeholder="品項名稱" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="border p-2 rounded flex-1 font-medium" />
                <input placeholder="價格" type="number" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} className="border p-2 rounded w-24 font-bold text-blue-600" />
                <button onClick={async () => {
                  if(!newItemName || !newItemPrice) return;
                  await supabase.from('products').insert([{ store_id: editingStore.id, name: newItemName, price: parseInt(newItemPrice) }]);
                  setNewItemName(''); setNewItemPrice(''); fetchMenu(editingStore.id);
                }} className="bg-orange-500 text-white px-4 rounded font-bold">＋</button>
              </div>

              {/* 菜單列表 */}
              <table className="w-full text-left">
                <thead className="bg-gray-100 text-gray-700">
                  <tr><th className="p-3">品項</th><th className="p-3 w-28">價格</th><th className="p-3 w-12"></th></tr>
                </thead>
                <tbody className="divide-y">
                  {menuItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3 font-medium">{item.name}</td>
                      <td className="p-3 font-bold text-blue-600">${item.price}</td>
                      <td className="p-3"><button onClick={async () => { await supabase.from('products').delete().eq('id', item.id); fetchMenu(editingStore.id); }} className="text-red-400 text-xl">×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t text-right bg-gray-50 rounded-b-2xl"><button onClick={() => setEditingStore(null)} className="px-6 py-2 bg-gray-400 text-white rounded-lg font-bold">關閉視窗</button></div>
          </div>
        </div>
      )}
    </div>
  );
}