"""
會議處理服務
整合語音轉文字、AI 摘要、Email 發送
"""

from datetime import datetime
from pathlib import Path

from config import get_settings
from database import get_db
from models.meeting import MeetingStatus
from .transcription import transcribe_audio
from .summary import generate_summary
from .email import send_summary_email

settings = get_settings()


async def process_meeting(meeting_id: str):
    """
    處理會議的完整流程
    
    1. 語音轉文字
    2. AI 摘要生成
    3. 發送 Email
    
    這是背景任務，由 end_meeting API 觸發
    """
    db = await get_db()
    meeting_dir = Path(settings.storage_path) / meeting_id
    
    try:
        print(f"📝 開始處理會議: {meeting_id}")
        
        # 取得會議資訊
        cursor = await db.execute(
            "SELECT * FROM meetings WHERE id = ?",
            (meeting_id,)
        )
        meeting = await cursor.fetchone()
        
        if not meeting:
            raise Exception("會議不存在")
        
        audio_path = meeting["audio_path"]
        
        # ========== Step 1: 語音轉文字 ==========
        print(f"🎤 [1/3] 語音轉文字中...")
        transcript = await transcribe_audio(audio_path)
        
        # 儲存逐字稿
        transcript_path = meeting_dir / "transcript.txt"
        with open(transcript_path, "w", encoding="utf-8") as f:
            f.write(transcript)
        
        await db.execute(
            "UPDATE meetings SET transcript_path = ?, updated_at = ? WHERE id = ?",
            (str(transcript_path), datetime.now().isoformat(), meeting_id)
        )
        await db.commit()
        print(f"✅ 語音轉文字完成，共 {len(transcript)} 字")
        
        # ========== Step 2: AI 摘要 ==========
        print(f"🤖 [2/3] AI 摘要生成中...")
        
        # 取得與會者資訊
        cursor = await db.execute(
            "SELECT * FROM attendees WHERE meeting_id = ?",
            (meeting_id,)
        )
        attendees = await cursor.fetchall()
        attendee_list = [
            {"email": a["email"], "name": a["name"] or a["email"].split("@")[0]}
            for a in attendees
        ]
        
        summary = await generate_summary(
            transcript=transcript,
            room=meeting["room"],
            start_time=meeting["start_time"],
            end_time=meeting["end_time"],
            attendees=attendee_list
        )
        
        # 儲存摘要
        summary_path = meeting_dir / "summary.md"
        with open(summary_path, "w", encoding="utf-8") as f:
            f.write(summary)
        
        await db.execute(
            "UPDATE meetings SET summary_path = ?, updated_at = ? WHERE id = ?",
            (str(summary_path), datetime.now().isoformat(), meeting_id)
        )
        await db.commit()
        print(f"✅ 摘要生成完成")
        
        # ========== Step 3: 發送 Email ==========
        print(f"📧 [3/3] 發送 Email 中...")
        
        email_list = [a["email"] for a in attendees]
        await send_summary_email(
            recipients=email_list,
            summary=summary,
            meeting_id=meeting_id,
            room=meeting["room"],
            start_time=meeting["start_time"]
        )
        
        # 更新 Email 發送狀態
        await db.execute(
            """
            UPDATE attendees 
            SET email_sent = TRUE, email_sent_at = ? 
            WHERE meeting_id = ?
            """,
            (datetime.now().isoformat(), meeting_id)
        )
        
        # ========== 完成 ==========
        await db.execute(
            """
            UPDATE meetings 
            SET status = ?, updated_at = ?
            WHERE id = ?
            """,
            (MeetingStatus.COMPLETED.value, datetime.now().isoformat(), meeting_id)
        )
        await db.commit()
        
        print(f"🎉 會議處理完成: {meeting_id}")
        
    except Exception as e:
        # 處理失敗
        print(f"❌ 會議處理失敗: {meeting_id}, 錯誤: {str(e)}")
        
        await db.execute(
            """
            UPDATE meetings 
            SET status = ?, error_message = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                MeetingStatus.FAILED.value,
                str(e),
                datetime.now().isoformat(),
                meeting_id
            )
        )
        await db.commit()
        raise

