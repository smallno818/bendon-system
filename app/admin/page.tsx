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
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10">
          <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">後台管理中心</h1>
          <p className="text-slate-500 mt-2 font-medium">管理您的店家資訊與菜單清單</p>
        </header>

        {/* 店家新增區塊 */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mb-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-6 bg-indigo-500 rounded-full"></div>
            <h2 className="text-xl font-bold text-slate-700">店家維護</h2>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-5 items-end">
            <div className="flex-[2] w-full space-y-1.5">
              <label className="text-sm font-bold text-slate-600 ml-1">店家名稱</label>
              <input value={newStoreName} onChange={e => setNewStoreName(e.target.value)} placeholder="必填，如：麥當勞" className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium" />
            </div>
            
            <div className="flex-[1.5] w-full space-y-1.5">
              <label className="text-sm font-bold text-slate-600 ml-1">聯絡電話</label>
              <input value={newStorePhone} onChange={e => setNewStorePhone(e.target.value)} placeholder="選填" className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium" />
            </div>
            
            {/* ★ 精緻化的圖片上傳按鈕 */}
            <div className="flex-1 w-full space-y-1.5">
              <label className="text-sm font-bold text-slate-600 ml-1">店家圖示</label>
              <label className="flex items-center justify-center gap-2 h-11 w-full bg-white border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all group">
                <span className="text-slate-400 group-hover:text-indigo-500 transition-colors">
                  {uploading ? '⏳' : '📷'}
                </span>
                <span className="text-sm font-bold text-slate-500 group-hover:text-indigo-600">
                  {uploading ? '處理中' : '選擇照片'}
                </span>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>

            <button onClick={handleAddStore} className="w-full lg:w-auto px-8 h-11 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 transition-all active:scale-95">
              儲存更新
            </button>
          </div>
          
          {newStoreImage && (
            <div className="mt-6 flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 w-fit">
              <div className="w-16 h-16 rounded-xl overflow-hidden shadow-inner">
                <img src={newStoreImage} className="w-full h-full object-cover" />
              </div>
              <p className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-md">圖片已上傳成功</p>
            </div>
          )}
        </div>

        {/* 店家列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map(store => (
            <div key={store.id} className="group bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden border border-slate-100 shadow-inner group-hover:scale-110 transition-transform">
                  {store.image_url ? <img src={store.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">NO IMAGE</div>}
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-bold text-slate-800 truncate text-lg">{store.name}</h3>
                  <p className="text-sm text-indigo-500 font-bold">{store.phone || '尚未提供電話'}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => openEditModal(store)} className="flex-[3] bg-slate-900 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-600 shadow-md transition-all">
                  編輯菜單
                </button>
                <button onClick={() => handleDeleteStore(store.id, store.name, store.image_url)} className="flex-1 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all">
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 菜單 Modal */}
      {editingStore && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-6 z-50 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-white/20">
            <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-slate-800">{editingStore.name}</h2>
                <p className="text-xs text-slate-400 font-bold mt-0.5 uppercase tracking-widest">Menu Management</p>
              </div>
              <button onClick={() => setEditingStore(null)} className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm text-slate-400 hover:text-rose-500 transition-colors text-2xl">×</button>
            </div>
            
            <div className="p-8 overflow-y-auto flex-1">
              {/* ★ 精緻化的 Excel 匯入按鈕 */}
              <div className="mb-10 p-6 bg-indigo-50/50 rounded-2xl border-2 border-dashed border-indigo-100 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-2xl mb-3">📁</div>
                <h3 className="font-bold text-indigo-900">批次匯入菜單</h3>
                <p className="text-xs text-indigo-400 mt-1 mb-4">支援 .xlsx, .xls 格式，自動更新現有品項</p>
                <label className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl cursor-pointer hover:bg-indigo-700 shadow-lg shadow-indigo-200 font-bold transition-all active:scale-95">
                  選擇檔案
                  <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="hidden" />
                </label>
              </div>

              <div className="space-y-4 mb-8">
                <p className="text-sm font-black text-slate-700 ml-1">手動新增品項</p>
                <div className="flex gap-3">
                  <input placeholder="品項名稱" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="flex-1 h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium" />
                  <input placeholder="價格" type="number" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} className="w-24 h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-600" />
                  <button onClick={async () => {
                    if(!newItemName || !newItemPrice) return;
                    await supabase.from('products').insert([{ store_id: editingStore.id, name: newItemName, price: parseInt(newItemPrice) }]);
                    setNewItemName(''); setNewItemPrice(''); fetchMenu(editingStore.id);
                  }} className="w-11 h-11 flex items-center justify-center bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">＋</button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                    <tr><th className="p-4">Item Name</th><th className="p-4 w-28">Price</th><th className="p-4 w-12"></th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {menuItems.map(item => (
                      <tr key={item.id} className="group hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-bold text-slate-700">{item.name}</td>
                        <td className="p-4 font-black text-indigo-600">${item.price}</td>
                        <td className="p-4"><button onClick={async () => { await supabase.from('products').delete().eq('id', item.id); fetchMenu(editingStore.id); }} className="text-slate-300 hover:text-rose-500 transition-colors text-xl">×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button onClick={() => setEditingStore(null)} className="px-8 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-all shadow-sm">完成並關閉</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}