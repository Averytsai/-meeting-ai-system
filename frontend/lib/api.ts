import type { 
  StartMeetingRequest, 
  StartMeetingResponse, 
  EndMeetingResponse,
  ProcessingStatusResponse,
  Attendee 
} from './types';

// 生產環境使用外部 API，本地開發使用 /api
const API_BASE = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? 'http://tw-07.access.glows.ai:23435/api'
  : (process.env.NEXT_PUBLIC_API_URL || '/api');

/**
 * 開始新會議
 */
export async function startMeeting(data: StartMeetingRequest): Promise<StartMeetingResponse> {
  const response = await fetch(`${API_BASE}/meetings/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error('無法開始會議');
  }
  
  return response.json();
}

/**
 * 結束會議並上傳錄音
 */
export async function endMeeting(
  meetingId: string, 
  audioBlob: Blob, 
  attendees: Attendee[]
): Promise<EndMeetingResponse> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('attendees', JSON.stringify(attendees));
  
  const response = await fetch(`${API_BASE}/meetings/${meetingId}/end`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error('無法結束會議');
  }
  
  return response.json();
}

/**
 * 查詢處理狀態
 */
export async function getMeetingStatus(meetingId: string): Promise<ProcessingStatusResponse> {
  const response = await fetch(`${API_BASE}/meetings/${meetingId}/status`);
  
  if (!response.ok) {
    throw new Error('無法取得會議狀態');
  }
  
  return response.json();
}

