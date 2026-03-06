import React, { useState } from 'react';
import { Store } from '@/types';
import { StoreCard } from '@/components/StoreCard';

type Props = {
  storeList: Store[];
  inputEndDateTime: string;
  setInputEndDateTime: (val: string) => void;
  onStoreSelect: (storeId: number) => void;
};

export function EmptyStateView({ storeList, inputEndDateTime, setInputEndDateTime, onStoreSelect }: Props) {
  // ★ 新增狀態：控制目前選中的頁籤
  const [activeTab, setActiveTab] = useState<'lunch' | 'beverage'>('lunch');

  // ★ 根據頁籤過濾店家
  const filteredStores = storeList.filter(store => 
    activeTab === 'beverage' ? store.category === 'beverage' : store.category !== 'beverage'
  );

  return (
    <div className="max-w-6xl mx-auto p-6 pt-12 animate-fadeIn">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-black text-slate-800 mb-4 tracking-tight">今天想吃點什麼？🤤</h2>
        <p className="text-slate-500 font-medium text-lg">目前還沒有人開團，趕快挑一家喜歡的發起揪團吧！</p>
      </div>

      {/* 快速設定時間區塊 */}
      <div className="flex justify-center mb-10">
        <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm flex flex-col items-center gap-3 w-full max-w-md hover:shadow-md transition-shadow">
          <label className="text-sm font-bold text-indigo-800 flex items-center gap-2">
            <span className="text-lg">⏱️</span>
            <span>快速設定結單時間 (選填)</span>
          </label>
          <input 
            type="datetime-local" 
            value={inputEndDateTime} 
            onChange={e => setInputEndDateTime(e.target.value)} 
            className="w-full border-2 border-indigo-50 p-3 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 bg-slate-50 transition-all" 
          />
        </div>
      </div>

      {/* ★ 新增：分類切換分頁 (Tabs) */}
      <div className="flex justify-center mb-10">
        <div className="bg-slate-200/70 p-1.5 rounded-2xl inline-flex shadow-inner">
          <button 
            onClick={() => setActiveTab('lunch')} 
            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'lunch' 
                ? 'bg-white text-indigo-600 shadow-md scale-105' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-300/50'
            }`}
          >
            <span className="text-xl">🍱</span> 午餐便當
          </button>
          <button 
            onClick={() => setActiveTab('beverage')} 
            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'beverage' 
                ? 'bg-white text-indigo-600 shadow-md scale-105' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-300/50'
            }`}
          >
            <span className="text-xl">🥤</span> 飲料下午茶
          </button>
        </div>
      </div>

      {/* 店家列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {filteredStores.length > 0 ? (
          filteredStores.map(store => (
            <StoreCard 
              key={store.id} 
              name={store.name} 
              imageUrl={store.image_url} 
              phone={store.phone} 
              onSelect={() => onStoreSelect(store.id)} 
            />
          ))
        ) : (
          <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <span className="text-5xl mb-4">🔍</span>
            <span className="font-bold text-lg">目前這個分類還沒有店家喔！</span>
            <span className="text-sm mt-1">請主揪到後台新增店家並設定分類</span>
          </div>
        )}
      </div>
    </div>
  );
}