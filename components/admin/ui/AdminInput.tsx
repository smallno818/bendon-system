import React from 'react';

type AdminInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  icon?: string;
};

export function AdminInput({ icon, className = '', ...props }: AdminInputProps) {
  return (
    <div className="relative flex items-center w-full">
      {icon && <span className="absolute left-3 text-slate-400 font-bold z-10">{icon}</span>}
      <input 
        className={`w-full py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-700 placeholder-slate-300 ${icon ? 'pl-7 pr-3' : 'px-4'} ${className}`}
        {...props} 
      />
    </div>
  );
}