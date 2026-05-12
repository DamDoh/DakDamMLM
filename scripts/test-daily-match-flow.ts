/**
 * Test script to verify daily match flow
 * Tests: waiting PV calculation, auto trigger, and commission payment
 * 
 * Usage: npx tsx scripts/test-daily-match-flow.ts [sponsorMemberId]
 */

import { PrismaClient } from '@prisma/client';
import { PVMatchingService } from '../src/services/pv-matching-service';
import { checkAndTriggerDailyMatch } from '../src/services/daily-match-trigger';

const prisma = new PrismaClient();

async function testDailyMatchFlow(sponsorMemberId?: string) {
  try {
    console.log('🧪 Testing Daily Match Flow...\n');

    let sponsor;
    
    if (sponsorMemberId) {
      // Find sponsor by memberId
      sponsor = await prisma.user.findUnique({
        where: { memberId: sponsorMemberId },
        select: {
          id: true,
          memberId: true,
          fullName: true,
          rank: true,
          leftWaitingPV: true,
          rightWaitingPV: true,
        },
      });

      if (!sponsor) {
        console.error(`❌ Sponsor not found: ${sponsorMemberId}`);
        process.exit(1);
      }
    } else {
      // Find first sponsor with both children
      const sponsors = await prisma.user.findMany({
        where: {
          deleted: false,
          active: true,
          rank: { not: 'Member' },
        },
        select: {
          id: true,
          memberId: true,
          fullName: true,
          rank: true,
          leftWaitingPV: true,
          rightWaitingPV: true,
        },
      });

      // Find one with both children
      for (const s of sponsors) {
        const [leftChild, rightChild] = await Promise.all([
          prisma.user.findFirst({
            where: {
              placementParentId: s.id,
              position: 'left',
              deleted: false,
              rank: { not: 'Member' },
            },
          }),
          prisma.user.findFirst({
            where: {
              placementParentId: s.id,
              position: 'right',
              deleted: false,
              rank: { not: 'Member' },
            },
          }),
        ]);

        if (leftChild && rightChild) {
          sponsor = s;
          break;
        }
      }

      if (!sponsor) {
        console.error('❌ No sponsor found with both left and right children');
        process.exit(1);
      }
    }

    console.log(`📋 Testing for sponsor: ${sponsor.memberId} (${sponsor.fullName})`);
    console.log(`   Rank: ${sponsor.rank}`);
    console.log(`   Current Left Waiting PV: ${sponsor.leftWaitingPV}`);
    console.log(`   Current Right Waiting PV: ${sponsor.rightWaitingPV}\n`);

    // Step 1: Get current period volume
    console.log('📊 Step 1: Getting Current Period Volume...');
    const currentVolume = await PVMatchingService.getCurrentPeriodVolume(sponsor.id);
    console.log(`   Left Waiting PV: ${currentVolume.leftWaitingPV}`);
    console.log(`   Right Waiting PV: ${currentVolume.rightWaitingPV}`);
    console.log(`   Matchable PV: ${Math.min(currentVolume.leftWaitingPV, currentVolume.rightWaitingPV)}\n`);

    // Step 2: Check if eligible for daily match
    if (currentVolume.leftWaitingPV > 0 && currentVolume.rightWaitingPV > 0) {
      console.log('✅ Sponsor has matching PV - triggering daily match...\n');
      
      // Step 3: Trigger daily match
      await checkAndTriggerDailyMatch(sponsor.id);
      
      // Step 4: Check results
      const afterVolume = await PVMatchingService.getCurrentPeriodVolume(sponsor.id);
      console.log('📊 After Daily Match:');
      console.log(`   Left Waiting PV: ${afterVolume.leftWaitingPV}`);
      console.log(`   Right Waiting PV: ${afterVolume.rightWaitingPV}`);
      console.log(`   Matched Today: ${afterVolume.matchedPV} PV\n`);

      // Check commission records
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      const commissions = await prisma.commission.findMany({
        where: {
          userId: sponsor.id,
          type: 'Daily Match',
          date: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { date: 'desc' },

      });

      console.log('💰 Commission Records Today:');
      if (commissions.length > 0) {
        commissions.forEach((c, i) => {
          console.log(`   ${i + 1}. Amount: $${c.amount}, Status: ${c.status}, Date: ${c.date}`);
        });
      } else {
        console.log('   No commissions found');
      }

      // Check wallet transactions
      const wallet = await prisma.wallet.findUnique({
        where: { userId: sponsor.id },
        include: {
          transactions: {
            where: {
              referenceType: 'daily_match',
              createdAt: { gte: startOfDay, lte: endOfDay },
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });

      if (wallet) {
        console.log(`\n💵 Wallet Balance: $${wallet.balance}`);
        console.log('   Recent Daily Match Transactions:');
        if (wallet.transactions.length > 0) {
          wallet.transactions.forEach((t, i) => {
            console.log(`   ${i + 1}. Amount: $${t.amount}, Type: ${t.type}, Status: ${t.status}`);
          });
        } else {
          console.log('   No transactions found');
        }
      }
    } else {
      console.log('⚠️  Sponsor does not have matching PV');
      console.log(`   Left: ${currentVolume.leftWaitingPV} PV, Right: ${currentVolume.rightWaitingPV} PV`);
      console.log('\n💡 Tip: Run backfill script to set waiting PV from G1 children ranks');
    }

  } catch (error) {
    console.error('❌ Error in test:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get sponsor memberId from command line
const sponsorMemberId = process.argv[2];

// Run the test
testDailyMatchFlow(sponsorMemberId)
  .then(() => {
    console.log('\n✅ Test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

