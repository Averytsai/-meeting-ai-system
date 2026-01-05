# 會議室 AI 系統 - 技術架構文檔

> 📅 文檔版本：v1.0  
> 📝 建立日期：2026-01-05  
> 🎯 設計原則：**簡單優先、MVP 導向**

---

## 1. 技術選型

| 類別 | 技術 | 原因 |
|-----|------|------|
| **前端框架** | Next.js 14 | 與 Vercel 完美整合、React 生態系、支援 PWA |
| **前端部署** | Vercel | 免費方案足夠 MVP、自動 CI/CD、全球 CDN |
| **後端框架** | Python FastAPI | 簡單快速、非同步支援、自動 API 文檔 |
| **資料庫** | SQLite | MVP 最簡單、零配置、單檔案備份方便 |
| **檔案儲存** | 本地檔案系統 | 直接存放錄音檔和摘要文件 |
| **語音轉文字** | OpenAI Whisper API | 中文辨識準確、免維護 |
| **AI 摘要** | OpenAI GPT-4o | 摘要品質高、API 穩定 |
| **Email 發送** | SMTP (公司郵件伺服器) | 使用現有基礎設施 |

---

## 2. 系統架構圖

```
                          ┌─────────────────────────────────────┐
                          │            Vercel (雲端)            │
                          │  ┌─────────────────────────────┐   │
                          │  │   Next.js 前端 (平板介面)    │   │
                          │  │   - 會議控制頁面             │   │
                          │  │   - 錄音上傳                 │   │
                          │  └─────────────────────────────┘   │
                          └──────────────┬──────────────────────┘
                                         │
                                         │ HTTPS API
                                         │
┌────────────────────────────────────────┴────────────────────────────────────┐
│                           公司地端伺服器                                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     FastAPI 後端服務                                  │   │
│  │                                                                      │   │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │   │  會議 API    │  │  音檔處理    │  │  Email 服務  │              │   │
│  │   │              │  │              │  │              │              │   │
│  │   │ POST /start  │  │ 接收上傳     │  │ 寄送摘要     │              │   │
│  │   │ POST /end    │  │ 呼叫 AI      │  │              │              │   │
│  │   │ GET /status  │  │ 儲存結果     │  │              │              │   │
│  │   └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │                            │                  │                      │   │
│  └────────────────────────────┼──────────────────┼──────────────────────┘   │
│                               │                  │                          │
│        ┌──────────────────────┴──────┐           │                          │
│        ▼                             ▼           ▼                          │
│  ┌───────────┐              ┌───────────┐  ┌───────────┐                   │
│  │  SQLite   │              │ 檔案系統   │  │   SMTP    │                   │
│  │  (會議    │              │ /data/    │  │ (公司郵件) │                   │
│  │   metadata)│              │ meetings/ │  │           │                   │
│  └───────────┘              └───────────┘  └───────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         │ HTTPS (外部 API)
                                         ▼
                          ┌─────────────────────────────────────┐
                          │         OpenAI API (雲端)           │
                          │  ┌─────────────┐ ┌─────────────┐   │
                          │  │   Whisper   │ │   GPT-4o    │   │
                          │  │  語音轉文字  │ │  摘要生成    │   │
                          │  └─────────────┘ └─────────────┘   │
                          └─────────────────────────────────────┘
```

---

## 3. 專案結構

```
meeting-ai-system/
│
├── frontend/                    # Next.js 前端 (部署到 Vercel)
│   ├── app/
│   │   ├── page.tsx            # 主頁面（會議控制介面）
│   │   ├── layout.tsx          # 版面配置
│   │   └── globals.css         # 全域樣式
│   ├── components/
│   │   ├── MeetingPanel.tsx    # 會議控制面板
│   │   ├── RecordButton.tsx    # 錄音按鈕
│   │   ├── AttendeeList.tsx    # 與會者列表
│   │   └── StatusDisplay.tsx   # 狀態顯示
│   ├── lib/
│   │   └── api.ts              # API 呼叫封裝
│   ├── package.json
│   └── next.config.js
│
├── backend/                     # FastAPI 後端 (部署到地端伺服器)
│   ├── main.py                 # 主程式入口
│   ├── routers/
│   │   └── meetings.py         # 會議相關 API
│   ├── services/
│   │   ├── transcription.py    # 語音轉文字服務
│   │   ├── summary.py          # AI 摘要服務
│   │   └── email.py            # Email 發送服務
│   ├── models/
│   │   └── meeting.py          # 資料模型
│   ├── database.py             # SQLite 連線
│   ├── config.py               # 設定檔
│   └── requirements.txt        # Python 依賴
│
├── data/                        # 資料存放 (地端伺服器)
│   └── meetings/               # 會議檔案
│       └── {meeting_id}/
│           ├── audio.webm      # 錄音檔
│           ├── transcript.txt  # 逐字稿
│           └── summary.md      # 摘要
│
└── docs/                        # 文檔
    ├── PRD-會議室AI系統.md
    └── Architecture-會議室AI系統.md
```

