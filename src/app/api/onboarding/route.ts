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

    const body = await request.json().catch(() => ({}));
    const { action, stepId, timeSpent } = body || {};
    
    console.log(`[Onboarding API] POST request from user ${user.id}:`, { action, stepId, timeSpent });
    
    if (action === 'complete-step') {
      if (!stepId) {
        console.error('[Onboarding API] Missing stepId in request');
        return NextResponse.json({ success: false, error: 'stepId is required' }, { status: 400 });
      }
      
      try {
      const ok = await completeOnboardingStep(user.id, stepId, Number(timeSpent) || 0);
        if (ok) {
          console.log(`[Onboarding API] ✅ Successfully completed step ${stepId} for user ${user.id}`);
          return NextResponse.json({ success: true });
        } else {
          console.error(`[Onboarding API] ❌ Failed to complete step ${stepId} for user ${user.id}`);
          return NextResponse.json({ success: false, error: 'Failed to complete step' }, { status: 500 });
        }
      } catch (stepError: any) {
        console.error('[Onboarding API] Error completing step:', stepError);
        return NextResponse.json({ 
          success: false, 
          error: stepError.message || 'Failed to complete step' 
        }, { status: 500 });
      }
    }

    console.error('[Onboarding API] Invalid action:', action);
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('[Onboarding API] POST error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to update onboarding' 
    }, { status: 500 });
  }
}


