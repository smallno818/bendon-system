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

  // Ref 用來解決閉包舊值的問題
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
    // console.log('正在更新訂單，群組ID:', groupId);
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

  // --- API 動作：抓取所有未關閉的開團 (不限日期，直到手動關閉) ---
  const fetchTodayGroups = useCallback(async () => {
    const { data } = await supabase
      .from('daily_groups')
      .select('*, store:stores(*)')
      // ★ 已經把 .eq('order_date') 或是 .gte('end_time') 等日期過濾條件完全移除了
      // 現在只要這筆群組資料還存在於資料庫（沒有被按「關閉此團」刪除），就會全部抓出來
      .order('end_time', { ascending: true }); // 依然按照結單時間排序，快結單的排在最前面
    
    if (data) {
      setTodayGroups(data as any);
    } else {
      setTodayGroups([]);
    }
    setLoading(false);
  }, []);

  // --- 監聽資料變化並自動導航 (Auto-Switch Logic) ---
  useEffect(() => {
    if (loading) return;

    // 1. 如果完全沒團 -> 清空狀態
    if (todayGroups.length === 0) {
      setActiveGroupId(null);
      setOrders([]);
      setSummary([]);
      return;
    }

    const currentId = activeGroupIdRef.current;
    const currentGroupStillExists = todayGroups.find(g => g.id === currentId);

    // 2. 如果目前選中的團不見了 (被刪除) -> 自動跳轉到第一團
    if (!currentId || !currentGroupStillExists) {
      const firstGroup = todayGroups[0];
      switchGroup(firstGroup.id, firstGroup.store_id);
    } 
    // 3. 如果團還在，但資料可能舊了 -> 順手刷新訂單
    else if (currentId) {
      // 這裡不強制 fetchOrders，避免過度刷新，由 Real-time 負責即可
    }
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
      
      // (A) 監聽群組變化
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'daily_groups' }, (payload: any) => {
        // ★ 關鍵修正：如果是 DELETE 事件，直接在本地狀態把該群組移除，不要等 fetch
        // 這就是 Optimistic Update (樂觀更新)，讓 UI 瞬間反應
        if (payload.eventType === 'DELETE' && payload.old.id) {
          console.log('收到刪除群組訊號，立即移除 ID:', payload.old.id);
          setTodayGroups((prev) => prev.filter(g => g.id !== payload.old.id));
        } else {
          // 如果是 INSERT 或 UPDATE，還是乖乖重抓比較保險
          fetchTodayGroups();
        }
      })
      
      // (B) 監聽訂單變化
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'orders' }, () => {
        // 當訂單變動時，重抓目前顯示群組的訂單
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
    // 第一道防線：本地端初步阻擋 (為了 UI 反應快速)
    if (isExpired) throw new Error('已經超過結單時間');
    if (!activeGroupId) throw new Error('沒有選擇群組');

    const currentGroup = todayGroups.find(g => g.id === activeGroupId);
    if (!currentGroup) throw new Error('找不到該群組資料');

    // ★ 第二道防線：向伺服器請求標準時間 (防止竄改本地時間)
    try {
      const timeRes = await fetch('/api/server-time');
      const { now: serverTime } = await timeRes.json();
      
      const serverNow = new Date(serverTime).getTime();
      const groupEnd = new Date(currentGroup.end_time).getTime();

      // 用伺服器的時間來做最終裁決
      if (serverNow > groupEnd) {
        throw new Error('伺服器判定：已超過結單時間，無法下單！');
      }
    } catch (err: any) {
      // 如果是我們自己丟出的錯誤，就原封不動往外丟
      if (err.message.includes('伺服器判定')) throw err;
      // 如果只是網路不穩抓不到時間，就不強制阻擋，或者您也可以選擇嚴格阻擋
      console.warn('無法取得伺服器時間，跳過二次驗證', err);
    }

    // 通過重重考驗，才允許寫入資料庫
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
    // ★ 新增：檢查開團數量限制 (最後一道防線)
    if (todayGroups.length >= 5) {
      throw new Error('同時最多只能開啟 5 個團購！請先關閉其他團購。');
    }
    
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
    
    // 1. 先刪除訂單
    await supabase.from('orders').delete().eq('group_id', activeGroupId);
    
    // 2. 再刪除群組
    const { error } = await supabase.from('daily_groups').delete().eq('id', activeGroupId);
    
    if (error) throw error;
    
    // 3. 本地也立刻執行刪除邏輯，不依賴 Real-time 回傳，確保自己這台最順
    setTodayGroups((prev) => prev.filter(g => g.id !== activeGroupId));
  };
  // --- ★ 新增：提早結單 (將結單時間改為現在) ---
  const closeGroupEarly = async () => {
    if (!activeGroupId) return;
    
    // 取得當下的 ISO 時間字串
    const now = new Date().toISOString();
    
    // 去資料庫更新這個群組的 end_time
    const { error } = await supabase
      .from('daily_groups')
      .update({ end_time: now })
      .eq('id', activeGroupId);

    if (error) throw error;
    
    // 更新完後重新抓取群組資料，讓畫面瞬間變成「已結單」
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
    closeGroupEarly, // ★ 記得把它 return 出去
  };
}