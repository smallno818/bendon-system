'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type Store = { id: number; name: string; image_url: string | null; phone: string | null; };
type Product = { id: number; store_id: number; name: string; price: number; description: string | null; };
type Order = { id: number; item_name: string; price: number; customer_name: string; };
type SummaryItem = { name: string; count: number; total: number; orderDetails: { id: number; customer_name: string }[]; };

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
    const ordersChannel = supabase.channel('orders').on('postgres_changes' as any, { event: '*', schema: 'public', table: 'orders' }, () => fetchTodayOrders()).subscribe();
    const statusChannel = supabase.channel('status').on('postgres_changes' as any, { event: '*', schema: 'public', table: 'daily_status' }, () => checkDailyStatus()).subscribe();

    const timer = setInterval(updateCountdown, 1000);
    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(statusChannel);
      clearInterval(timer);
    };
  }, [endTime]);

  const updateCountdown = () => {
    if (!endTime) return;
    const now = new Date().getTime();
    const end = new Date(endTime).getTime();
    const diff = end - now;

    if (diff <= 0) {
      setIsExpired(true);
      setTimeLeft('已結單');
    } else {
      setIsExpired(false);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`倒數 ${hours}時 ${mins}分 ${secs}秒`);
    }
  };

  const checkDailyStatus = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data: statusData } = await supabase.from('daily_status').select('*').eq('order_date', today).order('id', { ascending: false }).limit(1).maybeSingle();
    
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
    if (!inputEndDateTime) return alert('請設定結單日期與時間');
    const todayStr = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('daily_status').insert([{ 
      active_store_id: storeId,
      order_date: todayStr,
      end_time: new Date(inputEndDateTime).toISOString()
    }]);
    if (!error) checkDailyStatus();
  };

  const handleResetStore = async () => {
    if (!window.confirm('確定換店家？這會清空今日訂單！')) return;
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('orders').delete().gte('created_at', `${today}T00:00:00`);
    await supabase.from('daily_status').delete().eq('order_date', today);
    checkDailyStatus();
  };

  const fetchTodayOrders = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('orders').select('*').gte('created_at', `${today}T00:00:00`);
    if (data) calculateSummary(data);
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

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    const btn = document.getElementById('pdf-btn');
    if (btn) btn.innerText = '處理中...';

    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200 // 確保匯出時寬度固定，避免手機端切到
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`訂單_${currentStore?.name}.pdf`);
    } catch (e) {
      alert('PDF 生成失敗，建議直接截圖。錯誤：' + e);
    } finally {
      if (btn) btn.innerText = '📄 匯出 PDF';
    }
  };

  if (loading) return <div className="p-10 text-center">載入中...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {!currentStore ? (
        <div className="max-w-4xl mx-auto p-6 text-center">
          <h1 className="text-3xl font-bold mb-6">🍱 今天吃什麼？</h1>
          <div className="bg-white p-6 rounded-xl shadow mb-8 border-2 border-blue-100 inline-block">
            <label className="block text-blue-800 font-bold mb-2 text-sm">請設定結單時間（包含日期）：</label>
            <input type="datetime-local" value={inputEndDateTime} onChange={e => setInputEndDateTime(e.target.value)} className="border-2 border-blue-300 p-2 rounded-lg font-bold outline-none focus:border-blue-500" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {storeList.map(store => (
              <div key={store.id} className="bg-white rounded-xl shadow-lg p-5">
                <h3 className="text-xl font-bold mb-4">{store.name}</h3>
                <button onClick={() => handleSelectStore(store.id)} className="w-full bg-blue-600 text-white py-2 rounded-full font-bold">開啟點餐團</button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Banner 倒數計時 */}
          <div className="w-full h-48 bg-gray-800 relative flex flex-col items-center justify-center text-white text-center">
            {currentStore.image_url && <img src={currentStore.image_url} alt={currentStore.name} className="absolute inset-0 w-full h-full object-cover opacity-40" />}
            <div className="relative z-10">
              <h1 className="text-4xl font-bold mb-2">{currentStore.name}</h1>
              <div className={`px-6 py-2 rounded-full font-bold text-lg shadow-xl ${isExpired ? 'bg-red-600' : 'bg-yellow-500 text-yellow-900 animate-pulse'}`}>
                {timeLeft}
              </div>
              <p className="text-xs mt-2 opacity-80">結單於：{new Date(endTime!).toLocaleString()}</p>
            </div>
          </div>

          <div className="max-w-5xl mx-auto p-4">
            {/* 菜單區 (略) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {menu.map(item => (
                <button key={item.id} disabled={isExpired} onClick={() => {
                  const name = prompt(`你要訂購 ${item.name}，請輸入名字：`);
                  if (name) supabase.from('orders').insert([{ item_name: item.name, price: item.price, customer_name: name }]);
                }} className={`bg-white p-4 rounded-xl shadow border text-left ${isExpired ? 'opacity-50 cursor-not-allowed' : 'hover:border-orange-500'}`}>
                  <div className="font-bold">{item.name}</div>
                  <div className="text-orange-600 font-bold mt-2">${item.price}</div>
                </button>
              ))}
            </div>

            {/* 統計區 */}
            <div ref={printRef} className="bg-white p-6 rounded-xl shadow-2xl border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">訂單統計 {isExpired && ' (已結單)'}</h2>
                <div className="flex gap-2">
                  <button id="pdf-btn" onClick={handleExportPDF} className="bg-red-600 text-white px-4 py-2 rounded font-bold text-sm">📄 匯出 PDF</button>
                  <button onClick={() => window.print()} className="bg-gray-800 text-white px-4 py-2 rounded font-bold text-sm">🖨️ 列印</button>
                </div>
              </div>

              <table className="w-full text-left">
                <thead className="border-b-2">
                  <tr><th className="p-2">品項</th><th className="p-2 text-center">數量</th><th className="p-2 text-right">小計</th><th className="p-2">訂購人</th></tr>
                </thead>
                <tbody>
                  {summary.map(row => (
                    <tr key={row.name} className="border-b">
                      <td className="p-2 font-bold">{row.name}</td>
                      <td className="p-2 text-center text-blue-600 font-bold">{row.count}</td>
                      <td className="p-2 text-right font-bold">${row.total}</td>
                      <td className="p-2 text-xs flex flex-wrap gap-1">
                        {row.orderDetails.map(d => (
                          <span key={d.id} className="bg-gray-100 px-2 py-1 rounded">{d.customer_name}</span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-900 text-white font-bold">
                    <td colSpan={2} className="p-3">總額</td>
                    <td className="p-3 text-right text-yellow-400">${summary.reduce((a,b) => a+b.total, 0)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            <button onClick={handleResetStore} className="mt-10 w-full bg-gray-200 text-gray-600 py-3 rounded-xl font-bold">🔄 換一家店 (清空訂單)</button>
          </div>
        </>
      )}
    </div>
  );
}