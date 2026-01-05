"""
環境設定模組
從 .env 檔案讀取設定值
"""

from typing import List
from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path


class Settings(BaseSettings):
    """應用程式設定"""
    
    # API 設定
    app_name: str = "會議室 AI 系統"
    debug: bool = True
    api_prefix: str = "/api"
    
    # CORS 設定 - 允許的來源
    cors_origins: List[str] = [
        "http://localhost:3000",        # Next.js 開發
        "http://localhost:3001",        # Next.js 開發 (備用埠)
        "http://localhost:3002",        # Next.js 開發 (備用埠)
        "https://meeting-ai-system.vercel.app",  # Vercel 部署
        "https://*.vercel.app",         # Vercel 預覽部署
    ]
    
    # 資料庫
    database_path: str = "./data/meetings.db"
    
    # 檔案儲存
    storage_path: str = "./data/meetings"
    
    # OpenAI API
    openai_api_key: str = ""
    whisper_model: str = "whisper-1"
    gpt_model: str = "gpt-4o"
    
    # Email SMTP 設定
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_name: str = "會議室 AI 系統"
    
    # 會議室設定
    default_room: str = "會議室 A"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """取得設定單例"""
    return Settings()


# 確保資料目錄存在
def ensure_directories():
    """建立必要的資料目錄"""
    settings = get_settings()
    
    # 資料庫目錄
    db_path = Path(settings.database_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    
    # 檔案儲存目錄
    storage_path = Path(settings.storage_path)
    storage_path.mkdir(parents=True, exist_ok=True)

