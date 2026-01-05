# 🚀 會議室 AI 系統 - 部署指南

## 架構概覽

```
┌─────────────────┐         API          ┌─────────────────────┐
│     Vercel      │  ─────────────────▶  │   VM (Docker)       │
│   (前端 Next.js) │                      │   (後端 FastAPI)     │
│                 │                      │   Port: 8000        │
└─────────────────┘                      └─────────────────────┘
```

---

## 📦 Phase 1: 上傳到 GitHub

### 1.1 建立 GitHub Repository
1. 前往 https://github.com/new
2. Repository name: `meeting-ai-system`
3. 設為 Private（包含 API Key）
4. 點擊 Create repository

### 1.2 上傳程式碼
```bash
cd /path/to/會議室AI

# 初始化 Git
git init

# 建立 .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
venv/
__pycache__/

# Environment
.env
.env.local
*.env

# Build
.next/
dist/

# Data
backend/data/

# IDE
.idea/
.vscode/
.DS_Store
EOF

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: 會議室 AI 系統"

# 連接 GitHub
git remote add origin https://github.com/YOUR_USERNAME/meeting-ai-system.git

# 推送
git branch -M main
git push -u origin main
```

---

## 🐳 Phase 2: 部署後端到 VM

### 2.1 SSH 連接到 VM
```bash
ssh -p 27236 glows@tw-07.access.glows.ai
# 密碼: tJhRU(-mV2nctf2B
```

### 2.2 安裝 Docker（如果還沒安裝）
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 重新登入讓群組生效
```

### 2.3 Clone 專案
```bash
cd ~
git clone https://github.com/YOUR_USERNAME/meeting-ai-system.git
cd meeting-ai-system/backend
```

### 2.4 建立環境變數
```bash
cat > .env << 'EOF'
DEBUG=false
DATABASE_PATH=/app/data/meetings.db
STORAGE_PATH=/app/data/meetings

OPENAI_API_KEY=your_openai_api_key_here

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password_here
SMTP_FROM_NAME=會議室 AI 系統
EOF
```

### 2.5 啟動 Docker Container
```bash
# 建立並啟動
docker-compose up -d --build

# 查看日誌
docker-compose logs -f

# 確認運行狀態
curl http://localhost:8000/health
```

### 2.6 設定防火牆（如需要）
```bash
sudo ufw allow 8000/tcp
```

---

## 🌐 Phase 3: 部署前端到 Vercel

### 3.1 連接 Vercel
1. 前往 https://vercel.com
2. 登入並點擊 "Add New Project"
3. Import 你的 GitHub repository
4. 選擇 `frontend` 資料夾作為 Root Directory

### 3.2 設定環境變數
在 Vercel 專案設定中添加：

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `http://tw-07.access.glows.ai:8000/api` |

### 3.3 部署
點擊 Deploy，等待完成！

---

## ✅ 驗證部署

### 測試後端
```bash
curl http://tw-07.access.glows.ai:8000/health
```

### 測試前端
訪問 Vercel 提供的 URL，例如：
`https://meeting-ai-system.vercel.app`

---

## 🔧 常用指令

### VM 上的 Docker 管理
```bash
# 查看運行中的容器
docker ps

# 查看日誌
docker-compose logs -f

# 重啟服務
docker-compose restart

# 停止服務
docker-compose down

# 更新程式碼並重新部署
git pull
docker-compose up -d --build
```

### 更新後端
```bash
ssh -p 27236 glows@tw-07.access.glows.ai
cd ~/meeting-ai-system/backend
git pull
docker-compose up -d --build
```

---

## ⚠️ 注意事項

1. **API Key 安全**: 不要將 .env 檔案提交到 Git
2. **CORS**: 確保後端 CORS 設定包含 Vercel 域名
3. **HTTPS**: 生產環境建議使用 HTTPS（可用 Cloudflare 或 Nginx）

