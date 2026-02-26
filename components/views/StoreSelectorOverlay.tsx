import React from 'react';
import { Store } from '@/types';
import { StoreCard } from '@/components/StoreCard';

type Props = {
  storeList: Store[];
  inputEndDateTime: string;
  setInputEndDateTime: (val: string) => void;
  onStoreSelect: (storeId: number) => void;
  onClose: () => void;
};

export function StoreSelectorOverlay({ storeList, inputEndDateTime, setInputEndDateTime, onStoreSelect, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto animate-fadeIn">
      <div className="max-w-6xl mx-auto p-6 min-h-screen">
        <div className="flex justify-between items-center mb-8 sticky top-0 bg-gray-50/95 backdrop-blur py-4 z-10 border-b border-gray-200">
          <h2 className="text-3xl font-black text-gray-800">🎉 加開新團購</h2>
          <button 
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-600 px-5 py-2 rounded-xl font-bold transition"
          >
            取消
          </button>
        </div>

        <div className="flex justify-center mb-10">
          <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-sm flex flex-col items-center gap-2 w-full max-w-md">
            <label className="text-sm font-bold text-indigo-800 flex items-center gap-2">
              <span>⏱️</span>
              <span>快速設定結單時間 (選填)</span>
            </label>
            <input 
              type="datetime-local" 
              value={inputEndDateTime} 
              onChange={e => setInputEndDateTime(e.target.value)} 
              className="w-full border-2 border-indigo-100 p-2 rounded-lg font-bold text-gray-700 outline-none focus:border-indigo-500 bg-gray-50" 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
          {storeList.map(store => (
            <StoreCard 
              key={store.id} 
              name={store.name} 
              imageUrl={store.image_url} 
              phone={store.phone} 
              onSelect={() => onStoreSelect(store.id)} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}