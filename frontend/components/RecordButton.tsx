'use client';

import { Mic, Square } from 'lucide-react';

interface RecordButtonProps {
  isRecording: boolean;
  isDisabled?: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function RecordButton({ isRecording, isDisabled, onStart, onStop }: RecordButtonProps) {
  if (isRecording) {
    return (
      <button
        onClick={onStop}
        className="btn-danger-neon flex items-center gap-3 text-lg sm:text-xl min-w-[160px] sm:min-w-[200px] justify-center"
        aria-label="結束會議"
      >
        <Square className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" />
        <span>結束會議</span>
      </button>
    );
  }

  return (
    <button
      onClick={onStart}
      disabled={isDisabled}
      className="btn-neon flex items-center gap-3 text-lg sm:text-xl min-w-[160px] sm:min-w-[200px] justify-center"
      aria-label="開始會議"
    >
      <Mic className="w-5 h-5 sm:w-6 sm:h-6" />
      <span>開始會議</span>
    </button>
  );
}
