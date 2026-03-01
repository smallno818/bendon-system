'use client';
import { useState } from 'react';
import { useGroupOrders } from '@/hooks/UseGroupOrders';

// 引入我們剛剛拆分的 View 元件
import { EmptyStateView } from '@/components/views/EmptyStateView';
import { StoreSelectorOverlay } from '@/components/views/StoreSelectorOverlay';
import { ActiveGroupView } from '@/components/views/ActiveGroupView';
import { StartGroupModal } from '@/components/StartGroupModal';

export default function Home() {
  // 1. 取得所有資料與邏輯
  const {
    todayGroups, activeGroupId, activeGroup, storeList, menu, summary, 
    loading, timeLeft, isExpired,
    switchGroup, createOrder, deleteOrder, createGroup, closeGroup
  } = useGroupOrders();

  // 2. 本地 UI 狀態
  const [showStartGroupModal, setShowStartGroupModal] = useState(false); 
  const [showStoreSelector, setShowStoreSelector] = useState(false);
  const [preSelectedStoreId, setPreSelectedStoreId] = useState<number | null>(null);
  const [inputEndDateTime, setInputEndDateTime] = useState('');

  // 3. 事件處理 (Wrappers)
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const handleOrderSubmit = async (itemName: string, itemPrice: number, quantity: number) => {
    const name = prompt(`你要訂購 ${quantity} 份「${itemName}」，請輸入你的名字：`);
    if (!name) return;
    try { await createOrder(itemName, itemPrice, quantity, name); } 
    catch (e: any) { alert('失敗：' + e.message); }
  };

  const handleDeleteSubmit = async (orderId: number, customerName: string) => {
    const confirmName = prompt(`確定要刪除 ${customerName} 的這份餐點嗎？\n請輸入你的名字「${customerName}」進行確認：`);
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
    if (!window.confirm(`確定要關閉「${activeGroup.store.name}」的團購嗎？\n⚠️ 這會刪除此團的所有訂單，且無法復原！`)) return;
    try { await closeGroup(); } catch (e: any) { alert('刪除失敗：' + e.message); }
  };

  // 點擊卡片邏輯 (統一處理)
  const handleCardClick = (storeId: number) => {
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
            onOpenStoreSelector={() => setShowStoreSelector(true)}
            onOrder={handleOrderSubmit}
            onDeleteOrder={handleDeleteSubmit}
            onCloseGroup={handleCloseGroupSubmit}
            onScrollTop={scrollToTop}
          />
        ) : null}
      </div>

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
          辦公室團購小幫手 v1.0.0
        </p>
        <p className="text-xs text-red-400">
          僅供ML訂便當群組內部使用
        </p>
      </footer>

    </div>
  );
}
