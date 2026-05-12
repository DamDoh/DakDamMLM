/**
 * Manually trigger daily match for a sponsor who has matching PV
 * This will process the match and pay the commission
 * 
 * Usage: npx tsx scripts/trigger-daily-match-now.ts [sponsorMemberId]
 */

import { PrismaClient } from '@prisma/client';
import { checkAndTriggerDailyMatch } from '../src/services/daily-match-trigger';
import { PVMatchingService } from '../src/services/pv-matching-service';

const prisma = new PrismaClient();

async function triggerDailyMatch(sponsorMemberId: string) {
  try {
    console.log(`🚀 Triggering Daily Match for ${sponsorMemberId}...\n`);

    // Find sponsor
    const sponsor = await prisma.user.findUnique({
      where: { memberId: sponsorMemberId },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        rank: true,
        active: true,
        deleted: true,
      },
    });

    if (!sponsor) {
      console.error(`❌ Sponsor not found: ${sponsorMemberId}`);
      process.exit(1);
    }

    if (!sponsor.active || sponsor.deleted) {
      console.error(`❌ Sponsor is not active or deleted`);
      process.exit(1);
    }

    console.log(`📋 Sponsor: ${sponsor.memberId} (${sponsor.fullName})`);
    console.log(`   Rank: ${sponsor.rank}\n`);

    // Check current waiting PV
    const waitingPV = await PVMatchingService.getWaitingPV(sponsor.id);
    console.log(`📊 Current Waiting PV:`);
    console.log(`   Left: ${waitingPV.leftWaitingPV} PV`);
    console.log(`   Right: ${waitingPV.rightWaitingPV} PV`);
    
    const matchablePV = Math.min(waitingPV.leftWaitingPV, waitingPV.rightWaitingPV);
    console.log(`   Matchable: ${matchablePV} PV\n`);

    if (matchablePV <= 0) {
      console.log('⚠️  No matchable PV (both legs need PV > 0)');
      console.log('   Tip: Add members to both legs or set waiting PV manually');
      process.exit(0);
    }

    // Check if already paid today
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const existingCommission = await prisma.commission.findFirst({
      where: {
        userId: sponsor.id,
        type: 'Daily Match',
        date: { gte: startOfDay, lte: endOfDay },
        status: { in: ['Paid', 'Pending'] },
      },
    });

    if (existingCommission) {
      console.log(`⚠️  Already paid today: $${existingCommission.amount}`);
      console.log(`   Commission ID: ${existingCommission.id}`);
      console.log(`   Date: ${existingCommission.date}`);
    } else {
      console.log('✅ No payment today - triggering daily match...\n');
    }

    // Trigger daily match
    console.log('🔄 Calling checkAndTriggerDailyMatch...\n');
    await checkAndTriggerDailyMatch(sponsor.id);

    // Wait a bit for async operations
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check results
    const afterWaitingPV = await PVMatchingService.getWaitingPV(sponsor.id);
    console.log(`📊 After Daily Match:`);
    console.log(`   Left Waiting PV: ${afterWaitingPV.leftWaitingPV}`);
    console.log(`   Right Waiting PV: ${afterWaitingPV.rightWaitingPV}\n`);

    // Check commission records
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

    // Check wallet
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
      console.log(`\n💵 Wallet:`);
      console.log(`   Balance: $${wallet.balance}`);
      console.log(`   Recent Daily Match Transactions:`);
      if (wallet.transactions.length > 0) {
        wallet.transactions.forEach((t, i) => {
          console.log(`   ${i + 1}. Amount: $${t.amount}, Type: ${t.type}, Status: ${t.status}`);
        });
      } else {
        console.log('   No transactions found');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get sponsor memberId from command line
const sponsorMemberId = process.argv[2];

if (!sponsorMemberId) {
  console.error('❌ Usage: npx tsx scripts/trigger-daily-match-now.ts [sponsorMemberId]');
  console.error('   Example: npx tsx scripts/trigger-daily-match-now.ts ADMIN002');
  process.exit(1);
}

// Run the trigger
triggerDailyMatch(sponsorMemberId)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

