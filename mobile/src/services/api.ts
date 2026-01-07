/**
 * API 服務
 * 與後端通訊
 */

const API_BASE = 'http://tw-07.access.glows.ai:23435/api';

export interface Attendee {
  email: string;
  name?: string;
}

export interface StartMeetingResponse {
  meeting_id: string;
  status: string;
  start_time: string;
}

export interface MeetingStatusResponse {
  meeting_id: string;
  status: string;
  steps: {
    upload: string;
    transcription: string;
    summary: string;
    email: string;
  };
  error?: string;
}

export interface SummaryResponse {
  meeting_id: string;
  summary: string;
  transcript: string;
}

/**
 * 開始會議
 */
export async function startMeeting(room: string, attendees: Attendee[]): Promise<StartMeetingResponse> {
  const response = await fetch(`${API_BASE}/meetings/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ room, attendees }),
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
  audioUri: string,
  attendees: Attendee[]
): Promise<any> {
  const formData = new FormData();
  
  // iPhone 錄音格式是 M4A（不是 webm）
  // 從 URI 判斷格式
  const isM4A = audioUri.includes('.m4a') || audioUri.includes('.caf');
  const mimeType = isM4A ? 'audio/m4a' : 'audio/webm';
  const fileName = isM4A ? 'recording.m4a' : 'recording.webm';
  
  // 添加音檔
  formData.append('audio', {
    uri: audioUri,
    type: mimeType,
    name: fileName,
  } as any);
  
  // 添加與會者
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
 * 查詢會議狀態
 */
export async function getMeetingStatus(meetingId: string): Promise<MeetingStatusResponse> {
  const response = await fetch(`${API_BASE}/meetings/${meetingId}/status`);

  if (!response.ok) {
    throw new Error('無法取得會議狀態');
  }

  return response.json();
}

/**
 * 獲取會議摘要
 */
export async function getMeetingSummary(meetingId: string): Promise<SummaryResponse> {
  const response = await fetch(`${API_BASE}/meetings/${meetingId}/summary`);

  if (!response.ok) {
    throw new Error('無法取得摘要');
  }

  return response.json();
}
