// 會議狀態
export type MeetingStatus = 'idle' | 'recording' | 'uploading' | 'processing' | 'completed' | 'failed';

// 處理步驟
export type ProcessingStep = 'pending' | 'in_progress' | 'completed' | 'failed';

// 與會者
export interface Attendee {
  email: string;
  name?: string;
}

// 會議資料
export interface Meeting {
  meeting_id: string;
  room: string;
  start_time: string;
  end_time?: string;
  status: MeetingStatus;
  attendees: Attendee[];
}

// 開始會議請求
export interface StartMeetingRequest {
  room: string;
  attendees: Attendee[];
}

// 開始會議回應
export interface StartMeetingResponse {
  meeting_id: string;
  status: MeetingStatus;
  start_time: string;
}

// 結束會議回應
export interface EndMeetingResponse {
  meeting_id: string;
  status: MeetingStatus;
  message: string;
}

// 處理狀態回應
export interface ProcessingStatusResponse {
  meeting_id: string;
  status: MeetingStatus;
  steps: {
    upload: ProcessingStep;
    transcription: ProcessingStep;
    summary: ProcessingStep;
    email: ProcessingStep;
  };
  completed_at?: string;
  error?: string;
}

