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

  // Ref 追蹤，解決閉包問題
  const activeGroupIdRef = useRef<number | null>(null);

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
  const fetchOrders = useCallback(async (groupId: number) => {
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
    // console.log('切換群組 -> ID:', groupId);
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
    // console.log('重抓今日開團列表...');
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

  // --- 關鍵修正：自動導航邏輯 ---
  // 當 todayGroups 改變時 (例如重抓後發現少了一團)，這裡會決定要跳去哪
  useEffect(() => {
    if (loading) return;

    // 1. 如果完全沒團 -> 強制清空
    if (todayGroups.length === 0) {
      if (activeGroupIdRef.current !== null) {
        setActiveGroupId(null);
        setOrders([]);
        setSummary([]);
      }
      return;
    }

    const currentId = activeGroupIdRef.current;
    const currentGroupStillExists = todayGroups.find(g => g.id === currentId);

    // 2. 如果「目前選中的團」已經不在列表裡了 (被刪除了)
    if (!currentId || !currentGroupStillExists) {
      // 自動跳轉到剩下的第一團
      const firstGroup = todayGroups[0];
      switchGroup(firstGroup.id, firstGroup.store_id);
    } 
    // 3. 如果團還在，就乖乖待著，不需要特別做動作 (訂單更新交給 orders channel)
  }, [todayGroups, loading, switchGroup]);


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
    fetchStores();
    fetchTodayGroups();
    
    const channel = supabase.channel('global_changes')
      
      // (A) 監聽群組變化：不管新增、修改、刪除，通通重抓列表！
      // 這樣最穩，不用擔心 payload 格式問題
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'daily_groups' }, () => {
        // console.log('收到群組變更，重抓列表！');
        fetchTodayGroups();
      })
      
      // (B) 監聽訂單變化：重抓目前訂單
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'orders' }, () => {
        if (activeGroupIdRef.current) {
          fetchOrders(activeGroupIdRef.current);
        }
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStores, fetchTodayGroups, fetchOrders]);

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
    
    // 本地先重抓，觸發 UI 更新
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