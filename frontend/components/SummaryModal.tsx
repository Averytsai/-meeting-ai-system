'use client';

import { FileText, Mail, Clock, Users, X, CheckCircle } from 'lucide-react';

interface SummaryModalProps {
  isOpen: boolean;
  summary: string;
  transcript: string;
  room: string;
  attendeeCount: number;
  onClose: () => void;
}

export function SummaryModal({ 
  isOpen, 
  summary, 
  transcript, 
  room, 
  attendeeCount,
  onClose 
}: SummaryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="glass-card max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
        {/* 標題區 */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-neon-green to-neon-cyan">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neon-green text-glow">
                ✓ 會議處理完成！
              </h2>
              <p className="text-sm text-zinc-400">摘要已發送至所有與會者</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 會議資訊 */}
        <div className="flex items-center gap-6 px-6 py-4 bg-white/5 border-b border-white/10">
          <div className="flex items-center gap-2 text-zinc-400">
            <FileText className="w-4 h-4 text-neon-cyan" />
            <span>{room}</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <Users className="w-4 h-4 text-neon-purple" />
            <span>{attendeeCount} 位與會者</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <Mail className="w-4 h-4 text-neon-green" />
            <span>已發送 Email</span>
          </div>
        </div>

        {/* 摘要內容 - 可滾動 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* AI 摘要 */}
          <div>
            <h3 className="text-sm font-semibold text-neon-cyan mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-neon-cyan"></span>
              AI 會議摘要
            </h3>
            <div className="bg-black/30 rounded-xl p-4 border border-white/10">
              <div className="prose prose-invert prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-zinc-300 text-sm leading-relaxed">
                  {summary || '摘要生成中...'}
                </pre>
              </div>
            </div>
          </div>

          {/* 原始轉錄 */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-400 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-zinc-500"></span>
              語音轉錄原文
            </h3>
            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
              <p className="text-zinc-500 text-sm leading-relaxed">
                {transcript || '無轉錄內容'}
              </p>
            </div>
          </div>
        </div>

        {/* 底部按鈕 */}
        <div className="p-6 border-t border-white/10 bg-black/20">
          <button
            onClick={onClose}
            className="w-full py-4 rounded-xl font-semibold text-white
                       bg-gradient-to-r from-neon-cyan to-neon-purple
                       hover:opacity-90 transition-all duration-200
                       shadow-lg shadow-neon-cyan/20"
          >
            結束會議，返回首頁
          </button>
        </div>
      </div>
    </div>
  );
}


