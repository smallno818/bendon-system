'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [menu, setMenu] = useState<any[]>([]);

  // 1. 從 Supabase 抓取菜單
  useEffect(() => {
    async function fetchMenu() {
      const { data, error } = await supabase.from('bendon menu').select('*');
      if (error) {
        console.error('抓取失敗:', error.message);
        alert('資料庫抓取失敗: ' + error.message);
      }
      if (data) setMenu(data);
    }
    fetchMenu();
  }, []);

  // 2. 處理點餐（寫入 orders 資料表）
  const handleOrder = async (itemName: string, price: number) => {
    const customerName = prompt("請輸入您的姓名：") || "匿名同事";
    
    const { error } = await supabase
      .from('orders')
      .insert([{ item_name: itemName, price: price, customer_name: customerName }]);

    if (error) {
      alert("下單失敗：" + error.message);
    } else {
      alert(`🎉 ${customerName}，您已成功訂購 ${itemName}！`);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-orange-600">🍱 雲端訂便當系統</h1>
          <p className="text-gray-500 mt-2">連線至 Supabase 實時菜單</p>
        </header>

        <div className="space-y-4">
          {menu.map((item) => (
            <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">{item.name}</h2>
                <p className="text-orange-600 font-bold">${item.price}</p>
              </div>
              <button 
                onClick={() => handleOrder(item.name, item.price)}
                className="bg-orange-500 text-white px-6 py-2 rounded-xl hover:bg-orange-600 active:scale-95 transition"
              >
                點餐
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}