/**
 * Restore waiting PV to before-match values and trigger daily match
 * This will process the match and pay the commission
 * 
 * Usage: npx tsx scripts/restore-and-trigger-match.ts [sponsorMemberId] [leftPV] [rightPV]
 * Example: npx tsx scripts/restore-and-trigger-match.ts ADMIN002 100 500
 */

import { PrismaClient } from '@prisma/client';
import { checkAndTriggerDailyMatch } from '../src/services/daily-match-trigger';
import { PVMatchingService } from '../src/services/pv-matching-service';

const prisma = new PrismaClient();

async function restoreAndTrigger(sponsorMemberId: string, leftPV: number, rightPV: number) {
  try {
    console.log(`🔄 Restoring waiting PV and triggering match for ${sponsorMemberId}...\n`);

    // Find sponsor
    const sponsor = await prisma.user.findUnique({
      where: { memberId: sponsorMemberId },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        rank: true,
      },
    });

    if (!sponsor) {
      console.error(`❌ Sponsor not found: ${sponsorMemberId}`);
      process.exit(1);
    }

    console.log(`📋 Sponsor: ${sponsor.memberId} (${sponsor.fullName})`);
    console.log(`   Rank: ${sponsor.rank}\n`);

    // Step 1: Restore waiting PV to before-match values
    console.log(`📝 Step 1: Setting waiting PV to before-match values...`);
    console.log(`   Left: ${leftPV} PV`);
    console.log(`   Right: ${rightPV} PV\n`);

    await PVMatchingService.updateWaitingPV(sponsor.id, leftPV, rightPV);

    // Verify
    const waitingPV = await PVMatchingService.getWaitingPV(sponsor.id);
    console.log(`✅ Waiting PV set:`);
    console.log(`   Left: ${waitingPV.leftWaitingPV} PV`);
    console.log(`   Right: ${waitingPV.rightWaitingPV} PV\n`);

    const matchablePV = Math.min(waitingPV.leftWaitingPV, waitingPV.rightWaitingPV);
    console.log(`📊 Matchable PV: ${matchablePV} PV`);
    console.log(`   Potential Commission: $${(matchablePV * 0.08).toFixed(2)} (8%)\n`);

    if (matchablePV <= 0) {
      console.log('⚠️  No matchable PV');
      process.exit(0);
    }

    // Step 2: Trigger daily match
    console.log('🚀 Step 2: Triggering daily match...\n');
    await checkAndTriggerDailyMatch(sponsor.id);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Step 3: Check results
    console.log('📊 Step 3: Checking results...\n');

    const afterWaitingPV = await PVMatchingService.getWaitingPV(sponsor.id);
    console.log(`✅ After Match:`);
    console.log(`   Left Waiting PV: ${afterWaitingPV.leftWaitingPV}`);
    console.log(`   Right Waiting PV: ${afterWaitingPV.rightWaitingPV}\n`);

    // Check commission
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

    console.log('💰 Commission Records:');
    if (commissions.length > 0) {
      const total = commissions.reduce((sum, c) => sum + Number(c.amount), 0);
      commissions.forEach((c, i) => {
        console.log(`   ${i + 1}. Amount: $${c.amount}, Status: ${c.status}`);
      });
      console.log(`   Total: $${total.toFixed(2)}\n`);
    } else {
      console.log('   ⚠️  No commissions found - check logs for errors\n');
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
      console.log('💵 Wallet:');
      console.log(`   Balance: $${wallet.balance}`);
      if (wallet.transactions.length > 0) {
        console.log(`   Daily Match Transactions:`);
        wallet.transactions.forEach((t, i) => {
          console.log(`   ${i + 1}. Amount: $${t.amount}, Status: ${t.status}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get arguments
const sponsorMemberId = process.argv[2];
const leftPV = parseFloat(process.argv[3] || '0');
const rightPV = parseFloat(process.argv[4] || '0');

if (!sponsorMemberId || leftPV <= 0 || rightPV <= 0) {
  console.error('❌ Usage: npx tsx scripts/restore-and-trigger-match.ts [sponsorMemberId] [leftPV] [rightPV]');
  console.error('   Example: npx tsx scripts/restore-and-trigger-match.ts ADMIN002 100 500');
  console.error('   This will set Left=100, Right=500, then trigger match (should result in Left=0, Right=400)');
  process.exit(1);
}

// Run
restoreAndTrigger(sponsorMemberId, leftPV, rightPV)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

