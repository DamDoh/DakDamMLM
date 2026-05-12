import { NextRequest, NextResponse } from 'next/server';
import { trackReferralClick, trackReferralConversion } from '@/lib/referral-tracking';

export async function POST(request: NextRequest) {
  try {
    const { referralCode, metadata, conversion, newMemberId } = await request.json();

    if (!referralCode) {
      return NextResponse.json(
        { error: 'Referral code is required' },
        { status: 400 }
      );
    }

    // Handle conversion tracking (when user successfully registers)
    if (conversion && newMemberId) {
      const conversionResult = await trackReferralConversion(referralCode, newMemberId);
      
      if (!conversionResult) {
        return NextResponse.json(
          { error: 'Failed to track referral conversion' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Referral conversion tracked successfully',
      });
    }

    // Handle click tracking (when user clicks referral link)
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