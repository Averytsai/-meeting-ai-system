import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import * as recorder from './src/services/recorder';
import * as api from './src/services/api';
import * as storage from './src/services/storage';
import { initNetworkListener, checkNetworkStatus, getNetworkStatus } from './src/services/network';
import { syncPendingMeetings, initAutoSync } from './src/services/sync';

type MeetingStatus = 'idle' | 'recording' | 'uploading' | 'processing' | 'completed' | 'failed';

export default function App() {
  // 狀態
  const [status, setStatus] = useState<MeetingStatus>('idle');
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<api.Attendee[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState('');
  const [transcript, setTranscript] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [localMeetings, setLocalMeetings] = useState<storage.LocalMeeting[]>([]);

  // 初始化網路監聽和自動同步
  useEffect(() => {
    const unsubNetwork = initNetworkListener();
    const unsubSync = initAutoSync();
    
    // 檢查初始網路狀態
    checkNetworkStatus().then(setIsOnline);
    
    // 載入本地會議
    loadLocalMeetings();
    
    // 定期檢查網路狀態
    const interval = setInterval(async () => {
      const online = await checkNetworkStatus();
      setIsOnline(online);
      
      // 更新待上傳數量
      const pending = await storage.getPendingMeetings();
      setPendingCount(pending.length);
    }, 5000);
    
    return () => {
      unsubNetwork();
      unsubSync();
      clearInterval(interval);
    };
  }, []);

  // 載入本地會議
  const loadLocalMeetings = async () => {
    const meetings = await storage.getLocalMeetings();
    setLocalMeetings(meetings);
    const pending = await storage.getPendingMeetings();
    setPendingCount(pending.length);
  };

  // 錄音計時器
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'recording') {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  // 格式化時間
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 新增與會者
  const handleAddAttendee = () => {
    if (!newEmail.trim()) {
      Alert.alert('錯誤', '請輸入 Email');
      return;
    }
    if (attendees.some((a) => a.email === newEmail)) {
      Alert.alert('錯誤', '此 Email 已存在');
      return;
    }
    setAttendees([...attendees, { email: newEmail.trim(), name: newName.trim() || undefined }]);
    setNewEmail('');
    setNewName('');
  };

  // 移除與會者
  const handleRemoveAttendee = (email: string) => {
    setAttendees(attendees.filter((a) => a.email !== email));
  };

  // 開始會議（支持離線）
  const handleStartMeeting = async () => {
    if (attendees.length === 0) {
      Alert.alert('錯誤', '請至少新增一位與會者');
      return;
    }

    try {
      setError(null);
      
      // 生成本地會議 ID
      const localId = storage.generateLocalMeetingId();
      setMeetingId(localId);
      
      // 開始錄音
      await recorder.startRecording();
      
      // 創建本地會議記錄
      const meeting: storage.LocalMeeting = {
        id: localId,
        room: '會議室 A',
        attendees: [...attendees],
        audioUri: '',
        startTime: new Date().toISOString(),
        status: 'recording',
        uploadAttempts: 0,
      };
      await storage.saveLocalMeeting(meeting);
      
      setStatus('recording');
      setRecordingTime(0);
      
      console.log('✅ 會議開始（本地模式）:', localId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '開始會議失敗');
      Alert.alert('錯誤', err instanceof Error ? err.message : '開始會議失敗');
    }
  };

  // 結束會議（支持離線）
  const handleEndMeeting = async () => {
    if (!meetingId) return;

    try {
      setError(null);
      setStatus('uploading');

      // 停止錄音
      const tempUri = await recorder.stopRecording();
      
      // 持久化音檔
      const audioUri = await storage.persistAudioFile(tempUri, meetingId);
      
      // 更新本地會議記錄
      await storage.updateMeetingStatus(meetingId, {
        audioUri,
        endTime: new Date().toISOString(),
        status: 'pending_upload',
      });
      
      // 檢查網路狀態
      const online = await checkNetworkStatus();
      
      if (online) {
        // 有網路，直接上傳
        setStatus('processing');
        await uploadAndProcess(meetingId, audioUri);
      } else {
        // 無網路，提示用戶
        Alert.alert(
          '已保存到本地',
          '錄音已保存！網路恢復後會自動上傳處理。',
          [{ text: '確定', onPress: handleReset }]
        );
        await loadLocalMeetings();
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '結束會議失敗');
      setStatus('failed');
      Alert.alert('錯誤', err instanceof Error ? err.message : '結束會議失敗');
    }
  };

  // 上傳並處理
  const uploadAndProcess = async (localId: string, audioUri: string) => {
    try {
      // 開始服務器會議
      const startResponse = await api.startMeeting('會議室 A', attendees);
      const serverId = startResponse.meeting_id;
      
      // 上傳錄音
      await api.endMeeting(serverId, audioUri, attendees);
      
      // 更新本地狀態
      await storage.updateMeetingStatus(localId, { status: 'uploaded' });
      
      // 開始輪詢
      pollStatus(serverId, localId);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗');
      setStatus('failed');
      
      // 標記為待上傳
      await storage.updateMeetingStatus(localId, {
        status: 'pending_upload',
        lastError: err instanceof Error ? err.message : '上傳失敗',
      });
      
      Alert.alert(
        '上傳失敗',
        '錄音已保存到本地，稍後會自動重試上傳。',
        [{ text: '確定', onPress: handleReset }]
      );
    }
  };

  // 輪詢狀態
  const pollStatus = useCallback(async (serverId: string, localId: string) => {
    try {
      const response = await api.getMeetingStatus(serverId);

      if (response.status === 'processing' || response.status === 'uploading') {
        setTimeout(() => pollStatus(serverId, localId), 2000);
      } else if (response.status === 'completed') {
        // 獲取摘要
        try {
          const summaryData = await api.getMeetingSummary(serverId);
          setSummary(summaryData.summary);
          setTranscript(summaryData.transcript);
          setShowSummary(true);
          
          // 更新本地記錄
          await storage.updateMeetingStatus(localId, {
            status: 'uploaded',
            summary: summaryData.summary,
            transcript: summaryData.transcript,
          });
        } catch (e) {
          console.error('獲取摘要失敗:', e);
        }
        setStatus('completed');
      } else if (response.status === 'failed') {
        setError(response.error || '處理失敗');
        setStatus('failed');
      }
    } catch (err) {
      console.error('輪詢失敗:', err);
      setTimeout(() => pollStatus(serverId, localId), 3000);
    }
  }, []);

  // 重置
  const handleReset = () => {
    setStatus('idle');
    setMeetingId(null);
    setAttendees([]);
    setRecordingTime(0);
    setShowSummary(false);
    setSummary('');
    setTranscript('');
    setError(null);
    loadLocalMeetings();
  };

  // 手動同步
  const handleSync = async () => {
    if (!isOnline) {
      Alert.alert('無網路', '請連接網路後再試');
      return;
    }
    
    Alert.alert('開始同步', '正在上傳待處理的會議...');
    await syncPendingMeetings();
    await loadLocalMeetings();
    Alert.alert('同步完成', `還有 ${pendingCount} 個會議待上傳`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>◈ 會議室 AI</Text>
        <View style={styles.headerRight}>
          {/* 網路狀態 */}
          <View style={[styles.networkIndicator, { backgroundColor: isOnline ? '#22c55e' : '#f43f5e' }]}>
            <Text style={styles.networkText}>{isOnline ? '在線' : '離線'}</Text>
          </View>
          
          {/* 待上傳數量 */}
          {pendingCount > 0 && (
            <TouchableOpacity style={styles.pendingBadge} onPress={handleSync}>
              <Text style={styles.pendingText}>{pendingCount} 待上傳</Text>
            </TouchableOpacity>
          )}
          
          {status === 'recording' && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>REC</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* 會議面板 */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>◈ 會議室 A ◈</Text>
          
          {/* 離線模式提示 */}
          {!isOnline && status === 'idle' && (
            <View style={styles.offlineNotice}>
              <Text style={styles.offlineText}>📵 離線模式：錄音將保存到本地，網路恢復後自動上傳</Text>
            </View>
          )}
          
          {/* 狀態 */}
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: status === 'recording' ? '#f43f5e' : '#22c55e' }]} />
            <Text style={styles.statusText}>
              {status === 'idle' && '待機中'}
              {status === 'recording' && '錄音中'}
              {status === 'uploading' && '上傳中...'}
              {status === 'processing' && '處理中...'}
              {status === 'completed' && '已完成'}
              {status === 'failed' && '失敗'}
            </Text>
          </View>

          {/* 計時器 */}
          <Text style={styles.timer}>{formatTime(recordingTime)}</Text>

          {/* 按鈕 */}
          {status === 'idle' && (
            <TouchableOpacity style={styles.startButton} onPress={handleStartMeeting}>
              <Text style={styles.buttonText}>開始會議</Text>
            </TouchableOpacity>
          )}

          {status === 'recording' && (
            <TouchableOpacity style={styles.stopButton} onPress={handleEndMeeting}>
              <Text style={styles.buttonText}>結束會議</Text>
            </TouchableOpacity>
          )}

          {(status === 'uploading' || status === 'processing') && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#00d4ff" />
              <Text style={styles.loadingText}>
                {status === 'uploading' ? '上傳音檔中...' : '生成摘要中...'}
              </Text>
            </View>
          )}
        </View>

        {/* 與會者 */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>與會者 ({attendees.length})</Text>
          
          {status === 'idle' && (
            <View style={styles.addAttendee}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#666"
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="姓名 (選填)"
                placeholderTextColor="#666"
                value={newName}
                onChangeText={setNewName}
              />
              <TouchableOpacity style={styles.addButton} onPress={handleAddAttendee}>
                <Text style={styles.addButtonText}>新增</Text>
              </TouchableOpacity>
            </View>
          )}

          {attendees.map((attendee) => (
            <View key={attendee.email} style={styles.attendeeItem}>
              <View>
                <Text style={styles.attendeeName}>{attendee.name || '未命名'}</Text>
                <Text style={styles.attendeeEmail}>{attendee.email}</Text>
              </View>
              {status === 'idle' && (
                <TouchableOpacity onPress={() => handleRemoveAttendee(attendee.email)}>
                  <Text style={styles.removeButton}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          {attendees.length === 0 && (
            <Text style={styles.emptyText}>尚未新增與會者</Text>
          )}
        </View>

        {/* 歷史會議按鈕 */}
        <TouchableOpacity 
          style={styles.historyButton} 
          onPress={() => { loadLocalMeetings(); setShowHistory(true); }}
        >
          <Text style={styles.historyButtonText}>📋 查看會議記錄 ({localMeetings.length})</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 摘要 Modal */}
      <Modal visible={showSummary} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>✓ 會議處理完成！</Text>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.sectionTitle}>AI 會議摘要</Text>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>{summary || '無摘要'}</Text>
            </View>
            
            <Text style={styles.sectionTitle}>語音轉錄</Text>
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptText}>{transcript || '無轉錄'}</Text>
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.closeButton} onPress={handleReset}>
            <Text style={styles.closeButtonText}>結束會議，返回首頁</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      {/* 歷史會議 Modal */}
      <Modal visible={showHistory} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📋 會議記錄</Text>
            <TouchableOpacity onPress={() => setShowHistory(false)}>
              <Text style={styles.closeText}>關閉</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {localMeetings.length === 0 ? (
              <Text style={styles.emptyText}>尚無會議記錄</Text>
            ) : (
              localMeetings.map((meeting) => (
                <View key={meeting.id} style={styles.historyItem}>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyRoom}>{meeting.room}</Text>
                    <Text style={styles.historyTime}>
                      {new Date(meeting.startTime).toLocaleString('zh-TW')}
                    </Text>
                    <Text style={styles.historyAttendees}>
                      {meeting.attendees.map(a => a.email).join(', ')}
                    </Text>
                  </View>
                  <View style={[
                    styles.historyStatus,
                    { backgroundColor: 
                      meeting.status === 'uploaded' ? '#22c55e' :
                      meeting.status === 'pending_upload' ? '#f59e0b' :
                      meeting.status === 'failed' ? '#f43f5e' : '#6b7280'
                    }
                  ]}>
                    <Text style={styles.historyStatusText}>
                      {meeting.status === 'uploaded' ? '已上傳' :
                       meeting.status === 'pending_upload' ? '待上傳' :
                       meeting.status === 'failed' ? '失敗' : meeting.status}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          {pendingCount > 0 && (
            <TouchableOpacity style={styles.syncButton} onPress={handleSync}>
              <Text style={styles.syncButtonText}>🔄 立即同步 ({pendingCount} 個待上傳)</Text>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00d4ff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  networkIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  networkText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  pendingBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f43f5e',
    marginRight: 6,
  },
  recordingText: {
    color: '#f43f5e',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  panel: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  offlineNotice: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  offlineText: {
    color: '#f59e0b',
    fontSize: 13,
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    color: '#a1a1aa',
    fontSize: 14,
  },
  timer: {
    fontSize: 48,
    fontWeight: '300',
    color: '#fff',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: '#00d4ff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#f43f5e',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    color: '#00d4ff',
    marginTop: 12,
  },
  addAttendee: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  addButton: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  attendeeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  attendeeName: {
    color: '#fff',
    fontSize: 16,
  },
  attendeeEmail: {
    color: '#71717a',
    fontSize: 12,
  },
  removeButton: {
    color: '#f43f5e',
    fontSize: 18,
    padding: 8,
  },
  emptyText: {
    color: '#52525b',
    textAlign: 'center',
    paddingVertical: 20,
  },
  historyButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  historyButtonText: {
    color: '#a1a1aa',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  closeText: {
    color: '#00d4ff',
    fontSize: 16,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00d4ff',
    marginBottom: 8,
    marginTop: 16,
  },
  summaryBox: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  summaryText: {
    color: '#d4d4d8',
    lineHeight: 22,
  },
  transcriptBox: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  transcriptText: {
    color: '#71717a',
    lineHeight: 20,
  },
  closeButton: {
    margin: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#00d4ff',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  historyInfo: {
    flex: 1,
  },
  historyRoom: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  historyTime: {
    color: '#a1a1aa',
    fontSize: 12,
    marginTop: 4,
  },
  historyAttendees: {
    color: '#71717a',
    fontSize: 11,
    marginTop: 2,
  },
  historyStatus: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  historyStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  syncButton: {
    margin: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f59e0b',
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
