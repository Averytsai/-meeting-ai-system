import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'http://tw-07.access.glows.ai:23435';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/meetings/${params.id}/status`);
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Backend connection failed' }, { status: 500 });
  }
}

