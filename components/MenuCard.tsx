import React, { useState } from 'react';

type Props = {
  name: string;
  description: string | null;
  price: number;
  isExpired: boolean;
  // ★ 注意：這裡定義了 onOrder 接收一個數字參數
  onOrder: (quantity: number) => void;
};

// ★ 關鍵：這裡必須有 "export" 且沒有 "default"
export function MenuCard({ name, description, price, isExpired, onOrder }: Props) {
  const [count, setCount] = useState(1);

  const handleMinus = () => {
    setCount(prev => Math.max(1, prev - 1));
  };

  const handlePlus = () => {
    setCount(prev => prev + 1);
  };

  return (
    <div className={`bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition border border-gray-100 flex flex-col justify-between h-full ${isExpired ? 'opacity-60 grayscale' : ''}`}>
      <div>
        <h3 className="font-bold text-lg text-gray-800 leading-tight">{name}</h3>
        <p className="text-sm text-gray-400 mt-1">{description}</p>
      </div>
      
      <div className="mt-4 pt-3 border-t border-gray-50">
        <div className="flex justify-between items-center mb-3">
          <span className="text-orange-600 font-bold text-xl">${price}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* 數量加減區塊 */}
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
            <button 
              onClick={handleMinus}
              disabled={isExpired}
              className="px-3 py-1.5 text-gray-600 hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50 transition"
            >
              -
            </button>
            <div className="w-8 text-center font-bold text-gray-800 text-sm">
              {count}
            </div>
            <button 
              onClick={handlePlus}
              disabled={isExpired}
              className="px-3 py-1.5 text-gray-600 hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50 transition"
            >
              +
            </button>
          </div>

          <button 
            disabled={isExpired}
            onClick={() => {
              onOrder(count);
              setCount(1); // 點餐後重置為 1
            }}
            className={`flex-1 py-1.5 rounded-lg font-bold text-sm transition shadow-sm ${isExpired ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-500 hover:text-white'}`}
          >
            {isExpired ? '已結單' : '加入'}
          </button>
        </div>
      </div>
    </div>
  );
}