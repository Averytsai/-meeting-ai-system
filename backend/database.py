"""
資料庫模組
使用 SQLite + aiosqlite 進行非同步操作
"""

from typing import Optional
import aiosqlite
from pathlib import Path
from contextlib import asynccontextmanager
from config import get_settings

# 資料庫連線池
_db_connection: Optional[aiosqlite.Connection] = None


async def get_db() -> aiosqlite.Connection:
    """取得資料庫連線"""
    global _db_connection
    
    if _db_connection is None:
        settings = get_settings()
        db_path = Path(settings.database_path)
        
        # 確保目錄存在
        db_path.parent.mkdir(parents=True, exist_ok=True)
        
        _db_connection = await aiosqlite.connect(str(db_path))
        _db_connection.row_factory = aiosqlite.Row
        
        # 啟用外鍵約束
        await _db_connection.execute("PRAGMA foreign_keys = ON")
    
    return _db_connection


async def close_db():
    """關閉資料庫連線"""
    global _db_connection
    
    if _db_connection is not None:
        await _db_connection.close()
        _db_connection = None


async def init_db():
    """初始化資料庫表格"""
    db = await get_db()
    
    # 建立用戶表
    await db.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            company TEXT,
            auth_token TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login_at DATETIME
        )
    """)
    
    # 建立會議主表（添加 user_id 關聯）
    await db.execute("""
        CREATE TABLE IF NOT EXISTS meetings (
            id TEXT PRIMARY KEY,
            user_id INTEGER,
            room TEXT NOT NULL,
            topic TEXT,
            start_time DATETIME NOT NULL,
            end_time DATETIME,
            status TEXT DEFAULT 'recording',
            audio_path TEXT,
            transcript_path TEXT,
            summary_path TEXT,
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    
    # 嘗試添加 topic 欄位（如果不存在）
    try:
        await db.execute("ALTER TABLE meetings ADD COLUMN topic TEXT")
    except Exception:
        pass  # 欄位已存在
    
    # 建立與會者表
    await db.execute("""
        CREATE TABLE IF NOT EXISTS attendees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            meeting_id TEXT NOT NULL,
            name TEXT,
            email TEXT NOT NULL,
            email_sent BOOLEAN DEFAULT FALSE,
            email_sent_at DATETIME,
            FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
        )
    """)
    
    # 建立索引
    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_meetings_status 
        ON meetings(status)
    """)
    
    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_meetings_created_at 
        ON meetings(created_at)
    """)
    
    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_attendees_meeting_id 
        ON attendees(meeting_id)
    """)
    
    # 用戶表索引
    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_users_email 
        ON users(email)
    """)
    
    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_users_auth_token 
        ON users(auth_token)
    """)
    
    # 會議表 user_id 索引
    await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_meetings_user_id 
        ON meetings(user_id)
    """)
    
    await db.commit()
    print("✅ 資料庫初始化完成")


@asynccontextmanager
async def get_db_session():
    """資料庫會話上下文管理器"""
    db = await get_db()
    try:
        yield db
    except Exception:
        await db.rollback()
        raise

