'use client';

import React, { useState } from 'react';
import * as auth from '@/lib/auth';

interface LoginPageProps {
  onLoginSuccess: (user: auth.User) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 驗證 Email
    if (!email.trim()) {
      setError('請輸入 Email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('請輸入有效的 Email 格式');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await auth.login(email.trim(), name.trim() || undefined);
      
      onLoginSuccess({
        id: response.user_id,
        email: response.email,
        name: response.name,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '登入失敗';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">◈</div>
          <h1 className="text-3xl font-bold text-white mb-2">會議室 AI</h1>
          <p className="text-gray-400">智能會議錄音 · AI 摘要</p>
        </div>

        {/* 登入表單 */}
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-700">
          <h2 className="text-2xl font-bold text-white text-center mb-2">登入帳號</h2>
          <p className="text-gray-400 text-center mb-6">使用公司 Email 登入</p>

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-4">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.name@company.com"
                className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">姓名（選填）</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="您的姓名"
                className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  登入中...
                </span>
              ) : (
                '登入'
              )}
            </button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-4 leading-relaxed">
            首次登入會自動創建帳號<br />
            之後開啟網站會自動登入
          </p>
        </div>

        {/* 底部 */}
        <p className="text-center text-gray-600 text-sm mt-8">
          © 2026 Meeting AI
        </p>
      </div>
    </div>
  );
}


