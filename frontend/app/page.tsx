'use client';

import { useState, useCallback, useEffect } from 'react';
import { Calendar, Cpu, LogOut } from 'lucide-react';
import { MeetingPanel, AttendeeList, ProcessingModal, SummaryModal } from '@/components';
import LoginPage from '@/components/LoginPage';
import MeetingHistory from '@/components/MeetingHistory';
import { useAudioRecorder } from '@/lib/useAudioRecorder';
import { startMeeting, endMeeting, getMeetingStatus, getMeetingSummary } from '@/lib/api';
import * as auth from '@/lib/auth';
import type { Attendee, MeetingStatus, ProcessingStep } from '@/lib/types';

// 會議室名稱（可從環境變數或設定檔讀取）
const ROOM_NAME = '會議室 A';

export default function HomePage() {
  // 認證狀態
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<auth.User | null>(null);
  
  // 會議狀態管理
  const [status, setStatus] = useState<MeetingStatus>('idle');
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryContent, setSummaryContent] = useState('');
  const [transcriptContent, setTranscriptContent] = useState('');
  const [processingSteps, setProcessingSteps] = useState<{
    upload: ProcessingStep;
    transcription: ProcessingStep;
    summary: ProcessingStep;
    email: ProcessingStep;
  }>({
    upload: 'pending',
    transcription: 'pending',
    summary: 'pending',
    email: 'pending',
  });

  // 錄音 Hook
  const { isRecording, startRecording, stopRecording, error: recordError } = useAudioRecorder();

  // 當前日期時間
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // 檢查登入狀態
  useEffect(() => {
    const user = auth.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  // 登入成功處理
  const handleLoginSuccess = (user: auth.User) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  // 登出處理
  const handleLogout = async () => {
    if (confirm('確定要登出嗎？')) {
      await auth.logout();
      setCurrentUser(null);
      setIsAuthenticated(false);
    }
  };
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 格式化日期時間
  const formatDateTime = (date: Date) => {
    return date.toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 新增與會者
  const handleAddAttendee = useCallback((email: string, name?: string) => {
    setAttendees(prev => {
      // 檢查是否已存在
      if (prev.some(a => a.email === email)) {
        return prev;
      }
      return [...prev, { email, name }];
    });
  }, []);

  // 移除與會者
  const handleRemoveAttendee = useCallback((email: string) => {
    setAttendees(prev => prev.filter(a => a.email !== email));
  }, []);

  // 開始會議
  const handleStartMeeting = useCallback(async () => {
    try {
      setError(null);
      
      // 檢查是否有與會者
      if (attendees.length === 0) {
        setError('請至少新增一位與會者');
        return;
      }
      
      // 呼叫 API 開始會議
      const response = await startMeeting({
        room: ROOM_NAME,
        attendees,
      });
      
      setMeetingId(response.meeting_id);
      setStatus('recording');
      
      // 開始錄音
      await startRecording();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '開始會議失敗');
      setStatus('idle');
    }
  }, [attendees, startRecording]);

  // 結束會議
  const handleEndMeeting = useCallback(async () => {
    if (!meetingId) return;
    
    try {
      setError(null);
      setStatus('uploading');
      setShowProcessingModal(true);
      setProcessingSteps({
        upload: 'in_progress',
        transcription: 'pending',
        summary: 'pending',
        email: 'pending',
      });
      
      // 停止錄音並取得音檔
      const audioBlob = await stopRecording();
      
      // 上傳音檔
      await endMeeting(meetingId, audioBlob, attendees);
      
      setProcessingSteps(prev => ({ ...prev, upload: 'completed' }));
      setStatus('processing');
      
      // 開始輪詢狀態
      pollStatus(meetingId);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '結束會議失敗');
      setProcessingSteps(prev => ({ ...prev, upload: 'failed' }));
      setStatus('failed');
    }
  }, [meetingId, attendees, stopRecording]);

  // 輪詢處理狀態
  const pollStatus = useCallback(async (id: string) => {
    const poll = async () => {
      try {
        const response = await getMeetingStatus(id);
        console.log('Poll response:', response);
        
        setProcessingSteps(response.steps);
        setStatus(response.status);
        
        // 如果還在處理中，繼續輪詢
        if (response.status === 'processing' || response.status === 'uploading') {
          setTimeout(poll, 2000);
        } else if (response.status === 'completed') {
          // 處理完成，獲取摘要並顯示摘要頁面
          console.log('✅ 處理完成！獲取摘要...');
          try {
            const summaryData = await getMeetingSummary(id);
            setSummaryContent(summaryData.summary);
            setTranscriptContent(summaryData.transcript);
            // 關閉處理中 Modal，顯示摘要 Modal
            setShowProcessingModal(false);
            setShowSummaryModal(true);
          } catch (summaryErr) {
            console.error('獲取摘要失敗:', summaryErr);
            // 即使獲取摘要失敗，也顯示摘要頁面
            setShowProcessingModal(false);
            setShowSummaryModal(true);
          }
        } else if (response.status === 'failed') {
          setError(response.error || '處理失敗');
        }
        
      } catch (err) {
        console.error('輪詢狀態失敗:', err);
        setTimeout(poll, 3000);
      }
    };
    
    // 延遲開始輪詢
    setTimeout(poll, 1000);
  }, []);

  // 重置會議狀態
  const resetMeeting = useCallback(() => {
    setStatus('idle');
    setMeetingId(null);
    setAttendees([]);
    setShowProcessingModal(false);
    setShowSummaryModal(false);
    setSummaryContent('');
    setTranscriptContent('');
    setProcessingSteps({
      upload: 'pending',
      transcription: 'pending',
      summary: 'pending',
      email: 'pending',
    });
    setError(null);
  }, []);

  // 關閉處理中 Modal
  const handleCloseProcessingModal = useCallback(() => {
    if (status === 'failed') {
      resetMeeting();
    }
  }, [status, resetMeeting]);

  // 關閉摘要 Modal 並返回首頁
  const handleCloseSummaryModal = useCallback(() => {
    resetMeeting();
  }, [resetMeeting]);

  // 顯示錄音錯誤
  useEffect(() => {
    if (recordError) {
      setError(recordError);
    }
  }, [recordError]);

  // 載入中
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">載入中...</p>
        </div>
      </div>
    );
  }

  // 未登入 - 顯示登入頁面
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // 已登入 - 顯示主介面
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass-card rounded-none border-x-0 border-t-0 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-neon-cyan to-neon-purple">
              <Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-white">
              <span className="text-neon-cyan">◈</span> 會議室 AI
            </h1>
          </div>
          
          <div className="flex items-center gap-3 text-zinc-400 text-sm">
            {/* 用戶資訊 */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors"
            >
              <span className="text-cyan-400 text-xs">{currentUser?.email?.split('@')[0]}</span>
              <LogOut className="w-3.5 h-3.5 text-cyan-400" />
            </button>
            
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-neon-cyan" />
              <span className="font-mono hidden sm:inline">{formatDateTime(currentTime)}</span>
            </div>
            {isRecording && (
              <span className="flex items-center gap-1 text-neon-pink">
                <span className="recording-dot w-2 h-2" />
                <span className="hidden sm:inline">REC</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* 左側：會議控制 + 與會者 */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* 會議控制面板 */}
            <MeetingPanel
              room={ROOM_NAME}
              status={status}
              isRecording={isRecording}
              onStartMeeting={handleStartMeeting}
              onEndMeeting={handleEndMeeting}
              disabled={status === 'uploading' || status === 'processing'}
              error={error || undefined}
            />
            
            {/* 與會者列表 */}
            <AttendeeList
              attendees={attendees}
              onAdd={handleAddAttendee}
              onRemove={handleRemoveAttendee}
              disabled={isRecording || status === 'uploading' || status === 'processing'}
            />
          </div>
          
          {/* 右側：會議記錄 */}
          <div className="lg:col-span-1 min-h-[400px]">
            <MeetingHistory />
          </div>
        </div>
      </main>

      {/* 處理中 Modal */}
      <ProcessingModal
        isOpen={showProcessingModal}
        steps={processingSteps}
        error={error || undefined}
        onClose={handleCloseProcessingModal}
      />

      {/* 摘要顯示 Modal */}
      <SummaryModal
        isOpen={showSummaryModal}
        summary={summaryContent}
        transcript={transcriptContent}
        room={ROOM_NAME}
        attendeeCount={attendees.length}
        onClose={handleCloseSummaryModal}
      />
    </div>
  );
}
