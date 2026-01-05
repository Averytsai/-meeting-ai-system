"""
AI 摘要生成服務
使用 OpenAI GPT-4o
"""

from typing import List
from openai import AsyncOpenAI

from config import get_settings

settings = get_settings()

# 摘要生成提示詞
SUMMARY_PROMPT = """你是一位專業的會議記錄員。請根據以下會議逐字稿，生成一份結構清晰的會議摘要。

## 會議資訊
- 會議室：{room}
- 開始時間：{start_time}
- 結束時間：{end_time}
- 與會者：{attendees}

## 逐字稿
{transcript}

---

請按照以下格式生成摘要：

# 會議摘要

📅 日期：{date_range}
📍 地點：{room}
👥 與會者：{attendee_names}

---

## 📌 會議重點
（列出 3-5 個主要討論重點）

## ✅ 決議事項
（列出會議中達成的共識或決定）

## 📋 待辦事項 (Action Items)
| 項目 | 負責人 | 期限 |
|-----|-------|-----|
（如果逐字稿中有提到具體的待辦事項、負責人和期限，請列出）

---
此摘要由 AI 自動生成，如有疏漏請以實際會議內容為準。

注意事項：
1. 使用繁體中文
2. 保持專業、客觀的語氣
3. 只提取逐字稿中實際討論的內容
4. 如果某些資訊（如負責人、期限）在逐字稿中未提及，可以標註「待確認」
5. 如果逐字稿內容很短或資訊不足，請如實說明
"""


async def generate_summary(
    transcript: str,
    room: str,
    start_time: str,
    end_time: str,
    attendees: List[dict]
) -> str:
    """
    根據逐字稿生成 AI 摘要
    
    Args:
        transcript: 逐字稿內容
        room: 會議室名稱
        start_time: 開始時間
        end_time: 結束時間
        attendees: 與會者列表
        
    Returns:
        Markdown 格式的摘要
    """
    # 檢查 API Key
    if not settings.openai_api_key:
        raise Exception("OpenAI API Key 未設定，請在 .env 檔案中設定 OPENAI_API_KEY")
    
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    
    # 整理與會者資訊
    attendee_names = ", ".join([
        f"{a.get('name', '')} ({a.get('email', '')})"
        for a in attendees
    ])
    
    # 日期範圍
    date_range = f"{start_time} - {end_time}"
    
    # 組合提示詞
    prompt = SUMMARY_PROMPT.format(
        room=room,
        start_time=start_time,
        end_time=end_time,
        attendees=attendee_names,
        transcript=transcript,
        date_range=date_range,
        attendee_names=attendee_names
    )
    
    # 呼叫 GPT API
    response = await client.chat.completions.create(
        model=settings.gpt_model,
        messages=[
            {
                "role": "system",
                "content": "你是一位專業的會議記錄員，擅長將會議內容整理成結構清晰的摘要。"
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.3,  # 較低的溫度以確保一致性
        max_tokens=2000,
    )
    
    return response.choices[0].message.content