---

## 4. 資料流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              完整會議流程                                    │
└─────────────────────────────────────────────────────────────────────────────┘

1️⃣ 開始會議
   ┌─────────┐      POST /api/meetings/start       ┌─────────┐
   │  平板   │  ─────────────────────────────────▶ │  後端   │
   │  前端   │  { room: "A", attendees: [...] }    │ FastAPI │
   └─────────┘                                     └────┬────┘
                                                        │
                                                        ▼
                                                  建立會議記錄
                                                  回傳 meeting_id

2️⃣ 錄音中 (前端處理)
   ┌─────────┐
   │  平板   │  使用 MediaRecorder API 錄音
   │  前端   │  暫存於瀏覽器記憶體
   └─────────┘

3️⃣ 結束會議 & 上傳
   ┌─────────┐      POST /api/meetings/{id}/end    ┌─────────┐
   │  平板   │  ─────────────────────────────────▶ │  後端   │
   │  前端   │  FormData: audio file (webm)        │ FastAPI │
   └─────────┘                                     └────┬────┘
                                                        │
                                                        ▼
4️⃣ 後端處理 (非同步)
   ┌─────────────────────────────────────────────────────────┐
   │                                                         │
   │  1. 儲存音檔 ──▶ /data/meetings/{id}/audio.webm        │
   │                                                         │
   │  2. 語音轉文字 ──▶ OpenAI Whisper API                  │
   │     └─▶ 儲存 transcript.txt                            │
   │                                                         │
   │  3. AI 摘要 ──▶ OpenAI GPT-4o                          │
   │     └─▶ 儲存 summary.md                                │
   │                                                         │
   │  4. 發送 Email ──▶ 公司 SMTP                           │
   │     └─▶ 寄給所有與會者                                  │
   │                                                         │
   │  5. 更新資料庫狀態 ──▶ SQLite                          │
   │                                                         │
   └─────────────────────────────────────────────────────────┘
```

---

## 5. API 設計

### 5.1 端點總覽

| 方法 | 端點 | 說明 |
|-----|------|------|
| POST | `/api/meetings/start` | 開始新會議 |
| POST | `/api/meetings/{id}/end` | 結束會議並上傳錄音 |
| GET | `/api/meetings/{id}/status` | 查詢處理狀態 |

### 5.2 API 詳細規格

#### `POST /api/meetings/start`

開始新會議

**Request:**
```json
{
  "room": "會議室 A",
  "attendees": [
    { "email": "john@company.com", "name": "John" },
    { "email": "mary@client.com", "name": "Mary" }
  ]
}
```

**Response:**
```json
{
  "meeting_id": "mtg_20260105_143000",
  "status": "recording",
  "start_time": "2026-01-05T14:30:00+08:00"
}
```

---

#### `POST /api/meetings/{id}/end`

結束會議並上傳錄音

**Request:** `multipart/form-data`
- `audio`: 錄音檔 (webm 格式)
- `attendees`: JSON 字串（可能有新增的與會者）

**Response:**
```json
{
  "meeting_id": "mtg_20260105_143000",
  "status": "processing",
  "message": "會議已結束，正在處理中..."
}
```

---

#### `GET /api/meetings/{id}/status`

查詢處理狀態

**Response:**
```json
{
  "meeting_id": "mtg_20260105_143000",
  "status": "completed",
  "steps": {
    "transcription": "completed",
    "summary": "completed", 
    "email": "completed"
  },
  "completed_at": "2026-01-05T15:50:00+08:00"
}
```

**狀態值說明：**
- `recording`: 錄音中
- `processing`: 處理中
- `completed`: 完成
- `failed`: 失敗

---

## 6. 資料庫設計

### SQLite Schema

```sql
-- 會議主表
CREATE TABLE meetings (
    id TEXT PRIMARY KEY,              -- mtg_20260105_143000
    room TEXT NOT NULL,               -- 會議室名稱
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    status TEXT DEFAULT 'recording',  -- recording/processing/completed/failed
    audio_path TEXT,                  -- 音檔路徑
    transcript_path TEXT,             -- 逐字稿路徑
    summary_path TEXT,                -- 摘要路徑
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 與會者表
CREATE TABLE attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id TEXT NOT NULL,
    name TEXT,
    email TEXT NOT NULL,
    email_sent BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id)
);
```

---

## 7. 部署架構

### 7.1 前端部署 (Vercel)

```
GitHub Repo ──push──▶ Vercel ──auto deploy──▶ https://meeting-ai.vercel.app
```

**環境變數：**
```env
NEXT_PUBLIC_API_URL=https://your-server.company.com/api
```

### 7.2 後端部署 (地端伺服器)

```
地端伺服器
├── Docker (推薦)
│   └── docker-compose.yml
│       ├── fastapi (port 8000)
│       └── nginx (port 443, SSL)
│
└── 或直接運行
    └── uvicorn main:app --host 0.0.0.0 --port 8000
