import React from 'react';

type Props = {
  name: string;
  phone: string | null;
  imageUrl: string | null;
  onEdit: () => void;
  onDelete: () => void;
};

export function StoreCard({ name, phone, imageUrl, onEdit, onDelete }: Props) {
  return (
    <div className="group bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden border border-slate-100 shadow-inner group-hover:scale-110 transition-transform">
          {imageUrl ? (
            <img src={imageUrl} className="w-full h-full object-cover" alt={name} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">NO IMAGE</div>
          )}
        </div>
        <div className="overflow-hidden">
          <h3 className="font-bold text-slate-800 truncate text-lg">{name}</h3>
          <p className="text-sm text-indigo-500 font-bold">{phone || '尚未提供電話'}</p>
        </div>
      </div>
      <div className="flex gap-3">
        <button 
          onClick={onEdit} 
          className="flex-[3] bg-slate-900 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-600 shadow-md transition-all"
        >
          編輯菜單
        </button>
        <button 
          onClick={onDelete} 
          className="flex-1 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}