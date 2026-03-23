import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AdminInput } from './ui/AdminInput';
import { AdminButton } from './ui/AdminButton';

type Product = { id: number; name: string; price: number; description: string | null; options?: string | null;};

type Props = {
  storeId: number; storeName: string; menuItems: Product[];
  newItemName: string; newItemPrice: string; newItemDescription: string; newItemOptions: string;
  onClose: () => void; onExcelUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNameChange: (val: string) => void; onPriceChange: (val: string) => void; onDescriptionChange: (val: string) => void; onOptionsChange: (val: string) => void;
  onAddItem: () => void; onDeleteItem: (id: number) => void;
  onUpdateItem: (id: number, field: 'price' | 'description' | 'options', value: string | number) => void;
  onClearMenu: () => void;
  onRefresh: () => Promise<void>;
};

export function EditMenuModal({
  storeId, storeName, menuItems, newItemName, newItemPrice, newItemDescription, newItemOptions,
  onClose, onExcelUpload, onNameChange, onPriceChange, onDescriptionChange, onOptionsChange,
  onAddItem, onDeleteItem, onUpdateItem, onClearMenu, onRefresh
}: Props) {
  
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiPreviewItems, setAiPreviewItems] = useState<any[] | null>(null);
  
  // ★ 新增：控制是否進入 AI 工作區、儲存圖片與自訂提示詞的狀態
  const [isAiMode, setIsAiMode] = useState(false);
  const [aiImage, setAiImage] = useState<{ base64: string; type: string; url: string } | null>(null);
  const [aiPrompt, setAiPrompt] = useState(`
      你是一個專業的資料輸入員。請仔細辨識這張菜單圖片中的所有「餐點品項」與「價格」。
      
      規則：
      1. 只需要提取餐點名稱與價格。
      2. 價格請轉換為純數字。若沒有標示價格，請填寫 0。
      3. 若有備註（如大小份、辣度），請填入 description 欄位；若無則填寫 ""。
      4. 如果是飲料的菜單，把容量加入餐點名稱、同名稱不同容量擺在一起、價格不同。
      5. 請嚴格按照以下 JSON 陣列格式輸出：
      [
        {"name": "餐點名稱", "price": 100, "description": "備註"}
      ]
    `);

  // ★ 新增：選擇圖片的邏輯
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; 
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64Data = reader.result?.toString().split(',')[1];
      setAiImage({
        base64: base64Data || '',
        type: file.type,
        url: URL.createObjectURL(file)
      });
      setAiPreviewItems(null); // 上傳新圖片時清空舊的預覽
    };
  };

  // ★ 新增：發送給 API 進行辨識
  const handleRecognize = async () => {
    if (!aiImage) return alert('請先上傳圖片！');
    setIsAiLoading(true);
    setAiPreviewItems(null); // 辨識前先清空舊結果

    try {
      const response = await fetch('/api/extract-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          base64Image: aiImage.base64, 
          mimeType: aiImage.type,
          prompt: aiPrompt // 帶入自訂提示詞
        })
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

  const handleConfirmAiImport = async () => {
    if (!aiPreviewItems) return;
    setIsAiLoading(true);
    try {
      const productsToUpsert = aiPreviewItems.map((item: any) => ({
        store_id: storeId, name: item.name, price: Number(item.price), description: item.description || null, options: item.options || null
      }));
      const { error } = await supabase.from('products').upsert(productsToUpsert, { onConflict: 'store_id, name' });
      if (error) throw error;

      await onRefresh(); 
      alert(`✅ 成功匯入 ${productsToUpsert.length} 筆品項！`);
      setAiPreviewItems(null);
      setAiImage(null);
      setIsAiMode(false); // 匯入成功後自動返回一般編輯模式
    } catch (error: any) {
      alert('存入資料庫失敗: ' + error.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
        <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <span className="bg-indigo-100 text-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center text-lg">📝</span>
            {isAiMode ? '✨ AI 菜單辨識工作區' : `編輯菜單：${storeName}`}
          </h2>
          <div className="flex gap-2">
            {isAiMode ? (
              <button onClick={() => { setIsAiMode(false); setAiPreviewItems(null); }} className="px-4 py-2 rounded-xl text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition shadow-sm">
                返回編輯
              </button>
            ) : (
              <>
                <button onClick={() => setIsAiMode(true)} className="px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2 border bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-600 hover:text-white">
                  <span>✨ AI 圖片辨識</span>
                </button>
                <label className="cursor-pointer bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all flex items-center gap-2">
                  <span>📊 匯入 Excel</span>
                  <input type="file" accept=".xlsx,.csv" className="hidden" onChange={onExcelUpload} />
                </label>
                {menuItems.length > 0 && (
                  <button onClick={onClearMenu} className="cursor-pointer bg-white border border-rose-200 text-rose-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-rose-50 hover:border-rose-300 shadow-sm transition-all flex items-center gap-2" title="清空所有菜單">
                    <span>🗑️ 清空菜單</span>
                  </button>
                )}
              </>
            )}
            <AdminButton variant="icon-close" onClick={onClose}>✕</AdminButton>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          {isAiMode ? (
            // ★ AI 工作區介面
            <div className="flex flex-col md:flex-row gap-6 h-full animate-fadeIn">
              
              {/* 左側：設定區 */}
              <div className="w-full md:w-[40%] flex flex-col gap-4">
                <label className="border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition min-h-[200px] bg-white relative overflow-hidden group">
                  {aiImage ? (
                    <img src={aiImage.url} alt="menu" className="absolute inset-0 w-full h-full object-contain p-2" />
                  ) : (
                    <span className="text-slate-400 font-bold group-hover:text-slate-500">點擊上傳菜單圖片</span>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <span className="text-white font-bold">{aiImage ? '更換圖片' : '上傳圖片'}</span>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                </label>

                <div className="flex flex-col flex-1">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-bold text-slate-700">提示詞 (Prompt)</label>
                  </div>
                  <textarea 
                    value={aiPrompt} 
                    onChange={e => setAiPrompt(e.target.value)} 
                    className="w-full flex-1 min-h-[180px] p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-200 resize-none bg-white leading-relaxed text-slate-600" 
                  />
                </div>

                <AdminButton variant="primary" onClick={handleRecognize} disabled={!aiImage || isAiLoading} className="py-3 text-base shadow-md w-full flex justify-center items-center gap-2">
                  {isAiLoading ? <span className="animate-pulse">✨ 正在深度分析中...</span> : <span>🚀 開始辨識</span>}
                </AdminButton>
              </div>

              {/* 右側：預覽結果區 */}
              <div className="w-full md:w-[60%] flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm relative">
                <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 flex justify-between items-center">
                  <span>辨識預覽結果</span>
                  {aiPreviewItems && (
                     <AdminButton variant="primary" onClick={handleConfirmAiImport} disabled={isAiLoading}>✅ 確認加入</AdminButton>
                  )}
                </div>
                <div className="p-0 overflow-y-auto flex-1">
                  {aiPreviewItems ? (
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10">
                        <tr className="border-b text-slate-500 text-sm">
                          <th className="p-4 font-bold">品項</th>
                          <th className="p-4 font-bold">價格</th>
                          <th className="p-4 font-bold">備註</th>
                          <th className="p-4 font-bold">口味選項</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiPreviewItems.map((item, i) => (
                          <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition">
                            <td className="p-4 font-bold text-slate-700">{item.name}</td>
                            <td className="p-4 text-indigo-600 font-bold">${item.price}</td>
                            <td className="p-4 text-slate-500 text-sm">{item.description}</td>
                            <td className="p-4 text-slate-500 text-sm">{item.options}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 font-bold bg-slate-50/30">
                       {isAiLoading ? '正在擷取餐點資料...' : '尚未辨識，請上傳圖片並點擊開始辨識。'}
                    </div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            // ★ 原本的一般編輯菜單表格 (保持不變)
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-fadeIn">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                    <th className="p-4 font-bold min-w-[180px]">品項名稱</th>
                    <th className="p-4 font-bold min-w-[120px]">價格</th>
                    <th className="p-4 font-bold min-w-[200px]">備註</th>
                    <th className="p-4 font-bold w-48">口味選項</th>
                    <th className="p-4 font-bold w-10 text-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {menuItems.map(item => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 group transition-colors">
                      <td className="p-4 font-bold text-slate-700">{item.name}</td>
                      <td className="p-4">
                        <AdminInput icon="$" key={`price-${item.price}`} type="number" defaultValue={item.price} onBlur={(e) => onUpdateItem(item.id, 'price', parseFloat(e.target.value))} />
                      </td>
                      <td className="p-4">
                        <AdminInput key={`desc-${item.description}`} type="text" defaultValue={item.description || ''} placeholder="可留空" onBlur={(e) => onUpdateItem(item.id, 'description', e.target.value)} className="text-sm" />
                      </td>
                      <td className="p-4">
                        <AdminInput key={`opt-${item.options}`} type="text" defaultValue={item.options || ''} placeholder="例: 黑胡椒,蘑菇" onBlur={(e) => onUpdateItem(item.id, 'options', e.target.value)} className="text-sm" />
                      </td>
                      <td className="p-4 text-center">
                        <AdminButton variant="icon-delete" onClick={() => onDeleteItem(item.id)}>🗑️</AdminButton>
                      </td>
                    </tr>
                  ))}
                  
                  <tr className="bg-indigo-50/30">
                    <td className="p-4">
                      <AdminInput type="text" value={newItemName} onChange={e => onNameChange(e.target.value)} className="bg-white border-indigo-200" placeholder="餐點名稱" />
                    </td>
                    <td className="p-4">
                      <AdminInput icon="$" type="number" value={newItemPrice} onChange={e => onPriceChange(e.target.value)} className="bg-white border-indigo-200" placeholder="價格" />
                    </td>
                    <td className="p-4">
                      <AdminInput type="text" value={newItemDescription} onChange={e => onDescriptionChange(e.target.value)} className="bg-white border-indigo-200 text-sm" placeholder="備註" />
                    </td>
                    <td className="p-4">
                      <AdminInput type="text" value={newItemOptions} onChange={e => onOptionsChange(e.target.value)} className="bg-white border-indigo-200 text-sm" placeholder="例: 黑胡椒,蘑菇" />
                    </td>
                    <td className="p-4">
                      <AdminButton variant="primary" onClick={onAddItem} className="w-full" disabled={!newItemName || !newItemPrice}>新增</AdminButton>
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