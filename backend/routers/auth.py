"""
用戶認證路由
只需要 Email 登入，不需要密碼
"""

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr
from typing import Optional
from database import get_db
import secrets
from datetime import datetime

router = APIRouter(prefix="/api/auth", tags=["認證"])


class LoginRequest(BaseModel):
    """登入請求"""
    email: EmailStr
    name: Optional[str] = None


class LoginResponse(BaseModel):
    """登入回應"""
    success: bool
    token: str
    user_id: int
    email: str
    name: Optional[str]
    message: str


class UserInfo(BaseModel):
    """用戶資訊"""
    user_id: int
    email: str
    name: Optional[str]
    company: Optional[str]
    created_at: str


# 允許的 Email 網域（可以設為空列表表示允許所有）
ALLOWED_DOMAINS = []  # 例如: ["yourcompany.com", "company.com.tw"]


def is_email_allowed(email: str) -> bool:
    """檢查 Email 是否允許登入"""
    if not ALLOWED_DOMAINS:
        # 如果沒有設定網域限制，允許所有
        return True
    
    domain = email.split("@")[-1].lower()
    return domain in [d.lower() for d in ALLOWED_DOMAINS]


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    使用 Email 登入
    - 如果用戶不存在，自動創建帳號
    - 返回認證 Token
    """
    email = request.email.lower().strip()
    
    # 檢查 Email 是否允許
    if not is_email_allowed(email):
        raise HTTPException(
            status_code=403,
            detail=f"此 Email 網域不允許登入。請使用公司 Email。"
        )
    
    db = await get_db()
    
    # 查找用戶
    cursor = await db.execute(
        "SELECT id, email, name, auth_token FROM users WHERE email = ?",
        (email,)
    )
    user = await cursor.fetchone()
    
    if user:
        # 用戶已存在，更新登入時間和 Token
        new_token = secrets.token_urlsafe(32)
        await db.execute(
            """
            UPDATE users 
            SET auth_token = ?, last_login_at = ?, name = COALESCE(?, name)
            WHERE id = ?
            """,
            (new_token, datetime.now().isoformat(), request.name, user["id"])
        )
        await db.commit()
        
        return LoginResponse(
            success=True,
            token=new_token,
            user_id=user["id"],
            email=email,
            name=request.name or user["name"],
            message="登入成功"
        )
    else:
        # 創建新用戶
        new_token = secrets.token_urlsafe(32)
        cursor = await db.execute(
            """
            INSERT INTO users (email, name, auth_token, last_login_at)
            VALUES (?, ?, ?, ?)
            """,
            (email, request.name, new_token, datetime.now().isoformat())
        )
        await db.commit()
        
        return LoginResponse(
            success=True,
            token=new_token,
            user_id=cursor.lastrowid,
            email=email,
            name=request.name,
            message="帳號已創建並登入"
        )


@router.get("/me", response_model=UserInfo)
async def get_current_user(authorization: str = Header(...)):
    """
    獲取當前登入用戶資訊
    需要在 Header 中傳入 Authorization: Bearer <token>
    """
    # 解析 Token
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="無效的認證格式")
    
    token = authorization[7:]  # 移除 "Bearer " 前綴
    
    db = await get_db()
    cursor = await db.execute(
        "SELECT id, email, name, company, created_at FROM users WHERE auth_token = ?",
        (token,)
    )
    user = await cursor.fetchone()
    
    if not user:
        raise HTTPException(status_code=401, detail="認證已過期，請重新登入")
    
    return UserInfo(
        user_id=user["id"],
        email=user["email"],
        name=user["name"],
        company=user["company"],
        created_at=user["created_at"]
    )


@router.post("/logout")
async def logout(authorization: str = Header(...)):
    """
    登出 - 清除 Token
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="無效的認證格式")
    
    token = authorization[7:]
    
    db = await get_db()
    await db.execute(
        "UPDATE users SET auth_token = NULL WHERE auth_token = ?",
        (token,)
    )
    await db.commit()
    
    return {"success": True, "message": "已登出"}


async def get_user_by_token(token: str) -> Optional[dict]:
    """
    通過 Token 獲取用戶（供其他模組使用）
    """
    if not token:
        return None
        
    db = await get_db()
    cursor = await db.execute(
        "SELECT id, email, name FROM users WHERE auth_token = ?",
        (token,)
    )
    user = await cursor.fetchone()
    
    if user:
        return {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"]
        }
    return None


