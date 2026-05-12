/**
 * Backfill waiting PV for all sponsors based on their G1 children's ranks
 * This script calculates and sets the correct waiting PV for all existing members
 * 
 * Usage: npx tsx scripts/backfill-waiting-pv-from-ranks.ts
 */

import { PrismaClient } from '@prisma/client';

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

async function backfillWaitingPV() {
  try {
    console.log('🔄 Starting backfill of waiting PV from G1 children ranks...\n');

    // Get all users who have children (potential sponsors)
    const sponsors = await prisma.user.findMany({
      where: {
        deleted: false,
        active: true,
      },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        rank: true,
        placementParentId: true,
        position: true,
      },
    });

    console.log(`Found ${sponsors.length} users to process\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const sponsor of sponsors) {
      try {
        // Get G1 left and right children
        const [leftChild, rightChild] = await Promise.all([
          prisma.user.findFirst({
            where: {
              placementParentId: sponsor.id,
              position: 'left',
              deleted: false,
              active: true,
            },
            select: { id: true, rank: true, pv: true, memberId: true },
          }),
          prisma.user.findFirst({
            where: {
              placementParentId: sponsor.id,
              position: 'right',
              deleted: false,
              active: true,
            },
            select: { id: true, rank: true, pv: true, memberId: true },
          }),
        ]);

        // Calculate waiting PV from G1 children's rank PV
        let leftWaitingPV = 0;
        let rightWaitingPV = 0;

        if (leftChild) {
          // Use rank PV if child has a valid rank (not Member)
          if (leftChild.rank && leftChild.rank !== 'Member') {
            leftWaitingPV = RANK_PV[leftChild.rank] || 0;
          }
        }

        if (rightChild) {
          // Use rank PV if child has a valid rank (not Member)
          if (rightChild.rank && rightChild.rank !== 'Member') {
            rightWaitingPV = RANK_PV[rightChild.rank] || 0;
          }
        }

        // Only update if there's actual waiting PV
        if (leftWaitingPV > 0 || rightWaitingPV > 0) {
          await prisma.$executeRaw`
            UPDATE "users"
            SET 
              "leftWaitingPV" = ${leftWaitingPV},
              "rightWaitingPV" = ${rightWaitingPV},
              "updatedAt" = NOW()
            WHERE "id" = ${sponsor.id}
          `;

          console.log(`✅ Updated ${sponsor.memberId} (${sponsor.fullName}):`);
          console.log(`   Left: ${leftWaitingPV} PV (from ${leftChild?.memberId || 'none'})`);
          console.log(`   Right: ${rightWaitingPV} PV (from ${rightChild?.memberId || 'none'})`);
          updatedCount++;
        } else {
          // Reset to 0 if no valid children
          await prisma.$executeRaw`
            UPDATE "users"
            SET 
              "leftWaitingPV" = 0,
              "rightWaitingPV" = 0,
              "updatedAt" = NOW()
            WHERE "id" = ${sponsor.id}
          `;
          skippedCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing ${sponsor.memberId}:`, error);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Total users processed: ${sponsors.length}`);
    console.log(`   Updated with waiting PV: ${updatedCount}`);
    console.log(`   Reset to zero: ${skippedCount}`);

  } catch (error) {
    console.error('❌ Error in backfill:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
backfillWaitingPV()
  .then(() => {
    console.log('\n✅ Backfill completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  });

