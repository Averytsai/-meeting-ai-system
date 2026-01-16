/**
 * 錄音服務
 * 使用 expo-av 進行錄音
 */

import { Audio } from 'expo-av';

let recording: Audio.Recording | null = null;

/**
 * 請求麥克風權限
 */
export async function requestPermissions(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * 清理現有的錄音實例
 */
async function cleanupRecording(): Promise<void> {
  if (recording) {
    try {
      const status = await recording.getStatusAsync();
      if (status.isRecording) {
        await recording.stopAndUnloadAsync();
      } else if (status.canRecord) {
        await recording._cleanupForUnloadedRecorder();
      }
    } catch (e) {
      // 忽略清理錯誤
      console.log('清理舊錄音:', e);
    }
    recording = null;
  }
}

/**
 * 開始錄音
 */
export async function startRecording(): Promise<void> {
  try {
    // 先清理任何現有的錄音
    await cleanupRecording();
    
    // 請求權限
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      throw new Error('需要麥克風權限才能錄音。請在設定中允許麥克風存取。');
    }

    // 權限剛授予時需要短暫延遲（特別是 iPad）
    await new Promise(resolve => setTimeout(resolve, 500));

    // 設定音訊模式
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });

    // 再次短暫延遲確保音訊模式設定完成
    await new Promise(resolve => setTimeout(resolve, 200));

    // 建立錄音實例
    const { recording: newRecording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );

    recording = newRecording;
    console.log('✅ 錄音開始');
  } catch (error) {
    console.error('❌ 錄音啟動失敗:', error);
    // 確保清理
    recording = null;
    
    // 提供更友好的錯誤訊息
    const errorMessage = error instanceof Error ? error.message : '錄音啟動失敗';
    throw new Error(errorMessage);
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
    recording = null;
    throw error;
  }
}

/**
 * 取消錄音
 */
export async function cancelRecording(): Promise<void> {
  await cleanupRecording();
  console.log('🗑️ 錄音已取消');
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
  try {
    return await recording.getStatusAsync();
  } catch {
    return null;
  }
}
