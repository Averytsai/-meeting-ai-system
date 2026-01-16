/**
 * 認證服務（網站版）
 * 處理用戶登入、Token 管理
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

const AUTH_TOKEN_KEY = 'auth_token';
const USER_EMAIL_KEY = 'user_email';
const USER_NAME_KEY = 'user_name';
const USER_ID_KEY = 'user_id';

export interface User {
  id: number;
  email: string;
  name?: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user_id: number;
  email: string;
  name?: string;
  message: string;
}

/**
 * 登入（只需要 Email）
 */
export async function login(email: string, name?: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, name }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '登入失敗');
  }

  const data: LoginResponse = await response.json();

  // 保存到 localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    localStorage.setItem(USER_EMAIL_KEY, data.email);
    localStorage.setItem(USER_NAME_KEY, data.name || '');
    localStorage.setItem(USER_ID_KEY, String(data.user_id));
  }

  return data;
}

/**
 * 登出
 */
export async function logout(): Promise<void> {
  const token = getToken();
  
  if (token) {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (e) {
      // 忽略錯誤
    }
  }

  // 清除本地資料
  if (typeof window !== 'undefined') {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_EMAIL_KEY);
    localStorage.removeItem(USER_NAME_KEY);
    localStorage.removeItem(USER_ID_KEY);
  }
}

/**
 * 獲取當前 Token
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * 獲取當前用戶資訊
 */
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const email = localStorage.getItem(USER_EMAIL_KEY);
  const name = localStorage.getItem(USER_NAME_KEY);
  const userId = localStorage.getItem(USER_ID_KEY);

  if (!token || !email) {
    return null;
  }

  return {
    id: parseInt(userId || '0'),
    email,
    name: name || undefined,
  };
}

/**
 * 檢查是否已登入
 */
export function isLoggedIn(): boolean {
  return !!getToken();
}

/**
 * 獲取帶有認證的 Headers
 */
export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
    };
  }
  
  return {};
}

