import React, { useState } from 'react'; // ★ 新增：引入 useState
import { Store } from '@/types';
import { StoreCard } from '@/components/StoreCard';

type Props = {
  storeList: Store[];
  inputEndDateTime: string;
  setInputEndDateTime: (val: string) => void;
  onStoreSelect: (storeId: number) => void;
};

export function EmptyStateView({ storeList, inputEndDateTime, setInputEndDateTime, onStoreSelect }: Props) {
  // ★ 新增功能：控制目前選中的頁籤，並過濾店家清單
  const [activeTab, setActiveTab] = useState<'lunch' | 'beverage'>('lunch');
  const filteredStores = storeList.filter(store => 
    activeTab === 'beverage' ? store.category === 'beverage' : store.category !== 'beverage'
  );

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

      {/* ★ 新增功能：分類切換分頁 (Tabs) */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-200/80 p-1.5 rounded-2xl inline-flex shadow-inner">
          <button 
            onClick={() => setActiveTab('lunch')} 
            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'lunch' 
                ? 'bg-white text-blue-600 shadow-md scale-105' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-300/50'
            }`}
          >
            <span className="text-xl">🍱</span> 午餐便當
          </button>
          <button 
            onClick={() => setActiveTab('beverage')} 
            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'beverage' 
                ? 'bg-white text-blue-600 shadow-md scale-105' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-300/50'
            }`}
          >
            <span className="text-xl">🥤</span> 飲料下午茶
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* ★ 新增功能：改用 filteredStores 來渲染，並加上沒資料時的提示 */}
        {filteredStores.length > 0 ? (
          filteredStores.map(store => (
            <StoreCard 
              key={store.id} 
              name={store.name} 
              imageUrl={store.image_url} 
              phone={store.phone} 
              recentCount={store.recentCount}
              onSelect={() => onStoreSelect(store.id)} 
            />
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-gray-400 font-bold">
            目前這個分類還沒有店家喔！
          </div>
        )}
      </div>
    </div>
  );
}