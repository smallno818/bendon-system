import React from 'react';

type Product = {
  id: number;
  name: string;
  price: number;
  description: string | null; // ★ 新增 description
};

type Props = {
  storeName: string;
  menuItems: Product[];
  newItemName: string;
  newItemPrice: string;
  newItemDescription: string; // ★ 新增
  onClose: () => void;
  onExcelUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNameChange: (val: string) => void;
  onPriceChange: (val: string) => void;
  onDescriptionChange: (val: string) => void; // ★ 新增
  onAddItem: () => void;
  onDeleteItem: (id: number) => void;
};

export function EditMenuModal({ 
  storeName, 
  menuItems, 
  newItemName, 
  newItemPrice, 
  newItemDescription, // ★
  onClose, 
  onExcelUpload,
  onNameChange,
  onPriceChange,
  onDescriptionChange, // ★
  onAddItem,
  onDeleteItem 
}: Props) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-6 z-50 backdrop-blur-md">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-white/20">
        
        {/* Modal Header */}
        <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black text-slate-800">{storeName}</h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5 uppercase tracking-widest">Menu Management</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm text-slate-400 hover:text-rose-500 transition-colors text-2xl">×</button>
        </div>
        
        <div className="p-8 overflow-y-auto flex-1">
          {/* Excel Upload Area */}
          <div className="mb-10 p-6 bg-indigo-50/50 rounded-2xl border-2 border-dashed border-indigo-100 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-2xl mb-3">📁</div>
            <h3 className="font-bold text-indigo-900">批次匯入菜單</h3>
            <p className="text-xs text-indigo-400 mt-1 mb-4">支援 .xlsx, .xls (格式：品名 | 價格 | 備註)</p>
            <label className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl cursor-pointer hover:bg-indigo-700 shadow-lg shadow-indigo-200 font-bold transition-all active:scale-95">
              選擇檔案
              <input type="file" accept=".xlsx, .xls" onChange={onExcelUpload} className="hidden" />
            </label>
          </div>

          {/* Manual Add Item */}
          <div className="space-y-4 mb-8">
            <p className="text-sm font-black text-slate-700 ml-1">手動新增品項</p>
            <div className="flex gap-3">
              <input 
                placeholder="品項名稱" 
                value={newItemName} 
                onChange={(e) => onNameChange(e.target.value)} 
                className="flex-[2] h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium" 
              />
               {/* ★ 新增備註輸入框 */}
              <input 
                placeholder="備註 (選填)" 
                value={newItemDescription} 
                onChange={(e) => onDescriptionChange(e.target.value)} 
                className="flex-[2] h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium" 
              />
              <input 
                placeholder="價格" 
                type="number" 
                value={newItemPrice} 
                onChange={(e) => onPriceChange(e.target.value)} 
                className="w-24 h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-600" 
              />
              <button 
                onClick={onAddItem} 
                className="w-11 h-11 flex items-center justify-center bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
              >
                ＋
              </button>
            </div>
          </div>

          {/* Menu Table */}
          <div className="rounded-2xl border border-slate-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <tr>
                  <th className="p-4">Item Name</th>
                  <th className="p-4">Note</th> {/* ★ */}
                  <th className="p-4 w-28">Price</th>
                  <th className="p-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {menuItems.map(item => (
                  <tr key={item.id} className="group hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-700">{item.name}</td>
                    {/* ★ 顯示備註 */}
                    <td className="p-4 text-sm text-slate-500">{item.description || '-'}</td>
                    <td className="p-4 font-black text-indigo-600">${item.price}</td>
                    <td className="p-4">
                      <button onClick={() => onDeleteItem(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors text-xl">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-8 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-all shadow-sm">完成並關閉</button>
        </div>
      </div>
    </div>
  );
}