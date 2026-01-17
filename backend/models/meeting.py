"""
會議資料模型
使用 Pydantic 進行資料驗證
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


class MeetingStatus(str, Enum):
    """會議狀態"""
    RECORDING = "recording"      # 錄音中
    UPLOADING = "uploading"      # 上傳中
    PROCESSING = "processing"    # 處理中
    COMPLETED = "completed"      # 完成
    FAILED = "failed"            # 失敗


class ProcessingStep(str, Enum):
    """處理步驟狀態"""
    PENDING = "pending"          # 待處理
    IN_PROGRESS = "in_progress"  # 進行中
    COMPLETED = "completed"      # 完成
    FAILED = "failed"            # 失敗


# ========== 與會者相關 ==========

class AttendeeCreate(BaseModel):
    """新增與會者請求"""
    email: EmailStr
    name: Optional[str] = None


class Attendee(BaseModel):
    """與會者資訊"""
    id: Optional[int] = None
    email: EmailStr
    name: Optional[str] = None
    email_sent: bool = False
    email_sent_at: Optional[datetime] = None


# ========== 會議相關 ==========

class MeetingCreate(BaseModel):
    """開始會議請求"""
    room: str = Field(..., min_length=1, max_length=100, description="會議室名稱")
    topic: Optional[str] = Field(None, max_length=200, description="會議主題（選填）")
    attendees: List[AttendeeCreate] = Field(
        default_factory=list, 
        description="與會者列表"
    )


class MeetingResponse(BaseModel):
    """開始會議回應"""
    meeting_id: str
    status: MeetingStatus
    start_time: datetime
    room: str
    attendee_count: int


class ProcessingSteps(BaseModel):
    """處理步驟狀態"""
    upload: ProcessingStep = ProcessingStep.PENDING
    transcription: ProcessingStep = ProcessingStep.PENDING
    summary: ProcessingStep = ProcessingStep.PENDING
    email: ProcessingStep = ProcessingStep.PENDING


class MeetingStatusResponse(BaseModel):
    """會議狀態回應"""
    meeting_id: str
    status: MeetingStatus
    steps: ProcessingSteps
    start_time: datetime
    end_time: Optional[datetime] = None
    room: str
    attendees: List[Attendee] = []
    error: Optional[str] = None
    completed_at: Optional[datetime] = None


class MeetingEndRequest(BaseModel):
    """結束會議請求（與會者可能有更新）"""
    attendees: Optional[List[AttendeeCreate]] = None


# ========== 資料庫記錄對映 ==========

class MeetingDB(BaseModel):
    """資料庫會議記錄"""
    id: str
    room: str
    start_time: datetime
    end_time: Optional[datetime] = None
    status: MeetingStatus
    audio_path: Optional[str] = None
    transcript_path: Optional[str] = None
    summary_path: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AttendeeDB(BaseModel):
    """資料庫與會者記錄"""
    id: int
    meeting_id: str
    name: Optional[str] = None
    email: str
    email_sent: bool = False
    email_sent_at: Optional[datetime] = None

    class Config:
        from_attributes = True

