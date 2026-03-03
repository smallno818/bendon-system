import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

type Product = {
  id: number;
  name: string;
  price: number;
  description: string | null;
};

type Props = {
  storeId: number; // ★ 新增：明確傳入店家 ID
  storeName: string;
  menuItems: Product[];
  newItemName: string;
  newItemPrice: string;
  newItemDescription: string;
  onClose: () => void;
  onExcelUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNameChange: (val: string) => void;
  onPriceChange: (val: string) => void;
  onDescriptionChange: (val: string) => void;
  onAddItem: () => void;
  onDeleteItem: (id: number) => void;
  onUpdateItem: (id: number, field: 'price' | 'description', value: string | number) => void;
};

export function EditMenuModal({
  storeId, storeName, menuItems, newItemName, newItemPrice, newItemDescription,
  onClose, onExcelUpload, onNameChange, onPriceChange, onDescriptionChange,
  onAddItem, onDeleteItem, onUpdateItem
}: Props) {
  
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiPreviewItems, setAiPreviewItems] = useState<any[] | null>(null); // ★ 新增：預覽清單狀態

  // 1. 處理 AI 辨識圖片上傳 (只負責辨識，不存資料庫)
  const handleAiMenuUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; 
    if (!file) return;

    setIsAiLoading(true);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        const base64Data = reader.result?.toString().split(',')[1];
        
        const response = await fetch('/api/extract-menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Image: base64Data, mimeType: file.type })
        });

        const result = await response.json();

        if (!response.ok) throw new Error(result.error);

        if (result.menu && Array.isArray(result.menu)) {
          // 將 AI 吐出來的結果放進「預覽狀態」中
          setAiPreviewItems(result.menu);
        }
        setIsAiLoading(false);
      };
      
    } catch (error: any) {
      alert('AI 辨識發生錯誤: ' + error.message);
      setIsAiLoading(false);
    }
  };

  // 2. 使用者確認無誤後，正式寫入資料庫
  const handleConfirmAiImport = async () => {
    if (!aiPreviewItems) return;
    setIsAiLoading(true);

    try {
      // 這裡直接使用正確的 storeId
      const productsToUpsert = aiPreviewItems.map((item: any) => ({
        store_id: storeId,
        name: item.name,
        price: Number(item.price),
        description: item.description || null
      }));

      const { error } = await supabase.from('products').upsert(productsToUpsert, { onConflict: 'store_id, name' });
      
      if (error) throw error;

      alert(`✅ 成功匯入 ${productsToUpsert.length} 筆品項！請關閉視窗後重新開啟以載入最新菜單。`);
      setAiPreviewItems(null); // 清空預覽，回到原本畫面
      onClose(); // 匯入成功後自動關閉視窗，讓管理員重開刷新

    } catch (error: any) {
      alert('存入資料庫失敗: ' + error.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
        
        {/* 標題與操作區 */}
        <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <span className="bg-indigo-100 text-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center text-lg">📝</span>
            {aiPreviewItems ? '👀 預覽 AI 辨識結果' : `編輯菜單：${storeName}`}
          </h2>
          <div className="flex gap-2">
            {!aiPreviewItems && (
              <>
                {/* ★ 原始狀態下的按鈕 */}
                <label className={`cursor-pointer px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2 border 
                  ${isAiLoading ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-600 hover:text-white'}`}>
                  <span>{isAiLoading ? '✨ 努力辨識中...' : '✨ AI 圖片辨識'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleAiMenuUpload} disabled={isAiLoading} />
                </label>
                <label className="cursor-pointer bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all flex items-center gap-2">
                  <span>📊 匯入 Excel</span>
                  <input type="file" accept=".xlsx,.csv" className="hidden" onChange={onExcelUpload} />
                </label>
              </>
            )}
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-200 text-slate-500 hover:bg-rose-500 hover:text-white transition-all font-bold">✕</button>
          </div>
        </div>

        {/* 內容區：根據是否有預覽資料，切換顯示畫面 */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          
          {aiPreviewItems ? (
            /* ================= AI 預覽畫面 ================= */
            <div className="animate-fadeIn">
              <div className="bg-amber-50 text-amber-800 border border-amber-200 p-4 rounded-xl mb-4 font-bold flex items-center gap-2">
                <span>⚠️</span> 這是 AI 辨識的結果，尚未存入資料庫！請確認品項與價格是否正確。
              </div>
              
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-4">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                      <th className="p-4 font-bold">辨識出的品項</th>
                      <th className="p-4 font-bold">價格</th>
                      <th className="p-4 font-bold">備註</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiPreviewItems.map((item, index) => (
                      <tr key={index} className="border-b border-slate-100">
                        <td className="p-4 font-bold text-slate-700">{item.name}</td>
                        <td className="p-4 text-indigo-600 font-bold">${item.price}</td>
                        <td className="p-4 text-slate-500 text-sm">{item.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => setAiPreviewItems(null)} className="px-6 py-3 rounded-xl bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 transition-all">重新辨識 (取消)</button>
                <button onClick={handleConfirmAiImport} disabled={isAiLoading} className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-md disabled:bg-indigo-300">
                  {isAiLoading ? '寫入中...' : '✅ 確認無誤，加入資料庫'}
                </button>
              </div>
            </div>
          ) : (
            /* ================= 原始編輯菜單畫面 ================= */
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                    <th className="p-4 font-bold">品項名稱</th>
                    <th className="p-4 font-bold w-32">價格</th>
                    <th className="p-4 font-bold">備註 (隱藏欄位)</th>
                    <th className="p-4 font-bold w-20 text-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {menuItems.map(item => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 group transition-colors">
                      <td className="p-4 font-bold text-slate-700">{item.name}</td>
                      <td className="p-4">
                        <div className="relative flex items-center">
                          <span className="absolute left-3 text-slate-400 font-bold">$</span>
                          <input type="number" defaultValue={item.price} onBlur={(e) => onUpdateItem(item.id, 'price', parseFloat(e.target.value))} className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-bold text-slate-700" />
                        </div>
                      </td>
                      <td className="p-4">
                        <input type="text" defaultValue={item.description || ''} placeholder="可留空" onBlur={(e) => onUpdateItem(item.id, 'description', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm text-slate-600" />
                      </td>
                      <td className="p-4 text-center">
                        <button onClick={() => onDeleteItem(item.id)} className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-sm">🗑️</button>
                      </td>
                    </tr>
                  ))}
                  {menuItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 font-bold bg-slate-50 border-b border-slate-100">
                        目前沒有任何菜單，請從下方手動新增，或使用 Excel / AI 圖片匯入
                      </td>
                    </tr>
                  )}
                  
                  {/* 新增區塊固定在最後一列 */}
                  <tr className="bg-indigo-50/30">
                    <td className="p-4">
                      <input type="text" placeholder="輸入新餐點名稱..." value={newItemName} onChange={e => onNameChange(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold placeholder-indigo-300" />
                    </td>
                    <td className="p-4">
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-indigo-400 font-bold">$</span>
                        <input type="number" placeholder="金額" value={newItemPrice} onChange={e => onPriceChange(e.target.value)} className="w-full pl-7 pr-3 py-2.5 bg-white border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold placeholder-indigo-300" />
                      </div>
                    </td>
                    <td className="p-4">
                      <input type="text" placeholder="備註 (選填)" value={newItemDescription} onChange={e => onDescriptionChange(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm placeholder-indigo-300" />
                    </td>
                    <td className="p-4 text-center">
                      <button onClick={onAddItem} disabled={!newItemName || !newItemPrice} className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:bg-indigo-200 disabled:cursor-not-allowed transition-all shadow-md">新增</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}