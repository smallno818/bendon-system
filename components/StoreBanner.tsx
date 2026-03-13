import React from 'react';

type Props = {
  name: string;
  imageUrl: string | null;
  phone: string | null;
  timeLeft: string;
  endTime: string | null;
  isExpired: boolean;
  onShowLargeImage: () => void;
  onCloseGroup: () => void; // ★ 1. 新增接收關閉此團的函數
};

export function StoreBanner({ name, imageUrl, phone, timeLeft, endTime, isExpired, onShowLargeImage, onCloseGroup }: Props) {
  return (
    <div 
      className="w-full h-48 bg-gray-800 relative overflow-hidden group print:hidden cursor-zoom-in"
      onClick={onShowLargeImage}
      title="點擊查看大圖"
    >
      {imageUrl && (
        <img src={imageUrl} alt={name} className="w-full h-full object-cover opacity-50" />
      )}

      {/* ★ 2. 新增：放在右上角的小 ✕ 按鈕 */}
      <button 
        onClick={(e) => {
          e.stopPropagation(); // 防止點擊時觸發外層的放大圖片功能
          onCloseGroup();
        }}
        className="absolute top-4 right-4 z-20 bg-rose-500/60 hover:bg-rose-600 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm cursor-pointer"
        title="關閉此團"
      >
        ✕
      </button>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-white z-10">
        <h1 className="text-4xl font-bold drop-shadow-lg mb-2">{name}</h1>
        
        {/* 倒數計時顯示：已移除 animate-pulse (不閃爍)，並稍微加大內距 */}
        <div className={`px-6 py-2 rounded-full text-base font-bold shadow-lg backdrop-blur-md transition-colors ${isExpired ? 'bg-red-600/90' : 'bg-yellow-500/90 text-yellow-900'}`}>
          {timeLeft || '計算中...'}
        </div>
        
        {/* 結單時間：字體放大 (text-base)，增加黑色背景襯托 */}
        {endTime && (
          <p className="text-base font-medium mt-2 text-white drop-shadow-md bg-black/40 px-3 py-1 rounded-lg border border-white/20">
            結單時間：{new Date(endTime).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}

        {phone && (
          <a 
            href={`tel:${phone}`}
            onClick={(e) => e.stopPropagation()}
            className="mt-3 bg-green-600/90 hover:bg-green-600 px-4 py-1.5 rounded-full text-sm font-bold pointer-events-auto flex items-center gap-2 transition"
          >
            📞 撥打電話
          </a>
        )}
      </div>
    </div>
  );
}