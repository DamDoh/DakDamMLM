/**
 * Recalculate waiting PV for all sponsors based on correct logic:
 * 1. Get G1 children's rank PV
 * 2. If both legs have PV, calculate what should remain after matching
 * 3. Update waiting PV correctly
 * 
 * Usage: npx tsx scripts/recalculate-waiting-pv.ts [sponsorMemberId]
 */

import { PrismaClient } from '@prisma/client';
import { PVMatchingService } from '../src/services/pv-matching-service';

const prisma = new PrismaClient();

// Rank PV values
const RANK_PV: Record<string, number> = {
  'Member': 0,
  'Bronze': 100,
  'Silver': 100,
  'Gold': 100,
  'Diamond': 100,
  'Manager': 100,
  'Director': 100,
  'President': 100,
  'Double President': 100,
};

async function recalculateWaitingPV(sponsorMemberId?: string) {
  try {
    console.log('🔄 Recalculating waiting PV...\n');

    let sponsors;

    if (sponsorMemberId) {
      const sponsor = await prisma.user.findUnique({
        where: { memberId: sponsorMemberId },
      });
      if (!sponsor) {
        console.error(`❌ Sponsor not found: ${sponsorMemberId}`);
        process.exit(1);
      }
      sponsors = [sponsor];
    } else {
      // Get all sponsors with children
      sponsors = await prisma.user.findMany({
        where: {
          deleted: false,
          active: true,
        },
        select: {
          id: true,
          memberId: true,
          fullName: true,
          rank: true,
        },
      });
    }

    console.log(`Processing ${sponsors.length} sponsors...\n`);

    for (const sponsor of sponsors) {
      try {
        // Get G1 children
        const [leftChild, rightChild] = await Promise.all([
          prisma.user.findFirst({
            where: {
              placementParentId: sponsor.id,
              position: 'left',
              deleted: false,
              active: true,
            },
            select: { id: true, rank: true, memberId: true },
          }),
          prisma.user.findFirst({
            where: {
              placementParentId: sponsor.id,
              position: 'right',
              deleted: false,
              active: true,
            },
            select: { id: true, rank: true, memberId: true },
          }),
        ]);

        // Calculate waiting PV from G1 children's rank PV
        let leftWaitingPV = 0;
        let rightWaitingPV = 0;

        if (leftChild && leftChild.rank && leftChild.rank !== 'Member') {
          leftWaitingPV = RANK_PV[leftChild.rank] || 0;
        }

        if (rightChild && rightChild.rank && rightChild.rank !== 'Member') {
          rightWaitingPV = RANK_PV[rightChild.rank] || 0;
        }

        // Get current waiting PV from database
        const currentWaiting = await PVMatchingService.getWaitingPV(sponsor.id);

        // Check if there was a previous match that consumed some PV
        // If current waiting is less than what we calculated, it means a match happened
        // In that case, we need to check if the current values are correct after matching

        // If both legs have PV, check if a match should have happened
        if (leftWaitingPV > 0 && rightWaitingPV > 0) {
          const matchedPV = Math.min(leftWaitingPV, rightWaitingPV);
          
          // Calculate what should remain after match
          let expectedLeftAfter = 0;
          let expectedRightAfter = 0;

          if (leftWaitingPV > rightWaitingPV) {
            expectedLeftAfter = leftWaitingPV - rightWaitingPV;
            expectedRightAfter = 0;
          } else if (rightWaitingPV > leftWaitingPV) {
            expectedLeftAfter = 0;
            expectedRightAfter = rightWaitingPV - leftWaitingPV;
          } else {
            expectedLeftAfter = 0;
            expectedRightAfter = 0;
          }

          // Check if daily match was already processed today
          const today = new Date();
          const startOfDay = new Date(today);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(today);
          endOfDay.setHours(23, 59, 59, 999);

          const todayMatch = await prisma.commission.findFirst({
            where: {
              userId: sponsor.id,
              type: 'Daily Match',
              date: { gte: startOfDay, lte: endOfDay },
              status: { in: ['Paid', 'Pending'] },
            },
          });

          if (todayMatch) {
            // Match already happened today - use expected after-match values
            leftWaitingPV = expectedLeftAfter;
            rightWaitingPV = expectedRightAfter;
            console.log(`✅ ${sponsor.memberId} (${sponsor.fullName}): Match already processed today`);
            console.log(`   Setting: Left=${leftWaitingPV}, Right=${rightWaitingPV} (after match)`);
          } else {
            // No match today - use original values
            console.log(`📊 ${sponsor.memberId} (${sponsor.fullName}): Ready to match`);
            console.log(`   Left: ${leftWaitingPV}, Right: ${rightWaitingPV}`);
            console.log(`   Matchable: ${matchedPV} PV`);
          }
        } else {
          // One or both legs have no PV - set to calculated values
          console.log(`📊 ${sponsor.memberId} (${sponsor.fullName}):`);
          console.log(`   Left: ${leftWaitingPV}, Right: ${rightWaitingPV}`);
        }

        // Update waiting PV
        await PVMatchingService.updateWaitingPV(sponsor.id, leftWaitingPV, rightWaitingPV);

        console.log(`   ✅ Updated: Left=${leftWaitingPV}, Right=${rightWaitingPV}\n`);

      } catch (error) {
        console.error(`❌ Error processing ${sponsor.memberId}:`, error);
      }
    }

    console.log('✅ Recalculation completed!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get sponsor memberId from command line
const sponsorMemberId = process.argv[2];

// Run the recalculation
recalculateWaitingPV(sponsorMemberId)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

