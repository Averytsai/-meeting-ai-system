# 🛠️ AI 會議助手 - 開發指南

## 📁 專案結構

```
meeting-ai-mobile/
├── App.tsx                 # 主要 UI 組件
├── app.json               # Expo 配置
├── src/
│   └── services/
│       ├── api.ts         # 後端 API 調用
│       ├── recorder.ts    # 錄音功能
│       ├── storage.ts     # 本地存儲
│       ├── network.ts     # 網路狀態
│       └── sync.ts        # 離線同步
├── scripts/
│   ├── deploy.sh          # 部署腳本
│   └── test.sh            # 測試腳本
└── ios/                   # iOS 原生專案
```

## 🚀 快速開始

### 開發模式
```bash
cd ~/meeting-ai-mobile
npx expo start
```

### 在模擬器測試
```bash
./scripts/test.sh
```

### 部署到 App Store
```bash
./scripts/deploy.sh
```

## 📝 常用命令

| 命令 | 說明 |
|------|------|
| `npx expo start` | 啟動開發伺服器 |
| `npx expo start --ios` | 啟動 iOS 模擬器 |
| `npx expo prebuild --platform ios --clean` | 重新生成 iOS 專案 |
| `./scripts/deploy.sh` | 一鍵部署 |

## 🔄 迭代流程

### 1. 開發新功能
```bash
# 創建功能分支
git checkout -b feature/new-feature

# 開發...
# 測試...

# 提交
git add .
git commit -m "✨ 新功能描述"
```

### 2. 本地測試
```bash
# 在 Xcode 中 Build & Run
open ios/AI.xcworkspace
```

### 3. TestFlight 測試（可選）
```bash
# Archive 後選擇 TestFlight 分發
# 邀請測試者測試
```

### 4. 發布到 App Store
```bash
./scripts/deploy.sh
```

## 📊 版本號規則

- **Version (CFBundleShortVersionString)**: 用戶看到的版本 `1.0.0`
- **Build (CFBundleVersion)**: 每次提交遞增 `1, 2, 3...`

### 版本更新時機

| 變更類型 | Version | Build |
|----------|---------|-------|
| Bug 修復 | 不變 | +1 |
| 小功能 | 1.0.x | +1 |
| 大功能 | 1.x.0 | +1 |
| 重大更新 | x.0.0 | +1 |

## 🔧 常見問題

### Q: 模擬器上 App 無法啟動？
```bash
# 清理並重新編譯
cd ios && pod install && cd ..
npx expo prebuild --platform ios --clean
```

### Q: Archive 失敗？
1. 確認 Signing & Capabilities 設定正確
2. 確認選擇 "Any iOS Device (arm64)"
3. 清理：Product → Clean Build Folder

### Q: 上傳後 App Store Connect 看不到？
- 等待 5-15 分鐘
- 檢查郵件是否有錯誤通知

## 📱 後端 API

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/meetings/start` | POST | 開始會議 |
| `/api/meetings/{id}/end` | POST | 結束會議並上傳錄音 |
| `/api/meetings/{id}/status` | GET | 查詢處理狀態 |
| `/api/meetings/{id}/summary` | GET | 獲取摘要 |

後端地址：`http://tw-07.access.glows.ai:23435`

## 📧 聯絡

- Email: avery88123@gmail.com
- App Store: MeetNote AI

