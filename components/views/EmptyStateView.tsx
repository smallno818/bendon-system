import React from 'react';
import { Store } from '@/types';
import { StoreCard } from '@/components/StoreCard';

type Props = {
  storeList: Store[];
  inputEndDateTime: string;
  setInputEndDateTime: (val: string) => void;
  onStoreSelect: (storeId: number) => void;
};

export function EmptyStateView({ storeList, inputEndDateTime, setInputEndDateTime, onStoreSelect }: Props) {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="text-center py-6">
        <h1 className="text-4xl font-black text-gray-800 mb-2">🍽️ 今天吃什麼？</h1>
        <p className="text-gray-500 text-lg">發起今天的第一個團購吧！</p>
      </div>

      <div className="flex justify-center mb-10">
        <div className="bg-blue-50 p-5 rounded-2xl border border-blue-200 shadow-sm flex flex-col items-center gap-3 animate-fadeIn">
          <label className="text-base font-bold text-blue-800 flex items-center gap-2">
            <span>⏱️</span>
            <span>快速開團：請先設定結單時間</span>
          </label>
          <input 
            type="datetime-local" 
            value={inputEndDateTime} 
            onChange={e => setInputEndDateTime(e.target.value)} 
            className="border-2 border-blue-300 p-2 rounded-lg text-xl font-bold text-gray-700 outline-none focus:border-blue-500 bg-white shadow-inner" 
          />
          <p className="text-xs text-blue-500 font-medium">✨ 設定後，點擊下方卡片即可直接開團</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
  );
}