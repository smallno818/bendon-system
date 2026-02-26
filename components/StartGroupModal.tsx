import React, { useState } from 'react';

type Store = { id: number; name: string; };

type Props = {
  stores: Store[];
  initialStoreId?: number | null; // ★ 新增：接收預設店家 ID
  onClose: () => void;
  onSubmit: (storeId: number, endTime: string, groupName: string) => void;
};

export function StartGroupModal({ stores, initialStoreId, onClose, onSubmit }: Props) {
  // ★ 如果有傳入 initialStoreId，就直接設定為預設值
  const [selectedStoreId, setSelectedStoreId] = useState<number | ''>(initialStoreId || '');
  const [endTime, setEndTime] = useState('');
  const [groupName, setGroupName] = useState('');

  const handleSubmit = () => {
    if (!selectedStoreId) return alert('請選擇店家！');
    if (!endTime) return alert('請設定結單時間！');
    
    if (new Date(endTime).getTime() <= new Date().getTime()) {
      return alert('結單時間不能是過去喔！');
    }

    onSubmit(Number(selectedStoreId), endTime, groupName);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scaleIn">
        
        <div className="bg-indigo-600 p-6 text-white text-center">
          <h2 className="text-2xl font-bold">🎉 發起新團購</h2>
          <p className="text-indigo-200 text-sm mt-1">想吃什麼自己開！</p>
        </div>

        <div className="p-6 space-y-5">
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">1. 選擇店家</label>
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
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">2. 結單時間</label>
            <input 
              type="datetime-local" 
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800"
            />
          </div>

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