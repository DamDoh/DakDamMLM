import { NextRequest, NextResponse } from 'next/server';
import { trackReferralClick } from '@/lib/referral-tracking';

export async function POST(request: NextRequest) {
  try {
    const { referralCode, metadata } = await request.json();

    if (!referralCode) {
      return NextResponse.json(
        { error: 'Referral code is required' },
        { status: 400 }
      );
    }

    const result = await trackReferralClick(referralCode, metadata);

    if (!result) {
      return NextResponse.json(
        { error: 'Invalid or expired referral code' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      sponsorId: result.sponsorId,
      companyId: result.companyId,
    });

  } catch (error) {
    console.error('Referral tracking error:', error);
    return NextResponse.json(
      { error: 'Failed to track referral' },
      { status: 500 }
    );
  }
}