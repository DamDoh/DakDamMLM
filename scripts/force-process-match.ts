/**
 * Force process daily match for RiThy VoNg
 * This bypasses maintenance checks for testing
 * 
 * Usage: npx tsx scripts/force-process-match.ts
 */

import { PrismaClient } from '@prisma/client';
import { PVMatchingService } from '../src/services/pv-matching-service';
import { WalletServiceEnhanced } from '../src/services/wallet-service-enhanced';

const prisma = new PrismaClient();

const DAILY_MATCH_RATE = 0.08;

const BONUS_CONFIG: Record<string, { dailyCapAmount: number; label: string }> = {
  Bronze: { dailyCapAmount: 8, label: 'Daily Match' },
  Silver: { dailyCapAmount: 80, label: 'Daily Match' },
  Gold: { dailyCapAmount: 320, label: 'Daily Match' },
  Diamond: { dailyCapAmount: 640, label: 'Daily Match' },
  Manager: { dailyCapAmount: 800, label: 'Daily Match' },
  Director: { dailyCapAmount: 928, label: 'Daily Match' },
  President: { dailyCapAmount: 1120, label: 'Daily Match' },
  'Double President': { dailyCapAmount: 1600, label: 'Daily Match' },
};

async function forceProcessMatch() {
  try {
    console.log('🚀 Force processing daily match for RiThy VoNg...\n');

    // Find RiThy VoNg
    const rithy = await prisma.user.findUnique({
      where: { memberId: 'ADMIN002' },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        rank: true,
      },
    });

    if (!rithy) {
      console.error('❌ RiThy VoNg (ADMIN002) not found');
      process.exit(1);
    }

    console.log(`📋 Sponsor: ${rithy.memberId} (${rithy.fullName})`);
    console.log(`   Rank: ${rithy.rank}\n`);

    // Get current waiting PV
    const waitingPV = await PVMatchingService.getWaitingPV(rithy.id);
    console.log(`📊 Current Waiting PV:`);
    console.log(`   Left: ${waitingPV.leftWaitingPV} PV`);
    console.log(`   Right: ${waitingPV.rightWaitingPV} PV\n`);

    const matchedPV = Math.min(waitingPV.leftWaitingPV, waitingPV.rightWaitingPV);
    
    if (matchedPV <= 0) {
      console.log('⚠️  No matchable PV');
      process.exit(0);
    }

    console.log(`✅ Matchable PV: ${matchedPV} PV\n`);

    // Calculate commission
    const rule = BONUS_CONFIG[rithy.rank];
    if (!rule) {
      console.error(`❌ Rank ${rithy.rank} not eligible`);
      process.exit(1);
    }

    const rawCommission = Math.round(matchedPV * DAILY_MATCH_RATE * 100) / 100;
    const dailyCapAmount = rule.dailyCapAmount;
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    const existing = await prisma.commission.findMany({
      where: {
        userId: rithy.id,
        type: rule.label,
        date: { gte: startOfDay, lte: endOfDay },
        status: { in: ['Paid', 'Pending'] },
      },
      select: { amount: true },
    });
    const previousAmount = existing.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const remainingCap = Math.max(0, dailyCapAmount - previousAmount);
    const actualPayout = Math.round(Math.min(rawCommission, remainingCap) * 100) / 100;

    console.log(`💰 Commission Calculation:`);
    console.log(`   Matched PV: ${matchedPV}`);
    console.log(`   Raw Commission: $${rawCommission.toFixed(2)} (8%)`);
    console.log(`   Daily Cap: $${dailyCapAmount}`);
    console.log(`   Previous today: $${previousAmount.toFixed(2)}`);
    console.log(`   Actual Payout: $${actualPayout}\n`);

    // Calculate new waiting PV
    let leftAfterMatch: number;
    let rightAfterMatch: number;

    if (waitingPV.leftWaitingPV > waitingPV.rightWaitingPV) {
      leftAfterMatch = waitingPV.leftWaitingPV - waitingPV.rightWaitingPV;
      rightAfterMatch = 0;
    } else if (waitingPV.rightWaitingPV > waitingPV.leftWaitingPV) {
      leftAfterMatch = 0;
      rightAfterMatch = waitingPV.rightWaitingPV - waitingPV.leftWaitingPV;
    } else {
      leftAfterMatch = 0;
      rightAfterMatch = 0;
    }

    console.log(`📝 New Waiting PV After Match:`);
    console.log(`   Left: ${leftAfterMatch} PV`);
    console.log(`   Right: ${rightAfterMatch} PV\n`);

    // Update waiting PV FIRST
    console.log('💾 Updating waiting PV...');
    await PVMatchingService.updateWaitingPV(rithy.id, leftAfterMatch, rightAfterMatch);

    // Record transaction
    console.log('📝 Recording match transaction...');
    await PVMatchingService.recordMatchTransaction(rithy.id, {
      leftPVUsed: matchedPV,
      rightPVUsed: matchedPV,
      matchedPV,
      leftWaitingAfter: leftAfterMatch,
      rightWaitingAfter: rightAfterMatch,
      commissionRate: DAILY_MATCH_RATE,
      commissionEarned: actualPayout,
      triggerType: 'force',
      memberRank: rithy.rank,
      dailyCapMatches: dailyCapAmount,
      matchesUsed: actualPayout > 0 ? 1 : 0,
    });

    const todayKey = new Date().toISOString().slice(0, 10);
    const referenceId = `${rithy.id}:daily_match:${rithy.rank}:${todayKey}:force`;

    let commission: { id: string } | null = null;
    if (actualPayout > 0) {
      console.log('💳 Crediting wallet...');
      await WalletServiceEnhanced.creditWallet(
        rithy.id,
        actualPayout,
        rule.label,
        referenceId,
        'daily_match'
      );
      console.log('📋 Creating commission record...');
      commission = await prisma.commission.create({
        data: {
          userId: rithy.id,
          amount: actualPayout,
          type: rule.label,
          status: 'Paid',
          date: new Date(),
          description: `Daily Match Bonus - ${matchedPV} PV matched at 8% = $${actualPayout.toFixed(2)}`,
        },
      });
    }

    // Verify
    const finalWaitingPV = await PVMatchingService.getWaitingPV(rithy.id);
    const wallet = await prisma.wallet.findUnique({
      where: { userId: rithy.id },
      select: { balance: true },
    });

    console.log(`\n✅ Match processed successfully!`);
    console.log(`\n📊 Final State:`);
    console.log(`   Left Waiting PV: ${finalWaitingPV.leftWaitingPV} PV`);
    console.log(`   Right Waiting PV: ${finalWaitingPV.rightWaitingPV} PV`);
    console.log(`   Commission Paid: $${actualPayout}`);
    console.log(`   Wallet Balance: $${wallet?.balance ?? 0}`);
    if (commission) console.log(`   Commission ID: ${commission.id}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run
forceProcessMatch()
  .then(() => {
    console.log('\n✅ Done! Refresh your browser to see updated values.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

