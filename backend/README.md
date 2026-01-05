# 會議室 AI 系統 - 後端

> FastAPI 後端服務，處理會議錄音、語音轉文字、AI 摘要生成和 Email 發送

## 快速開始

### 1. 安裝依賴

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. 設定環境變數

複製 `.env.example` 為 `.env` 並填入實際值：

```bash
cp .env.example .env
```

必要設定：
- `OPENAI_API_KEY`: OpenAI API 金鑰（用於 Whisper 和 GPT）
- `SMTP_*`: Email 發送設定

### 3. 啟動服務

```bash
# 開發模式（自動重載）
python main.py

# 或使用 uvicorn
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. API 文檔

啟動後訪問：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 端點

| 方法 | 端點 | 說明 |
|-----|------|------|
| POST | `/api/meetings/start` | 開始新會議 |
| POST | `/api/meetings/{id}/end` | 結束會議並上傳錄音 |
| GET | `/api/meetings/{id}/status` | 查詢處理狀態 |
| GET | `/health` | 健康檢查 |

## 專案結構

```
backend/
├── main.py              # FastAPI 主程式
├── config.py            # 環境設定
├── database.py          # SQLite 資料庫
├── models/
│   └── meeting.py       # Pydantic 資料模型
├── routers/
│   └── meetings.py      # 會議 API 路由
├── services/
│   ├── processor.py     # 會議處理服務
│   ├── transcription.py # Whisper 語音轉文字
│   ├── summary.py       # GPT 摘要生成
│   └── email.py         # Email 發送
├── data/                # 資料存放（自動建立）
│   ├── meetings.db      # SQLite 資料庫
│   └── meetings/        # 會議檔案
└── requirements.txt
```

## 開發注意事項

- 資料庫和檔案會儲存在 `./data/` 目錄
- 音檔格式支援 WebM（瀏覽器錄音）
- 摘要使用繁體中文生成

