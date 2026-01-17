"""
會議相關 API 路由
"""

from datetime import datetime
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks, Header
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
from routers.auth import get_user_by_token

router = APIRouter()
settings = get_settings()


async def get_current_user_id(authorization: Optional[str] = None) -> Optional[int]:
    """從 Authorization header 獲取當前用戶 ID"""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    
    token = authorization[7:]
    user = await get_user_by_token(token)
    return user["id"] if user else None


def generate_meeting_id() -> str:
    """產生會議 ID"""
    now = datetime.now()
    return f"mtg_{now.strftime('%Y%m%d_%H%M%S')}"


@router.post("/start", response_model=MeetingResponse)
async def start_meeting(
    request: MeetingCreate,
    authorization: Optional[str] = Header(None)
):
    """
    開始新會議
    
    - 建立會議記錄
    - 儲存與會者資訊
    - 關聯當前登入用戶（如有）
    - 回傳 meeting_id 供前端使用
    """
    db = await get_db()
    
    # 獲取當前用戶 ID（可選）
    user_id = await get_current_user_id(authorization)
    
    # 產生會議 ID
    meeting_id = generate_meeting_id()
    start_time = datetime.now()
    
    # 建立會議目錄
    meeting_dir = Path(settings.storage_path) / meeting_id
    meeting_dir.mkdir(parents=True, exist_ok=True)
    
    # 插入會議記錄（包含 user_id 和 topic）
    await db.execute(
        """
        INSERT INTO meetings (id, user_id, room, topic, start_time, status)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (meeting_id, user_id, request.room, request.topic, start_time.isoformat(), MeetingStatus.RECORDING.value)
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
    
    # 根據上傳的檔案類型決定副檔名
    content = await audio.read()
    
    # 從檔名或 content-type 獲取副檔名
    original_filename = audio.filename or "audio.m4a"
    if original_filename.endswith('.m4a'):
        ext = '.m4a'
    elif original_filename.endswith('.webm'):
        ext = '.webm'
    elif original_filename.endswith('.wav'):
        ext = '.wav'
    elif original_filename.endswith('.mp3'):
        ext = '.mp3'
    else:
        # 檢查文件頭來判斷格式
        if content[:4] == b'ftyp' or content[4:8] == b'ftyp':
            ext = '.m4a'  # MP4/M4A 格式
        elif content[:4] == b'RIFF':
            ext = '.wav'
        elif content[:3] == b'ID3' or content[:2] == b'\xff\xfb':
            ext = '.mp3'
        else:
            ext = '.m4a'  # 預設使用 m4a
    
    audio_path = meeting_dir / f"audio{ext}"
    
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


@router.get("/{meeting_id}/summary")
async def get_meeting_summary(meeting_id: str):
    """
    獲取會議摘要內容
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
    
    # 讀取摘要檔案
    summary_content = ""
    transcript_content = ""
    
    meeting_dir = Path(settings.storage_path) / meeting_id
    
    summary_path = meeting_dir / "summary.md"
    if summary_path.exists():
        summary_content = summary_path.read_text(encoding="utf-8")
    
    transcript_path = meeting_dir / "transcript.txt"
    if transcript_path.exists():
        transcript_content = transcript_path.read_text(encoding="utf-8")
    
    return {
        "meeting_id": meeting_id,
        "summary": summary_content,
        "transcript": transcript_content,
    }


@router.get("/my/list")
async def get_my_meetings(
    authorization: str = Header(...),
    limit: int = 50,
    offset: int = 0
):
    """
    獲取當前用戶的會議列表
    需要登入
    """
    user_id = await get_current_user_id(authorization)
    
    if not user_id:
        raise HTTPException(status_code=401, detail="請先登入")
    
    db = await get_db()
    
    # 查詢用戶的會議
    cursor = await db.execute(
        """
        SELECT id, room, start_time, end_time, status, created_at
        FROM meetings 
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
        """,
        (user_id, limit, offset)
    )
    meetings = await cursor.fetchall()
    
    # 獲取總數
    cursor = await db.execute(
        "SELECT COUNT(*) as count FROM meetings WHERE user_id = ?",
        (user_id,)
    )
    total = (await cursor.fetchone())["count"]
    
    return {
        "meetings": [
            {
                "id": m["id"],
                "room": m["room"],
                "start_time": m["start_time"],
                "end_time": m["end_time"],
                "status": m["status"],
                "created_at": m["created_at"]
            }
            for m in meetings
        ],
        "total": total,
        "limit": limit,
        "offset": offset
    }


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


@router.get("/daily-summary")
async def get_daily_summary(
    date: Optional[str] = None,
    authorization: str = Header(...)
):
    """
    獲取每日會議總結
    
    - date: 日期格式 YYYY-MM-DD，預設為今天
    - 返回該日所有已完成會議的合併摘要
    """
    user_id = await get_current_user_id(authorization)
    
    if not user_id:
        raise HTTPException(status_code=401, detail="請先登入")
    
    # 解析日期
    from datetime import datetime, timedelta
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式錯誤，請使用 YYYY-MM-DD")
    else:
        target_date = datetime.now()
    
    # 當天的時間範圍
    start_of_day = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = start_of_day + timedelta(days=1)
    
    db = await get_db()
    
    # 查詢當天已完成的會議
    cursor = await db.execute(
        """
        SELECT id, room, topic, start_time, end_time, summary_path
        FROM meetings
        WHERE user_id = ? 
          AND status = 'completed'
          AND start_time >= ?
          AND start_time < ?
        ORDER BY start_time ASC
        """,
        (user_id, start_of_day.isoformat(), end_of_day.isoformat())
    )
    meetings = await cursor.fetchall()
    
    if not meetings:
        return {
            "summary": "今天還沒有已完成的會議記錄。",
            "date": target_date.strftime("%Y-%m-%d"),
            "meeting_count": 0
        }
    
    # 獲取用戶名稱
    cursor = await db.execute("SELECT email, name FROM users WHERE id = ?", (user_id,))
    user = await cursor.fetchone()
    user_name = user["name"] if user and user["name"] else user["email"].split("@")[0].split(".")[0].capitalize() if user else "用戶"
    
    # 生成每日總結
    date_str = target_date.strftime("%-m/%-d")
    summary_lines = [f"📅 {date_str} {user_name} 業務日誌\n"]
    
    for idx, meeting in enumerate(meetings, 1):
        topic = meeting["topic"] or meeting["room"]
        time_str = datetime.fromisoformat(meeting["start_time"]).strftime("%H:%M")
        
        summary_lines.append(f"{idx}. {topic}")
        
        # 讀取會議摘要
        if meeting["summary_path"]:
            summary_path = Path(settings.storage_path) / meeting["id"] / meeting["summary_path"]
            if summary_path.exists():
                try:
                    with open(summary_path, "r", encoding="utf-8") as f:
                        meeting_summary = f.read()
                    # 提取摘要重點（簡化）
                    lines = meeting_summary.split("\n")
                    key_points = []
                    for line in lines:
                        line = line.strip()
                        if line.startswith("-") or line.startswith("•"):
                            key_points.append(line)
                        if len(key_points) >= 3:
                            break
                    if key_points:
                        for point in key_points:
                            summary_lines.append(f"   {point}")
                except Exception:
                    pass
        
        summary_lines.append(f"   ⏰ {time_str}\n")
    
    return {
        "summary": "\n".join(summary_lines),
        "date": target_date.strftime("%Y-%m-%d"),
        "meeting_count": len(meetings)
    }