```

**環境變數：**
```env
# .env
OPENAI_API_KEY=sk-xxxxx
SMTP_HOST=mail.company.com
SMTP_PORT=587
SMTP_USER=meeting-ai@company.com
SMTP_PASSWORD=xxxxx
DATABASE_PATH=/data/meetings.db
STORAGE_PATH=/data/meetings
```

### 7.3 網路需求

```
┌─────────────────────────────────────────────────────────────┐
│                        網路架構                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  平板 (公司內網)                                            │
│      │                                                      │
│      ├──▶ Vercel (前端) ──▶ 需要網際網路                   │
│      │                                                      │
│      └──▶ 地端伺服器 (後端)                                 │
│           │                                                 │
│           ├──▶ 需要能被 Vercel 訪問                        │
│           │    (公開 IP 或 VPN/Tunnel)                     │
│           │                                                 │
│           └──▶ 需要訪問 OpenAI API                         │
│                (需要網際網路出口)                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**⚠️ 重要提醒：**
- 地端伺服器需要有公開可訪問的端點（或使用 Cloudflare Tunnel 等方案）
- 需要 SSL 憑證（Let's Encrypt 免費）
- 建議設定 CORS 只允許 Vercel 網域

---

## 8. 開發流程

### Phase 1：環境搭建 (1 週)
- [ ] 建立 GitHub Repo
- [ ] 初始化 Next.js 專案，部署到 Vercel
- [ ] 初始化 FastAPI 專案
- [ ] 設定地端伺服器環境 (Python, SQLite)
- [ ] 設定 HTTPS (SSL 憑證)

### Phase 2：核心功能 - 後端 (2 週)
- [ ] 實作會議 CRUD API
- [ ] 整合 OpenAI Whisper API (語音轉文字)
- [ ] 整合 OpenAI GPT API (摘要生成)
- [ ] 實作 Email 發送功能
- [ ] 檔案儲存功能

### Phase 3：核心功能 - 前端 (2 週)
- [ ] 會議控制介面 UI
- [ ] 瀏覽器錄音功能 (MediaRecorder API)
- [ ] 與會者管理介面
- [ ] 狀態顯示與輪詢
- [ ] 響應式設計（平板優化）

### Phase 4：整合測試 (1 週)
- [ ] 端對端測試
- [ ] 錯誤處理優化
- [ ] 效能調整
- [ ] 部署到正式環境

**預估總時程：4-6 週**

---

## 9. 技術注意事項

### 9.1 錄音格式
- 使用 WebM 格式（瀏覽器原生支援）
- Whisper API 支援 webm, mp3, wav 等格式
- 建議採樣率：16kHz，足夠語音辨識使用

### 9.2 大檔案上傳
- 2 小時會議約 50-100MB
- 使用分塊上傳 (chunked upload) 避免超時
- 設定 Nginx 的 `client_max_body_size`

### 9.3 非同步處理
- 錄音處理可能需要數分鐘
- 使用背景任務 (FastAPI BackgroundTasks)
- 前端輪詢狀態或使用 WebSocket

### 9.4 成本估算 (OpenAI API)

| 服務 | 定價 | 1小時會議成本 |
|-----|-----|-------------|
| Whisper API | $0.006/分鐘 | ~$0.36 |
| GPT-4o | $5/1M input tokens | ~$0.10 |
| **總計** | | **~$0.50/場會議** |

---

## 10. 給 UI Agent 的組件規劃

### 需要實作的前端組件：

| 組件 | 功能 | 優先級 |
|-----|------|:-----:|
| `MeetingPanel` | 主面板容器 | P0 |
| `RecordButton` | 開始/結束錄音按鈕 | P0 |
| `AttendeeList` | 與會者 Email 列表 | P0 |
| `AttendeeInput` | 新增與會者輸入框 | P0 |
| `StatusDisplay` | 顯示會議狀態 | P0 |
| `Timer` | 錄音計時器 | P0 |
| `ProcessingModal` | 處理中的 Modal | P1 |

### UI 狀態機：

```
IDLE ──開始──▶ RECORDING ──結束──▶ UPLOADING ──完成──▶ PROCESSING ──完成──▶ IDLE
                                      │                      │
                                      ▼                      ▼
                                   顯示上傳進度          顯示處理進度
```

---

> 📌 **下一步**：確認架構後，可使用 `@ui-designer` 開始設計平板介面。

