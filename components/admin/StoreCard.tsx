'use client';
import React, { useState } from 'react';
import { AdminButton } from './ui/AdminButton'; // 引入我們剛做的共用按鈕

type Props = {
  name: string;
  phone: string | null;
  imageUrl: string | null;
  category?: string; // ★ 新增：接收分類資料
  onEdit: () => void;
  onDelete: () => void;
};

export function StoreCard({ name, phone, imageUrl, category, onEdit, onDelete }: Props) {
  // ★ 新增狀態：控制大圖彈窗是否開啟
  const [isImageOpen, setIsImageOpen] = useState(false);

  return (
    <>
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all hover:shadow-lg hover:-translate-y-1">
        
        {/* === 圖片預覽區 === */}
        <div 
          // 有圖片才允許點擊，加上 group 方便做 hover 特效
          className={`h-48 w-full relative overflow-hidden bg-slate-50 flex items-center justify-center ${imageUrl ? 'cursor-pointer group' : ''}`}
          onClick={() => imageUrl && setIsImageOpen(true)}
        >
          {imageUrl ? (
            <>
              {/* 店家小圖 */}
              <img 
                src={imageUrl} 
                alt={name} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
              />
              {/* 滑鼠移上去時顯示的「點擊放大」遮罩 */}
              <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-all flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 bg-white/90 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold shadow-md backdrop-blur-sm transition-all translate-y-2 group-hover:translate-y-0 flex items-center gap-2">
                  🔍 點擊放大
                </span>
              </div>
            </>
          ) : (
            // 沒圖片時的預設畫面
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <span className="text-4xl">🏪</span>
              <span className="text-sm font-bold">尚無圖片</span>
            </div>
          )}
        </div>

        {/* === 店家資訊區 === */}
        <div className="p-6 flex-1 flex flex-col bg-white">
          <h3 className="text-xl font-bold text-slate-800 mb-1">
            {name}
            {/* ★ 新增功能：顯示分類標籤 */}
            <span className="ml-2 text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-md font-bold align-middle">
              {category === 'beverage' ? '🥤 飲料' : '🍱 午餐'}
            </span>
          </h3>
          <p className="text-slate-500 text-sm font-medium mb-6 flex items-center gap-2">
            <span>📞</span> {phone || '未提供電話'}
          </p>
          
          <div className="mt-auto flex gap-3 pt-4 border-t border-slate-100">
            <button 
              onClick={onEdit}
              className="flex-1 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl font-bold hover:bg-indigo-600 hover:text-white transition-colors"
            >
              📝 編輯菜單
            </button>
            <button 
              onClick={onDelete}
              className="w-12 h-12 flex items-center justify-center bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-colors"
              title="刪除店家"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>

      {/* === 大圖彈窗 (Lightbox) === */}
      {isImageOpen && imageUrl && (
        <div 
          className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn cursor-zoom-out"
          onClick={() => setIsImageOpen(false)} // 點擊黑色背景即可關閉
        >
          <div className="relative max-w-5xl max-h-[90vh] flex items-center justify-center group">
            
            {/* 右上角關閉按鈕 */}
            <button 
              className="absolute -top-12 right-0 w-10 h-10 bg-white/20 hover:bg-white/40 text-white rounded-full flex items-center justify-center transition-all text-xl font-bold backdrop-blur-md"
              onClick={(e) => {
                e.stopPropagation(); // 避免點擊事件往上傳遞觸發背景的關閉
                setIsImageOpen(false);
              }}
            >
              ✕
            </button>
            
            {/* 實際顯示的大圖 */}
            <img 
              src={imageUrl} 
              alt={name} 
              className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl cursor-default"
              onClick={(e) => e.stopPropagation()} // 點擊圖片本身不會關閉彈窗
            />
          </div>
        </div>
      )}
    </>
  );
}