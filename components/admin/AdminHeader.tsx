import React from 'react';

// 新增 Props 定義
type Props = {
  onLogout: () => void;
};

export function AdminHeader({ onLogout }: Props) {
  return (
    <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">後台管理中心</h1>
        <p className="text-slate-500 mt-2 font-medium">管理您的店家資訊與菜單清單</p>
      </div>
      
      <button 
        onClick={onLogout}
        className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-300 transition-colors text-sm"
      >
        登出系統
      </button>
    </header>
  );
}