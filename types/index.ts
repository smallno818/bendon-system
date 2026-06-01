// src/types/index.ts

export type Store = { 
  id: number; 
  name: string; 
  image_url: string | null; 
  phone: string | null; 
  category?: string; // ★ 新增這行：lunch 或 beverage
  recentCount?: number;
};

export type Product = { 
  id: number; 
  store_id: number; 
  name: string; 
  price: number; 
  description: string | null; 
  options?: string | null;
};

export type Order = { 
  id: number; 
  item_name: string; 
  price: number; 
  customer_name: string; 
  quantity: number; 
  group_id: number; 
  remark?: string | null; // ★ 新增備註
};

export type SummaryItem = { 
  name: string; 
  count: number; 
  total: number; 
  orderDetails: { 
    id: number; 
    customer_name: string; 
    quantity: number 
    remark?: string | null; // ★ 新增備註
  }[]; 
};

export type Group = { 
  id: number; 
  store_id: number; 
  end_time: string; 
  name: string | null; 
  store: Store 
  order_date: string;
  is_printed?: boolean;
};