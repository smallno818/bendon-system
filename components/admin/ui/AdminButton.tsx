import React from 'react';

type AdminButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'icon-close' | 'icon-delete';
};

export function AdminButton({ variant = 'primary', className = '', children, ...props }: AdminButtonProps) {
  // 基礎樣式：置中、動畫過渡、禁用時的狀態
  const baseStyle = "flex items-center justify-center font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed";
  
  // 各種按鈕的專屬樣式
  const variants = {
    primary: "bg-indigo-600 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 shadow-sm",
    secondary: "bg-slate-200 text-slate-700 px-6 py-2.5 rounded-xl hover:bg-slate-300",
    danger: "bg-rose-500 text-white px-6 py-2.5 rounded-xl hover:bg-rose-600",
    'icon-close': "w-10 h-10 rounded-xl bg-slate-200 text-slate-500 hover:bg-rose-500 hover:text-white",
    'icon-delete': "w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white opacity-0 group-hover:opacity-100"
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}