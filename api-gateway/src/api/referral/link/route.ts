import { NextRequest, NextResponse } from 'next/server';
import { createReferralLink, getReferralStats, deactivateReferralLink } from '@/lib/referral-tracking';

export async function POST(request: NextRequest) {
  try {
    const { sponsorId, companyId, expiresIn, metadata } = await request.json();

    if (!sponsorId || !companyId) {
      return NextResponse.json(
        { error: 'Sponsor ID and Company ID are required' },
        { status: 400 }
      );
    }

    const referralLink = await createReferralLink(sponsorId, companyId, {
      expiresIn,
      metadata,
    });

    return NextResponse.json({
      success: true,
      referralLink,
    });

  } catch (error) {
    console.error('Create referral link error:', error);
    return NextResponse.json(
      { error: 'Failed to create referral link' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sponsorId = searchParams.get('sponsorId');
    const companyId = searchParams.get('companyId');

    if (!sponsorId) {
      return NextResponse.json(
        { error: 'Sponsor ID is required' },
        { status: 400 }
      );
    }

    const stats = await getReferralStats(sponsorId, companyId || undefined);

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Get referral stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get referral statistics' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get('linkId');
    const sponsorId = searchParams.get('sponsorId');

    if (!linkId || !sponsorId) {
      return NextResponse.json(
        { error: 'Link ID and Sponsor ID are required' },
        { status: 400 }
      );
    }

    const success = await deactivateReferralLink(linkId, sponsorId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to deactivate referral link' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Referral link deactivated successfully',
    });

  } catch (error) {
    console.error('Delete referral link error:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate referral link' },
      { status: 500 }
    );
  }
}