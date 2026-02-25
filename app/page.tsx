'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// 定義資料型別
type Store = {
  id: number;
  name: string;
  image_url: string | null;
  phone: string | null; // ★ 新增電話欄位
};

type Product = {
  id: number;
  store_id: number;
  name: string;
  price: number;
  description: string | null;
};

type Order = {
  item_name: string;
  price: number;
  customer_name: string;
};

type SummaryItem = {
  name: string;
  count: number;
  total: number;
  names: string[];
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

  useEffect(() => {
    checkDailyStatus();
  }, []);

  const checkDailyStatus = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const { data: statusData } = await supabase
      .from('daily_status')
      .select('active_store_id, order_date')
      .eq('order_date', today)
      .order('id', { ascending: false })
      .limit(1)
      .single();
    
    if (statusData?.active_store_id) {
      await loadStoreData(statusData.active_store_id);
    } else {
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
      // eslint-disable-next-line no-restricted-globals
      const confirm = window.confirm(`⚠️ 注意：今天已經有 ${count} 人點餐了！\n換店家將會「清空」這些訂單，確定要執行嗎？`);
      if (!confirm) return;
      await supabase.from('orders').delete().gte('created_at', `${today}T00:00:00`);
    }

    await supabase.from('daily_status').delete().eq('order_date', today);
    const { error } = await supabase.from('daily_status').insert([{ 
      active_store_id: storeId,
      order_date: today
    }]);

    if (!error) {
      loadStoreData(storeId);
      setOrders([]); 
      setSummary([]);
    }
  };

  const handleResetStore = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00`);

    if (count && count > 0) {
      // eslint-disable-next-line no-restricted-globals
      const confirm = window.confirm('確定要換一家吃嗎？\n⚠️ 這會「清空」大家已經點的餐喔！');
      if (!confirm) return;
      await supabase.from('orders').delete().gte('created_at', `${today}T00:00:00`);
    }

    await supabase.from('daily_status').delete().eq('order_date', today);
    setCurrentStore(null);
    setMenu([]);
    setOrders([]);
    setSummary([]);
    const { data: stores } = await supabase.from('stores').select('*');
    if (stores) setStoreList(stores);
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
        stats[order.item_name] = { name: order.item_name, count: 0, total: 0, names: [] };
      }
      stats[order.item_name].count += 1;
      stats[order.item_name].total += order.price;
      stats[order.item_name].names.push(order.customer_name);
    });
    setSummary(Object.values(stats));
  };

  const handleOrder = async (itemName: string, itemPrice: number) => {
    const name = prompt(`你要訂購 ${itemName}，請輸入你的名字：`);
    if (!name) return;

    const { error } = await supabase.from('orders').insert([{ 
      item_name: itemName, 
      price: itemPrice, 
      customer_name: name 
    }]);

    if (!error) {
      alert('點餐成功！');
      fetchTodayOrders();
      setCustomItemName('');
      setCustomItemPrice('');
    } else {
      alert('失敗：' + error.message);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500 font-medium">載入中...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 print:bg-white print:pb-0 relative">
      
      {!currentStore && (
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-3xl font-bold text-center mb-2 text-gray-900">🤷‍♂️ 今天吃什麼？</h1>
          <p className="text-gray-600 text-center mb-8 font-medium">請選擇一間餐廳開啟今日午餐</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {storeList.map(store => (
              <div 
                key={store.id} 
                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition group cursor-pointer border hover:border-blue-500"
                onClick={() => handleSelectStore(store.id)}
              >
                <div className="h-40 bg-gray-200 relative">
                  {store.image_url ? (
                    <img src={store.image_url} alt={store.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">無圖片</div>
                  )}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition"></div>
                </div>
                <div className="p-5 text-center">
                  <h3 className="text-xl font-bold text-gray-800 mb-1">{store.name}</h3>
                  {store.phone && <p className="text-xs text-gray-500 mb-3">📞 {store.phone}</p>}
                  <button className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-blue-700">
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
          <div 
            className="w-full h-48 bg-gray-800 relative overflow-hidden group print:hidden cursor-zoom-in"
            onClick={() => setShowLargeImage(true)}
            title="點擊查看大圖"
          >
            {currentStore.image_url && (
              <img src={currentStore.image_url} alt={currentStore.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition" />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <h1 className="text-white text-4xl font-bold shadow-black drop-shadow-lg">{currentStore.name}</h1>
              {/* ★ 新增：電話顯示，點擊可撥打 */}
              {currentStore.phone && (
                <a 
                  href={`tel:${currentStore.phone}`}
                  onClick={(e) => e.stopPropagation()} // 避免觸發大圖
                  className="mt-3 text-white bg-green-600/80 hover:bg-green-600 px-4 py-1.5 rounded-full text-sm font-bold backdrop-blur-sm pointer-events-auto flex items-center gap-2"
                >
                  📞 點我撥打：{currentStore.phone}
                </a>
              )}
            </div>
          </div>

          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleResetStore();
            }}
            className="fixed bottom-8 right-8 z-40 bg-orange-600 text-white px-6 py-4 rounded-2xl shadow-2xl hover:bg-orange-700 transition-all hover:scale-105 active:scale-95 print:hidden flex items-center gap-2 border-2 border-white/20"
          >
            <span className="text-xl">🔄</span>
            <span className="font-bold text-lg tracking-wider">換一家</span>
          </button>

          <div className="max-w-5xl mx-auto p-4 print:p-0 print:max-w-none">
            <div className="flex items-center gap-2 mb-4 print:hidden">
               <span className="text-2xl">🍱</span>
               <h2 className="text-xl font-bold text-gray-800">美味菜單</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 print:hidden">
              {menu.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition border border-gray-100 flex flex-col justify-between h-full">
                  <div>
                    <h3 className="font-bold text-lg text-gray-800 leading-tight">{item.name}</h3>
                    <p className="text-sm text-gray-400 mt-1">{item.description}</p>
                  </div>
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-50">
                    <span className="text-orange-600 font-bold text-xl">${item.price}</span>
                    <button 
                      onClick={() => handleOrder(item.name, item.price)}
                      className="bg-orange-50 text-orange-600 border border-orange-200 px-4 py-1.5 rounded-lg hover:bg-orange-500 hover:text-white transition font-medium text-sm"
                    >
                      + 點餐
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-12 bg-white p-5 rounded-xl border-2 border-dashed border-blue-200 shadow-sm print:hidden">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">✏️</span>
                <h3 className="font-bold text-gray-700">想吃點不一樣的？或有特殊需求？</h3>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  placeholder="輸入需求 (例：排骨飯-不加菜 / 加一顆蛋)" 
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                  className="flex-1 border border-gray-300 p-3 rounded-lg text-gray-900 font-medium outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-3">
                  <input 
                    type="number" 
                    placeholder="金額" 
                    value={customItemPrice}
                    onChange={(e) => setCustomItemPrice(e.target.value)}
                    className="w-24 border border-gray-300 p-3 rounded-lg text-gray-900 font-bold text-center outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button 
                    onClick={() => {
                      if(!customItemName || !customItemPrice) return alert('請輸入完整內容與金額');
                      handleOrder(customItemName, parseInt(customItemPrice));
                    }}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition"
                  >
                    下單
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">* 自訂需求將會自動加入下方的統計清單中</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 print:shadow-none print:border-none print:w-full print:p-0">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-2xl print:hidden">📋</span>
                  <h2 className="text-2xl font-bold text-gray-800 print:text-3xl">
                    <span className="hidden print:inline">{currentStore?.name} - </span>
                    今日訂單統計
                  </h2>
                </div>
                <button 
                  onClick={() => window.print()} 
                  className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700 flex items-center gap-2 text-sm shadow-lg shadow-gray-300/50 print:hidden"
                >
                  🖨️ 列印訂購單
                </button>
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
                        <th className="p-3 text-right font-semibold">單價</th>
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
                          <td className="p-3 text-right text-gray-500">${Math.round(row.total / row.count)}</td>
                          <td className="p-3 text-right font-bold text-gray-800">${row.total}</td>
                          <td className="p-3 text-sm text-gray-500">{row.names.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-900 text-white font-bold print:bg-gray-200 print:text-black">
                        <td className="p-3">總計</td>
                        <td className="p-3 text-center">{summary.reduce((a, b) => a + b.count, 0)} 份</td>
                        <td className="p-3"></td>
                        <td className="p-3 text-right text-xl text-yellow-400 print:text-black">
                          ${summary.reduce((a, b) => a + b.total, 0)}
                        </td>
                        <td className="p-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                  
                  <div className="hidden print:block mt-8 text-right text-sm text-gray-500">
                    列印時間: {new Date().toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {showLargeImage && currentStore?.image_url && (
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