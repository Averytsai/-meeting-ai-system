"""
Email 發送服務
使用 SMTP 發送會議摘要
"""

from typing import List
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import ssl

from config import get_settings

settings = get_settings()


async def send_summary_email(
    recipients: List[str],
    summary: str,
    meeting_id: str,
    room: str,
    start_time: str,
) -> bool:
    """
    發送會議摘要 Email
    
    Args:
        recipients: 收件人 Email 列表
        summary: Markdown 格式的摘要
        meeting_id: 會議 ID
        room: 會議室名稱
        start_time: 會議開始時間
        
    Returns:
        是否發送成功
    """
    # 檢查 SMTP 設定
    if not settings.smtp_user or not settings.smtp_password:
        print("⚠️ SMTP 未設定，跳過 Email 發送")
        print(f"   收件人: {recipients}")
        print(f"   會議: {meeting_id}")
        # 在開發階段，即使沒有設定 SMTP 也視為成功
        return True
    
    # 處理密碼（去掉空格）
    password = settings.smtp_password.replace(" ", "")
    
    print(f"📧 準備發送 Email...")
    print(f"   SMTP: {settings.smtp_host}:{settings.smtp_port}")
    print(f"   發件人: {settings.smtp_user}")
    print(f"   收件人: {recipients}")
    
    # 建立郵件
    message = MIMEMultipart("alternative")
    message["Subject"] = f"📋 會議摘要 - {room} ({start_time})"
    message["From"] = f"{settings.smtp_from_name} <{settings.smtp_user}>"
    message["To"] = ", ".join(recipients)
    
    # 純文字版本
    text_content = f"""
會議摘要

會議室: {room}
時間: {start_time}
會議 ID: {meeting_id}

---

{summary}

---
此郵件由會議室 AI 系統自動發送
    """
    
    # HTML 版本 (將 Markdown 轉換為基本 HTML)
    html_content = _markdown_to_html(summary, room, start_time)
    
    message.attach(MIMEText(text_content, "plain", "utf-8"))
    message.attach(MIMEText(html_content, "html", "utf-8"))
    
    try:
        # 方法 1: 使用 Port 465 + SSL（Gmail 推薦）
        if settings.smtp_port == 587:
            # STARTTLS 模式
            await aiosmtplib.send(
                message,
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                username=settings.smtp_user,
                password=password,
                start_tls=True,
            )
        else:
            # SSL 模式 (Port 465)
            await aiosmtplib.send(
                message,
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                username=settings.smtp_user,
                password=password,
                use_tls=True,
            )
        print(f"✅ Email 已發送給 {len(recipients)} 位收件人")
        return True
        
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Email 發送失敗 (Port {settings.smtp_port}): {error_msg}")
        
        # 如果 587 失敗，嘗試 465
        if settings.smtp_port == 587:
            print("🔄 嘗試使用 Port 465 + SSL...")
            try:
                await aiosmtplib.send(
                    message,
                    hostname=settings.smtp_host,
                    port=465,
                    username=settings.smtp_user,
                    password=password,
                    use_tls=True,
                )
                print(f"✅ Email 已發送給 {len(recipients)} 位收件人 (使用 Port 465)")
                return True
            except Exception as e2:
                print(f"❌ Port 465 也失敗: {str(e2)}")
        
        raise


def _markdown_to_html(summary: str, room: str, start_time: str) -> str:
    """簡單的 Markdown 轉 HTML"""
    
    # 基本轉換
    html_body = summary
    
    # 標題
    html_body = html_body.replace("# 會議摘要", "<h1>📋 會議摘要</h1>")
    html_body = html_body.replace("## 📌 會議重點", "<h2>📌 會議重點</h2>")
    html_body = html_body.replace("## ✅ 決議事項", "<h2>✅ 決議事項</h2>")
    html_body = html_body.replace("## 📋 待辦事項 (Action Items)", "<h2>📋 待辦事項</h2>")
    
    # 換行
    html_body = html_body.replace("\n\n", "</p><p>")
    html_body = html_body.replace("\n", "<br>")
    
    # 水平線
    html_body = html_body.replace("---", "<hr>")
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }}
            h1 {{
                color: #1a1a2e;
                border-bottom: 2px solid #00d4ff;
                padding-bottom: 10px;
            }}
            h2 {{
                color: #1a1a2e;
                margin-top: 30px;
            }}
            hr {{
                border: none;
                border-top: 1px solid #ddd;
                margin: 20px 0;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin: 15px 0;
            }}
            th, td {{
                border: 1px solid #ddd;
                padding: 10px;
                text-align: left;
            }}
            th {{
                background: #f5f5f5;
            }}
            .footer {{
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
                color: #666;
                font-size: 12px;
            }}
        </style>
    </head>
    <body>
        <p>{html_body}</p>
        <div class="footer">
            此郵件由會議室 AI 系統自動發送<br>
            會議室: {room} | 時間: {start_time}
        </div>
    </body>
    </html>
    """

