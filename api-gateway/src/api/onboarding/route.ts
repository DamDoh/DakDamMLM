import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getMemberProgress, completeOnboardingStep, getOnboardingTemplate } from '@/services/onboarding-service';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const [template, progress] = await Promise.all([
      getOnboardingTemplate('new-member-onboarding'),
      getMemberProgress(user.id),
    ]);

    return NextResponse.json({ success: true, data: { template, progress } });
  } catch (error) {
    console.error('Onboarding GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch onboarding data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { action, stepId, timeSpent } = body || {};
    if (action === 'complete-step') {
      if (!stepId) {
        return NextResponse.json({ success: false, error: 'stepId is required' }, { status: 400 });
      }
      const ok = await completeOnboardingStep(user.id, stepId, Number(timeSpent) || 0);
      return NextResponse.json({ success: ok });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Onboarding POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update onboarding' }, { status: 500 });
  }
}


