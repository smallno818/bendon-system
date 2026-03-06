import React from 'react';

type Props = {
  name: string;
  imageUrl: string | null;
  phone: string | null;
  recentCount?: number;
  onSelect: () => void;
};

export function StoreCard({ name, imageUrl, phone, recentCount, onSelect }: Props) {
  return (
    <div 
      onClick={onSelect}
      className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden cursor-pointer flex flex-col h-full transform hover:-translate-y-1"
    >
      <div className="relative h-48 bg-gray-100 overflow-hidden">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={name} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-5xl">
            🏠
          </div>
        )}
        
        {/* 原本位於圖片左上角的標籤已移除，改移至下方資訊區 */}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
          <span className="text-white font-bold text-sm">點擊選擇此店家</span>
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1">
        {/* ★ 修改：使用 flex 佈局讓名稱與標籤在同一水平線上 ★ */}
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">{name}</h3>
          
          {/* ★ 新增功能：標籤顯示在最右邊，內容更新為「最近14天點過 {recentCount} 次」 ★ */}
          {recentCount !== undefined && recentCount > 0 && (
            <span className="text-[10px] bg-rose-500 text-white font-bold px-2 py-1 rounded-lg shadow-sm whitespace-nowrap ml-2">
              最近14天點過 {recentCount} 次
            </span>
          )}
        </div>

        {phone && (
          <p className="text-gray-500 text-sm mb-4 flex items-center gap-1">
            📞 {phone}
          </p>
        )}
        
        <div className="mt-auto pt-4 border-t border-gray-50">
          <button 
            className="w-full py-2.5 bg-indigo-50 text-indigo-600 rounded-xl font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
          >
            決定吃這家
          </button>
        </div>
      </div>
    </div>
  );
}