'use client';

import { MapPin } from 'lucide-react';
import { RecordButton } from './RecordButton';
import { Timer } from './Timer';
import { StatusDisplay } from './StatusDisplay';
import type { MeetingStatus } from '@/lib/types';

interface MeetingPanelProps {
  room: string;
  status: MeetingStatus;
  isRecording: boolean;
  onStartMeeting: () => void;
  onEndMeeting: () => void;
  disabled?: boolean;
  error?: string;
}

// 音波動畫組件
function SoundWave({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  
  return (
    <div className="flex items-center justify-center gap-1 h-8 my-4">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="soundwave-bar"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );
}

export function MeetingPanel({
  room,
  status,
  isRecording,
  onStartMeeting,
  onEndMeeting,
  disabled,
  error,
}: MeetingPanelProps) {
  return (
    <div className="glass-card h-full flex flex-col items-center justify-center text-center py-8 sm:py-12">
      {/* 會議室資訊 */}
      <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 mb-6 sm:mb-8">
        <MapPin className="w-4 h-4 text-neon-cyan" />
        <span className="font-medium text-neon-cyan">◈ {room} ◈</span>
      </div>
      
      {/* 狀態顯示 */}
      <div className="mb-6 sm:mb-8">
        <StatusDisplay status={status} />
      </div>
      
      {/* 錄音按鈕 */}
      <div className="mb-6 sm:mb-8">
        <RecordButton
          isRecording={isRecording}
          isDisabled={disabled}
          onStart={onStartMeeting}
          onStop={onEndMeeting}
        />
      </div>
      
      {/* 音波動畫 */}
      <SoundWave isActive={isRecording} />
      
      {/* 計時器 */}
      <Timer isRunning={isRecording} />
      
      {/* 錯誤訊息 */}
      {error && (
        <div className="mt-6 p-4 bg-neon-pink/10 border border-neon-pink/30 rounded-xl max-w-sm">
          <p className="text-sm text-neon-pink">{error}</p>
        </div>
      )}
      
      {/* 提示文字 */}
      {status === 'idle' && (
        <p className="mt-6 sm:mt-8 text-sm text-zinc-500 max-w-xs px-4">
          點擊「開始會議」按鈕開始錄音，會議結束後系統將自動生成摘要
        </p>
      )}
      
      {isRecording && (
        <p className="mt-6 sm:mt-8 text-sm text-zinc-400 max-w-xs px-4">
          會議進行中，請在會議結束時點擊「結束會議」
        </p>
      )}
    </div>
  );
}
