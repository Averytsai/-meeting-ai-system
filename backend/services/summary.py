"""
AI 摘要生成服務
使用 OpenAI GPT-4o
"""

from typing import List
from openai import AsyncOpenAI

from config import get_settings

settings = get_settings()

# 摘要生成提示詞（簡潔版）
SUMMARY_PROMPT = """你是一位專業的會議記錄員。請根據以下會議逐字稿，生成一份簡潔清晰的會議摘要。

會議資訊：
- 會議室：{room}
- 時間：{start_time} - {end_time}
- 與會者：{attendees}

逐字稿：
{transcript}

---

請按照以下格式生成摘要（不要使用表情符號）：

# 會議摘要

日期：{date_range}
地點：{room}
與會者：{attendee_names}

---

## 會議重點
（列出 3-5 個主要討論重點，用條列式）

## 決議事項
（列出會議中達成的共識或決定）

## 待辦事項

| 項目 | 負責人 | 期限 |
|-----|-------|-----|
（如果有提到具體的待辦事項，請列出；若無則省略此表格）

---
此摘要由 AI 自動生成

重要規則：
1. 使用繁體中文
2. 不要使用任何表情符號（emoji）
3. 保持專業、簡潔的語氣
4. 只提取逐字稿中實際討論的內容
5. 若資訊不足可標註「待確認」
6. 若逐字稿很短，如實說明即可
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

