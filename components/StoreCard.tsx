import React from 'react';

type Props = {
  name: string;
  imageUrl: string | null;
  phone: string | null;
  onSelect: () => void;
};

export function StoreCard({ name, imageUrl, phone, onSelect }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 flex flex-col">
      <div className="h-40 bg-gray-200 relative">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">無圖片</div>
        )}
      </div>
      <div className="p-5 text-center flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-1">{name}</h3>
          {phone && <p className="text-xs text-gray-500 mb-4">📞 {phone}</p>}
        </div>
        <button 
          onClick={onSelect}
          className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-blue-700 transition active:scale-95"
        >
          2. 決定吃這家！
        </button>
      </div>
    </div>
  );
}