'use client';

import { useState, useCallback, useEffect } from 'react';
import { Calendar, Cpu } from 'lucide-react';
import { MeetingPanel, AttendeeList, ProcessingModal } from '@/components';
import { useAudioRecorder } from '@/lib/useAudioRecorder';
import { startMeeting, endMeeting, getMeetingStatus } from '@/lib/api';
import type { Attendee, MeetingStatus, ProcessingStep } from '@/lib/types';

// 會議室名稱（可從環境變數或設定檔讀取）
const ROOM_NAME = '會議室 A';

export default function HomePage() {
  // 狀態管理
  const [status, setStatus] = useState<MeetingStatus>('idle');
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
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
      setShowModal(true);
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
          // 處理完成，不自動重置，讓用戶看到結果
          console.log('✅ 處理完成！');
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
    setShowModal(false);
    setProcessingSteps({
      upload: 'pending',
      transcription: 'pending',
      summary: 'pending',
      email: 'pending',
    });
  }, []);

  // 關閉 Modal
  const handleCloseModal = useCallback(() => {
    if (status === 'completed' || status === 'failed') {
      resetMeeting();
    }
  }, [status, resetMeeting]);

  // 顯示錄音錯誤
  useEffect(() => {
    if (recordError) {
      setError(recordError);
    }
  }, [recordError]);

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
          
          <div className="flex items-center gap-2 text-zinc-400 text-sm">
            <Calendar className="w-4 h-4 text-neon-cyan" />
            <span className="font-mono">{formatDateTime(currentTime)}</span>
            {isRecording && (
              <span className="ml-2 flex items-center gap-1 text-neon-pink">
                <span className="recording-dot w-2 h-2" />
                <span className="hidden sm:inline">REC</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6">
        {/* 桌面/平板：並排佈局 | 手機：堆疊佈局 */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 sm:gap-6 h-full min-h-[calc(100vh-120px)]">
          {/* 會議控制面板 */}
          <div className="md:col-span-3 min-h-[400px] md:min-h-0">
            <MeetingPanel
              room={ROOM_NAME}
              status={status}
              isRecording={isRecording}
              onStartMeeting={handleStartMeeting}
              onEndMeeting={handleEndMeeting}
              disabled={status === 'uploading' || status === 'processing'}
              error={error || undefined}
            />
          </div>
          
          {/* 與會者列表 */}
          <div className="md:col-span-2 min-h-[300px] md:min-h-0">
            <AttendeeList
              attendees={attendees}
              onAdd={handleAddAttendee}
              onRemove={handleRemoveAttendee}
              disabled={isRecording || status === 'uploading' || status === 'processing'}
            />
          </div>
        </div>
      </main>

      {/* 處理中 Modal */}
      <ProcessingModal
        isOpen={showModal}
        steps={processingSteps}
        error={error || undefined}
        onClose={handleCloseModal}
      />
    </div>
  );
}
