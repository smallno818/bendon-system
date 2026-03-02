import React, { useState } from 'react';
import { Group, Product, SummaryItem } from '@/types';
import { StoreBanner } from '@/components/StoreBanner';
import { MenuCard } from '@/components/MenuCard';
import { OrderSummary } from '@/components/OrderSummary';
import { LineIcon } from '@/components/LineIcon'; // 如果您前面有抽離成元件，就保留這行；如果沒有，請換回 SVG 標籤

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
        setCustomItemName('');
        setCustomItemPrice('');
        setCustomItemCount(1);
      });
  };

  // ★ 整合更新：分享開團資訊 (加入智慧日期判斷與「這次吃」文案)
  const handleShareToLine = () => {
    const end = new Date(activeGroup.end_time);
    const now = new Date();
    
    // 判斷日期
    const isToday = end.toDateString() === now.toDateString();
    
    const tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow = end.toDateString() === tomorrow.toDateString();

    // 預設顯示幾月幾日 (例如: 3/5)
    let datePrefix = `${end.getMonth() + 1}/${end.getDate()}`; 
    if (isToday) datePrefix = "今天";
    else if (isTomorrow) datePrefix = "明天";

    // 格式化時間
    const timeStr = end.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    // 將「今天吃」改為「這次吃」，並套用動態日期
    const text = `🍱 辦公室揪團囉！\n這次吃【${activeGroup.store.name}】\n\n⏱️ 結單時間：${datePrefix} ${timeStr}\n👉 快速點餐連結：\n${window.location.href}`;
    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
    window.open(lineUrl, '_blank');
  };

  // 分享結單與請款明細
  const handleShareSummaryToLine = () => {
    if (summary.length === 0) return alert('目前還沒有人點餐喔！');

    const totalCount = summary.reduce((a, b) => a + b.count, 0);
    const totalAmount = Math.round(summary.reduce((a, b) => a + b.total, 0) * 10) / 10;
    
    // 組合結單文案
    let text = `🔴 【${activeGroup.store.name}】已結單！\n`;
    text += `共計 ${totalCount} 份，總金額 $${totalAmount}\n`;
    text += `----------------------\n`;
    text += `📋 訂購明細：\n`;

    // 條列出每個品項與訂購人
    summary.forEach(item => {
      const unitPrice = Math.round((item.total / item.count) * 10) / 10;
      // 把訂購人串接起來，例如：Carl*2, 小明
      const people = item.orderDetails.map(d => `${d.customer_name}${d.quantity > 1 ? `*${d.quantity}` : ''}`).join(', ');
      
      text += `▪️ ${item.name} ($${unitPrice}): ${people}\n`;
    });

    text += `----------------------\n`;
    text += `再麻煩大家準備好零錢交給主揪囉！感謝！🙏`;

    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
    window.open(lineUrl, '_blank');
  };

  return (
    <>
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

        {/* 按鈕區塊：根據是否結單，顯示不同的分享按鈕 */}
        <div className="flex justify-end mb-4 print:hidden animate-fadeIn">
          {!isExpired ? (
            <button 
              onClick={handleShareToLine}
              className="flex items-center gap-2 bg-[#00B900] text-white px-5 py-2.5 rounded-xl font-bold shadow-sm hover:shadow-md hover:bg-[#00a000] transition-all hover:-translate-y-0.5 active:scale-95"
            >
              <LineIcon className="w-5 h-5" />
              <span>分享揪團連結</span>
            </button>
          ) : (
            <button 
              onClick={handleShareSummaryToLine}
              className="flex items-center gap-2 bg-gray-800 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm hover:shadow-md hover:bg-gray-700 transition-all hover:-translate-y-0.5 active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <span>複製結單明細至 LINE</span>
            </button>
          )}
        </div>
        
        {/* 客製化輸入區 */}
        <div className={`mb-8 bg-white p-5 rounded-xl border-2 border-dashed border-blue-200 shadow-sm print:hidden ${isExpired ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-2 mb-3"><span className="text-xl font-bold text-gray-700">✏️ 客製化 / 隱藏版 ({activeGroup.store.name})</span></div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" placeholder={isExpired ? "已停止下單" : "輸入需求 (例：半糖少冰)"} value={customItemName} onChange={(e) => setCustomItemName(e.target.value)} disabled={isExpired} className="flex-[2] border border-gray-300 p-3 rounded-lg text-gray-900 font-medium outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
            <div className="flex gap-2 flex-1">
              <input type="number" step="0.1" min="0" placeholder="金額" value={customItemPrice} onChange={(e) => { const val = e.target.value; if (val === '' || Number(val) >= 0) setCustomItemPrice(val); }} disabled={isExpired} className="w-24 border border-gray-300 p-3 rounded-lg text-gray-900 font-bold text-center outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
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