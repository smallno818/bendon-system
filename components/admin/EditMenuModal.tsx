import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

type Product = {
  id: number;
  name: string;
  price: number;
  description: string | null;
};

type Props = {
  storeId: number;
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
  onRefresh: () => Promise<void>; // ★ 新增：重新抓取資料的函式
};

export function EditMenuModal({
  storeId, storeName, menuItems, newItemName, newItemPrice, newItemDescription,
  onClose, onExcelUpload, onNameChange, onPriceChange, onDescriptionChange,
  onAddItem, onDeleteItem, onUpdateItem, onRefresh
}: Props) {
  
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiPreviewItems, setAiPreviewItems] = useState<any[] | null>(null);

  const handleAiMenuUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; 
    if (!file) return;
    setIsAiLoading(true);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64Data = reader.result?.toString().split(',')[1];
        const response = await fetch('/api/extract-menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Image: base64Data, mimeType: file.type })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (result.menu) setAiPreviewItems(result.menu);
      } catch (error: any) {
        alert('AI 辨識失敗: ' + error.message);
      } finally {
        setIsAiLoading(false);
      }
    };
  };

  const handleConfirmAiImport = async () => {
    if (!aiPreviewItems) return;
    setIsAiLoading(true);
    try {
      const productsToUpsert = aiPreviewItems.map((item: any) => ({
        store_id: storeId,
        name: item.name,
        price: Number(item.price),
        description: item.description || null
      }));

      const { error } = await supabase.from('products').upsert(productsToUpsert, { onConflict: 'store_id, name' });
      if (error) throw error;

      // ★ 核心修正：先執行重新抓取資料，再清空預覽，使用者就不用重開視窗了
      await onRefresh(); 
      alert(`✅ 成功匯入 ${productsToUpsert.length} 筆品項！`);
      setAiPreviewItems(null); 

    } catch (error: any) {
      alert('存入資料庫失敗: ' + error.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
        <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <span className="bg-indigo-100 text-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center text-lg">📝</span>
            {aiPreviewItems ? '👀 預覽 AI 辨識結果' : `編輯菜單：${storeName}`}
          </h2>
          <div className="flex gap-2">
            {!aiPreviewItems && (
              <>
                <label className={`cursor-pointer px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2 border 
                  ${isAiLoading ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-600 hover:text-white'}`}>
                  <span>{isAiLoading ? '✨ 辨識中...' : '✨ AI 圖片辨識'}</span>
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

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          {aiPreviewItems ? (
            <div className="animate-fadeIn">
              <div className="bg-amber-50 text-amber-800 border border-amber-200 p-4 rounded-xl mb-4 font-bold">⚠️ 這是預覽結果，尚未存入資料庫！</div>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-4">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b text-slate-500 text-sm">
                      <th className="p-4">品項</th>
                      <th className="p-4">價格</th>
                      <th className="p-4">備註</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiPreviewItems.map((item, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="p-4 font-bold">{item.name}</td>
                        <td className="p-4 text-indigo-600">${item.price}</td>
                        <td className="p-4 text-slate-500 text-sm">{item.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setAiPreviewItems(null)} className="px-6 py-3 rounded-xl bg-slate-200 font-bold">取消</button>
                <button onClick={handleConfirmAiImport} disabled={isAiLoading} className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold">確認加入</button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                    <th className="p-4 font-bold">品項名稱</th>
                    <th className="p-4 font-bold w-32">價格</th>
                    <th className="p-4 font-bold">備註</th>
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
                          <input key={`price-${item.price}`} type="number" defaultValue={item.price} onBlur={(e) => onUpdateItem(item.id, 'price', parseFloat(e.target.value))} className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold text-slate-700" />
                        </div>
                      </td>
                      <td className="p-4">
                        <input key={`desc-${item.description}`} type="text" defaultValue={item.description || ''} placeholder="可留空" onBlur={(e) => onUpdateItem(item.id, 'description', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm text-slate-600" />
                      </td>
                      <td className="p-4 text-center">
                        <button onClick={() => onDeleteItem(item.id)} className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover:opacity-100">🗑️</button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-indigo-50/30">
                    <td className="p-4"><input type="text" value={newItemName} onChange={e => onNameChange(e.target.value)} className="w-full px-4 py-2 bg-white border border-indigo-200 rounded-xl" placeholder="餐點名稱" /></td>
                    <td className="p-4"><input type="number" value={newItemPrice} onChange={e => onPriceChange(e.target.value)} className="w-full px-4 py-2 bg-white border border-indigo-200 rounded-xl" placeholder="價格" /></td>
                    <td className="p-4"><input type="text" value={newItemDescription} onChange={e => onDescriptionChange(e.target.value)} className="w-full px-4 py-2 bg-white border border-indigo-200 rounded-xl" placeholder="備註" /></td>
                    <td className="p-4"><button onClick={onAddItem} className="w-full py-2 bg-indigo-600 text-white rounded-xl font-bold">新增</button></td>
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