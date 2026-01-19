"""
會議室 AI 系統 - FastAPI 後端主程式
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings, ensure_directories
from database import init_db, close_db
from routers import meetings, auth, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    """應用程式生命週期管理"""
    # 啟動時
    print("🚀 啟動會議室 AI 系統...")
    ensure_directories()
    await init_db()
    print("✅ 系統準備就緒")
    
    yield
    
    # 關閉時
    print("👋 關閉系統...")
    await close_db()
    print("✅ 系統已關閉")


# 取得設定
settings = get_settings()

# 建立 FastAPI 應用
app = FastAPI(
    title=settings.app_name,
    description="會議室 AI 智慧摘要系統 API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS 中間件設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 註冊路由
app.include_router(auth.router)  # 認證路由（已包含 /api/auth 前綴）
app.include_router(admin.router)  # 管理員路由（已包含 /api/admin 前綴）

app.include_router(
    meetings.router, 
    prefix=f"{settings.api_prefix}/meetings",
    tags=["meetings"]
)


# 健康檢查端點
@app.get("/health", tags=["system"])
async def health_check():
    """健康檢查"""
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": "1.0.0"
    }


@app.get("/", tags=["system"])
async def root():
    """根路徑"""
    return {
        "message": f"歡迎使用 {settings.app_name}",
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
    )

