/**
 * 認證服務
 * 處理用戶登入、Token 管理
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'http://tw-07.access.glows.ai:23435/api';

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

  // 保存到本地
  await AsyncStorage.multiSet([
    [AUTH_TOKEN_KEY, data.token],
    [USER_EMAIL_KEY, data.email],
    [USER_NAME_KEY, data.name || ''],
    [USER_ID_KEY, String(data.user_id)],
  ]);

  return data;
}

/**
 * 登出
 */
export async function logout(): Promise<void> {
  const token = await getToken();
  
  if (token) {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (e) {
      // 忽略錯誤，仍然清除本地資料
    }
  }

  // 清除本地資料
  await AsyncStorage.multiRemove([
    AUTH_TOKEN_KEY,
    USER_EMAIL_KEY,
    USER_NAME_KEY,
    USER_ID_KEY,
  ]);
}

/**
 * 獲取當前 Token
 */
export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * 獲取當前用戶資訊
 */
export async function getCurrentUser(): Promise<User | null> {
  const [token, email, name, userId] = await AsyncStorage.multiGet([
    AUTH_TOKEN_KEY,
    USER_EMAIL_KEY,
    USER_NAME_KEY,
    USER_ID_KEY,
  ]);

  if (!token[1] || !email[1]) {
    return null;
  }

  return {
    id: parseInt(userId[1] || '0'),
    email: email[1],
    name: name[1] || undefined,
  };
}

/**
 * 檢查是否已登入
 */
export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  return !!token;
}

/**
 * 驗證 Token 是否有效（向後端確認）
 */
export async function validateToken(): Promise<boolean> {
  const token = await getToken();
  
  if (!token) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 獲取帶有認證的 Headers
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
    };
  }
  
  return {};
}

