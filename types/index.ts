// src/types/index.ts

export type Store = { 
  id: number; 
  name: string; 
  image_url: string | null; 
  phone: string | null; 
};

export type Product = { 
  id: number; 
  store_id: number; 
  name: string; 
  price: number; 
  description: string | null; 
};

export type Order = { 
  id: number; 
  item_name: string; 
  price: number; 
  customer_name: string; 
  quantity: number; 
  group_id: number; 
};

export type SummaryItem = { 
  name: string; 
  count: number; 
  total: number; 
  orderDetails: { 
    id: number; 
    customer_name: string; 
    quantity: number 
  }[]; 
};

export type Group = { 
  id: number; 
  store_id: number; 
  end_time: string; 
  name: string | null; 
  store: Store 
};