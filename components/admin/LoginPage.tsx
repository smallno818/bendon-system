import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert('登入失敗：' + error.message);
      setLoading(false);
    } else {
      // 登入成功，頁面會自動重整
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl border border-gray-200">
        <div className="text-center mb-8">
          {/* 標題改為最深的 Gray-900 */}
          <h1 className="text-3xl font-extrabold text-gray-900">後台登入</h1>
          {/* 副標題加深並加粗 */}
          <p className="text-gray-600 mt-2 font-bold">請輸入管理員帳號密碼</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            {/* Label 改為深灰色 */}
            <label className="block text-sm font-bold text-gray-800 mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              // 輸入文字改為全黑 (text-gray-900)，提示文字改為深灰 (placeholder-gray-500)
              className="w-full h-12 px-4 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none font-bold text-gray-900 placeholder-gray-500 transition-all"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 px-4 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none font-bold text-gray-900 placeholder-gray-500 transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-indigo-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 hover:bg-indigo-800 transition-all active:scale-95 disabled:bg-gray-400"
          >
            {loading ? '驗證中...' : '登入系統'}
          </button>
        </form>
      </div>
    </div>
  );
}