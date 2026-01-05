"""
會議相關 API 路由
"""

from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks
from typing import Optional
import json

from config import get_settings
from database import get_db
from models.meeting import (
    MeetingCreate,
    MeetingResponse,
    MeetingStatusResponse,
    MeetingStatus,
    ProcessingSteps,
    ProcessingStep,
    Attendee,
    AttendeeCreate,
)
from services.processor import process_meeting

router = APIRouter()
settings = get_settings()


def generate_meeting_id() -> str:
    """產生會議 ID"""
    now = datetime.now()
    return f"mtg_{now.strftime('%Y%m%d_%H%M%S')}"


@router.post("/start", response_model=MeetingResponse)
async def start_meeting(request: MeetingCreate):
    """
    開始新會議
    
    - 建立會議記錄
    - 儲存與會者資訊
    - 回傳 meeting_id 供前端使用
    """
    db = await get_db()
    
    # 產生會議 ID
    meeting_id = generate_meeting_id()
    start_time = datetime.now()
    
    # 建立會議目錄
    meeting_dir = Path(settings.storage_path) / meeting_id
    meeting_dir.mkdir(parents=True, exist_ok=True)
    
    # 插入會議記錄
    await db.execute(
        """
        INSERT INTO meetings (id, room, start_time, status)
        VALUES (?, ?, ?, ?)
        """,
        (meeting_id, request.room, start_time.isoformat(), MeetingStatus.RECORDING.value)
    )
    
    # 插入與會者
    for attendee in request.attendees:
        await db.execute(
            """
            INSERT INTO attendees (meeting_id, email, name)
            VALUES (?, ?, ?)
            """,
            (meeting_id, attendee.email, attendee.name)
        )
    
    await db.commit()
    
    return MeetingResponse(
        meeting_id=meeting_id,
        status=MeetingStatus.RECORDING,
        start_time=start_time,
        room=request.room,
        attendee_count=len(request.attendees)
    )


@router.post("/{meeting_id}/end")
async def end_meeting(
    meeting_id: str,
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(..., description="錄音檔 (webm 格式)"),
    attendees: Optional[str] = Form(None, description="與會者 JSON 字串（如有更新）"),
):
    """
    結束會議並上傳錄音
    
    - 接收音檔上傳
    - 更新與會者列表（如有新增）
    - 觸發背景處理任務
    """
    db = await get_db()
    
    # 檢查會議是否存在
    cursor = await db.execute(
        "SELECT * FROM meetings WHERE id = ?",
        (meeting_id,)
    )
    meeting = await cursor.fetchone()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="會議不存在")
    
    if meeting["status"] != MeetingStatus.RECORDING.value:
        raise HTTPException(status_code=400, detail="會議狀態不正確，無法結束")
    
    # 儲存音檔
    meeting_dir = Path(settings.storage_path) / meeting_id
    meeting_dir.mkdir(parents=True, exist_ok=True)
    
    audio_path = meeting_dir / "audio.webm"
    content = await audio.read()
    
    with open(audio_path, "wb") as f:
        f.write(content)
    
    # 更新與會者（如有提供）
    if attendees:
        try:
            attendee_list = json.loads(attendees)
            # 先刪除舊的與會者
            await db.execute(
                "DELETE FROM attendees WHERE meeting_id = ?",
                (meeting_id,)
            )
            # 插入新的與會者
            for att in attendee_list:
                await db.execute(
                    """
                    INSERT INTO attendees (meeting_id, email, name)
                    VALUES (?, ?, ?)
                    """,
                    (meeting_id, att.get("email"), att.get("name"))
                )
        except json.JSONDecodeError:
            pass  # 忽略無效的 JSON
    
    # 更新會議狀態
    end_time = datetime.now()
    await db.execute(
        """
        UPDATE meetings 
        SET status = ?, end_time = ?, audio_path = ?, updated_at = ?
        WHERE id = ?
        """,
        (
            MeetingStatus.PROCESSING.value,
            end_time.isoformat(),
            str(audio_path),
            datetime.now().isoformat(),
            meeting_id
        )
    )
    
    await db.commit()
    
    # 觸發背景處理任務
    background_tasks.add_task(process_meeting, meeting_id)
    
    return {
        "meeting_id": meeting_id,
        "status": MeetingStatus.PROCESSING.value,
        "message": "會議已結束，正在處理中...",
        "audio_size_bytes": len(content)
    }


@router.get("/{meeting_id}/status", response_model=MeetingStatusResponse)
async def get_meeting_status(meeting_id: str):
    """
    查詢會議處理狀態
    
    - 回傳會議基本資訊
    - 回傳各處理步驟狀態
    """
    db = await get_db()
    
    # 查詢會議
    cursor = await db.execute(
        "SELECT * FROM meetings WHERE id = ?",
        (meeting_id,)
    )
    meeting = await cursor.fetchone()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="會議不存在")
    
    # 查詢與會者
    cursor = await db.execute(
        "SELECT * FROM attendees WHERE meeting_id = ?",
        (meeting_id,)
    )
    attendee_rows = await cursor.fetchall()
    
    attendees = [
        Attendee(
            id=row["id"],
            email=row["email"],
            name=row["name"],
            email_sent=bool(row["email_sent"]),
            email_sent_at=row["email_sent_at"]
        )
        for row in attendee_rows
    ]
    
    # 根據會議狀態推算處理步驟
    status = MeetingStatus(meeting["status"])
    steps = _calculate_processing_steps(status, meeting)
    
    return MeetingStatusResponse(
        meeting_id=meeting_id,
        status=status,
        steps=steps,
        start_time=datetime.fromisoformat(meeting["start_time"]),
        end_time=datetime.fromisoformat(meeting["end_time"]) if meeting["end_time"] else None,
        room=meeting["room"],
        attendees=attendees,
        error=meeting["error_message"],
        completed_at=datetime.fromisoformat(meeting["updated_at"]) if status == MeetingStatus.COMPLETED else None
    )


def _calculate_processing_steps(status: MeetingStatus, meeting) -> ProcessingSteps:
    """根據會議狀態計算處理步驟"""
    
    if status == MeetingStatus.RECORDING:
        return ProcessingSteps()
    
    if status == MeetingStatus.FAILED:
        # 失敗狀態 - 需要根據已完成的步驟判斷
        steps = ProcessingSteps(upload=ProcessingStep.COMPLETED)
        if meeting["transcript_path"]:
            steps.transcription = ProcessingStep.COMPLETED
            if meeting["summary_path"]:
                steps.summary = ProcessingStep.COMPLETED
                steps.email = ProcessingStep.FAILED
            else:
                steps.summary = ProcessingStep.FAILED
        else:
            steps.transcription = ProcessingStep.FAILED
        return steps
    
    if status == MeetingStatus.PROCESSING:
        # 處理中 - 根據已有的檔案判斷進度
        steps = ProcessingSteps(upload=ProcessingStep.COMPLETED)
        
        if meeting["transcript_path"]:
            steps.transcription = ProcessingStep.COMPLETED
            if meeting["summary_path"]:
                steps.summary = ProcessingStep.COMPLETED
                steps.email = ProcessingStep.IN_PROGRESS
            else:
                steps.summary = ProcessingStep.IN_PROGRESS
        else:
            steps.transcription = ProcessingStep.IN_PROGRESS
        
        return steps
    
    if status == MeetingStatus.COMPLETED:
        return ProcessingSteps(
            upload=ProcessingStep.COMPLETED,
            transcription=ProcessingStep.COMPLETED,
            summary=ProcessingStep.COMPLETED,
            email=ProcessingStep.COMPLETED
        )
    
    return ProcessingSteps()

