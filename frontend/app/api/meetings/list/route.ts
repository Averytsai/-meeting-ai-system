import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://tw-07.access.glows.ai:23435';

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    
    const response = await fetch(`${BACKEND_URL}/api/meetings/my/list`, {
      headers: {
        ...(authorization ? { 'Authorization': authorization } : {}),
      },
    });

    const data = await response.json();
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Meetings list proxy error:', error);
    return NextResponse.json(
      { detail: '無法獲取會議列表' },
      { status: 500 }
    );
  }
}

