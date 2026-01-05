'use client';

import { Check, Loader2, Circle, AlertCircle, X } from 'lucide-react';
import type { ProcessingStep } from '@/lib/types';

interface ProcessingModalProps {
  isOpen: boolean;
  steps: {
    upload: ProcessingStep;
    transcription: ProcessingStep;
    summary: ProcessingStep;
    email: ProcessingStep;
  };
  error?: string;
  onClose?: () => void;
}

const stepLabels = {
  upload: '音檔上傳',
  transcription: '語音轉文字',
  summary: 'AI 摘要生成',
  email: 'Email 發送',
};

function StepIcon({ status }: { status: ProcessingStep }) {
  switch (status) {
    case 'completed':
      return <Check className="w-5 h-5 text-neon-green" />;
    case 'in_progress':
      return <Loader2 className="w-5 h-5 text-neon-cyan animate-spin" />;
    case 'failed':
      return <AlertCircle className="w-5 h-5 text-neon-pink" />;
    default:
      return <Circle className="w-5 h-5 text-zinc-600" />;
  }
}

export function ProcessingModal({ isOpen, steps, error, onClose }: ProcessingModalProps) {
  if (!isOpen) return null;

  const allCompleted = Object.values(steps).every(s => s === 'completed');
  const hasFailed = Object.values(steps).some(s => s === 'failed');
  
  // 計算進度百分比
  const completedCount = Object.values(steps).filter(s => s === 'completed').length;
  const progress = (completedCount / 4) * 100;

  return (
    <div className="modal-backdrop">
      <div className="glass-card max-w-md w-full mx-4 animate-slide-up">
        {/* 標題 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-lg sm:text-xl font-semibold ${
            hasFailed ? 'text-neon-pink' : allCompleted ? 'text-neon-green text-glow' : 'text-white'
          }`}>
            {hasFailed ? '✕ 處理失敗' : allCompleted ? '✓ 處理完成！' : '⟳ 處理中，請稍候...'}
          </h2>
          {(allCompleted || hasFailed) && onClose && (
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        
        {/* 進度條 */}
        <div className="progress-bar-neon mb-6">
          <div 
            className="progress-bar-fill-neon" 
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* 步驟列表 */}
        <div className="space-y-4">
          {(Object.keys(steps) as Array<keyof typeof steps>).map((key) => (
            <div key={key} className="flex items-center gap-3">
              <StepIcon status={steps[key]} />
              <span className={`flex-1 ${
                steps[key] === 'completed' ? 'text-zinc-400' :
                steps[key] === 'in_progress' ? 'text-neon-cyan font-medium' :
                steps[key] === 'failed' ? 'text-neon-pink' :
                'text-zinc-600'
              }`}>
                {stepLabels[key]}
              </span>
              {steps[key] === 'in_progress' && (
                <span className="text-sm text-neon-cyan animate-pulse">處理中...</span>
              )}
            </div>
          ))}
        </div>
        
        {/* 錯誤訊息 */}
        {error && (
          <div className="mt-6 p-4 bg-neon-pink/10 border border-neon-pink/30 rounded-xl">
            <p className="text-sm text-neon-pink">{error}</p>
          </div>
        )}
        
        {/* 完成訊息 */}
        {allCompleted && (
          <div className="mt-6 p-4 bg-neon-green/10 border border-neon-green/30 rounded-xl">
            <p className="text-sm text-neon-green">
              ✓ 會議摘要已發送至所有與會者的 Email
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
