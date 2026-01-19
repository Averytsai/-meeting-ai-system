"""
管理員路由
查看所有用戶的會議概覽
"""

from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
from typing import List, Optional
from database import get_db
from datetime import datetime

router = APIRouter(prefix="/api/admin", tags=["管理員"])

# 管理員帳號配置（初期固定一個）
ADMIN_CREDENTIALS = {
    "admin@konsttech.ai": "admin123"
}


class AdminLoginRequest(BaseModel):
    """管理員登入請求"""
    email: str
    password: str


class AdminLoginResponse(BaseModel):
    """管理員登入回應"""
    success: bool
    token: str
    message: str


class MeetingSummaryItem(BaseModel):
    """會議摘要項目"""
    meeting_id: str
    topic: Optional[str]
    room: str
    start_time: str
    end_time: Optional[str]
    summary: Optional[str]
    attendees: List[str]


class UserMeetingOverview(BaseModel):
    """用戶會議概覽"""
    user_id: int
    email: str
    name: Optional[str]
    meeting_count: int
    meetings: List[MeetingSummaryItem]


class DailyOverviewResponse(BaseModel):
    """每日概覽回應"""
    date: str
    total_users: int
    total_meetings: int
    users: List[UserMeetingOverview]


# 管理員 Token 存儲（簡易版，實際應用應使用 Redis 或資料庫）
admin_tokens = {}


def verify_admin_token(token: str) -> bool:
    """驗證管理員 Token"""
    return token in admin_tokens.values()


@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(request: AdminLoginRequest):
    """
    管理員登入
    """
    email = request.email.lower().strip()
    password = request.password
    
    if email not in ADMIN_CREDENTIALS:
        raise HTTPException(status_code=401, detail="管理員帳號不存在")
    
    if ADMIN_CREDENTIALS[email] != password:
        raise HTTPException(status_code=401, detail="密碼錯誤")
    
    # 生成管理員 Token
    import secrets
    token = f"admin_{secrets.token_urlsafe(32)}"
    admin_tokens[email] = token
    
    return AdminLoginResponse(
        success=True,
        token=token,
        message="管理員登入成功"
    )


@router.post("/logout")
async def admin_logout(authorization: str = Header(...)):
    """
    管理員登出
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="無效的認證格式")
    
    token = authorization[7:]
    
    # 移除 Token
    for email, t in list(admin_tokens.items()):
        if t == token:
            del admin_tokens[email]
            break
    
    return {"success": True, "message": "已登出"}


@router.get("/daily-overview", response_model=DailyOverviewResponse)
async def get_daily_overview(
    date: Optional[str] = Query(None, description="日期 (YYYY-MM-DD)，預設今天"),
    authorization: str = Header(...)
):
    """
    獲取每日會議概覽
    - 顯示所有用戶當天的會議
    - 每個用戶開了幾場會議
    - 每場會議的摘要
    """
    # 驗證管理員權限
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="無效的認證格式")
    
    token = authorization[7:]
    if not verify_admin_token(token):
        raise HTTPException(status_code=401, detail="管理員認證無效")
    
    # 解析日期
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式錯誤，請使用 YYYY-MM-DD")
    else:
        target_date = datetime.now().date()
    
    date_str = target_date.strftime("%Y-%m-%d")
    
    db = await get_db()
    
    # 獲取所有用戶
    cursor = await db.execute("SELECT id, email, name FROM users ORDER BY email")
    users = await cursor.fetchall()
    
    user_overviews = []
    total_meetings = 0
    
    for user in users:
        user_id = user["id"]
        
        # 獲取該用戶當天的會議
        cursor = await db.execute(
            """
            SELECT m.id, m.room, m.topic, m.start_time, m.end_time, m.status
            FROM meetings m
            WHERE m.user_id = ?
            AND DATE(m.start_time) = ?
            AND m.status = 'completed'
            ORDER BY m.start_time
            """,
            (user_id, date_str)
        )
        meetings = await cursor.fetchall()
        
        meeting_items = []
        for meeting in meetings:
            meeting_id = meeting["id"]
            
            # 獲取會議摘要
            summary = None
            if meeting["status"] == "completed":
                try:
                    summary_path = f"data/summaries/{meeting_id}.txt"
                    import os
                    if os.path.exists(summary_path):
                        with open(summary_path, "r", encoding="utf-8") as f:
                            summary = f.read()
                except:
                    pass
            
            # 獲取與會者
            cursor2 = await db.execute(
                "SELECT email, name FROM attendees WHERE meeting_id = ?",
                (meeting_id,)
            )
            attendees = await cursor2.fetchall()
            attendee_list = [
                a["name"] or a["email"].split("@")[0] 
                for a in attendees
            ]
            
            meeting_items.append(MeetingSummaryItem(
                meeting_id=meeting_id,
                topic=meeting["topic"],
                room=meeting["room"],
                start_time=meeting["start_time"],
                end_time=meeting["end_time"],
                summary=summary,
                attendees=attendee_list
            ))
        
        total_meetings += len(meeting_items)
        
        user_overviews.append(UserMeetingOverview(
            user_id=user_id,
            email=user["email"],
            name=user["name"],
            meeting_count=len(meeting_items),
            meetings=meeting_items
        ))
    
    # 只返回有會議的用戶（放在最前面），沒有會議的用戶放後面
    user_overviews.sort(key=lambda x: (-x.meeting_count, x.email))
    
    return DailyOverviewResponse(
        date=date_str,
        total_users=len([u for u in user_overviews if u.meeting_count > 0]),
        total_meetings=total_meetings,
        users=user_overviews
    )


@router.get("/user/{user_id}/meetings")
async def get_user_meetings(
    user_id: int,
    date: Optional[str] = Query(None),
    authorization: str = Header(...)
):
    """
    獲取特定用戶的會議詳情
    """
    # 驗證管理員權限
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="無效的認證格式")
    
    token = authorization[7:]
    if not verify_admin_token(token):
        raise HTTPException(status_code=401, detail="管理員認證無效")
    
    db = await get_db()
    
    # 獲取用戶資訊
    cursor = await db.execute(
        "SELECT id, email, name FROM users WHERE id = ?",
        (user_id,)
    )
    user = await cursor.fetchone()
    
    if not user:
        raise HTTPException(status_code=404, detail="用戶不存在")
    
    # 構建查詢
    if date:
        cursor = await db.execute(
            """
            SELECT id, room, topic, start_time, end_time, status
            FROM meetings
            WHERE user_id = ? AND DATE(start_time) = ?
            ORDER BY start_time DESC
            """,
            (user_id, date)
        )
    else:
        cursor = await db.execute(
            """
            SELECT id, room, topic, start_time, end_time, status
            FROM meetings
            WHERE user_id = ?
            ORDER BY start_time DESC
            LIMIT 50
            """,
            (user_id,)
        )
    
    meetings = await cursor.fetchall()
    
    return {
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"]
        },
        "meetings": [
            {
                "id": m["id"],
                "room": m["room"],
                "topic": m["topic"],
                "start_time": m["start_time"],
                "end_time": m["end_time"],
                "status": m["status"]
            }
            for m in meetings
        ]
    }

