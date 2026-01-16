#!/bin/bash
# 快速測試腳本

echo "🧪 啟動本地測試..."

# 啟動 iPad 模擬器
xcrun simctl boot "iPad Pro 13-inch (M5)" 2>/dev/null || true
xcrun simctl boot "iPhone 17 Pro Max" 2>/dev/null || true

# 安裝 App
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData/AI-*/Build/Products/Debug-iphonesimulator/AI.app -type d 2>/dev/null | head -1)

if [ -n "$APP_PATH" ]; then
    xcrun simctl install "iPad Pro 13-inch (M5)" "$APP_PATH"
    xcrun simctl install "iPhone 17 Pro Max" "$APP_PATH"
    
    echo "✅ App 已安裝到模擬器"
    echo "📱 開啟 Simulator..."
    open -a Simulator
else
    echo "❌ 找不到編譯好的 App，請先在 Xcode 中 Build"
fi
