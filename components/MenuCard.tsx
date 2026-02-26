import React from 'react';

type Props = {
  name: string;
  description: string | null;
  price: number;
  isExpired: boolean;
  onOrder: () => void;
};

export function MenuCard({ name, description, price, isExpired, onOrder }: Props) {
  return (
    <div className={`bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition border border-gray-100 flex flex-col justify-between h-full ${isExpired ? 'opacity-60 grayscale' : ''}`}>
      <div>
        <h3 className="font-bold text-lg text-gray-800 leading-tight">{name}</h3>
        <p className="text-sm text-gray-400 mt-1">{description}</p>
      </div>
      <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-50">
        <span className="text-orange-600 font-bold text-xl">${price}</span>
        <button 
          disabled={isExpired}
          onClick={onOrder}
          className={`px-4 py-1.5 rounded-lg font-medium text-sm transition ${isExpired ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-500 hover:text-white'}`}
        >
          {isExpired ? '已結單' : '+ 點餐'}
        </button>
      </div>
    </div>
  );
}