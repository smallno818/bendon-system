import React from 'react';

type Props = {
  name: string;
  phone: string;
  uploading: boolean;
  imagePreview: string;
  onNameChange: (val: string) => void;
  onPhoneChange: (val: string) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
};

export function StoreForm({ name, phone, uploading, imagePreview, onNameChange, onPhoneChange, onImageUpload, onSubmit }: Props) {
  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mb-10">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-2 h-6 bg-indigo-500 rounded-full"></div>
        <h2 className="text-xl font-bold text-slate-700">店家維護</h2>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-5 items-end">
        <div className="flex-[2] w-full space-y-1.5">
          <label className="text-sm font-bold text-slate-600 ml-1">店家名稱</label>
          <input 
            value={name} 
            onChange={(e) => onNameChange(e.target.value)} 
            placeholder="必填，如：麥當勞" 
            className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium" 
          />
        </div>
        
        <div className="flex-[1.5] w-full space-y-1.5">
          <label className="text-sm font-bold text-slate-600 ml-1">聯絡電話</label>
          <input 
            value={phone} 
            onChange={(e) => onPhoneChange(e.target.value)} 
            placeholder="選填" 
            className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium" 
          />
        </div>
        
        <div className="flex-1 w-full space-y-1.5">
          <label className="text-sm font-bold text-slate-600 ml-1">店家圖示</label>
          <label className="flex items-center justify-center gap-2 h-11 w-full bg-white border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all group">
            <span className="text-slate-400 group-hover:text-indigo-500 transition-colors">
              {uploading ? '⏳' : '📷'}
            </span>
            <span className="text-sm font-bold text-slate-500 group-hover:text-indigo-600">
              {uploading ? '處理中' : '選擇照片'}
            </span>
            <input type="file" accept="image/*" onChange={onImageUpload} className="hidden" />
          </label>
        </div>

        <button 
          onClick={onSubmit} 
          className="w-full lg:w-auto px-8 h-11 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 transition-all active:scale-95"
        >
          儲存更新
        </button>
      </div>
      
      {imagePreview && (
        <div className="mt-6 flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 w-fit">
          <div className="w-16 h-16 rounded-xl overflow-hidden shadow-inner">
            <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
          </div>
          <p className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-md">圖片已上傳成功</p>
        </div>
      )}
    </div>
  );
}