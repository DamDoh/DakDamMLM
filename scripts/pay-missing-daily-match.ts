/**
 * Pay missing daily match bonus for a sponsor who had a match but wasn't paid
 * This calculates what should have been paid based on waiting PV history
 * 
 * Usage: npx tsx scripts/pay-missing-daily-match.ts [sponsorMemberId] [matchedPV]
 * Example: npx tsx scripts/pay-missing-daily-match.ts ADMIN002 100
 */

import { PrismaClient } from '@prisma/client';
import { WalletServiceEnhanced } from '../src/services/wallet-service-enhanced';
import { PVMatchingService } from '../src/services/pv-matching-service';

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

async function payMissingDailyMatch(sponsorMemberId: string, matchedPV: number) {
  try {
    console.log(`💰 Paying missing daily match bonus for ${sponsorMemberId}...\n`);

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

    // Check rank eligibility
    const rule = BONUS_CONFIG[sponsor.rank];
    if (!rule) {
      console.error(`❌ Rank ${sponsor.rank} is not eligible for Daily Match`);
      process.exit(1);
    }

    const rawCommission = Math.round(matchedPV * DAILY_MATCH_RATE * 100) / 100;
    const dailyCapAmount = rule.dailyCapAmount;

    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    const existingCommissions = await prisma.commission.findMany({
      where: {
        userId: sponsor.id,
        type: rule.label,
        date: { gte: startOfDay, lte: endOfDay },
        status: { in: ['Paid', 'Pending'] },
      },
      select: { amount: true },
    });
    const previousAmount = existingCommissions.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const remainingCap = Math.max(0, dailyCapAmount - previousAmount);
    const actualPayout = Math.round(Math.min(rawCommission, remainingCap) * 100) / 100;

    console.log(`📊 Calculation:`);
    console.log(`   Matched PV: ${matchedPV}`);
    console.log(`   Raw Commission: $${rawCommission.toFixed(2)} (8%)`);
    console.log(`   Daily Cap: $${dailyCapAmount}`);
    console.log(`   Previous today: $${previousAmount.toFixed(2)}`);
    console.log(`   Actual Payout: $${actualPayout}\n`);

    if (actualPayout <= 0) {
      console.log('⚠️  No payout (matched PV too low or cap reached)');
      process.exit(0);
    }

    const existingCommission = await prisma.commission.findFirst({
      where: {
        userId: sponsor.id,
        type: 'Daily Match',
        date: { gte: startOfDay, lte: endOfDay },
        status: { in: ['Paid', 'Pending'] },
      },
    });

    if (existingCommission) {
      const existingAmount = Number(existingCommission.amount) || 0;
      if (previousAmount >= actualPayout) {
        console.log(`✅ Already paid today: $${existingAmount.toFixed(2)}`);
        console.log(`   Commission ID: ${existingCommission.id}`);
        process.exit(0);
      } else {
        console.log(`⚠️  Partial payment exists: $${existingAmount.toFixed(2)}`);
        console.log(`   Paying additional: $${(actualPayout - existingAmount).toFixed(2)}\n`);
      }
    }

    const wallet = await prisma.wallet.upsert({
      where: { userId: sponsor.id },
      create: { userId: sponsor.id, balance: 0, currency: 'USD' },
      update: {},
      select: { id: true, balance: true },
    });
    console.log(`💵 Wallet Balance Before: $${wallet.balance}\n`);

    // Credit wallet
    const todayKey = today.toISOString().slice(0, 10);
    const referenceId = `${sponsor.id}:daily_match:${sponsor.rank}:${todayKey}:retroactive`;

    console.log('💳 Crediting wallet...');
    await WalletServiceEnhanced.creditWallet(
      sponsor.id,
      actualPayout,
      rule.label,
      referenceId,
      'daily_match'
    );

    console.log('📝 Creating commission record...');
    const commission = await prisma.commission.create({
      data: {
        userId: sponsor.id,
        amount: actualPayout,
        type: rule.label,
        status: 'Paid',
        date: new Date(),
        description: `Daily Match Bonus - ${matchedPV} PV matched at 8% = $${actualPayout.toFixed(2)}`,
      },
    });

    const waitingPV = await PVMatchingService.getWaitingPV(sponsor.id);
    await PVMatchingService.recordMatchTransaction(sponsor.id, {
      leftPVUsed: matchedPV,
      rightPVUsed: matchedPV,
      matchedPV,
      leftWaitingAfter: waitingPV.leftWaitingPV,
      rightWaitingAfter: waitingPV.rightWaitingPV,
      commissionRate: DAILY_MATCH_RATE,
      commissionEarned: actualPayout,
      triggerType: 'retroactive',
      memberRank: sponsor.rank,
      dailyCapMatches: dailyCapAmount,
      matchesUsed: 1,
    });

    // Check final wallet balance
    const finalWallet = await prisma.wallet.findUnique({
      where: { userId: sponsor.id },
      select: { balance: true },
    });

    console.log(`\n✅ Payment completed!`);
    console.log(`   Commission ID: ${commission.id}`);
    console.log(`   Amount Paid: $${actualPayout}`);
    console.log(`   Wallet Balance After: $${finalWallet?.balance || 0}`);
    console.log(`   Reference ID: ${referenceId}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get arguments
const sponsorMemberId = process.argv[2];
const matchedPV = parseFloat(process.argv[3] || '0');

if (!sponsorMemberId || matchedPV <= 0) {
  console.error('❌ Usage: npx tsx scripts/pay-missing-daily-match.ts [sponsorMemberId] [matchedPV]');
  console.error('   Example: npx tsx scripts/pay-missing-daily-match.ts ADMIN002 100');
  console.error('   This will pay $8 for 100 PV matched (8% of 100 = $8)');
  process.exit(1);
}

// Run
payMissingDailyMatch(sponsorMemberId, matchedPV)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

