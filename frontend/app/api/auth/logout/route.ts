import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://tw-07.access.glows.ai:23435';

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    
    const response = await fetch(`${BACKEND_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        ...(authorization ? { 'Authorization': authorization } : {}),
      },
    });

    const data = await response.json();
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Logout proxy error:', error);
    return NextResponse.json(
      { detail: '登出服務暫時不可用' },
      { status: 500 }
    );
  }
}


