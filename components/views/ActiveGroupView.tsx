import React, { useState } from 'react';
import { Group, Product, SummaryItem } from '@/types';
import { StoreBanner } from '@/components/StoreBanner';
import { MenuCard } from '@/components/MenuCard';
import { OrderSummary } from '@/components/OrderSummary';

type Props = {
  todayGroups: Group[];
  activeGroupId: number | null;
  activeGroup: Group;
  menu: Product[];
  summary: SummaryItem[];
  timeLeft: string;
  isExpired: boolean;
  
  onSwitchGroup: (groupId: number, storeId: number) => void;
  onOpenStoreSelector: () => void;
  onOrder: (item: string, price: number, qty: number) => Promise<void>;
  onDeleteOrder: (orderId: number, name: string) => Promise<void>;
  onCloseGroup: () => Promise<void>;
  onScrollTop: () => void;
};

export function ActiveGroupView({
  todayGroups, activeGroupId, activeGroup, menu, summary, timeLeft, isExpired,
  onSwitchGroup, onOpenStoreSelector, onOrder, onDeleteOrder, onCloseGroup, onScrollTop
}: Props) {
  
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemCount, setCustomItemCount] = useState(1);
  const [showLargeImage, setShowLargeImage] = useState(false);

  const handleCustomOrder = () => {
    if (!customItemName || !customItemPrice) return alert('請輸入完整內容與金額');
    onOrder(customItemName, parseFloat(customItemPrice), customItemCount)
      .then(() => {
        // 成功後清空
        setCustomItemName('');
        setCustomItemPrice('');
        setCustomItemCount(1);
      });
  };

  // ★ 新增：分享到 LINE 的邏輯
  const handleShareToLine = () => {
    // 將結單時間格式化成可讀性高的文字 (例如: 14:30)
    const end = new Date(activeGroup.end_time);
    const timeStr = end.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    // 組合要發送的文案內容
    const text = `🍱 辦公室揪團囉！\n今天吃【${activeGroup.store.name}】\n\n⏱️ 結單時間：今天 ${timeStr}\n👉 快速點餐連結：\n${window.location.href}`;
    
    // 將文字編碼並組合 LINE 的分享網址
    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
    
    // 開啟新視窗 (手機上會自動觸發開啟 LINE App)
    window.open(lineUrl, '_blank');
  };

  return (
    <>
      {/* Tabs 分頁列 */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm print:hidden">
        <div className="max-w-5xl mx-auto px-4 flex items-center gap-2 overflow-x-auto py-3 scrollbar-hide">
          {todayGroups.map(group => (
            <button
              key={group.id}
              onClick={() => onSwitchGroup(group.id, group.store_id)}
              className={`flex flex-col items-start px-5 py-1.5 rounded-xl transition-all border ${
                activeGroupId === group.id 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105' 
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
              }`}
            >
              <span className="font-bold text-sm whitespace-nowrap">{group.store.name}</span>
              <span className={`text-[10px] ${activeGroupId === group.id ? 'text-indigo-200' : 'text-gray-400'}`}>
                {group.name ? group.name : '團購 #' + group.id}
              </span>
            </button>
          ))}
          <button onClick={onOpenStoreSelector} className="ml-2 w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 border border-dashed border-gray-300 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 transition-all font-bold text-xl" title="加開新團購">＋</button>
        </div>
      </div>

      <StoreBanner 
        name={activeGroup.store.name} 
        imageUrl={activeGroup.store.image_url} 
        phone={activeGroup.store.phone} 
        timeLeft={timeLeft} 
        endTime={activeGroup.end_time} 
        isExpired={isExpired} 
        onShowLargeImage={() => setShowLargeImage(true)} 
      />
      
      <button onClick={onScrollTop} className="fixed bottom-8 right-8 z-30 bg-gray-700/80 text-white p-3 rounded-full shadow-lg backdrop-blur-sm hover:bg-gray-900 transition-all duration-300 print:hidden" title="回到頂部">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
      </button>

      <button onClick={onCloseGroup} className="fixed bottom-28 right-8 z-30 bg-rose-600 text-white px-4 py-4 rounded-2xl shadow-2xl hover:bg-rose-700 transition-all hover:scale-105 active:scale-95 print:hidden border-2 border-white/20 flex flex-col items-center justify-center gap-1" title="刪除目前顯示的團購">
        <span className="text-xl">❌</span><span className="text-xs font-bold">關閉此團</span>
      </button>

      <div className="max-w-5xl mx-auto p-4 print:p-0 print:max-w-none">

        {/* ★ 新增：LINE 分享按鈕 (若已結單則自動隱藏) */}
        {!isExpired && (
          <div className="flex justify-end mb-4 print:hidden animate-fadeIn">
            <button 
              onClick={handleShareToLine}
              className="flex items-center gap-2 bg-[#00B900] text-white px-5 py-2.5 rounded-xl font-bold shadow-sm hover:shadow-md hover:bg-[#00a000] transition-all hover:-translate-y-0.5 active:scale-95"
              title="分享開團資訊到 LINE"
            >
              {/* 這裡使用的是 LINE 官方的經典 Logo SVG 向量圖 */}
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M24 10.304c0-5.369-5.383-9.738-12-9.738-6.616 0-12 4.369-12 9.738 0 4.814 4.269 8.846 10.036 9.608.391.084.922.258 1.057.592.122.301.08.771.037 1.085l-.171 1.027c-.05.303-.242 1.186 1.039.647 1.281-.54 6.911-4.069 9.428-6.967 1.739-1.907 2.574-3.843 2.574-5.992zM8.525 12.352H6.012c-.227 0-.411-.184-.411-.411V7.936c0-.227.184-.411.411-.411h2.513c.227 0 .411.184.411.411v3.593h2.098c.227 0 .411.184.411.411v.412c0 .227-.184.411-.411.411z" />
              </svg>
              <span>分享揪團連結</span>
            </button>
          </div>
        )}
        
        {/* 客製化輸入區 */}
        <div className={`mb-8 bg-white p-5 rounded-xl border-2 border-dashed border-blue-200 shadow-sm print:hidden ${isExpired ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-2 mb-3"><span className="text-xl font-bold text-gray-700">✏️ 客製化 / 隱藏版 ({activeGroup.store.name})</span></div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" placeholder={isExpired ? "已停止下單" : "輸入需求 (例：半糖少冰)"} value={customItemName} onChange={(e) => setCustomItemName(e.target.value)} disabled={isExpired} className="flex-[2] border border-gray-300 p-3 rounded-lg text-gray-900 font-medium outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
            <div className="flex gap-2 flex-1">
              
              {/* 金額輸入框防呆機制 */}
              <input 
                type="number" 
                step="0.1" 
                min="0"  
                placeholder="金額" 
                value={customItemPrice} 
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || Number(val) >= 0) {
                    setCustomItemPrice(val);
                  }
                }} 
                disabled={isExpired} 
                className="w-24 border border-gray-300 p-3 rounded-lg text-gray-900 font-bold text-center outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" 
              />

              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
                <button onClick={() => setCustomItemCount(c => Math.max(1, c - 1))} className="px-3 py-3 hover:bg-gray-100 text-gray-600 font-bold" disabled={isExpired}>-</button>
                <span className="w-8 text-center font-bold text-gray-800">{customItemCount}</span>
                <button onClick={() => setCustomItemCount(c => c + 1)} className="px-3 py-3 hover:bg-gray-100 text-gray-600 font-bold" disabled={isExpired}>+</button>
              </div>
              <button disabled={isExpired} onClick={handleCustomOrder} className={`flex-1 px-4 py-3 rounded-lg font-bold transition shadow-sm whitespace-nowrap ${isExpired ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-500 hover:text-white'}`}>{isExpired ? '已結單' : '加入'}</button>
            </div>
          </div>
        </div>

        {/* 菜單列表 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 print:hidden">
          {menu.map((item) => (
            <MenuCard key={item.id} name={item.name} description={item.description} price={item.price} isExpired={isExpired} onOrder={(qty) => onOrder(item.name, item.price, qty)} />
          ))}
        </div>

        <OrderSummary 
          storeName={activeGroup.store.name} 
          summary={summary} 
          totalAmount={Math.round(summary.reduce((a, b) => a + b.total, 0) * 10) / 10} 
          totalCount={summary.reduce((a, b) => a + b.count, 0)} 
          isExpired={isExpired} 
          onDeleteOrder={onDeleteOrder} 
        />
      </div>

      {showLargeImage && activeGroup.store.image_url && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out animate-fadeIn" onClick={() => setShowLargeImage(false)}>
          <img src={activeGroup.store.image_url} alt={activeGroup.store.name} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
          <button className="absolute top-6 right-6 text-white text-4xl opacity-70 hover:opacity-100 transition">&times;</button>
        </div>
      )}
    </>
  );
}
