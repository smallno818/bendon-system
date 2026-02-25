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
  const [newStoreName, setNewStoreName] = useState('');
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
    
    // ★ 修正 1：不管選了什麼，先重置 input 的值
    // 這樣如果你上傳失敗，再次選擇同一個檔案時，才會觸發 onChange
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

  // 在原本的 handleAddStore 附近修改
const [newStorePhone, setNewStorePhone] = useState(''); // 新增狀態

// 修改 handleAddStore 函數
const handleAddStore = async () => {
  if (!newStoreName.trim()) return alert('請輸入店名');
  
  const { error } = await supabase
    .from('stores')
    .upsert([
      { 
        name: newStoreName, 
        image_url: newStoreImage,
        phone: newStorePhone // 儲存電話
      }
    ], { onConflict: 'name' }) 
    .select();

  if (!error) {
    alert('✅ 店家資訊已儲存');
    setNewStoreName('');
    setNewStoreImage('');
    setNewStorePhone(''); // 清空
    fetchStores();
  } else {
    alert('❌ 儲存失敗: ' + error.message);
  }
};

// UI 部分在輸入店名的旁邊加入：
<input 
  placeholder="店家電話 (選填)" 
  value={newStorePhone}
  onChange={e => setNewStorePhone(e.target.value)}
  className="border border-gray-300 p-2 rounded h-10 flex-1 w-full text-gray-900 placeholder-gray-500 font-medium" 
/>

  // ★ 修正 2：增加 imageUrl 參數，用來刪除雲端圖片
  const handleDeleteStore = async (id: number, name: string, imageUrl: string | null) => {
    const confirm = window.confirm(`確定要刪除「${name}」嗎？\n這會刪除該店家的所有資料與圖片！`);
    if (!confirm) return;

    try {
      // A. 先刪除關聯資料 (菜單 & 每日狀態)
      await supabase.from('products').delete().eq('store_id', id);
      await supabase.from('daily_status').delete().eq('active_store_id', id);

      // B. ★ 新增：刪除雲端圖片 (如果有的話)
      if (imageUrl) {
        // 從網址中解析出檔案名稱
        // 範例網址: .../stores_picture/170988888.png
        // 我們只需要最後面的 "170988888.png"
        const fileName = imageUrl.split('/').pop();
        if (fileName) {
          const { error: storageError } = await supabase.storage
            .from('stores_picture')
            .remove([fileName]);
            
          if (storageError) {
            console.error('圖片刪除失敗，但將繼續刪除店家資料:', storageError);
          }
        }
      }

      // C. 最後刪除店家紀錄
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

  // --- 菜單管理功能 (Modal 內) ---

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
    } else {
      alert('新增失敗: ' + error.message);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!window.confirm('確定刪除此品項？')) return;
    const { error } = await supabase.from('products').delete().eq('id', itemId);
    if (!error && editingStore) fetchMenu(editingStore.id);
  };

  const handleUpdatePrice = async (itemId: number, newPrice: number) => {
    const { error } = await supabase.from('products').update({ price: newPrice }).eq('id', itemId);
    if (error) alert('更新失敗');
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 這裡原本就有，不用改
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
           productsToUpsert.push({
             store_id: editingStore.id,
             name: row[0],
             price: parseInt(row[1])
           });
        }
      });

      if (productsToUpsert.length === 0) return alert('Excel 格式錯誤或無資料');

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
          <h2 className="text-xl font-bold mb-4 text-gray-700">➕ 新增 / 更新店家</h2>
          <p className="text-sm text-gray-500 mb-4">💡 提示：如果輸入相同的店名，將會更新該店家的圖片。</p>
          <div className="flex flex-col md:flex-row gap-4 items-start">
            <input 
              placeholder="店名 (例如: 悟饕池上便當)" 
              value={newStoreName}
              onChange={e => setNewStoreName(e.target.value)}
              className="border border-gray-300 p-2 rounded h-10 flex-1 w-full text-gray-900 placeholder-gray-500 font-medium" 
            />
            
            <div className="flex-1 w-full">
              <label className="block text-sm font-bold text-gray-700 mb-1">
                店家圖片 {uploading && <span className="text-orange-500">(上傳中...)</span>}
              </label>
              <input 
                type="file" 
                accept="image/*"
                onChange={handleImageUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {newStoreImage && (
                <p className="text-xs text-green-600 mt-1">✅ 圖片已就緒</p>
              )}
            </div>

            <button 
              onClick={handleAddStore} 
              disabled={uploading}
              className={`px-6 h-10 rounded text-white font-bold transition ${uploading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {uploading ? '處理中' : '儲存'}
            </button>
          </div>
          
          {newStoreImage && (
             <div className="mt-4 w-32 h-32 bg-gray-100 rounded overflow-hidden border">
               <img src={newStoreImage} alt="預覽" className="w-full h-full object-cover" />
             </div>
          )}
        </div>

        {/* 店家列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map(store => (
            <div key={store.id} className="bg-white p-5 rounded-xl shadow hover:shadow-lg transition border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-16 h-16 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                   {store.image_url ? (
                     <img src={store.image_url} alt={store.name} className="w-full h-full object-cover" />
                   ) : (
                     <span className="flex items-center justify-center h-full text-gray-400 text-xs">無圖</span>
                   )}
                </div>
                <h3 className="text-lg font-bold truncate text-gray-800">{store.name}</h3>
              </div>
              <div className="flex justify-between gap-2">
                <button 
                  onClick={() => openEditModal(store)}
                  className="flex-1 bg-green-50 text-green-700 py-2 rounded-lg hover:bg-green-100 font-medium"
                >
                  📝 管理菜單
                </button>
                <button 
                  // ★ 修正 3：這裡呼叫時多傳了 store.image_url，讓刪除功能知道要刪哪張圖
                  onClick={() => handleDeleteStore(store.id, store.name, store.image_url)}
                  className="bg-red-50 text-red-600 px-3 rounded-lg hover:bg-red-100"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 編輯菜單 Modal (無變動，保持原樣) */}
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
                <div className="flex items-center gap-2">
                  <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700" />
                </div>
              </div>
              <div className="flex gap-2 mb-6 border-b pb-6">
                <input placeholder="品項名稱" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="border border-gray-300 p-2 rounded flex-1 text-gray-900 placeholder-gray-500 font-medium" />
                <input type="number" placeholder="價格" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} className="border border-gray-300 p-2 rounded w-24 text-gray-900 placeholder-gray-500 font-medium" />
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
                      <td className="p-2"><input type="number" defaultValue={item.price} onBlur={(e) => handleUpdatePrice(item.id, parseInt(e.target.value))} className="border border-gray-300 rounded w-20 px-2 py-1 text-center focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-bold"/></td>
                      <td className="p-2 text-right"><button onClick={() => handleDeleteItem(item.id)} className="text-red-400 hover:text-red-600 px-2">×</button></td>
                    </tr>
                  ))}
                  {menuItems.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-gray-400">目前沒有菜單</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t bg-gray-50 text-right"><button onClick={closeEditModal} className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400">關閉</button></div>
          </div>
        </div>
      )}
    </div>
  );
}