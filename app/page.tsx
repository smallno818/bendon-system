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

  const [showLargeImage, setShowLargeImage] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');

  // 用於 PDF 匯出的引用
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkDailyStatus();

    // ★ Real-time 監聽 (修正型別報錯)
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

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(statusChannel);
    };
  }, []);

  const checkDailyStatus = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data: statusData } = await supabase
      .from('daily_status')
      .select('active_store_id, order_date')
      .eq('order_date', today)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (statusData?.active_store_id) {
      await loadStoreData(statusData.active_store_id);
    } else {
      setCurrentStore(null);
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
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00`);

    if (count && count > 0) {
      const confirm = window.confirm(`⚠️ 注意：今天已經有 ${count} 人點餐了！\n換店家將會「清空」這些訂單，確定要執行嗎？`);
      if (!confirm) return;
      await supabase.from('orders').delete().gte('created_at', `${today}T00:00:00`);
    }

    await supabase.from('daily_status').delete().eq('order_date', today);
    const { error } = await supabase.from('daily_status').insert([{ 
      active_store_id: storeId,
      order_date: today
    }]);

    if (!error) checkDailyStatus();
  };

  const handleResetStore = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00`);

    if (count && count > 0) {
      const confirm = window.confirm('確定要換一家吃嗎？\n⚠️ 這會「清空」大家已經點的餐喔！');
      if (!confirm) return;
      await supabase.from('orders').delete().gte('created_at', `${today}T00:00:00`);
    }

    await supabase.from('daily_status').delete().eq('order_date', today);
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
    const name = prompt(`你要訂購 ${itemName}，請輸入你的名字：`);
    if (!name) return;
    const { error } = await supabase.from('orders').insert([{ 
      item_name: itemName, price: itemPrice, customer_name: name 
    }]);
    if (!error) {
      setCustomItemName('');
      setCustomItemPrice('');
    }
  };

  const handleDeleteOrder = async (orderId: number, customerName: string) => {
    const confirmName = prompt(`請輸入你的名字「${customerName}」進行確認刪除：`);
    if (confirmName === customerName) {
      await supabase.from('orders').delete().eq('id', orderId);
    }
  };

  // ★ PDF 匯出功能
  const handleExportPDF = async () => {
    if (!printRef.current) return;
    const element = printRef.current;
    const canvas = await html2canvas(element, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`訂單統計_${currentStore?.name}.pdf`);
  };

  if (loading) return <div className="p-10 text-center text-gray-500 font-medium">載入中...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 relative">
      
      {!currentStore && (
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-3xl font-bold text-center mb-2 text-gray-900">🤷‍♂️ 今天吃什麼？</h1>
          <p className="text-gray-600 text-center mb-8 font-medium">請選擇一間餐廳開啟今日午餐</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {storeList.map(store => (
              <div key={store.id} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 flex flex-col">
                <div className="h-40 bg-gray-200">
                  {store.image_url && <img src={store.image_url} alt={store.name} className="w-full h-full object-cover" />}
                </div>
                <div className="p-5 text-center flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-1">{store.name}</h3>
                    {store.phone && <p className="text-xs text-gray-500 mb-4">📞 {store.phone}</p>}
                  </div>
                  {/* ★ 只有按鈕才能點擊選擇 */}
                  <button onClick={() => handleSelectStore(store.id)} className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-blue-700 transition active:scale-95">
                    決定吃這家！
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentStore && (
        <>
          <div className="w-full h-48 bg-gray-800 relative overflow-hidden print:hidden cursor-zoom-in" onClick={() => setShowLargeImage(true)}>
            {currentStore.image_url && <img src={currentStore.image_url} alt={currentStore.name} className="w-full h-full object-cover opacity-60" />}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <h1 className="text-white text-4xl font-bold drop-shadow-lg">{currentStore.name}</h1>
              {currentStore.phone && (
                <a href={`tel:${currentStore.phone}`} onClick={(e) => e.stopPropagation()} className="mt-3 text-white bg-green-600/80 px-4 py-1.5 rounded-full text-sm font-bold pointer-events-auto">
                  📞 撥打：{currentStore.phone}
                </a>
              )}
            </div>
          </div>

          <button onClick={handleResetStore} className="fixed bottom-8 right-8 z-40 bg-orange-600 text-white px-6 py-4 rounded-2xl shadow-2xl font-bold print:hidden">
            🔄 換一家
          </button>

          <div className="max-w-5xl mx-auto p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 print:hidden">
              {menu.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                  <h3 className="font-bold text-gray-800">{item.name}</h3>
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-orange-600 font-bold">${item.price}</span>
                    <button onClick={() => handleOrder(item.name, item.price)} className="bg-orange-50 text-orange-600 border border-orange-200 px-3 py-1 rounded-lg text-sm">+ 點餐</button>
                  </div>
                </div>
              ))}
            </div>

            {/* 客製化輸入 */}
            <div className="mb-12 bg-white p-5 rounded-xl border-2 border-dashed border-blue-200 print:hidden">
              <div className="flex flex-col sm:flex-row gap-3">
                <input placeholder="輸入需求 (例：不要蔥)" value={customItemName} onChange={(e) => setCustomItemName(e.target.value)} className="flex-1 border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="number" placeholder="金額" value={customItemPrice} onChange={(e) => setCustomItemPrice(e.target.value)} className="w-24 border p-3 rounded-lg text-center" />
                <button onClick={() => { if(!customItemName || !customItemPrice) return; handleOrder(customItemName, parseInt(customItemPrice)); }} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold">下單</button>
              </div>
            </div>

            {/* ★ 統計區塊 (PDF 匯出範圍) */}
            <div ref={printRef} className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 mb-10">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">{currentStore.name} - 訂單統計</h2>
                <div className="flex gap-2 print:hidden">
                  <button onClick={handleExportPDF} className="bg-red-600 text-white px-4 py-2 rounded flex items-center gap-2 text-sm shadow-md font-bold">📄 匯出 PDF</button>
                  <button onClick={() => window.print()} className="bg-gray-800 text-white px-4 py-2 rounded text-sm font-bold">🖨️ 列印</button>
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
                      <tr key={row.name} className="border-b">
                        <td className="p-3 font-medium">{row.name}</td>
                        <td className="p-3 text-center">{row.count}</td>
                        <td className="p-3 text-right font-bold">${row.total}</td>
                        <td className="p-3 flex flex-wrap gap-2">
                          {row.orderDetails.map((detail) => (
                            <span key={detail.id} className="bg-gray-100 px-2 py-1 rounded text-xs flex items-center">
                              {detail.customer_name}
                              <button onClick={() => handleDeleteOrder(detail.id, detail.customer_name)} className="text-red-400 ml-1 print:hidden">×</button>
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="text-center py-10 text-gray-400">尚未有人點餐</p>}
            </div>
          </div>
          
          {/* 大圖燈箱 */}
          {showLargeImage && currentStore.image_url && (
            <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setShowLargeImage(false)}>
              <img src={currentStore.image_url} alt={currentStore.name} className="max-w-full max-h-full rounded-lg shadow-2xl" />
            </div>
          )}
        </>
      )}
    </div>
  );
}