import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'http://tw-07.access.glows.ai:23435';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    
    const response = await fetch(`${BACKEND_URL}/api/meetings/${id}/end`, {
      method: 'POST',
      body: formData,
    });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Backend connection failed' }, { status: 500 });
  }
}

