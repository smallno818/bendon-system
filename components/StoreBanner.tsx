import React from 'react';

type Props = {
  name: string;
  imageUrl: string | null;
  phone: string | null;
  timeLeft: string;
  endTime: string | null;
  isExpired: boolean;
  onShowLargeImage: () => void;
};

export function StoreBanner({ name, imageUrl, phone, timeLeft, endTime, isExpired, onShowLargeImage }: Props) {
  return (
    <div 
      className="w-full h-48 bg-gray-800 relative overflow-hidden group print:hidden cursor-zoom-in"
      onClick={onShowLargeImage}
      title="點擊查看大圖"
    >
      {imageUrl && (
        <img src={imageUrl} alt={name} className="w-full h-full object-cover opacity-50" />
      )}
      
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-white">
        <h1 className="text-4xl font-bold drop-shadow-lg mb-2">{name}</h1>
        
        {/* 倒數計時顯示 */}
        <div className={`px-4 py-1 rounded-full text-sm font-bold shadow-lg backdrop-blur-md ${isExpired ? 'bg-red-600/90' : 'bg-yellow-500/90 text-yellow-900 animate-pulse'}`}>
          {timeLeft || '計算中...'}
        </div>
        
        {endTime && (
          <p className="text-xs mt-1 opacity-80 bg-black/20 px-2 rounded">
            結單時間：{new Date(endTime).toLocaleString()}
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