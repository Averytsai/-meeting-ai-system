'use client';

import { useState, useEffect } from 'react';
import { Clock, FileText, ChevronRight, RefreshCw } from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth';

interface Meeting {
  id: string;
  room: string;
  start_time: string;
  end_time: string | null;
  status: string;
  created_at: string;
}

interface MeetingHistoryProps {
  onViewMeeting?: (meetingId: string) => void;
}

export default function MeetingHistory({ onViewMeeting }: MeetingHistoryProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null);
  const [summary, setSummary] = useState<string>('');
  const [transcript, setTranscript] = useState<string>('');
  const [loadingSummary, setLoadingSummary] = useState(false);

  const fetchMeetings = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const headers = getAuthHeaders();
      const response = await fetch('/api/meetings/list', {
        headers,
      });
      
      if (!response.ok) {
        throw new Error('無法獲取會議記錄');
      }
      
      const data = await response.json();
      setMeetings(data.meetings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '獲取失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const handleViewMeeting = async (meetingId: string) => {
    if (selectedMeeting === meetingId) {
      setSelectedMeeting(null);
      return;
    }
    
    setSelectedMeeting(meetingId);
    setLoadingSummary(true);
    setSummary('');
    setTranscript('');
    
    try {
      const response = await fetch(`/api/meetings/${meetingId}/summary`);
      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary || '尚無摘要');
        setTranscript(data.transcript || '');
      }
    } catch (err) {
      setSummary('無法獲取摘要');
    } finally {
      setLoadingSummary(false);
    }
  };

  const formatTime = (timeStr: string) => {
    return new Date(timeStr).toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return { label: '已完成', color: 'bg-green-500' };
      case 'processing': return { label: '處理中', color: 'bg-yellow-500' };
      case 'failed': return { label: '失敗', color: 'bg-red-500' };
      case 'recording': return { label: '錄音中', color: 'bg-blue-500' };
      default: return { label: status, color: 'bg-gray-500' };
    }
  };

  return (
    <div className="glass-card p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-neon-cyan" />
          會議記錄
        </h2>
        <button
          onClick={fetchMeetings}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          title="重新整理"
        >
          <RefreshCw className={`w-4 h-4 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {loading && meetings.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">載入中...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-400">{error}</div>
        ) : meetings.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">尚無會議記錄</div>
        ) : (
          meetings.map((meeting) => {
            const statusInfo = getStatusLabel(meeting.status);
            const isSelected = selectedMeeting === meeting.id;
            
            return (
              <div key={meeting.id} className="space-y-2">
                <button
                  onClick={() => handleViewMeeting(meeting.id)}
                  className={`w-full text-left p-4 rounded-xl transition-all ${
                    isSelected 
                      ? 'bg-neon-cyan/20 border border-neon-cyan/30' 
                      : 'bg-white/5 hover:bg-white/10 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">{meeting.room}</div>
                      <div className="text-sm text-zinc-400 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(meeting.start_time)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs text-white ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      <ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                </button>
                
                {isSelected && (
                  <div className="ml-4 p-4 bg-black/30 rounded-xl border border-white/5">
                    {loadingSummary ? (
                      <div className="text-zinc-500 text-center py-4">載入摘要中...</div>
                    ) : (
                      <>
                        <h4 className="text-sm font-medium text-neon-cyan mb-2">摘要</h4>
                        <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                          {summary}
                        </p>
                        {transcript && (
                          <>
                            <h4 className="text-sm font-medium text-neon-cyan mt-4 mb-2">逐字稿</h4>
                            <p className="text-xs text-zinc-500 whitespace-pre-wrap max-h-32 overflow-y-auto">
                              {transcript}
                            </p>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

