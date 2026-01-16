#!/bin/bash
# 快速部署腳本

set -e

# 顏色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 開始部署流程${NC}"

# 1. 更新版本號
echo -e "${YELLOW}📦 當前版本號：${NC}"
grep '"buildNumber"' app.json

read -p "輸入新的 Build 號碼: " BUILD_NUM

sed -i '' "s/\"buildNumber\": \"[0-9]*\"/\"buildNumber\": \"$BUILD_NUM\"/" app.json
sed -i '' "s/\"versionCode\": [0-9]*/\"versionCode\": $BUILD_NUM/" app.json

echo -e "${GREEN}✅ 版本號已更新為 $BUILD_NUM${NC}"

# 2. 同步代碼
echo -e "${YELLOW}📂 同步代碼到主專案...${NC}"
cp App.tsx "/Users/caimingzhi/Desktop/企業app store/會議室AI/mobile/"
cp -r src "/Users/caimingzhi/Desktop/企業app store/會議室AI/mobile/"
cp app.json "/Users/caimingzhi/Desktop/企業app store/會議室AI/mobile/"

# 3. 重新生成 iOS 專案
echo -e "${YELLOW}🔧 重新生成 iOS 專案...${NC}"
npx expo prebuild --platform ios --clean

# 4. 打開 Xcode
echo -e "${GREEN}✅ 完成！正在開啟 Xcode...${NC}"
open ios/AI.xcworkspace

echo ""
echo -e "${GREEN}📱 接下來在 Xcode 中：${NC}"
echo "   1. 選擇 'Any iOS Device (arm64)'"
echo "   2. Product → Archive"
echo "   3. Distribute App → App Store Connect → Upload"

