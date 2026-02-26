'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// 定義資料型別
type Store = {
  id: number;
  name: string;
  image_url: string | null;
  phone: string | null;
};

type Product = {
  id: number;
  store_id: number;
  name: string;
  price: number;
  description: string | null;
};

type Order = {
  id: number;
  item_name: string;
  price: number;
  customer_name: string;
};

type SummaryItem = {
  name: string;
  count: number;
  total: number;
  orderDetails: { id: number; customer_name: string }[];
};

export default function Home() {
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [storeList, setStoreList] = useState<Store[]>([]);
  const [menu, setMenu] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 結單狀態
  const [endTime, setEndTime] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);

  const [showLargeImage, setShowLargeImage] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [inputEndDateTime, setInputEndDateTime] = useState(''); // 包含日期的設定值

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkDailyStatus();

    // Real-time 監聽
    const ordersChannel = supabase
      .channel('realtime_orders')
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'orders' },
        () => fetchTodayOrders()
      )
      .subscribe();

    const statusChannel = supabase
      .channel('realtime_status')
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'daily_status' },
        () => checkDailyStatus()
      )
      .subscribe();

    // 倒數計時器
    const timer = setInterval(updateCountdown, 1000);

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(statusChannel);
      clearInterval(timer);
    };
  }, [endTime]); 

  // 更新倒數時間
  const updateCountdown = () => {
    if (!endTime) {
      setTimeLeft('');
      setIsExpired(false);
      return;
    }

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

  const checkDailyStatus = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data: statusData } = await supabase
      .from('daily_status')
      .select('active_store_id, end_time')
      .eq('order_date', today)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (statusData?.active_store_id) {
      setEndTime(statusData.end_time); 
      await loadStoreData(statusData.active_store_id);
    } else {
      setCurrentStore(null);
      setEndTime(null);
      const { data: stores } = await supabase.from('stores').select('*');
      if (stores) setStoreList(stores);
    }
    setLoading(false);
  };

  const loadStoreData = async (storeId: number) => {
    const { data: store } = await supabase.from('stores').select('*').eq('id', storeId).single();
    setCurrentStore(store);
    const { data: menuData } = await supabase.from('products').select('*').eq('store_id', storeId);
    if (menuData) setMenu(menuData);
    fetchTodayOrders();
  };

  const handleSelectStore = async (storeId: number) => {
    if (!inputEndDateTime) return alert('請先設定「結單日期與時間」！');
    
    const todayStr = new Date().toISOString().split('T')[0];
    const fullEndDateTime = new Date(inputEndDateTime).toISOString();

    const confirm = window.confirm(`將設定於 ${new Date(inputEndDateTime).toLocaleString()} 結單，確定嗎？`);
    if (!confirm) return;

    await supabase.from('daily_status').delete().eq('order_date', todayStr);
    const { error } = await supabase.from('daily_status').insert([{ 
      active_store_id: storeId,
      order_date: todayStr,
      end_time: fullEndDateTime
    }]);

    if (!error) checkDailyStatus();
  };

  const handleResetStore = async () => {
    const confirm = window.confirm('確定要換一家吃嗎？\n⚠️ 這會「清空」大家已經點的餐喔！');
    if (!confirm) return;
    
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('orders').delete().gte('created_at', `${today}T00:00:00`);
    await supabase.from('daily_status').delete().eq('order_date', today);
    
    setCurrentStore(null);
    setEndTime(null);
    checkDailyStatus();
  };

  const fetchTodayOrders = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false });

    if (data) {
      setOrders(data);
      calculateSummary(data);
    }
  };

  const calculateSummary = (ordersData: Order[]) => {
    const stats: Record<string, SummaryItem> = {};
    ordersData.forEach(order => {
      if (!stats[order.item_name]) {
        stats[order.item_name] = { name: order.item_name, count: 0, total: 0, orderDetails: [] };
      }
      stats[order.item_name].count += 1;
      stats[order.item_name].total += order.price;
      stats[order.item_name].orderDetails.push({ id: order.id, customer_name: order.customer_name });
    });
    setSummary(Object.values(stats));
  };

  const handleOrder = async (itemName: string, itemPrice: number) => {
    if (isExpired) return alert('🔴 抱歉，已經超過結單時間，無法再點餐！');
    
    const name = prompt(`你要訂購 ${itemName}，請輸入你的名字：`);
    if (!name) return;

    const { error } = await supabase.from('orders').insert([{ 
      item_name: itemName, 
      price: itemPrice, 
      customer_name: name 
    }]);

    if (!error) {
      setCustomItemName('');
      setCustomItemPrice('');
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
    } else if (confirmName !== null) {
      alert('名字輸入不正確，刪除失敗。');
    }
  };

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    
    const btn = document.getElementById('pdf-btn');
    if (btn) btn.innerText = '處理中...';

    try {
      // 增加延遲確保渲染
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(printRef.current, {
        scale: 2, 
        useCORS: true, 
        allowTaint: true,
        logging: true,
        backgroundColor: '#ffffff',
        windowWidth: 1200, 
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`訂單統計_${currentStore?.name || '團購'}.pdf`);
    } catch (e) {
      console.error(e);
      alert('PDF 生成失敗，這通常是圖片安全性限制導致。建議改用手機截圖。');
    } finally {
      if (btn) btn.innerText = '📄 匯出 PDF';
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500 font-medium">系統載入中...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 relative">
      
      {!currentStore && (
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-3xl font-bold text-center mb-6 text-gray-900">🍱 今天吃什麼？</h1>
          
          {/* 設定時間區塊 */}
          <div className="flex justify-center mb-8">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm flex flex-col items-center gap-2">
              <label className="text-sm font-bold text-blue-800">1. 請先設定結單時間 (含日期)：</label>
              <input 
                type="datetime-local" 
                value={inputEndDateTime} 
                onChange={e => setInputEndDateTime(e.target.value)}
                className="border-2 border-blue-300 p-2 rounded-lg text-lg font-bold text-gray-700 outline-none focus:border-blue-500 bg-white"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {storeList.map(store => (
              <div 
                key={store.id} 
                className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 flex flex-col"
              >
                <div className="h-40 bg-gray-200 relative">
                  {store.image_url ? (
                    <img src={store.image_url} alt={store.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">無圖片</div>
                  )}
                </div>
                <div className="p-5 text-center flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-1">{store.name}</h3>
                    {store.phone && <p className="text-xs text-gray-500 mb-4">📞 {store.phone}</p>}
                  </div>
                  <button 
                    onClick={() => handleSelectStore(store.id)}
                    className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-blue-700 transition active:scale-95"
                  >
                    2. 決定吃這家！
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentStore && (
        <>
          <div 
            className="w-full h-48 bg-gray-800 relative overflow-hidden group print:hidden cursor-zoom-in"
            onClick={() => setShowLargeImage(true)}
            title="點擊查看大圖"
          >
            {currentStore.image_url && (
              <img src={currentStore.image_url} alt={currentStore.name} className="w-full h-full object-cover opacity-50" />
            )}
            
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-white">
              <h1 className="text-4xl font-bold drop-shadow-lg mb-2">{currentStore.name}</h1>
              
              {/* 倒數計時顯示 */}
              <div className={`px-4 py-1 rounded-full text-sm font-bold shadow-lg backdrop-blur-md ${isExpired ? 'bg-red-600/90' : 'bg-yellow-500/90 text-yellow-900 animate-pulse'}`}>
                {timeLeft || '計算中...'}
              </div>
              
              {endTime && (
                <p className="text-xs mt-1 opacity-80 bg-black/20 px-2 rounded">
                  結單時間：{new Date(endTime).toLocaleString()}
                </p>
              )}

              {currentStore.phone && (
                <a 
                  href={`tel:${currentStore.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-3 bg-green-600/90 hover:bg-green-600 px-4 py-1.5 rounded-full text-sm font-bold pointer-events-auto flex items-center gap-2 transition"
                >
                  📞 撥打電話
                </a>
              )}
            </div>
          </div>

          <button 
            onClick={handleResetStore}
            className="fixed bottom-8 right-8 z-40 bg-orange-600 text-white px-6 py-4 rounded-2xl shadow-2xl hover:bg-orange-700 transition-all hover:scale-105 active:scale-95 print:hidden border-2 border-white/20"
          >
            <span className="text-xl font-bold">🔄 換一家</span>
          </button>

          <div className="max-w-5xl mx-auto p-4 print:p-0 print:max-w-none">
            {/* 這裡已經恢復成原本您喜歡的卡片樣式 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 print:hidden">
              {menu.map((item) => (
                <div key={item.id} className={`bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition border border-gray-100 flex flex-col justify-between h-full ${isExpired ? 'opacity-60 grayscale' : ''}`}>
                  <div>
                    <h3 className="font-bold text-lg text-gray-800 leading-tight">{item.name}</h3>
                    <p className="text-sm text-gray-400 mt-1">{item.description}</p>
                  </div>
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-50">
                    <span className="text-orange-600 font-bold text-xl">${item.price}</span>
                    <button 
                      disabled={isExpired}
                      onClick={() => handleOrder(item.name, item.price)}
                      className={`px-4 py-1.5 rounded-lg font-medium text-sm transition ${isExpired ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-500 hover:text-white'}`}
                    >
                      {isExpired ? '已結單' : '+ 點餐'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 客製化輸入 */}
            <div className={`mb-12 bg-white p-5 rounded-xl border-2 border-dashed border-blue-200 shadow-sm print:hidden ${isExpired ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl font-bold text-gray-700">✏️ 客製化品項 / 特殊需求</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  placeholder={isExpired ? "已停止下單" : "輸入需求 (例：雞腿飯-不要蔥)"}
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                  disabled={isExpired}
                  className="flex-1 border border-gray-300 p-3 rounded-lg text-gray-900 font-medium outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
                <div className="flex gap-3">
                  <input 
                    type="number" 
                    placeholder="金額" 
                    value={customItemPrice}
                    onChange={(e) => setCustomItemPrice(e.target.value)}
                    disabled={isExpired}
                    className="w-24 border border-gray-300 p-3 rounded-lg text-gray-900 font-bold text-center outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                  <button 
                    disabled={isExpired}
                    onClick={() => {
                      if(!customItemName || !customItemPrice) return alert('請輸入完整內容與金額');
                      handleOrder(customItemName, parseInt(customItemPrice));
                    }}
                    className={`px-6 py-3 rounded-lg font-bold transition ${isExpired ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                  >
                    下單
                  </button>
                </div>
              </div>
            </div>

            {/* 統計區 (PDF 匯出範圍) */}
            <div ref={printRef} className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 mb-10">
              <div className="flex justify-between items-center mb-6">
                <div className="flex flex-col">
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    {currentStore.name} 
                    {isExpired && <span className="text-red-500 text-sm border border-red-500 px-2 rounded">已結單</span>}
                  </h2>
                  <p className="text-sm text-gray-500">今日訂單統計</p>
                </div>
                <div className="flex gap-2 print:hidden">
                  <button 
                    id="pdf-btn"
                    onClick={handleExportPDF} 
                    className="bg-red-600 text-white px-4 py-2 rounded flex items-center gap-2 text-sm shadow-md hover:bg-red-700 font-bold transition"
                  >
                    📄 匯出 PDF
                  </button>
                  <button 
                    onClick={() => window.print()} 
                    className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700 flex items-center gap-2 text-sm shadow-md font-bold transition"
                  >
                    🖨️ 列印
                  </button>
                </div>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300 print:hidden">
                  目前還沒有人點餐，快當第一個！
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider border-b border-gray-200">
                        <th className="p-3 font-semibold">品項</th>
                        <th className="p-3 text-center font-semibold">數量</th>
                        <th className="p-3 text-right font-semibold">小計</th>
                        <th className="p-3 font-semibold w-1/3">訂購人</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {summary.map((row) => (
                        <tr key={row.name} className="hover:bg-blue-50/50 transition">
                          <td className="p-3 font-medium text-gray-800">{row.name}</td>
                          <td className="p-3 text-center">
                            <span className="bg-blue-100 text-blue-800 py-1 px-2 rounded font-bold text-xs print:bg-transparent print:text-black print:border print:border-gray-300">{row.count}</span>
                          </td>
                          <td className="p-3 text-right font-bold text-gray-800">${row.total}</td>
                          <td className="p-3 text-sm text-gray-500">
                            <div className="flex flex-wrap gap-2">
                              {row.orderDetails.map((detail) => (
                                <span key={detail.id} className="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                                  {detail.customer_name}
                                  {!isExpired && (
                                    <button 
                                      onClick={() => handleDeleteOrder(detail.id, detail.customer_name)}
                                      className="text-red-400 hover:text-red-600 font-bold ml-1 print:hidden"
                                    >
                                      ×
                                    </button>
                                  )}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-900 text-white font-bold print:bg-gray-200 print:text-black">
                        <td className="p-3 rounded-bl-xl">總計</td>
                        <td className="p-3 text-center">{summary.reduce((a, b) => a + b.count, 0)} 份</td>
                        <td className="p-3 text-right text-xl text-yellow-400 print:text-black">
                          ${summary.reduce((a, b) => a + b.total, 0)}
                        </td>
                        <td className="p-3 rounded-br-xl"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
          
          {showLargeImage && currentStore.image_url && (
            <div 
              className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out animate-fadeIn"
              onClick={() => setShowLargeImage(false)}
            >
              <img 
                src={currentStore.image_url} 
                alt={currentStore.name} 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
              <button className="absolute top-6 right-6 text-white text-4xl opacity-70 hover:opacity-100 transition">
                &times;
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}