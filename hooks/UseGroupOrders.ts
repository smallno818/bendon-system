import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Store, Product, Order, SummaryItem, Group } from '@/types';

export function useGroupOrders() {
  // --- 資料狀態 ---
  const [todayGroups, setTodayGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [storeList, setStoreList] = useState<Store[]>([]);
  
  const [menu, setMenu] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);

  // ★ 關鍵：用 Ref 來隨時追蹤「當前選中的群組」，解決跨裝置監聽時的變數過期問題
  const activeGroupIdRef = useRef<number | null>(null);

  // 當 State 改變時，同步更新 Ref (讓監聽器隨時能拿到最新 ID)
  useEffect(() => {
    activeGroupIdRef.current = activeGroupId;
  }, [activeGroupId]);

  // --- 內部輔助：計算統計 ---
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

  // --- API 動作：抓取訂單 ---
  // 使用 useCallback 確保函數記憶體位置不變，避免 useEffect 重複執行
  const fetchOrders = useCallback(async (groupId: number) => {
    console.log('正在更新訂單，群組ID:', groupId);
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    
    if (data) { 
      setOrders(data); 
      calculateSummary(data); 
    }
  }, []);

  // --- API 動作：切換群組 ---
  const switchGroup = useCallback(async (groupId: number, storeId: number) => {
    setActiveGroupId(groupId);
    
    const { data: menuData } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .order('price', { ascending: true });
    if (menuData) setMenu(menuData);
    
    await fetchOrders(groupId);
  }, [fetchOrders]);

  // --- API 動作：抓取今日開團 ---
  const fetchTodayGroups = useCallback(async () => {
    console.log('正在檢查今日開團...');
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('daily_groups')
      .select('*, store:stores(*)')
      .eq('order_date', today)
      .order('id', { ascending: true });
    
    if (data) {
      setTodayGroups(data as any);
    } else {
      setTodayGroups([]);
    }
    setLoading(false);
  }, []);

  // --- 監聽資料變化並自動導航 ---
  useEffect(() => {
    if (loading) return;

    if (todayGroups.length === 0) {
      setActiveGroupId(null);
      setOrders([]);
      setSummary([]);
      return;
    }

    const currentId = activeGroupIdRef.current;
    const currentGroupStillExists = todayGroups.find(g => g.id === currentId);

    if (!currentId || !currentGroupStillExists) {
      // 如果目前沒選，或是原本選的被刪除了 -> 自動跳到第一團
      const firstGroup = todayGroups[0];
      switchGroup(firstGroup.id, firstGroup.store_id);
    } else if (currentId) {
       // 如果目前的還在，順便刷新一下訂單確保最新
       fetchOrders(currentId);
    }
  }, [todayGroups, loading, switchGroup, fetchOrders]);


  // --- API 動作：抓取店家列表 ---
  const fetchStores = useCallback(async () => {
    const { data } = await supabase.from('stores').select('*').order('id');
    if (data) setStoreList(data);
  }, []);

  // --- 倒數計時邏輯 ---
  useEffect(() => {
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

    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [activeGroupId, todayGroups]);

  // --- ★★★ 核心：Real-time 跨裝置監聽 ★★★ ---
  useEffect(() => {
    // 1. 載入初始資料
    fetchStores();
    fetchTodayGroups();
    
    // 2. 建立 Real-time 連線
    // 這裡我們不放任何依賴 (Dependency Array 為空)，確保連線只建立一次，不會斷斷續續
    
    const channel = supabase.channel('global_changes')
      // (A) 監聽群組變化：當有人開團或刪團時 -> 重抓群組列表
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'daily_groups' }, () => {
        console.log('收到群組變更通知！');
        fetchTodayGroups();
      })
      // (B) 監聽訂單變化：當有人下單或刪單時 -> 重抓「目前群組」的訂單
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'orders' }, () => {
        console.log('收到訂單變更通知！');
        // ★ 這裡使用 Ref 來讀取當下的 ID，解決閉包問題
        if (activeGroupIdRef.current) {
          fetchOrders(activeGroupIdRef.current);
        }
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStores, fetchTodayGroups, fetchOrders]); // 這些函數都是 useCallback 的，所以不會導致重複執行

  // --- 使用者動作 ---

  const createOrder = async (itemName: string, itemPrice: number, quantity: number, customerName: string) => {
    if (isExpired) throw new Error('已經超過結單時間');
    if (!activeGroupId) throw new Error('沒有選擇群組');

    const { error } = await supabase.from('orders').insert([{ 
      item_name: itemName, 
      price: itemPrice, 
      customer_name: customerName,
      quantity: quantity,
      group_id: activeGroupId
    }]);

    if (error) throw error;
    // 本地操作也要手動刷新，讓自己看起來最快
    await fetchOrders(activeGroupId); 
  };

  const deleteOrder = async (orderId: number) => {
    if (isExpired) throw new Error('已結單，無法刪除');
    if (!activeGroupId) return;

    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) throw error;
    await fetchOrders(activeGroupId);
  };

  const createGroup = async (storeId: number, endTime: string, groupName: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const fullEndDateTime = new Date(endTime).toISOString();

    const { error } = await supabase.from('daily_groups').insert([{
      order_date: todayStr,
      store_id: storeId,
      end_time: fullEndDateTime,
      name: groupName || null
    }]);

    if (error) throw error;
    await fetchTodayGroups(); 
  };

  const closeGroup = async () => {
    if (!activeGroupId) return;
    await supabase.from('orders').delete().eq('group_id', activeGroupId);
    const { error } = await supabase.from('daily_groups').delete().eq('id', activeGroupId);
    
    if (error) throw error;
    await fetchTodayGroups();
  };

  return {
    todayGroups,
    activeGroupId,
    activeGroup: todayGroups.find(g => g.id === activeGroupId),
    storeList,
    menu,
    orders,
    summary,
    loading,
    timeLeft,
    isExpired,
    switchGroup,
    createOrder,
    deleteOrder,
    createGroup,
    closeGroup,
  };
}