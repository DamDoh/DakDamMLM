/**
 * API endpoint to manually recalculate G2 Binary Bonus for a specific member or all eligible members
 * 
 * POST /api/commissions/recalculate-g2
 * Body: { memberId?: string } // Optional - if not provided, recalculates for all Manager+ members with G2 downlines
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recalculateG2BinaryBonus } from '@/services/g2-binary-bonus-auto-calc';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { memberId } = body;

    // Get all active Manager+ members who might have G2 downlines
    const g2Rates: Record<string, number> = {
      'Manager': 0.01,
      'Director': 0.03,
      'President': 0.03,
      'Double President': 0.03
    };

    let membersToProcess: Array<{ id: string; memberId: string; rank: string }> = [];

    if (memberId) {
      // Recalculate for specific member
      const member = await prisma.user.findUnique({
        where: { memberId },
        select: {
          id: true,
          memberId: true,
          rank: true,
          active: true,
          deleted: true
        }
      });

      if (member && member.active && !member.deleted && g2Rates[member.rank]) {
        membersToProcess.push({
          id: member.id,
          memberId: member.memberId,
          rank: member.rank
        });
      }
    } else {
      // Recalculate for all Manager+ members with G2 downlines
      const allMembers = await prisma.user.findMany({
        where: {
          active: true,
          deleted: false,
          rank: {
            in: ['Manager', 'Director', 'President', 'Double President']
          }
        },
        select: {
          id: true,
          memberId: true,
          rank: true
        }
      });

      // Check which members have G2 downlines
      for (const member of allMembers) {
        // Get G1 downlines
        const g1Downlines = await prisma.user.findMany({
          where: {
            placementParentId: member.id,
            active: true,
            deleted: false
          },
          select: { id: true }
        });

        // Check if any G1 downline has children (G2 downlines)
        for (const g1 of g1Downlines) {
          const g2Count = await prisma.user.count({
            where: {
              placementParentId: g1.id,
              active: true,
              deleted: false,
              rank: {
                not: 'Member'
              }
            }
          });

          if (g2Count > 0) {
            membersToProcess.push(member);
            break; // Found G2 downlines for this member, no need to check other G1 downlines
          }
        }
      }
    }

    console.log(`🔄 Recalculating G2 Binary Bonus for ${membersToProcess.length} members`);

    const results: Array<{
      memberId: string;
      rank: string;
      success: boolean;
      error?: string;
    }> = [];

    // Process each member
    for (const member of membersToProcess) {
      try {
        await recalculateG2BinaryBonus(member.id);
        results.push({
          memberId: member.memberId,
          rank: member.rank,
          success: true
        });
      } catch (error) {
        results.push({
          memberId: member.memberId,
          rank: member.rank,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `G2 Binary Bonus recalculation completed: ${successCount} succeeded, ${failCount} failed`,
      results: {
        total: membersToProcess.length,
        succeeded: successCount,
        failed: failCount,
        details: results
      }
    });
  } catch (error) {
    console.error('Failed to recalculate G2 Binary Bonus:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
