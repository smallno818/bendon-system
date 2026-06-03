import React, { useState, useEffect } from 'react';
import { SummaryItem } from '@/types';
import { OrderSummary } from '@/components/OrderSummary'; // ★ 魔法在這裡：直接引入您完美的訂單明細元件

type Props = {
  onClose: () => void;
  historyLogs: any[];
  fetchHistoryByDate: (date: string) => void;
};

export function HistoryModal({ onClose, historyLogs, fetchHistoryByDate }: Props) {
  // 預設選擇今天的日期
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [printingId, setPrintingId] = useState<number | null>(null);

  // 當選擇的日期改變時，重新撈取資料
  useEffect(() => {
    fetchHistoryByDate(selectedDate);
  }, [selectedDate, fetchHistoryByDate]);

  return (
    // ★ 加上 print: 相關的 class，確保列印時背景變白，且只印出 Modal 內的內容
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm print:absolute print:inset-0 print:bg-white print:p-0 print:block print:z-[9999]">
      
      {/* 加上這段樣式是為了確保列印時，不會印到背後透明的「今日團購」畫面 */}
      <style>{`
        @media print {
          body { overflow: visible !important; }
          #history-modal-content {
            position: absolute; left: 0; top: 0; width: 100%; background: white;
          }
        }
      `}</style>

      <div id="history-modal-content" className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn print:shadow-none print:max-h-none print:w-full print:rounded-none print:bg-white print:overflow-visible">
        
        {/* 標題列 (列印時自動隱藏) */}
        <div className="bg-white px-6 py-4 border-b flex justify-between items-center sticky top-0 z-10 print:hidden">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span>📜</span> 歷史訂單查詢
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-3xl leading-none" title="關閉">&times;</button>
        </div>
        
        {/* 內容區塊 */}
        <div className="p-6 overflow-y-auto flex-1 print:p-0 print:overflow-visible">
          {/* 選擇日期過濾器 (列印時自動隱藏) */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 print:hidden">
            <label className="font-bold text-gray-700 whitespace-nowrap">選擇結單日期：</label>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-gray-700 bg-gray-50"
            />
          </div>

          {/* 歷史紀錄列表 */}
          {historyLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-500 font-medium bg-white rounded-xl border border-dashed border-gray-300 print:hidden">
              這天沒有已結單的歷史紀錄喔！
            </div>
          ) : (
            <div className="space-y-8 print:space-y-4">
              {historyLogs.map(log => {
                // 將 JSON 轉回 SummaryItem 陣列
                const summary: SummaryItem[] = log.summary_json || [];
                // ★ 判斷：如果系統正在列印，且這筆不是我們點擊的那筆，就加上 print:hidden 讓它在紙上消失！
                const isHiddenDuringPrint = printingId !== null && printingId !== log.id;
                return (
                  <div key={log.id} className={`relative ${isHiddenDuringPrint ? 'print:hidden' : ''}`}>
                    {/* ★ 直接使用原本的 OrderSummary 元件 */}
                    <OrderSummary 
                      storeName={log.store_name} 
                      storePhone={null} // 快照沒有存電話，傳 null 即可
                      summary={summary} 
                      totalAmount={log.total_amount} 
                      totalCount={log.total_count} 
                      isExpired={true} // ★ 傳入 true，它就會自動隱藏 + 跟 x 按鈕，變成純閱讀模式！
                      endTime={log.end_time}
                      onDeleteOrder={() => {}} // 歷史紀錄不能刪除，所以給個空函式
                      // ★ 新增：自訂列印行為
                      onPrint={() => {
                        setPrintingId(log.id); // 1. 先告訴系統「我要印這個 ID」
                        // 2. 給 React 100 毫秒的時間更新畫面（把其他筆隱藏起來）再觸發列印
                        setTimeout(() => {
                          window.print();
                          setPrintingId(null); // 3. 印完之後，把狀態清空，讓大家恢復原狀
                        }, 100);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}