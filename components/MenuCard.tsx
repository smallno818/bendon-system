import React, { useState } from 'react';

type Props = {
  name: string;
  description: string | null;
  price: number;
  options?: string | null; // ★ 1. 新增：接收從資料庫傳來的口味字串
  isExpired: boolean;
  // ★ 2. 修改：加上第三個可選參數 selectedOption，準備傳給外層
  onOrder: (quantity: number, remark: string, selectedOption?: string) => void; 
};

export function MenuCard({ name, description, price, options, isExpired, onOrder }: Props) {
  const [count, setCount] = useState(1);
  const [remark, setRemark] = useState('');
  const [selectedOption, setSelectedOption] = useState(''); // ★ 3. 新增：記錄顧客選了什麼口味

  // ★ 4. 新增：將字串 (例: "黑胡椒,蘑菇") 拆解成陣列，方便製作下拉選單
  const optionList = options ? options.split(',').map(o => o.trim()).filter(Boolean) : [];
  const hasOptions = optionList.length > 0;

  const handleMinus = () => {
    setCount(prev => Math.max(1, prev - 1));
  };

  const handlePlus = () => {
    setCount(prev => prev + 1);
  };

  // ★ 5. 新增：獨立出「加入」按鈕的邏輯，加入防呆機制
  const handleAdd = () => {
    // 防呆：如果有口味選項，但顧客沒選，就跳出警告阻擋
    if (hasOptions && !selectedOption) {
      alert('請先選擇口味喔！');
      return;
    }
    
    // 成功點餐，把數量、備註、口味一起往外傳
    onOrder(count, remark, selectedOption);
    setCount(1);
    setRemark('');
    setSelectedOption(''); // 加入後一併清空口味選擇
  };

  return (
    <div className={`bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition border border-gray-100 flex flex-col justify-between h-full ${isExpired ? 'opacity-60 grayscale' : ''}`}>
      <div>
        <h3 className="font-bold text-lg text-gray-800 leading-tight">{name}</h3>
        <p className="text-sm text-blue-500 font-bold mt-1">{description}</p>
      </div>
      
      <div className="mt-4 pt-3 border-t border-gray-50">
        <div className="flex justify-between items-center mb-3">
          <span className="text-orange-600 font-bold text-xl">${price}</span>
        </div>

        {/* ★ 6. 新增：動態顯示口味下拉選單 (只有當 hasOptions 為 true 時才會出現) */}
        {hasOptions && (
          <select
            value={selectedOption}
            onChange={(e) => setSelectedOption(e.target.value)}
            disabled={isExpired}
            className="w-full mb-2 px-3 py-2 text-sm border border-orange-300 rounded-lg text-gray-900 font-bold outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200 disabled:bg-gray-100 transition cursor-pointer bg-orange-50/30"
          >
            <option value="" disabled>請選擇口味...</option>
            {optionList.map((opt, idx) => (
              <option key={idx} value={opt}>{opt}</option>
            ))}
          </select>
        )}

        <input 
          type="text" 
          placeholder="備註 (例：加辣、少冰)" 
          value={remark} 
          onChange={(e) => setRemark(e.target.value)} 
          disabled={isExpired} 
          className="w-full mb-3 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 font-medium outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200 disabled:bg-gray-100 transition"
        />

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
            onClick={handleAdd} // ★ 7. 修改：改用上面寫好的 handleAdd 函數
            className={`flex-1 py-1.5 rounded-lg font-bold text-sm transition shadow-sm ${isExpired ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-500 hover:text-white'}`}
          >
            {isExpired ? '已結單' : '加入'}
          </button>
        </div>
      </div>
    </div>
  );
}