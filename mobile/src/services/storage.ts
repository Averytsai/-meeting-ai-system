/**
 * 本地存儲服務
 * 管理離線會議數據
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
// 使用 legacy API 避免棄用警告
import * as FileSystem from 'expo-file-system/legacy';

const MEETINGS_KEY = '@meetings';

export interface LocalMeeting {
  id: string;
  room: string;
  attendees: { email: string; name?: string }[];
  audioUri: string;
  startTime: string;
  endTime?: string;
  status: 'recording' | 'pending_upload' | 'uploading' | 'uploaded' | 'failed';
  uploadAttempts: number;
  lastError?: string;
  summary?: string;
  transcript?: string;
}

/**
 * 生成本地會議 ID
 */
export function generateLocalMeetingId(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  return `local_${timestamp}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * 獲取所有本地會議
 */
export async function getLocalMeetings(): Promise<LocalMeeting[]> {
  try {
    const data = await AsyncStorage.getItem(MEETINGS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('讀取本地會議失敗:', error);
    return [];
  }
}

/**
 * 保存本地會議
 */
export async function saveLocalMeeting(meeting: LocalMeeting): Promise<void> {
  try {
    const meetings = await getLocalMeetings();
    const index = meetings.findIndex(m => m.id === meeting.id);
    
    if (index >= 0) {
      meetings[index] = meeting;
    } else {
      meetings.unshift(meeting); // 新會議放最前面
    }
    
    await AsyncStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings));
    console.log('✅ 會議已保存到本地:', meeting.id);
  } catch (error) {
    console.error('保存本地會議失敗:', error);
    throw error;
  }
}

/**
 * 更新會議狀態
 */
export async function updateMeetingStatus(
  meetingId: string,
  updates: Partial<LocalMeeting>
): Promise<void> {
  const meetings = await getLocalMeetings();
  const index = meetings.findIndex(m => m.id === meetingId);
  
  if (index >= 0) {
    meetings[index] = { ...meetings[index], ...updates };
    await AsyncStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings));
  }
}

/**
 * 獲取待上傳的會議
 */
export async function getPendingMeetings(): Promise<LocalMeeting[]> {
  const meetings = await getLocalMeetings();
  return meetings.filter(m => m.status === 'pending_upload' || m.status === 'failed');
}

/**
 * 刪除本地會議
 */
export async function deleteLocalMeeting(meetingId: string): Promise<void> {
  try {
    const meetings = await getLocalMeetings();
    const meeting = meetings.find(m => m.id === meetingId);
    
    // 刪除音檔
    if (meeting?.audioUri) {
      try {
        await FileSystem.deleteAsync(meeting.audioUri, { idempotent: true });
      } catch (e) {
        console.log('刪除音檔失敗（可能已不存在）');
      }
    }
    
    // 從列表移除
    const filtered = meetings.filter(m => m.id !== meetingId);
    await AsyncStorage.setItem(MEETINGS_KEY, JSON.stringify(filtered));
    
    console.log('🗑️ 已刪除本地會議:', meetingId);
  } catch (error) {
    console.error('刪除會議失敗:', error);
  }
}

/**
 * 複製錄音到持久化目錄
 */
export async function persistAudioFile(tempUri: string, meetingId: string): Promise<string> {
  try {
    const dir = `${FileSystem.documentDirectory}meetings/`;
    const fileName = `${meetingId}.m4a`;
    const destUri = `${dir}${fileName}`;
    
    // 確保目錄存在
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    
    // 複製文件
    await FileSystem.copyAsync({ from: tempUri, to: destUri });
    console.log('💾 音檔已保存:', destUri);
    
    return destUri;
  } catch (error) {
    console.error('持久化音檔失敗:', error);
    // 如果失敗，返回原始 URI
    return tempUri;
  }
}

/**
 * 清理舊的已上傳會議（保留最近 50 筆）
 */
export async function cleanupOldMeetings(): Promise<void> {
  const meetings = await getLocalMeetings();
  const uploaded = meetings.filter(m => m.status === 'uploaded');
  
  if (uploaded.length > 50) {
    // 刪除最舊的已上傳會議
    const toDelete = uploaded.slice(50);
    for (const meeting of toDelete) {
      await deleteLocalMeeting(meeting.id);
    }
  }
}
