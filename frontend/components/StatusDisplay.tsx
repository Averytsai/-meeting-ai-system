'use client';

import type { MeetingStatus } from '@/lib/types';

interface StatusDisplayProps {
  status: MeetingStatus;
}

const statusConfig: Record<MeetingStatus, { 
  label: string; 
  textColor: string; 
  bgColor: string;
  glowClass: string;
}> = {
  idle: {
    label: '● 待機中',
    textColor: 'text-zinc-400',
    bgColor: 'bg-zinc-800/50',
    glowClass: '',
  },
  recording: {
    label: '◉ 錄音中',
    textColor: 'text-neon-pink',
    bgColor: 'bg-neon-pink/10',
    glowClass: 'status-glow-pink',
  },
  uploading: {
    label: '↑ 上傳中',
    textColor: 'text-neon-orange',
    bgColor: 'bg-neon-orange/10',
    glowClass: '',
  },
  processing: {
    label: '⟳ 處理中',
    textColor: 'text-neon-cyan',
    bgColor: 'bg-neon-cyan/10',
    glowClass: 'status-glow-cyan',
  },
  completed: {
    label: '✓ 已完成',
    textColor: 'text-neon-green',
    bgColor: 'bg-neon-green/10',
    glowClass: 'status-glow-green',
  },
  failed: {
    label: '✕ 處理失敗',
    textColor: 'text-neon-pink',
    bgColor: 'bg-neon-pink/10',
    glowClass: 'status-glow-pink',
  },
};

export function StatusDisplay({ status }: StatusDisplayProps) {
  const config = statusConfig[status];
  
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 ${config.bgColor} ${config.glowClass}`}>
      {status === 'recording' && (
        <span className="recording-dot" aria-hidden="true" />
      )}
      {status === 'processing' && (
        <span className="w-3 h-3 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
      )}
      <span className={`font-medium ${config.textColor}`}>
        {config.label}
      </span>
    </div>
  );
}
