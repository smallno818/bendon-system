'use client';
import { useState, useEffect } from 'react';
import { useGroupOrders } from '@/hooks/UseGroupOrders';

// 引入我們剛剛拆分的 View 元件
import { EmptyStateView } from '@/components/views/EmptyStateView';
import { StoreSelectorOverlay } from '@/components/views/StoreSelectorOverlay';
import { ActiveGroupView } from '@/components/views/ActiveGroupView';
import { StartGroupModal } from '@/components/StartGroupModal';
import MaintenanceView from '@/components/MaintenanceView';
import { HistoryModal } from '@/components/HistoryModal'; // ★ 新增這行

export default function Home() {
  const isDev = process.env.NODE_ENV === 'development';
  const isMaintenance = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true';

  // 只有在「非開發環境」且「開啟維護模式」時才攔截
  if (isMaintenance && !isDev) {
    return <MaintenanceView />;
  }
  // 1. 取得所有資料與邏輯
  const {
    todayGroups, activeGroupId, activeGroup, storeList, menu, summary, 
    loading, timeLeft, isExpired,
    switchGroup, createOrder, deleteOrder, createGroup, closeGroup, closeGroupEarly,
    historyLogs, fetchHistoryByDate, markGroupAsPrinted // ★ 把這兩個加進來
  } = useGroupOrders();

  // 2. 本地 UI 狀態
  const [showStartGroupModal, setShowStartGroupModal] = useState(false); 
  const [showStoreSelector, setShowStoreSelector] = useState(false);
  const [preSelectedStoreId, setPreSelectedStoreId] = useState<number | null>(null);
  const [inputEndDateTime, setInputEndDateTime] = useState('');

  // ==========================================
  // ★ 新增：控制關閉防呆與列印狀態
  const [showUnprintedWarning, setShowUnprintedWarning] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false); // ★ 新增：控制歷史查詢彈窗

  // ★ 修改：監聽列印動作時，直接寫入資料庫！
  useEffect(() => {
    const handlePrint = () => {
      if (activeGroupId) {
        markGroupAsPrinted(activeGroupId);
      }
    };
    window.addEventListener('afterprint', handlePrint);
    return () => window.removeEventListener('afterprint', handlePrint);
  }, [activeGroupId, markGroupAsPrinted]);

  // 3. 事件處理 (Wrappers)
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const handleOrderSubmit = async (itemName: string, itemPrice: number, quantity: number, remark: string = '') => {
    const savedName = localStorage.getItem('bendon_user_name') || '';
    const name = prompt(`你要訂購 ${quantity} 份「${itemName}」，請輸入你的名字：`, savedName);
    if (!name) return;
    localStorage.setItem('bendon_user_name', name.trim());
    try { await createOrder(itemName, itemPrice, quantity, name, remark); } 
    catch (e: any) { alert('失敗：' + e.message); }
  };

  const handleDeleteSubmit = async (orderId: number, customerName: string) => {
    const savedName = localStorage.getItem('bendon_user_name') || '';

    const confirmName = prompt(`確定要刪除 ${customerName} 的這份餐點嗎？\n請輸入你的名字「${customerName}」進行確認：`, savedName);
    if (confirmName === customerName) {
      try { await deleteOrder(orderId); } 
      catch (e: any) { alert('刪除失敗：' + e.message); }
    } else if (confirmName !== null) { alert('名字輸入不正確，刪除失敗。'); }
  };

  const handleCreateGroupSubmit = async (storeId: number, endTime: string, groupName: string) => {
    try {
      await createGroup(storeId, endTime, groupName);
      alert('✅ 開團成功！');
      setShowStartGroupModal(false);
      setShowStoreSelector(false);
      setPreSelectedStoreId(null);
      setInputEndDateTime('');
    } catch (e: any) { alert('開團失敗：' + e.message); }
  };

  const handleCloseGroupSubmit = async () => {
    if (!activeGroup) return;
    
    // ★ 修改：直接判斷資料庫裡的 is_printed 欄位
    if (!activeGroup.is_printed) {
      setShowUnprintedWarning(true);
    } else {
      setShowCloseModal(true);
    }
  };

  // ★ 新增：真正去執行關閉的動作 (給最後的確定按鈕用的)
  const executeCloseGroup = async () => {
    try { 
      await closeGroup(); 
      setShowCloseModal(false);
      setShowUnprintedWarning(false);
    } catch (e: any) { 
      alert('關閉失敗：' + e.message); 
    }
  };
  // ==========================================

  // 點擊卡片邏輯 (統一處理)
  const handleCardClick = (storeId: number) => {
    if (todayGroups.length >= 5) {
      return alert('❌ 目前同時開團數量已達上限 (5 個)！\n請先將部分團購結單並刪除後，再開啟新團。');
    }
    if (inputEndDateTime) {
      if (new Date(inputEndDateTime).getTime() <= new Date().getTime()) {
        return alert('❌ 設定的結單時間已經過了，請選擇未來的時間！');
      }
      const storeName = storeList.find(s => s.id === storeId)?.name;
      if (!window.confirm(`確定要直接發起「${storeName}」的團購嗎？\n結單時間：${new Date(inputEndDateTime).toLocaleString()}`)) return;
      handleCreateGroupSubmit(storeId, inputEndDateTime, ''); 
    } else {
      setPreSelectedStoreId(storeId);
      setShowStartGroupModal(true);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500 font-medium">系統載入中...</div>;

  return (
    <div className="min-h-screen bg-gray-50 relative flex flex-col">
      
      {/* 彈窗：設定時間 */}
      {showStartGroupModal && (
        <StartGroupModal 
          stores={storeList} 
          initialStoreId={preSelectedStoreId}
          onClose={() => { setShowStartGroupModal(false); setPreSelectedStoreId(null); }} 
          onSubmit={handleCreateGroupSubmit} 
        />
      )}

      {/* 彈窗：全螢幕店家牆 */}
      {showStoreSelector && (
        <StoreSelectorOverlay 
          storeList={storeList}
          inputEndDateTime={inputEndDateTime}
          setInputEndDateTime={setInputEndDateTime}
          onStoreSelect={handleCardClick}
          onClose={() => setShowStoreSelector(false)}
        />
      )}

      {/* 主要內容區塊 */}
      <div className="flex-grow pb-20">
        {todayGroups.length === 0 ? (
          <EmptyStateView 
            storeList={storeList}
            inputEndDateTime={inputEndDateTime}
            setInputEndDateTime={setInputEndDateTime}
            onStoreSelect={handleCardClick}
          />
        ) : activeGroup ? (
          <ActiveGroupView 
            todayGroups={todayGroups}
            activeGroupId={activeGroupId}
            activeGroup={activeGroup}
            menu={menu}
            summary={summary}
            timeLeft={timeLeft}
            isExpired={isExpired}
            onSwitchGroup={switchGroup}
            onOpenStoreSelector={() => {
              if (todayGroups.length >= 5) {
                alert('❌ 目前同時開團數量已達上限 (5 個)！\n請先將部分團購結單並刪除後，再開啟新團。');
              } else {
                setShowStoreSelector(true);
              }
            }}
            onOrder={handleOrderSubmit}
            onDeleteOrder={handleDeleteSubmit}
            onCloseGroup={handleCloseGroupSubmit}
            onScrollTop={scrollToTop}
            onCloseGroupEarly={closeGroupEarly}
          />
        ) : null}
      </div>

      {/* ========================================== */}
      {/* ★ 新增：未列印警告彈窗 */}
      {showUnprintedWarning && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-fadeIn border-l-8 border-amber-500">
            <h3 className="text-xl font-bold text-amber-600 mb-2">⚠️ 尚未列印明細</h3>
            <p className="text-gray-600 mb-6 font-medium">
              您似乎還沒有列印或備份這次的訂單明細。<br/>確定要<span className="text-amber-600 font-bold">不列印</span>就直接關閉團購嗎？
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowUnprintedWarning(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition">
                取消，我要去列印
              </button>
              <button onClick={() => { setShowUnprintedWarning(false); setShowCloseModal(true); }} className="px-4 py-2 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg font-bold hover:bg-amber-100 transition">
                是，跳過列印
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ★ 新增：關閉團購最終確認彈窗 (大字、紅字) */}
      {showCloseModal && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-fadeIn border-2 border-red-500 transform scale-105">
            <h3 className="text-3xl font-black text-red-600 mb-4 text-center tracking-wider">🚨 警告 🚨</h3>
            <p className="text-red-500 text-xl font-bold mb-2 text-center">
              確定要關閉「{activeGroup?.store.name}」嗎？
            </p>
            <p className="text-gray-600 text-sm mb-8 text-center font-medium bg-red-50 p-3 rounded-lg">
              關閉後，所有明細將移至歷史快照紀錄，<br/>畫面上的點餐資料將被<strong className="text-red-500">全部清空</strong>！
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowCloseModal(false)} className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition text-lg">
                取消
              </button>
              <button onClick={executeCloseGroup} className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-black text-lg hover:bg-red-700 shadow-md hover:shadow-lg transition transform hover:-translate-y-0.5">
                確認關閉
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ========================================== */}

      {/* 頁尾作者資訊區塊 (列印時隱藏) */}
      <footer className="w-full py-6 text-center text-gray-400 text-sm border-t border-gray-200 mt-auto print:hidden">
        <p className="mb-1">
          Made with <span className="text-red-400">Next.js</span> by{' '}
          <span className="font-bold text-gray-500 hover:text-indigo-500 transition-colors cursor-default">
            ML-Carl
          </span>{' '}
          &copy; {new Date().getFullYear()}
        </p>
        <p className="text-xs text-gray-400">
          辦公室團購小幫手 v1.0.1
        </p>
        <p className="text-xs text-red-400">
          僅供ML訂便當群組內部使用
        </p>
      </footer>
      {/* ★ 新增：左下角浮動按鈕 (歷史紀錄) */}
      <button 
        onClick={() => setShowHistoryModal(true)} 
        className="fixed bottom-8 left-8 z-30 bg-white text-gray-700 border-2 border-gray-200 p-3 sm:px-5 sm:py-3 rounded-full shadow-lg hover:bg-gray-50 transition-all duration-300 print:hidden flex items-center justify-center gap-2 font-bold group" 
        title="歷史訂單查詢"
      >
        <span className="text-xl group-hover:scale-110 transition-transform">📜</span>
        <span className="hidden sm:inline">歷史紀錄</span>
      </button>

      {/* ★ 新增：歷史紀錄查詢彈跳視窗 */}
      {showHistoryModal && (
        <HistoryModal 
          onClose={() => setShowHistoryModal(false)}
          historyLogs={historyLogs}
          fetchHistoryByDate={fetchHistoryByDate}
        />
      )}

    </div>
  );
}