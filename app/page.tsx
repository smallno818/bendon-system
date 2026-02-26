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
  
  // ★ 結單時間狀態
  const [endTime, setEndTime] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  const [showLargeImage, setShowLargeImage] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [inputEndTime, setInputEndTime] = useState(''); // 選擇店家時輸入的時間

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkDailyStatus();

    const ordersChannel = supabase
      .channel('realtime_orders')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'orders' }, () => fetchTodayOrders())
      .subscribe();

    const statusChannel = supabase
      .channel('realtime_status')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'daily_status' }, () => checkDailyStatus())
      .subscribe();

    // 每分鐘檢查一次是否過期
    const timer = setInterval(checkIfExpired, 10000);

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(statusChannel);
      clearInterval(timer);
    };
  }, [endTime]);

  const checkIfExpired = () => {
    if (!endTime) return setIsExpired(false);
    const now = new Date();
    const end = new Date(endTime);
    setIsExpired(now > end);
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
    checkIfExpired();
  };

  const loadStoreData = async (storeId: number) => {
    const { data: store } = await supabase.from('stores').select('*').eq('id', storeId).single();
    setCurrentStore(store);
    const { data: menuData } = await supabase.from('products').select('*').eq('store_id', storeId);
    if (menuData) setMenu(menuData);
    fetchTodayOrders();
  };

  const handleSelectStore = async (storeId: number) => {
    if (!inputEndTime) return alert('請設定今日結單時間');
    
    const todayStr = new Date().toISOString().split('T')[0];
    const fullEndDateTime = new Date(`${todayStr}T${inputEndTime}:00`).toISOString();

    const confirm = window.confirm(`將設定於 ${inputEndTime} 結單，確定嗎？`);
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
    const confirm = window.confirm('更換店家會清空今日所有訂單，確定嗎？');
    if (!confirm) return;
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('orders').delete().gte('created_at', `${today}T00:00:00`);
    await supabase.from('daily_status').delete().eq('order_date', today);
    checkDailyStatus();
  };

  const fetchTodayOrders = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('orders').select('*').gte('created_at', `${today}T00:00:00`).order('created_at', { ascending: false });
    if (data) {
      setOrders(data);
      calculateSummary(data);
    }
  };

  const calculateSummary = (ordersData: Order[]) => {
    const stats: Record<string, SummaryItem> = {};
    ordersData.forEach(order => {
      if (!stats[order.item_name]) stats[order.item_name] = { name: order.item_name, count: 0, total: 0, orderDetails: [] };
      stats[order.item_name].count += 1;
      stats[order.item_name].total += order.price;
      stats[order.item_name].orderDetails.push({ id: order.id, customer_name: order.customer_name });
    });
    setSummary(Object.values(stats));
  };

  const handleOrder = async (itemName: string, itemPrice: number) => {
    if (isExpired) return alert('已超過結單時間，無法再下單！');
    const name = prompt(`訂購 ${itemName}，請輸入名字：`);
    if (!name) return;
    await supabase.from('orders').insert([{ item_name: itemName, price: itemPrice, customer_name: name }]);
  };

  const handleDeleteOrder = async (orderId: number, customerName: string) => {
    if (isExpired) return alert('已結單，無法修改訂單。');
    const confirmName = prompt(`輸入名字「${customerName}」確認刪除：`);
    if (confirmName === customerName) await supabase.from('orders').delete().eq('id', orderId);
  };

  // ★ 修復後的 PDF 匯出函數
  const handleExportPDF = async () => {
    if (!printRef.current) return;
    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true, 
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`訂單統計_${currentStore?.name}.pdf`);
    } catch (e) {
      alert('PDF 匯出失敗，請檢查網路或直接截圖');
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-400">系統載入中...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 relative">
      {!currentStore && (
        <div className="max-w-4xl mx-auto p-6">
          <header className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">🤷‍♂️ 今天吃什麼？</h1>
            <div className="mt-4 inline-flex items-center gap-2 bg-blue-50 p-3 rounded-lg border border-blue-200">
              <span className="text-sm font-bold text-blue-700">設定今日結單時間：</span>
              <input type="time" value={inputEndTime} onChange={e => setInputEndTime(e.target.value)} className="border p-1 rounded font-bold text-blue-800 outline-none" />
            </div>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {storeList.map(store => (
              <div key={store.id} className="bg-white rounded-xl shadow-lg border border-gray-100 flex flex-col">
                <div className="h-40 bg-gray-200">{store.image_url && <img src={store.image_url} alt={store.name} className="w-full h-full object-cover" />}</div>
                <div className="p-5 text-center flex-1">
                  <h3 className="text-xl font-bold text-gray-800 mb-1">{store.name}</h3>
                  <button onClick={() => handleSelectStore(store.id)} className="mt-4 w-full bg-blue-600 text-white py-2 rounded-full font-bold hover:bg-blue-700">決定吃這家</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentStore && (
        <>
          <div className="w-full h-48 bg-gray-800 relative overflow-hidden print:hidden">
            {currentStore.image_url && <img src={currentStore.image_url} alt={currentStore.name} className="w-full h-full object-cover opacity-60" />}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <h1 className="text-white text-4xl font-bold drop-shadow-lg">{currentStore.name}</h1>
              {endTime && (
                <div className={`mt-3 px-4 py-1 rounded-full font-bold text-sm ${isExpired ? 'bg-red-500 text-white animate-pulse' : 'bg-yellow-400 text-yellow-900'}`}>
                  {isExpired ? '🔴 已結單' : `⏳ 結單時間：${new Date(endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                </div>
              )}
            </div>
          </div>

          <button onClick={handleResetStore} className="fixed bottom-8 right-8 z-40 bg-orange-600 text-white px-6 py-4 rounded-2xl shadow-2xl font-bold print:hidden transition hover:scale-105 active:scale-95">🔄 換一家</button>

          <div className="max-w-5xl mx-auto p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 print:hidden">
              {menu.map((item) => (
                <div key={item.id} className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between ${isExpired ? 'opacity-60' : ''}`}>
                  <h3 className="font-bold text-gray-800">{item.name}</h3>
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-orange-600 font-bold">${item.price}</span>
                    <button disabled={isExpired} onClick={() => handleOrder(item.name, item.price)} className={`px-3 py-1 rounded-lg text-sm font-bold ${isExpired ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-500 hover:text-white'}`}>+ 點餐</button>
                  </div>
                </div>
              ))}
            </div>

            <div className={`mb-12 bg-white p-5 rounded-xl border-2 border-dashed border-blue-200 print:hidden ${isExpired ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex flex-col sm:flex-row gap-3">
                <input placeholder={isExpired ? "已結單" : "特殊需求 (例：不要蔥)"} value={customItemName} onChange={e => setCustomItemName(e.target.value)} className="flex-1 border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="number" placeholder="金額" value={customItemPrice} onChange={e => setCustomItemPrice(e.target.value)} className="w-24 border p-3 rounded-lg text-center font-bold" />
                <button onClick={() => { if(!customItemName || !customItemPrice) return; handleOrder(customItemName, parseInt(customItemPrice)); }} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold">下單</button>
              </div>
            </div>

            <div ref={printRef} className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 mb-10">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{currentStore.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">今日訂單統計 {isExpired && ' (已結單)'}</p>
                </div>
                <div className="flex gap-2 print:hidden">
                  <button onClick={handleExportPDF} className="bg-red-600 text-white px-4 py-2 rounded flex items-center gap-2 text-sm shadow-md font-bold transition hover:bg-red-700">📄 匯出 PDF</button>
                  <button onClick={() => window.print()} className="bg-gray-800 text-white px-4 py-2 rounded text-sm font-bold shadow-md hover:bg-gray-900 transition">🖨️ 列印</button>
                </div>
              </div>

              {orders.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-sm border-b">
                      <th className="p-3">品項</th>
                      <th className="p-3 text-center">數量</th>
                      <th className="p-3 text-right">小計</th>
                      <th className="p-3">訂購人</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((row) => (
                      <tr key={row.name} className="border-b hover:bg-gray-50 transition">
                        <td className="p-3 font-medium text-gray-800">{row.name}</td>
                        <td className="p-3 text-center font-bold text-blue-600">{row.count}</td>
                        <td className="p-3 text-right font-bold text-gray-800">${row.total}</td>
                        <td className="p-3 flex flex-wrap gap-2">
                          {row.orderDetails.map((detail) => (
                            <span key={detail.id} className="bg-gray-100 px-2 py-1 rounded text-xs flex items-center font-medium">
                              {detail.customer_name}
                              {!isExpired && <button onClick={() => handleDeleteOrder(detail.id, detail.customer_name)} className="text-red-400 ml-1 hover:text-red-600">×</button>}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-bold">
                      <td className="p-3 rounded-bl-xl text-lg" colSpan={2}>總計</td>
                      <td className="p-3 text-right text-lg text-yellow-400">${summary.reduce((a, b) => a + b.total, 0)}</td>
                      <td className="p-3 rounded-br-xl"></td>
                    </tr>
                  </tfoot>
                </table>
              ) : <p className="text-center py-10 text-gray-400 font-bold border-2 border-dashed rounded-xl mt-4">目前還沒有人點餐 🍱</p>}
            </div>
          </div>
          
          {showLargeImage && currentStore.image_url && (
            <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fadeIn" onClick={() => setShowLargeImage(false)}>
              <img src={currentStore.image_url} alt={currentStore.name} className="max-w-full max-h-full rounded-lg shadow-2xl transition-transform duration-300" />
              <p className="absolute bottom-10 text-white/50 text-sm">點擊任意處關閉</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}