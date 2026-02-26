import React, { useState, useEffect } from 'react';

type Store = { id: number; name: string; };

type Props = {
  stores: Store[];
  initialStoreId?: number | null;
  onClose: () => void;
  onSubmit: (storeId: number, endTime: string, groupName: string) => void;
};

export function StartGroupModal({ stores, initialStoreId, onClose, onSubmit }: Props) {
  const [selectedStoreId, setSelectedStoreId] = useState<number | ''>('');
  const [endTime, setEndTime] = useState('');
  const [groupName, setGroupName] = useState('');

  // 初始化：如果有傳入 initialStoreId，就直接設定
  useEffect(() => {
    if (initialStoreId) {
      setSelectedStoreId(initialStoreId);
    }
  }, [initialStoreId]);

  const handleSubmit = () => {
    if (!selectedStoreId) return alert('請選擇店家！');
    if (!endTime) return alert('請設定結單時間！');
    
    if (new Date(endTime).getTime() <= new Date().getTime()) {
      return alert('結單時間不能是過去喔！');
    }

    onSubmit(Number(selectedStoreId), endTime, groupName);
  };

  // 取得目前選中店家的名字
  const selectedStoreName = stores.find(s => s.id === Number(selectedStoreId))?.name;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scaleIn">
        
        <div className="bg-indigo-600 p-6 text-white text-center">
          <h2 className="text-2xl font-bold">⏱️ 設定團購資訊</h2>
          <p className="text-indigo-200 text-sm mt-1">
            {initialStoreId ? '只差一步就完成了！' : '想吃什麼自己開！'}
          </p>
        </div>

        <div className="p-6 space-y-5">
          
          {/* 1. 選擇店家 (如果已經有預選，就變成純文字顯示，不能改) */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">1. 團購店家</label>
            {initialStoreId ? (
              <div className="w-full p-3 border border-indigo-200 rounded-xl bg-indigo-50 text-indigo-900 font-bold text-lg flex items-center gap-2">
                <span>🍱</span>
                {selectedStoreName}
              </div>
            ) : (
              <select 
                value={selectedStoreId} 
                onChange={(e) => setSelectedStoreId(Number(e.target.value))}
                className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800"
              >
                <option value="">-- 請選擇 --</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 2. 結單時間 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">2. 結單時間</label>
            <input 
              type="datetime-local" 
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800"
            />
          </div>

          {/* 3. 團購名稱 (選填) */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">3. 團購名稱 (選填)</label>
            <input 
              type="text" 
              placeholder="例：飲料團、晚餐團..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800"
            />
          </div>

        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-200 rounded-xl transition"
          >
            取消
          </button>
          <button 
            onClick={handleSubmit}
            className="flex-[2] py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition active:scale-95"
          >
            確定開團！
          </button>
        </div>
      </div>
    </div>
  );
}