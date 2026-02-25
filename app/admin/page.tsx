'use client';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

// 定義資料型別
type Store = {
  id: number;
  name: string;
  image_url: string | null;
};

type Product = {
  id: number;
  store_id: number;
  name: string;
  price: number;
};

export default function AdminPage() {
  const [stores, setStores] = useState<Store[]>([]);
  // 新增店家用的狀態
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreImage, setNewStoreImage] = useState('');
  
  // 編輯菜單用的狀態 (Modal)
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [menuItems, setMenuItems] = useState<Product[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStores();
  }, []);

  // --- 基礎店家功能 ---

  const fetchStores = async () => {
    setLoading(true);
    const { data } = await supabase.from('stores').select('*').order('id', { ascending: true });
    if (data) setStores(data);
    setLoading(false);
  };

  const handleAddStore = async () => {
    if (!newStoreName.trim()) return alert('請輸入店名');
    const { error } = await supabase.from('stores').insert([{ name: newStoreName, image_url: newStoreImage }]);
    if (!error) {
      alert('✅ 店家新增成功');
      setNewStoreName('');
      setNewStoreImage('');
      fetchStores();
    } else {
      alert('❌ 新增失敗: ' + error.message);
    }
  };

  const handleDeleteStore = async (id: number, name: string) => {
    if (!window.confirm(`確定要刪除「${name}」嗎？這會連同菜單一起刪除！`)) return;
    await supabase.from('products').delete().eq('store_id', id);
    const { error } = await supabase.from('stores').delete().eq('id', id);
    if (!error) fetchStores();
    else alert('刪除失敗: ' + error.message);
  };

  // --- 菜單管理功能 (Modal 內) ---

  // 開啟編輯視窗
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

  // 1. 網頁單筆新增
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
      fetchMenu(editingStore.id); // 重新抓取顯示
    } else {
      alert('新增失敗 (可能是名稱重複): ' + error.message);
    }
  };

  // 2. 網頁單筆刪除
  const handleDeleteItem = async (itemId: number) => {
    if (!window.confirm('確定刪除此品項？')) return;
    const { error } = await supabase.from('products').delete().eq('id', itemId);
    if (!error && editingStore) fetchMenu(editingStore.id);
  };

  // 3. 網頁單筆修改價格 (失去焦點時觸發)
  const handleUpdatePrice = async (itemId: number, newPrice: number) => {
    const { error } = await supabase.from('products').update({ price: newPrice }).eq('id', itemId);
    if (error) alert('更新失敗');
  };

  // 4. Excel 匯入 (Upsert: 新增或更新)
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingStore) return;
    e.target.value = ''; // 重置 input

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const rawData: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wsname], { header: 1 });
      
      const productsToUpsert: any[] = [];
      rawData.forEach((row) => {
        if (row[0] && row[1] && (typeof row[1] === 'number' || !isNaN(parseInt(row[1])))) {
           productsToUpsert.push({
             store_id: editingStore.id,
             name: row[0],
             price: parseInt(row[1])
           });
        }
      });

      if (productsToUpsert.length === 0) return alert('Excel 格式錯誤或無資料');

      // 使用 upsert，並指定 onConflict 為 store_id, name
      // 這代表：如果 (store_id + name) 相同，就更新 price；如果不同，就 insert
      const { error } = await supabase
        .from('products')
        .upsert(productsToUpsert, { onConflict: 'store_id, name' });
      
      if (error) alert('匯入失敗:' + error.message);
      else {
        alert(`✅ 處理完成！新增/更新了 ${productsToUpsert.length} 筆資料`);
        fetchMenu(editingStore.id);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">🛠️ 後台資料管理</h1>

        {/* 新增店家區塊 */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-8">
          <h2 className="text-xl font-bold mb-4 text-gray-700">➕ 新增店家</h2>
          <div className="flex gap-4">
            <input placeholder="店名" value={newStoreName} onChange={e => setNewStoreName(e.target.value)} className="border p-2 rounded flex-1" />
            <input placeholder="圖片網址" value={newStoreImage} onChange={e => setNewStoreImage(e.target.value)} className="border p-2 rounded flex-1" />
            <button onClick={handleAddStore} className="bg-blue-600 text-white px-6 rounded hover:bg-blue-700">新增</button>
          </div>
        </div>

        {/* 店家列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map(store => (
            <div key={store.id} className="bg-white p-5 rounded-xl shadow hover:shadow-lg transition border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden">
                   {store.image_url && <img src={store.image_url} className="w-full h-full object-cover" />}
                </div>
                <h3 className="text-lg font-bold">{store.name}</h3>
              </div>
              <div className="flex justify-between gap-2">
                <button 
                  onClick={() => openEditModal(store)}
                  className="flex-1 bg-green-50 text-green-700 py-2 rounded-lg hover:bg-green-100 font-medium"
                >
                  📝 管理菜單
                </button>
                <button 
                  onClick={() => handleDeleteStore(store.id, store.name)}
                  className="bg-red-50 text-red-600 px-3 rounded-lg hover:bg-red-100"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 編輯菜單 Modal (彈出視窗) */}
      {editingStore && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">正在編輯：{editingStore.name}</h2>
              <button onClick={closeEditModal} className="text-gray-400 hover:text-white text-2xl">×</button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              
              {/* 1. Excel 匯入區 */}
              <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <label className="font-bold text-blue-800 block mb-2">批次匯入 / 更新 (Excel)</label>
                <div className="flex items-center gap-2">
                  <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700" />
                  <span className="text-xs text-blue-600">若菜名相同會自動更新價格</span>
                </div>
              </div>

              {/* 2. 手動新增區 */}
              <div className="flex gap-2 mb-6 border-b pb-6">
                <input placeholder="品項名稱" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="border p-2 rounded flex-1" />
                <input type="number" placeholder="價格" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} className="border p-2 rounded w-24" />
                <button onClick={handleAddSingleItem} className="bg-orange-500 text-white px-4 rounded hover:bg-orange-600">＋ 新增</button>
              </div>

              {/* 3. 菜單列表 (可編輯) */}
              <table className="w-full text-left">
                <thead className="bg-gray-100 text-gray-500 text-sm">
                  <tr>
                    <th className="p-2 pl-4">品項</th>
                    <th className="p-2 w-24">價格</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {menuItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-2 pl-4">{item.name}</td>
                      <td className="p-2">
                        <input 
                          type="number" 
                          defaultValue={item.price}
                          onBlur={(e) => handleUpdatePrice(item.id, parseInt(e.target.value))}
                          className="border rounded w-20 px-2 py-1 text-center focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <button onClick={() => handleDeleteItem(item.id)} className="text-red-400 hover:text-red-600 px-2">×</button>
                      </td>
                    </tr>
                  ))}
                  {menuItems.length === 0 && (
                    <tr><td colSpan={3} className="p-4 text-center text-gray-400">目前沒有菜單</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t bg-gray-50 text-right">
              <button onClick={closeEditModal} className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400">關閉</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}