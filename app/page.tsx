'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// 定義資料型別，讓 TypeScript 不會報錯
type Store = {
  id: number;
  name: string;
  image_url: string | null;
};

type Product = {
  id: number;
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

  useEffect(() => {
    checkDailyStatus();
  }, []);

  // 1. 檢查今天是否已經選好店家
  const checkDailyStatus = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    // 找找看今天有沒有 active 的店家紀錄
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

  // 2. 載入特定店家的菜單與訂單
  const loadStoreData = async (storeId: number) => {
    const { data: store } = await supabase.from('stores').select('*').eq('id', storeId).single();
    setCurrentStore(store);

    const { data: menuData } = await supabase.from('products').select('*').eq('store_id', storeId);
    if (menuData) setMenu(menuData);

    fetchTodayOrders();
  };

  // 3. 決定吃這家
  const handleSelectStore = async (storeId: number) => {
    // eslint-disable-next-line no-restricted-globals
    const confirm = window.confirm('確定今天要吃這家嗎？舊的今日訂單統計將會重置。');
    if (!confirm) return;

    const today = new Date().toISOString().split('T')[0];
    
    await supabase.from('daily_status').delete().eq('order_date', today);
    
    const { error } = await supabase.from('daily_status').insert([{ 
      active_store_id: storeId,
      order_date: today
    }]);

    if (!error) {
      loadStoreData(storeId);
    }
  };

  // 4. 重設店家
  const handleResetStore = async () => {
    // eslint-disable-next-line no-restricted-globals
    const confirm = window.confirm('確定要換一家吃嗎？注意：大家可能已經下單了喔！');
    if (!confirm) return;

    const today = new Date().toISOString().split('T')[0];
    await supabase.from('daily_status').delete().eq('order_date', today);

    setCurrentStore(null);
    setMenu([]);
    const { data: stores } = await supabase.from('stores').select('*');
    if (stores) setStoreList(stores);
  };

  // 5. 抓取今日訂單
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

  // 6. 計算統計
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

  // 7. 點餐
  const handleOrder = async (item: Product) => {
    const name = prompt(`你要訂購 ${item.name}，請輸入你的名字：`);
    if (!name) return;

    const { error } = await supabase.from('orders').insert([{ 
      item_name: item.name, 
      price: item.price, 
      customer_name: name 
    }]);

    if (!error) {
      alert('點餐成功！');
      fetchTodayOrders();
    } else {
      alert('失敗：' + error.message);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">載入中...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      
      {/* 畫面 A: 選擇店家列表 */}
      {!currentStore && (
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-3xl font-bold text-center mb-2">🤷‍♂️ 今天吃什麼？</h1>
          <p className="text-gray-500 text-center mb-8">請選擇一間餐廳開啟今日團購</p>
          
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
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{store.name}</h3>
                  <button className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-blue-700">
                    決定吃這家！
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 畫面 B: 顯示菜單與訂單 */}
      {currentStore && (
        <>
          {/* Banner */}
          <div className="w-full h-48 bg-gray-800 relative overflow-hidden group">
            {currentStore.image_url && (
              <img src={currentStore.image_url} alt={currentStore.name} className="w-full h-full object-cover opacity-60" />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <h1 className="text-white text-4xl font-bold shadow-black drop-shadow-lg">{currentStore.name}</h1>
              <p className="text-gray-200 mt-2 text-sm bg-black/30 px-3 py-1 rounded">今日團購進行中</p>
              
              <button 
                onClick={handleResetStore}
                className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white text-xs px-3 py-1 rounded backdrop-blur-sm border border-white/30"
              >
                🔄 換一家吃
              </button>
            </div>
          </div>

          <div className="max-w-5xl mx-auto p-4">
            {/* 菜單區 */}
            <div className="flex items-center gap-2 mb-4">
               <span className="text-2xl">🍱</span>
               <h2 className="text-xl font-bold text-gray-800">美味菜單</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
              {menu.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition border border-gray-100 flex flex-col justify-between h-full">
                  <div>
                    <h3 className="font-bold text-lg text-gray-800 leading-tight">{item.name}</h3>
                    <p className="text-sm text-gray-400 mt-1">{item.description}</p>
                  </div>
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-50">
                    <span className="text-orange-600 font-bold text-xl">${item.price}</span>
                    <button 
                      onClick={() => handleOrder(item)}
                      className="bg-orange-50 text-orange-600 border border-orange-200 px-4 py-1.5 rounded-lg hover:bg-orange-500 hover:text-white transition font-medium text-sm"
                    >
                      + 點餐
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 訂單統計區 */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 print:shadow-none print:w-full">
              <div className="flex justify-between items-center mb-6 print:hidden">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📋</span>
                  <h2 className="text-2xl font-bold text-gray-800">統計結果</h2>
                </div>
                <button 
                  onClick={() => window.print()} 
                  className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700 flex items-center gap-2 text-sm shadow-lg shadow-gray-300/50"
                >
                  🖨️ 列印訂購單
                </button>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">
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
                            <span className="bg-blue-100 text-blue-800 py-1 px-2 rounded font-bold text-xs">{row.count}</span>
                          </td>
                          <td className="p-3 text-right text-gray-500">${Math.round(row.total / row.count)}</td>
                          <td className="p-3 text-right font-bold text-gray-800">${row.total}</td>
                          <td className="p-3 text-sm text-gray-500">{row.names.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-900 text-white font-bold">
                        <td className="p-3">總計</td>
                        <td className="p-3 text-center">{summary.reduce((a, b) => a + b.count, 0)} 份</td>
                        <td className="p-3"></td>
                        <td className="p-3 text-right text-xl text-yellow-400">
                          ${summary.reduce((a, b) => a + b.total, 0)}
                        </td>
                        <td className="p-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}