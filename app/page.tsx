'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// 引入元件
import { StoreBanner } from '@/components/StoreBanner';
import { MenuCard } from '@/components/MenuCard';
import { OrderSummary } from '@/components/OrderSummary';
import { StartGroupModal } from '@/components/StartGroupModal'; // ★ 新增引用

// 型別定義
type Store = { id: number; name: string; image_url: string | null; phone: string | null; };
type Product = { id: number; store_id: number; name: string; price: number; description: string | null; };
type Order = { id: number; item_name: string; price: number; customer_name: string; quantity: number; group_id: number; };
type SummaryItem = { name: string; count: number; total: number; orderDetails: { id: number; customer_name: string; quantity: number }[]; };
// ★ 修改 Group 定義，加入 name (團購名稱)
type Group = { id: number; store_id: number; end_time: string; name: string | null; store: Store };

export default function Home() {
  // 資料狀態
  const [todayGroups, setTodayGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [storeList, setStoreList] = useState<Store[]>([]); // ★ 儲存所有店家清單
  
  const [menu, setMenu] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);
  const [showLargeImage, setShowLargeImage] = useState(false);
  const [showStartGroupModal, setShowStartGroupModal] = useState(false); // ★ 控制開團 Modal

  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemCount, setCustomItemCount] = useState(1);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // 初始化與監聽
  useEffect(() => {
    fetchStores(); // ★ 先抓店家清單，開團要用
    fetchTodayGroups();
    
    // 監聽群組變化
    const groupChannel = supabase.channel('realtime_groups')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'daily_groups' }, () => fetchTodayGroups())
      .subscribe();

    // 監聽訂單變化
    const ordersChannel = supabase.channel('realtime_orders')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'orders' }, () => {
        if (activeGroupId) fetchOrders(activeGroupId);
      })
      .subscribe();
    
    const timer = setInterval(updateCountdown, 1000);

    const handleScroll = () => {
      if (window.scrollY > 300) setShowScrollTop(true);
      else setShowScrollTop(false);
    };
    window.addEventListener('scroll', handleScroll);

    return () => {
      supabase.removeChannel(groupChannel);
      supabase.removeChannel(ordersChannel);
      clearInterval(timer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [activeGroupId]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 0. 抓取所有店家 (給開團選單用)
  const fetchStores = async () => {
    const { data } = await supabase.from('stores').select('*').order('id');
    if (data) setStoreList(data);
  };

  // 1. 抓取今日所有開團
  const fetchTodayGroups = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('daily_groups')
      .select('*, store:stores(*)')
      .eq('order_date', today)
      .order('id', { ascending: true });
    
    if (data && data.length > 0) {
      setTodayGroups(data as any);
      // 如果目前沒有選中任何分頁，或選中的分頁不見了，預設選第一個
      if (!activeGroupId || !data.find((g: any) => g.id === activeGroupId)) {
        handleSwitchGroup(data[0].id, data[0].store_id);
      } else {
        fetchOrders(activeGroupId);
      }
    } else {
      setTodayGroups([]);
      setActiveGroupId(null);
    }
    setLoading(false);
  };

  // 2. 切換分頁
  const handleSwitchGroup = async (groupId: number, storeId: number) => {
    setActiveGroupId(groupId);
    const { data: menuData } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .order('price', { ascending: true });
    if (menuData) setMenu(menuData);
    
    fetchOrders(groupId);
    setCustomItemName(''); setCustomItemPrice(''); setCustomItemCount(1);
  };

  // 3. 抓取訂單
  const fetchOrders = async (groupId: number) => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    
    if (data) { 
      setOrders(data); 
      calculateSummary(data); 
    }
  };

  const calculateSummary = (ordersData: Order[]) => {
    const stats: Record<string, SummaryItem> = {};
    ordersData.forEach(order => {
      const qty = order.quantity || 1;
      if (!stats[order.item_name]) stats[order.item_name] = { name: order.item_name, count: 0, total: 0, orderDetails: [] };
      stats[order.item_name].count += qty;
      let newTotal = stats[order.item_name].total + (order.price * qty);
      stats[order.item_name].total = Math.round(newTotal * 10) / 10;
      stats[order.item_name].orderDetails.push({ id: order.id, customer_name: order.customer_name, quantity: qty });
    });
    setSummary(Object.values(stats));
  };

  const updateCountdown = () => {
    if (!activeGroupId || todayGroups.length === 0) return;
    const currentGroup = todayGroups.find(g => g.id === activeGroupId);
    if (!currentGroup?.end_time) return;

    const now = new Date().getTime();
    const end = new Date(currentGroup.end_time).getTime();
    const diff = end - now;

    if (diff <= 0) { 
      setIsExpired(true); 
      setTimeLeft('🔴 已結單'); 
    } else {
      setIsExpired(false);
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`⏳ 倒數：${hours}時 ${mins}分 ${secs}秒`);
    }
  };

  const handleOrder = async (itemName: string, itemPrice: number, quantity: number = 1) => {
    if (isExpired) return alert('🔴 抱歉，已經超過結單時間，無法再點餐！');
    if (!activeGroupId) return;

    const name = prompt(`你要訂購 ${quantity} 份「${itemName}」，請輸入你的名字：`);
    if (!name) return;

    const { error } = await supabase.from('orders').insert([{ 
      item_name: itemName, 
      price: itemPrice, 
      customer_name: name,
      quantity: quantity,
      group_id: activeGroupId
    }]);

    if (!error) { 
      setCustomItemName(''); setCustomItemPrice(''); setCustomItemCount(1);
    } else {
      alert('失敗：' + error.message);
    }
  };

  const handleDeleteOrder = async (orderId: number, customerName: string) => {
    if (isExpired) return alert('🔴 已結單，無法修改或刪除訂單。');
    const confirmName = prompt(`確定要刪除 ${customerName} 的這份餐點嗎？\n請輸入你的名字「${customerName}」進行確認：`);
    if (confirmName === customerName) {
      const { error } = await supabase.from('orders').delete().eq('id', orderId);
      if (error) alert('刪除失敗：' + error.message);
    } else if (confirmName !== null) alert('名字輸入不正確，刪除失敗。');
  };

  // ★ 新增：處理開團邏輯
  const handleCreateGroup = async (storeId: number, endTime: string, groupName: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const fullEndDateTime = new Date(endTime).toISOString();

    const { error } = await supabase.from('daily_groups').insert([{
      order_date: todayStr,
      store_id: storeId,
      end_time: fullEndDateTime,
      name: groupName || null // 如果沒填名稱就存 null
    }]);

    if (!error) {
      alert('✅ 開團成功！');
      setShowStartGroupModal(false);
      fetchTodayGroups();
    } else {
      alert('開團失敗：' + error.message);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500 font-medium">系統載入中...</div>;

  // 取得當前選中的 Group 物件
  const activeGroupData = todayGroups.find(g => g.id === activeGroupId);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 relative">
      
      {/* 開團 Modal */}
      {showStartGroupModal && (
        <StartGroupModal 
          stores={storeList} 
          onClose={() => setShowStartGroupModal(false)} 
          onSubmit={handleCreateGroup} 
        />
      )}

      {/* 狀況一：今天完全沒團，顯示大大的開團按鈕 */}
      {todayGroups.length === 0 ? (
        <div className="max-w-4xl mx-auto p-10 text-center mt-10">
          <div className="bg-white p-16 rounded-3xl shadow-xl border border-indigo-50 flex flex-col items-center">
            <div className="text-6xl mb-6">🍽️</div>
            <h1 className="text-4xl font-black text-gray-800 mb-4 tracking-tight">今天還沒開團喔</h1>
            <p className="text-gray-500 text-lg mb-8 font-medium">肚子餓了嗎？快當第一個發起團購的人！</p>
            <button 
              onClick={() => setShowStartGroupModal(true)}
              className="px-10 py-5 bg-indigo-600 text-white text-xl font-bold rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all active:scale-95 flex items-center gap-3"
            >
              <span>🚀</span>
              <span>發起第一個團購</span>
            </button>
          </div>
        </div>
      ) : (
        // 狀況二：有團購，顯示 Tabs
        <>
          <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm print:hidden">
            <div className="max-w-5xl mx-auto px-4 flex items-center gap-2 overflow-x-auto py-3 scrollbar-hide">
              {todayGroups.map(group => (
                <button
                  key={group.id}
                  onClick={() => handleSwitchGroup(group.id, group.store_id)}
                  className={`flex flex-col items-start px-5 py-1.5 rounded-xl transition-all border ${
                    activeGroupId === group.id 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105' 
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <span className="font-bold text-sm whitespace-nowrap">
                    {group.store.name}
                  </span>
                  <span className={`text-[10px] ${activeGroupId === group.id ? 'text-indigo-200' : 'text-gray-400'}`}>
                    {group.name ? group.name : '團購 #' + group.id}
                  </span>
                </button>
              ))}

              {/* ★ 在 Tabs 旁邊顯示一個小的 + 按鈕 */}
              <button
                onClick={() => setShowStartGroupModal(true)}
                className="ml-2 w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 border border-dashed border-gray-300 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 transition-all font-bold text-xl"
                title="再開一團"
              >
                ＋
              </button>
            </div>
          </div>

          {activeGroupData && (
            <>
              <StoreBanner 
                name={activeGroupData.store.name} 
                imageUrl={activeGroupData.store.image_url} 
                phone={activeGroupData.store.phone} 
                timeLeft={timeLeft} 
                endTime={activeGroupData.end_time} 
                isExpired={isExpired} 
                onShowLargeImage={() => setShowLargeImage(true)} 
              />

              <button onClick={scrollToTop} className={`fixed bottom-8 right-8 z-40 bg-gray-700/80 text-white p-3 rounded-full shadow-lg backdrop-blur-sm hover:bg-gray-900 transition-all duration-300 print:hidden ${showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`} title="回到頂部">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              </button>

              <div className="max-w-5xl mx-auto p-4 print:p-0 print:max-w-none">
                
                {/* 客製化輸入區塊 */}
                <div className={`mb-8 bg-white p-5 rounded-xl border-2 border-dashed border-blue-200 shadow-sm print:hidden ${isExpired ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl font-bold text-gray-700">✏️ 客製化 / 隱藏版 ({activeGroupData.store.name})</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input type="text" placeholder={isExpired ? "已停止下單" : "輸入需求 (例：半糖少冰)"} value={customItemName} onChange={(e) => setCustomItemName(e.target.value)} disabled={isExpired} className="flex-[2] border border-gray-300 p-3 rounded-lg text-gray-900 font-medium outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
                    <div className="flex gap-2 flex-1">
                      <input type="number" step="0.1" placeholder="金額" value={customItemPrice} onChange={(e) => setCustomItemPrice(e.target.value)} disabled={isExpired} className="w-24 border border-gray-300 p-3 rounded-lg text-gray-900 font-bold text-center outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
                        <button onClick={() => setCustomItemCount(c => Math.max(1, c - 1))} className="px-3 py-3 hover:bg-gray-100 text-gray-600 font-bold" disabled={isExpired}>-</button>
                        <span className="w-8 text-center font-bold text-gray-800">{customItemCount}</span>
                        <button onClick={() => setCustomItemCount(c => c + 1)} className="px-3 py-3 hover:bg-gray-100 text-gray-600 font-bold" disabled={isExpired}>+</button>
                      </div>
                      <button disabled={isExpired} onClick={() => { if(!customItemName || !customItemPrice) return alert('請輸入完整內容與金額'); handleOrder(customItemName, parseFloat(customItemPrice), customItemCount); }} className={`flex-1 px-4 py-3 rounded-lg font-bold transition whitespace-nowrap ${isExpired ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>下單</button>
                    </div>
                  </div>
                </div>

                {/* 菜單列表 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 print:hidden">
                  {menu.map((item) => (
                    <MenuCard key={item.id} name={item.name} description={item.description} price={item.price} isExpired={isExpired} onOrder={(count: number) => handleOrder(item.name, item.price, count)} />
                  ))}
                </div>

                {/* 訂單統計 */}
                <OrderSummary 
                  storeName={activeGroupData.store.name} 
                  summary={summary} 
                  totalAmount={Math.round(summary.reduce((a, b) => a + b.total, 0) * 10) / 10} 
                  totalCount={summary.reduce((a, b) => a + b.count, 0)}
                  isExpired={isExpired} 
                  onDeleteOrder={handleDeleteOrder} 
                />
              </div>

              {showLargeImage && activeGroupData.store.image_url && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out animate-fadeIn" onClick={() => setShowLargeImage(false)}>
                  <img src={activeGroupData.store.image_url} alt={activeGroupData.store.name} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
                  <button className="absolute top-6 right-6 text-white text-4xl opacity-70 hover:opacity-100 transition">&times;</button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}