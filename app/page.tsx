'use client'; // 告訴 Next.js 這是可以在手機/電腦上互動的元件

import React, { useState } from 'react';

export default function Home() {
  // 模擬餐點資料（之後我們會改成從 Supabase 抓取）
  const bentoList = [
    { id: 1, name: "古早味排骨飯", price: 100, desc: "現炸排骨，香脆可口" },
    { id: 2, name: "秘製雞腿飯", price: 120, desc: "超大隻雞腿，肉質鮮嫩" },
    { id: 3, name: "滷肉飯便當", price: 80, desc: "特製肥瘦比例，入口即化" },
  ];

  const handleOrder = (name: string) => {
    alert(`【點餐成功】\n您已選擇：${name}\n(稍後我們會串接資料庫，讓這筆訂單傳到雲端)`);
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto">
        {/* 標題區 */}
        <header className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-orange-600">🍱 辦公室訂便當系統</h1>
          <p className="text-gray-500 mt-2">今天想吃哪一家呢？</p>
        </header>

        {/* 菜單清單 */}
        <div className="space-y-4">
          {bentoList.map((item) => (
            <div 
              key={item.id} 
              className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center hover:shadow-md transition"
            >
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-800">{item.name}</h2>
                <p className="text-gray-400 text-sm mt-1">{item.desc}</p>
                <span className="inline-block mt-2 text-orange-600 font-bold">${item.price}</span>
              </div>
              
              <button 
                onClick={() => handleOrder(item.name)}
                className="ml-4 bg-orange-500 text-white px-6 py-2 rounded-xl font-medium hover:bg-orange-600 active:scale-95 transition"
              >
                點餐
              </button>
            </div>
          ))}
        </div>

        {/* 手機版小提示 */}
        <footer className="mt-12 text-center text-xs text-gray-400">
          * 支援手機版瀏覽，點擊按鈕即可下單
        </footer>
      </div>
    </main>
  );
}