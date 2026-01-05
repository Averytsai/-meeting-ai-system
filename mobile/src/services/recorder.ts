/**
 * 錄音服務
 * 使用 expo-av 進行錄音
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

let recording: Audio.Recording | null = null;

/**
 * 請求麥克風權限
 */
export async function requestPermissions(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * 開始錄音
 */
export async function startRecording(): Promise<void> {
  try {
    // 請求權限
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      throw new Error('需要麥克風權限');
    }

    // 設定音訊模式
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true, // 背景錄音關鍵設定
    });

    // 建立錄音實例
    const { recording: newRecording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );

    recording = newRecording;
    console.log('✅ 錄音開始');
  } catch (error) {
    console.error('❌ 錄音啟動失敗:', error);
    throw error;
  }
}

/**
 * 停止錄音並返回檔案路徑
 */
export async function stopRecording(): Promise<string> {
  if (!recording) {
    throw new Error('沒有正在進行的錄音');
  }

  try {
    await recording.stopAndUnloadAsync();
    
    // 重設音訊模式
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });

    const uri = recording.getURI();
    recording = null;

    if (!uri) {
      throw new Error('無法獲取錄音檔案');
    }

    console.log('✅ 錄音結束:', uri);
    return uri;
  } catch (error) {
    console.error('❌ 停止錄音失敗:', error);
    throw error;
  }
}

/**
 * 取消錄音
 */
export async function cancelRecording(): Promise<void> {
  if (recording) {
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recording = null;
      
      // 刪除錄音檔
      if (uri) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
      
      console.log('🗑️ 錄音已取消');
    } catch (error) {
      console.error('取消錄音失敗:', error);
    }
  }
}

/**
 * 檢查是否正在錄音
 */
export function isRecording(): boolean {
  return recording !== null;
}

/**
 * 獲取錄音狀態
 */
export async function getRecordingStatus(): Promise<Audio.RecordingStatus | null> {
  if (!recording) return null;
  return await recording.getStatusAsync();
}

