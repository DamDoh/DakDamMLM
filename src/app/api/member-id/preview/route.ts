import { NextRequest, NextResponse } from 'next/server';
import { getNextMemberIdForSponsor } from '@/lib/member-id-sponsor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sponsorId = searchParams.get('sponsorId');

    const { nextMemberId, prefix, nextNumber } = await getNextMemberIdForSponsor(sponsorId);

    return NextResponse.json(
      { nextMemberId, prefix, nextNumber },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error generating preview member ID:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to generate preview member ID',
      },
      { status: 500 }
    );
  }
}
