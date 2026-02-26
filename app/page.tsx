'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// 引入元件
import { StoreCard } from '@/components/StoreCard';
import { StoreBanner } from '@/components/StoreBanner';
import { MenuCard } from '@/components/MenuCard';
import { OrderSummary } from '@/components/OrderSummary';

// 型別定義
type Store = { id: number; name: string; image_url: string | null; phone: string | null; };
type Product = { id: number; store_id: number; name: string; price: number; description: string | null; };
type Order = { id: number; item_name: string; price: number; customer_name: string; };
type SummaryItem = { name: string; count: number; total: number; orderDetails: { id: number; customer_name: string }[]; };

export default function Home() {
  // --- 狀態管理 ---
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [storeList, setStoreList] = useState<Store[]>([]);
  const [menu, setMenu] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 時間與狀態
  const [endTime, setEndTime] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);
  const [showLargeImage, setShowLargeImage] = useState(false);
  const [inputEndDateTime, setInputEndDateTime] = useState('');

  // 客製化品項狀態
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemCount, setCustomItemCount] = useState(1); // 客製化數量預設 1

  // 回到頂部按鈕狀態
  const [showScrollTop, setShowScrollTop] = useState(false);

  // --- 初始化與 Real-time 監聽 ---
  useEffect(() => {
    checkDailyStatus();
    
    // 訂單更新監聽
    const ordersChannel = supabase.channel('realtime_orders')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'orders' }, () => fetchTodayOrders())
      .subscribe();
    
    // 每日狀態監聽 (例如有人切換店家)
    const statusChannel = supabase.channel('realtime_status')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'daily_status' }, () => checkDailyStatus())
      .subscribe();
    
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);

    // 捲動監聽
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(statusChannel);
      clearInterval(timer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [endTime]);

  // --- 功能函數 ---

  // 1. 回到頂部
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 2. 倒數計時邏輯
  const updateCountdown = () => {
    if (!endTime) { setTimeLeft(''); setIsExpired(false); return; }
    const now = new Date().getTime();
    const end = new Date(endTime).getTime();
    const diff = end - now;
    if (diff <= 0) { 
      setIsExpired(true); 
      setTimeLeft('🔴 已結單'); 
    } else {
      setIsExpired(false);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      let timeString = `${hours}時 ${mins}分 ${secs}秒`;
      if (days > 0) timeString = `${days}天 ${timeString}`;
      setTimeLeft(`⏳ 倒數：${timeString}`);
    }
  };

  // 3. 檢查每日狀態
  const checkDailyStatus = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data: statusData } = await supabase.from('daily_status').select('*').eq('order_date', today).order('id', { ascending: false }).limit(1).maybeSingle();
    
    if (statusData?.active_store_id) {
      setEndTime(statusData.end_time);
      await loadStoreData(statusData.active_store_id);
    } else {
      setCurrentStore(null);
      setEndTime(null);
      setIsExpired(false);
      const { data: stores } = await supabase.from('stores').select('*');
      if (stores) setStoreList(stores);
    }
    setLoading(false);
  };

  // 4. 載入店家與菜單 (含價格排序)
  const loadStoreData = async (storeId: number) => {
    const { data: store } = await supabase.from('stores').select('*').eq('id', storeId).single();
    setCurrentStore(store);
    
    const { data: menuData } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .order('price', { ascending: true }); // 依價格排序

    if (menuData) setMenu(menuData);
    fetchTodayOrders();
  };

  // 5. 選擇店家
  const handleSelectStore = async (storeId: number) => {
    if (!inputEndDateTime) return alert('請先設定「結單日期與時間」！');
    
    const todayStr = new Date().toISOString().split('T')[0];
    const fullEndDateTime = new Date(inputEndDateTime).toISOString();
    
    if (new Date(fullEndDateTime).getTime() <= new Date().getTime()) {
      return alert('❌ 設定的結單時間已經過了，請選擇未來的時間！');
    }

    if (!window.confirm(`將設定於 ${new Date(inputEndDateTime).toLocaleString()} 結單，確定嗎？`)) return;
    
    setIsExpired(false); 
    await supabase.from('daily_status').delete().eq('order_date', todayStr);
    const { error } = await supabase.from('daily_status').insert([{ active_store_id: storeId, order_date: todayStr, end_time: fullEndDateTime }]);
    if (!error) checkDailyStatus();
  };

  // 6. 重置/換一家
  const handleResetStore = async () => {
    if (!window.confirm('確定要換一家吃嗎？\n⚠️ 這會「清空」大家已經點的餐喔！')) return;
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('orders').delete().gte('created_at', `${today}T00:00:00`);
    await supabase.from('daily_status').delete().eq('order_date', today);
    setCurrentStore(null);
    setEndTime(null);
    setIsExpired(false);
    checkDailyStatus();
  };

  // 7. 抓取今日訂單
  const fetchTodayOrders = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('orders').select('*').gte('created_at', `${today}T00:00:00`).order('created_at', { ascending: false });
    if (data) { setOrders(data); calculateSummary(data); }
  };

  // 8. 計算統計 (含浮點數修正)
  const calculateSummary = (ordersData: Order[]) => {
    const stats: Record<string, SummaryItem> = {};
    ordersData.forEach(order => {
      if (!stats[order.item_name]) stats[order.item_name] = { name: order.item_name, count: 0, total: 0, orderDetails: [] };
      stats[order.item_name].count += 1;
      
      let newTotal = stats[order.item_name].total + order.price;
      // 四捨五入到小數點第一位
      stats[order.item_name].total = Math.round(newTotal * 10) / 10;
      
      stats[order.item_name].orderDetails.push({ id: order.id, customer_name: order.customer_name });
    });
    setSummary(Object.values(stats));
  };

  // 9. 下單處理 (支援數量與批次寫入)
  const handleOrder = async (itemName: string, itemPrice: number, quantity: number = 1) => {
    const isNowExpired = endTime && new Date(endTime).getTime() <= new Date().getTime();
    if (isExpired || isNowExpired) {
       setIsExpired(true);
       return alert('🔴 抱歉，已經超過結單時間，無法再點餐！');
    }

    const name = prompt(`你要訂購 ${quantity} 份「${itemName}」，請輸入你的名字：`);
    if (!name) return;

    // 建立多筆訂單陣列
    const ordersToInsert = [];
    for (let i = 0; i < quantity; i++) {
      ordersToInsert.push({ 
        item_name: itemName, 
        price: itemPrice, 
        customer_name: name 
      });
    }

    const { error } = await supabase.from('orders').insert(ordersToInsert);

    if (!error) { 
      // 清空客製化輸入
      setCustomItemName(''); 
      setCustomItemPrice(''); 
      setCustomItemCount(1);
    } else {
      alert('失敗：' + error.message);
    }
  };

  // 10. 刪除訂單
  const handleDeleteOrder = async (orderId: number, customerName: string) => {
    if (isExpired) return alert('🔴 已結單，無法修改或刪除訂單。');
    const confirmName = prompt(`確定要刪除 ${customerName} 的這份餐點嗎？\n請輸入你的名字「${customerName}」進行確認：`);
    if (confirmName === customerName) {
      const { error } = await supabase.from('orders').delete().eq('id', orderId);
      if (error) alert('刪除失敗：' + error.message);
    } else if (confirmName !== null) alert('名字輸入不正確，刪除失敗。');
  };

  if (loading) return <div className="p-10 text-center text-gray-500 font-medium">系統載入中...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 relative">
      {!currentStore ? (
        // --- 尚未選擇店家 ---
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-3xl font-bold text-center mb-6 text-gray-900">🍱 今天吃什麼？</h1>
          <div className="flex justify-center mb-8">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm flex flex-col items-center gap-2">
              <label className="text-sm font-bold text-blue-800">1. 請先設定結單時間 (含日期)：</label>
              <input type="datetime-local" value={inputEndDateTime} onChange={e => setInputEndDateTime(e.target.value)} className="border-2 border-blue-300 p-2 rounded-lg text-lg font-bold text-gray-700 outline-none focus:border-blue-500 bg-white" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {storeList.map(store => (
              <StoreCard key={store.id} name={store.name} imageUrl={store.image_url} phone={store.phone} onSelect={() => handleSelectStore(store.id)} />
            ))}
          </div>
        </div>
      ) : (
        // --- 已選擇店家 ---
        <>
          <StoreBanner 
            name={currentStore.name} 
            imageUrl={currentStore.image_url} 
            phone={currentStore.phone} 
            timeLeft={timeLeft} 
            endTime={endTime} 
            isExpired={isExpired} 
            onShowLargeImage={() => setShowLargeImage(true)} 
          />

          {/* 回到頂部按鈕 */}
          <button 
            onClick={scrollToTop}
            className={`fixed bottom-28 right-8 z-40 bg-gray-700/80 text-white p-3 rounded-full shadow-lg backdrop-blur-sm hover:bg-gray-900 transition-all duration-300 print:hidden ${showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
            title="回到頂部"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>

          {/* 換一家按鈕 */}
          <button onClick={handleResetStore} className="fixed bottom-8 right-8 z-40 bg-orange-600 text-white px-6 py-4 rounded-2xl shadow-2xl hover:bg-orange-700 transition-all hover:scale-105 active:scale-95 print:hidden border-2 border-white/20">
            <span className="text-xl font-bold">🔄 換一家</span>
          </button>

          <div className="max-w-5xl mx-auto p-4 print:p-0 print:max-w-none">
            
            {/* 客製化輸入區塊 (置頂) */}
            <div className={`mb-8 bg-white p-5 rounded-xl border-2 border-dashed border-blue-200 shadow-sm print:hidden ${isExpired ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl font-bold text-gray-700">✏️ 客製化品項 / 特殊需求</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input type="text" placeholder={isExpired ? "已停止下單" : "輸入需求 (例：雞腿飯-不要蔥)"} value={customItemName} onChange={(e) => setCustomItemName(e.target.value)} disabled={isExpired} className="flex-[2] border border-gray-300 p-3 rounded-lg text-gray-900 font-medium outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
                <div className="flex gap-2 flex-1">
                  {/* 支援小數點價格 */}
                  <input 
                    type="number" 
                    step="0.1" 
                    placeholder="金額" 
                    value={customItemPrice} 
                    onChange={(e) => setCustomItemPrice(e.target.value)} 
                    disabled={isExpired} 
                    className="w-24 border border-gray-300 p-3 rounded-lg text-gray-900 font-bold text-center outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" 
                  />
                  
                  {/* 客製化數量控制器 */}
                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
                    <button onClick={() => setCustomItemCount(c => Math.max(1, c - 1))} className="px-3 py-3 hover:bg-gray-100 text-gray-600 font-bold" disabled={isExpired}>-</button>
                    <span className="w-8 text-center font-bold text-gray-800">{customItemCount}</span>
                    <button onClick={() => setCustomItemCount(c => c + 1)} className="px-3 py-3 hover:bg-gray-100 text-gray-600 font-bold" disabled={isExpired}>+</button>
                  </div>

                  <button 
                    disabled={isExpired} 
                    onClick={() => { 
                      if(!customItemName || !customItemPrice) return alert('請輸入完整內容與金額'); 
                      handleOrder(customItemName, parseFloat(customItemPrice), customItemCount); 
                    }} 
                    className={`flex-1 px-4 py-3 rounded-lg font-bold transition whitespace-nowrap ${isExpired ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                  >
                    下單
                  </button>
                </div>
              </div>
            </div>

            {/* 菜單列表 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 print:hidden">
              {menu.map((item) => (
                <MenuCard 
                  key={item.id} 
                  name={item.name} 
                  description={item.description} 
                  price={item.price} 
                  isExpired={isExpired} 
                  // ★ 修正：明確宣告 count 為 number 型別，解決 TypeScript 錯誤
                  onOrder={(count: number) => handleOrder(item.name, item.price, count)} 
                />
              ))}
            </div>

            {/* 訂單統計 (總金額加總保護) */}
            <OrderSummary 
              storeName={currentStore.name} 
              summary={summary} 
              totalAmount={Math.round(summary.reduce((a, b) => a + b.total, 0) * 10) / 10} 
              totalCount={summary.reduce((a, b) => a + b.count, 0)}
              isExpired={isExpired} 
              onDeleteOrder={handleDeleteOrder} 
            />
          </div>
          
          {showLargeImage && currentStore.image_url && (
            <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out animate-fadeIn" onClick={() => setShowLargeImage(false)}>
              <img src={currentStore.image_url} alt={currentStore.name} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
              <button className="absolute top-6 right-6 text-white text-4xl opacity-70 hover:opacity-100 transition">&times;</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}