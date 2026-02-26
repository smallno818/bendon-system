// src/hooks/useGroupOrders.ts
import { useState, useEffect, useCallback } from 'react';
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

  // --- 內部輔助函數：計算統計 ---
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
    setActiveGroupId(groupId);
    // 載入菜單
    const { data: menuData } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .order('price', { ascending: true });
    if (menuData) setMenu(menuData);
    
    // 載入訂單
    fetchOrders(groupId);
  }, [fetchOrders]);

  // --- API 動作：抓取今日開團 ---
  const fetchTodayGroups = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('daily_groups')
      .select('*, store:stores(*)')
      .eq('order_date', today)
      .order('id', { ascending: true });
    
    if (data && data.length > 0) {
      setTodayGroups(data as any);
      
      // 自動切換邏輯
      const currentGroupStillExists = data.find((g: any) => g.id === activeGroupId);
      if (!activeGroupId || !currentGroupStillExists) {
        switchGroup(data[0].id, data[0].store_id);
      } else {
        fetchOrders(activeGroupId);
      }
    } else {
      setTodayGroups([]);
      setActiveGroupId(null);
      setOrders([]);
      setSummary([]);
    }
    setLoading(false);
  }, [activeGroupId, switchGroup, fetchOrders]);

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

  // --- 初始化與 Real-time 監聽 ---
  useEffect(() => {
    fetchStores();
    fetchTodayGroups();
    
    const groupChannel = supabase.channel('realtime_groups')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'daily_groups' }, () => {
        fetchTodayGroups();
      })
      .subscribe();

    const ordersChannel = supabase.channel('realtime_orders')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'orders' }, () => {
        if (activeGroupId) fetchOrders(activeGroupId);
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(groupChannel);
      supabase.removeChannel(ordersChannel);
    };
  }, [fetchStores, fetchTodayGroups, fetchOrders, activeGroupId]);

  // --- 使用者動作：下單 ---
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
  };

  // --- 使用者動作：刪除訂單 ---
  const deleteOrder = async (orderId: number) => {
    if (isExpired) throw new Error('已結單，無法刪除');
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) throw error;
  };

  // --- 使用者動作：建立開團 ---
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
    // 成功後 fetchTodayGroups 會被 real-time 或手動觸發
    await fetchTodayGroups(); 
  };

  // --- 使用者動作：關閉開團 ---
  const closeGroup = async () => {
    if (!activeGroupId) return;
    // 1. 刪除訂單
    await supabase.from('orders').delete().eq('group_id', activeGroupId);
    // 2. 刪除群組
    const { error } = await supabase.from('daily_groups').delete().eq('id', activeGroupId);
    
    if (error) throw error;
    await fetchTodayGroups();
  };

  return {
    // 資料
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
    // 動作
    switchGroup,
    createOrder,
    deleteOrder,
    createGroup,
    closeGroup,
  };
}