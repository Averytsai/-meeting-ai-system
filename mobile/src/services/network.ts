/**
 * 網路狀態服務
 * 監控網路連接並管理離線/在線模式
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

type NetworkCallback = (isConnected: boolean) => void;

let isConnected = true;
let listeners: NetworkCallback[] = [];

/**
 * 初始化網路監聽
 */
export function initNetworkListener(): () => void {
  const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    const connected = state.isConnected ?? false;
    
    if (connected !== isConnected) {
      isConnected = connected;
      console.log(`📡 網路狀態: ${connected ? '已連線' : '離線'}`);
      
      // 通知所有監聽者
      listeners.forEach(callback => callback(connected));
    }
  });
  
  return unsubscribe;
}

/**
 * 檢查當前是否有網路
 */
export async function checkNetworkStatus(): Promise<boolean> {
  const state = await NetInfo.fetch();
  isConnected = state.isConnected ?? false;
  return isConnected;
}

/**
 * 獲取當前網路狀態（同步）
 */
export function getNetworkStatus(): boolean {
  return isConnected;
}

/**
 * 添加網路狀態變化監聽器
 */
export function addNetworkListener(callback: NetworkCallback): () => void {
  listeners.push(callback);
  
  // 返回取消訂閱函數
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
}

/**
 * 等待網路連接
 */
export function waitForNetwork(timeoutMs: number = 30000): Promise<boolean> {
  return new Promise((resolve) => {
    if (isConnected) {
      resolve(true);
      return;
    }
    
    const timeout = setTimeout(() => {
      removeListener();
      resolve(false);
    }, timeoutMs);
    
    const removeListener = addNetworkListener((connected) => {
      if (connected) {
        clearTimeout(timeout);
        removeListener();
        resolve(true);
      }
    });
  });
}

