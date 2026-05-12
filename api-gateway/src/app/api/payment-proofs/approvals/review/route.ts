import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  return requireAuth(async (req) => {
    try {
      const body = await request.json();
    const { proofId, action, notes } = body;

    if (!proofId || !action) {
      return NextResponse.json(
        { error: 'Proof ID and action are required' },
        { status: 400 }
      );
    }

    const response = await fetch(`${process.env.PAYMENT_PROOF_SERVICE_URL}/api/approvals/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('authorization') || '',
      },
      body: JSON.stringify({ proofId, action, notes }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Review failed' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);

    } catch (error) {
      console.error('Payment proof review error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  })(request);
}