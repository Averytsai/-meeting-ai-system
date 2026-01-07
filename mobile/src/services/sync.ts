/**
 * 同步服務
 * 管理離線數據的上傳和同步
 */

import * as api from './api';
import * as storage from './storage';
import { checkNetworkStatus, addNetworkListener } from './network';
import * as FileSystem from 'expo-file-system/legacy';

let isSyncing = false;
let syncListeners: ((status: SyncStatus) => void)[] = [];

export interface SyncStatus {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime?: string;
  currentMeetingId?: string;
  error?: string;
}

/**
 * 檢查文件是否存在
 */
async function fileExists(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

/**
 * 上傳單個會議
 */
async function uploadMeeting(meeting: storage.LocalMeeting): Promise<boolean> {
  try {
    console.log(`📤 開始上傳會議: ${meeting.id}`);
    
    // 檢查音檔是否存在
    if (!meeting.audioUri || !(await fileExists(meeting.audioUri))) {
      console.log(`⚠️ 音檔不存在，移除會議: ${meeting.id}`);
      await storage.deleteLocalMeeting(meeting.id);
      return false;
    }
    
    // 更新狀態為上傳中
    await storage.updateMeetingStatus(meeting.id, { status: 'uploading' });
    notifyListeners({ isSyncing: true, pendingCount: 0, currentMeetingId: meeting.id });
    
    // 1. 先開始會議（獲取服務器 meeting_id）
    const startResponse = await api.startMeeting(meeting.room, meeting.attendees);
    const serverMeetingId = startResponse.meeting_id;
    
    // 2. 上傳錄音
    await api.endMeeting(serverMeetingId, meeting.audioUri, meeting.attendees);
    
    // 3. 更新本地狀態
    await storage.updateMeetingStatus(meeting.id, {
      status: 'uploaded',
      uploadAttempts: meeting.uploadAttempts + 1,
    });
    
    console.log(`✅ 會議上傳成功: ${meeting.id} -> ${serverMeetingId}`);
    return true;
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '上傳失敗';
    console.error(`❌ 會議上傳失敗: ${meeting.id}`, errorMsg);
    
    // 如果是文件不存在的錯誤，直接刪除
    if (errorMsg.includes('No such file') || errorMsg.includes('not found')) {
      await storage.deleteLocalMeeting(meeting.id);
      return false;
    }
    
    await storage.updateMeetingStatus(meeting.id, {
      status: 'failed',
      uploadAttempts: meeting.uploadAttempts + 1,
      lastError: errorMsg,
    });
    
    return false;
  }
}

/**
 * 清理無效的會議記錄（音檔不存在的）
 */
export async function cleanupInvalidMeetings(): Promise<number> {
  const meetings = await storage.getLocalMeetings();
  let cleaned = 0;
  
  for (const meeting of meetings) {
    if (meeting.status !== 'uploaded' && meeting.audioUri) {
      const exists = await fileExists(meeting.audioUri);
      if (!exists) {
        await storage.deleteLocalMeeting(meeting.id);
        cleaned++;
        console.log(`🗑️ 清理無效會議: ${meeting.id}`);
      }
    }
  }
  
  return cleaned;
}

/**
 * 同步所有待上傳的會議
 */
export async function syncPendingMeetings(): Promise<SyncStatus> {
  if (isSyncing) {
    console.log('⏳ 已有同步任務進行中');
    return { isSyncing: true, pendingCount: 0 };
  }
  
  // 先清理無效的會議
  await cleanupInvalidMeetings();
  
  // 檢查網路
  const hasNetwork = await checkNetworkStatus();
  if (!hasNetwork) {
    console.log('📵 無網路，跳過同步');
    return { isSyncing: false, pendingCount: 0, error: '無網路連接' };
  }
  
  isSyncing = true;
  const pending = await storage.getPendingMeetings();
  
  if (pending.length === 0) {
    isSyncing = false;
    return { isSyncing: false, pendingCount: 0 };
  }
  
  console.log(`🔄 開始同步 ${pending.length} 個待上傳會議`);
  notifyListeners({ isSyncing: true, pendingCount: pending.length });
  
  let successCount = 0;
  let failCount = 0;
  
  for (const meeting of pending) {
    // 跳過上傳次數過多的（超過 5 次）
    if (meeting.uploadAttempts >= 5) {
      console.log(`⚠️ 跳過多次失敗的會議: ${meeting.id}`);
      continue;
    }
    
    const success = await uploadMeeting(meeting);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // 每個會議間隔 1 秒，避免請求過快
    await new Promise(r => setTimeout(r, 1000));
  }
  
  isSyncing = false;
  
  // 重新獲取待上傳數量
  const remainingPending = await storage.getPendingMeetings();
  
  const status: SyncStatus = {
    isSyncing: false,
    pendingCount: remainingPending.length,
    lastSyncTime: new Date().toISOString(),
  };
  
  console.log(`✅ 同步完成: 成功 ${successCount}, 失敗 ${failCount}`);
  notifyListeners(status);
  
  return status;
}

/**
 * 初始化自動同步（網路恢復時自動上傳）
 */
export function initAutoSync(): () => void {
  // 啟動時清理無效會議
  cleanupInvalidMeetings();
  
  const unsubscribe = addNetworkListener(async (isConnected) => {
    if (isConnected) {
      console.log('📡 網路已恢復，開始自動同步');
      // 延遲 2 秒後開始同步，確保網路穩定
      setTimeout(() => syncPendingMeetings(), 2000);
    }
  });
  
  // 啟動時也檢查一次
  syncPendingMeetings();
  
  return unsubscribe;
}

/**
 * 添加同步狀態監聽器
 */
export function addSyncListener(callback: (status: SyncStatus) => void): () => void {
  syncListeners.push(callback);
  return () => {
    syncListeners = syncListeners.filter(l => l !== callback);
  };
}

/**
 * 通知所有監聽器
 */
function notifyListeners(status: SyncStatus): void {
  syncListeners.forEach(callback => callback(status));
}

/**
 * 手動重試上傳特定會議
 */
export async function retryUpload(meetingId: string): Promise<boolean> {
  const meetings = await storage.getLocalMeetings();
  const meeting = meetings.find(m => m.id === meetingId);
  
  if (!meeting) {
    console.error('找不到會議:', meetingId);
    return false;
  }
  
  // 重置上傳次數
  await storage.updateMeetingStatus(meetingId, {
    status: 'pending_upload',
    uploadAttempts: 0,
    lastError: undefined,
  });
  
  return uploadMeeting(meeting);
}

/**
 * 清除所有本地會議記錄
 */
export async function clearAllMeetings(): Promise<void> {
  const meetings = await storage.getLocalMeetings();
  for (const meeting of meetings) {
    await storage.deleteLocalMeeting(meeting.id);
  }
  console.log('🗑️ 已清除所有本地會議');
}
