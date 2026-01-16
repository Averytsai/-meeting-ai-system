import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://tw-07.access.glows.ai:23435';

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    
    // 如果沒有 authorization header，返回空列表而不是錯誤
    if (!authorization) {
      console.log('No authorization header, returning empty list');
      return NextResponse.json({ meetings: [], total: 0, limit: 50, offset: 0 });
    }
    
    console.log('Fetching meetings with auth:', authorization.substring(0, 20) + '...');
    
    const response = await fetch(`${BACKEND_URL}/api/meetings/my/list`, {
      headers: {
        'Authorization': authorization,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', response.status, errorText);
      
      // 如果是 401 或 422，返回空列表
      if (response.status === 401 || response.status === 422) {
        return NextResponse.json({ meetings: [], total: 0, limit: 50, offset: 0 });
      }
      
      return NextResponse.json(
        { detail: '獲取會議列表失敗', error: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Meetings list proxy error:', error);
    return NextResponse.json(
      { detail: '無法獲取會議列表', meetings: [], total: 0 },
      { status: 500 }
    );
  }
}

