import React, { useState } from 'react'; // ★ 新增：引入 useState
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
  // ★ 原有功能：控制目前選中的頁籤
  const [activeTab, setActiveTab] = useState<'lunch' | 'beverage'>('lunch');
  
  // ★ 新增功能：搜尋關鍵字狀態
  const [searchKeyword, setSearchKeyword] = useState('');

  // ★ 新增功能：過濾店家清單 (搜尋關鍵字優先，無搜尋才看分類)
  const filteredStores = storeList.filter(store => {
    if (searchKeyword.trim() !== '') {
      return store.name.toLowerCase().includes(searchKeyword.toLowerCase());
    }
    return activeTab === 'beverage' ? store.category === 'beverage' : store.category !== 'beverage';
  });

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

        {/* ★ 新增功能：搜尋輸入框 */}
        <div className="flex justify-center mb-6">
          <div className="relative w-full max-w-md">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-gray-400 text-lg">🔍</span>
            </div>
            <input
              type="text"
              placeholder="搜尋店家名稱..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full pl-12 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-gray-700 font-bold shadow-sm"
            />
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition"
                title="清除搜尋"
              >
                ✖
              </button>
            )}
          </div>
        </div>

        {/* ★ 新增功能：沒有搜尋文字時，才顯示分類切換分頁 (Tabs) */}
        {!searchKeyword && (
          <div className="flex justify-center mb-8">
            <div className="bg-gray-200/80 p-1.5 rounded-2xl inline-flex shadow-inner">
              <button 
                onClick={() => setActiveTab('lunch')} 
                className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all ${
                  activeTab === 'lunch' 
                    ? 'bg-white text-indigo-600 shadow-md scale-105' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-300/50'
                }`}
              >
                <span className="text-xl">🍱</span> 午餐便當
              </button>
              <button 
                onClick={() => setActiveTab('beverage')} 
                className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all ${
                  activeTab === 'beverage' 
                    ? 'bg-white text-indigo-600 shadow-md scale-105' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-300/50'
                }`}
              >
                <span className="text-xl">🥤</span> 飲料下午茶
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
          {/* ★ 改用 filteredStores 來渲染，並加上沒資料時的提示 */}
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
              {/* ★ 嚴格保留：無搜尋時維持原始文字，有搜尋時顯示找不到字詞 */}
              {searchKeyword ? `找不到符合「${searchKeyword}」的店家喔！` : '目前這個分類還沒有店家喔！'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}