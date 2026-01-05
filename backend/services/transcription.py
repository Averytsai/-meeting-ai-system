"""
語音轉文字服務
使用 OpenAI Whisper API
"""

from pathlib import Path
from openai import AsyncOpenAI

from config import get_settings

settings = get_settings()


async def transcribe_audio(audio_path: str) -> str:
    """
    將音檔轉換為文字
    
    Args:
        audio_path: 音檔路徑
        
    Returns:
        逐字稿文字
    """
    # 檢查 API Key
    if not settings.openai_api_key:
        raise Exception("OpenAI API Key 未設定，請在 .env 檔案中設定 OPENAI_API_KEY")
    
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    
    audio_file = Path(audio_path)
    if not audio_file.exists():
        raise Exception(f"音檔不存在: {audio_path}")
    
    # 讀取音檔並呼叫 Whisper API
    with open(audio_file, "rb") as f:
        response = await client.audio.transcriptions.create(
            model=settings.whisper_model,
            file=f,
            language="zh",  # 指定中文
            response_format="text",
            prompt="這是一場商業會議的錄音。"  # 提供上下文提示
        )
    
    return response

