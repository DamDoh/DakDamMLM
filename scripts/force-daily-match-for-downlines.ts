/**
 * Script to force Daily Match calculation for downlines and then Matching Bonus for sponsor
 * Usage: npx tsx scripts/force-daily-match-for-downlines.ts MEM001
 */

import { PrismaClient } from '@prisma/client';
import { CommissionCalculationEngineEnhanced } from '../src/services/commission-calculation-engine';

const prisma = new PrismaClient();

// Daily Match bonus configuration
const BONUS_CONFIG: Record<string, any> = {
  Bronze: { label: 'Daily Match', matchCap: 5, perMatchAmount: 4, commissionRate: 0.04 },
  Silver: { label: 'Daily Match', matchCap: 10, perMatchAmount: 8, commissionRate: 0.08 },
  Gold: { label: 'Daily Match', matchCap: 15, perMatchAmount: 12, commissionRate: 0.12 },
  Diamond: { label: 'Daily Match', matchCap: 20, perMatchAmount: 16, commissionRate: 0.16 },
  Manager: { label: 'Daily Match', matchCap: 25, perMatchAmount: 20, commissionRate: 0.20 },
  Director: { label: 'Daily Match', matchCap: 30, perMatchAmount: 24, commissionRate: 0.24 },
  'Vice President': { label: 'Daily Match', matchCap: 35, perMatchAmount: 28, commissionRate: 0.28 },
  President: { label: 'Daily Match', matchCap: 40, perMatchAmount: 32, commissionRate: 0.32 },
};

async function calculateTeamPV(userId: string): Promise<number> {
  const children = await prisma.user.findMany({
    where: {
      placementParentId: userId,
      deleted: false
    },
    select: {
      id: true,
      position: true,
      pv: true
    }
  });

  let totalPV = 0;
  for (const child of children) {
    totalPV += child.pv || 0;
    // Recursively get child's team PV
    totalPV += await calculateTeamPV(child.id);
  }

  return totalPV;
}

async function forceDailyMatchForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      memberId: true,
      fullName: true,
      rank: true,
      children: true,
      isAdmin: true,
      email: true
    }
  });

  if (!user) {
    console.log(`❌ User not found: ${userId}`);
    return null;
  }

  // Check if superadmin
  const { isSuperAdminSync, canEarnCommissions } = await import('../src/lib/superadmin-helper');
  if (isSuperAdminSync(user)) {
    console.log(`⚠️ Cannot calculate Daily Match for superadmin`);
    return null;
  }

  if (!(await canEarnCommissions(user.id))) {
    console.log(`⚠️ User has no downlines - cannot earn Daily Match`);
    return null;
  }

  const rule = BONUS_CONFIG[user.rank];
  if (!rule) {
    console.log(`⚠️ No Daily Match rule for rank: ${user.rank}`);
    return null;
  }

  // Get left and right children
  const children = user.children as any;
  const leftChildId = children?.left;
  const rightChildId = children?.right;

  if (!leftChildId || !rightChildId) {
    console.log(`⚠️ Missing downlines - Left: ${leftChildId ? '✓' : '✗'}, Right: ${rightChildId ? '✓' : '✗'}`);
    return null;
  }

  // Get left and right child PV
  const [leftChild, rightChild] = await Promise.all([
    prisma.user.findUnique({
      where: { id: leftChildId },
      select: { pv: true, rank: true }
    }),
    prisma.user.findUnique({
      where: { id: rightChildId },
      select: { pv: true, rank: true }
    })
  ]);

  if (!leftChild || !rightChild) {
    console.log(`⚠️ Could not find left or right child`);
    return null;
  }

  // Calculate team PV for each leg
  const leftPV = (leftChild.pv || 0) + await calculateTeamPV(leftChildId);
  const rightPV = (rightChild.pv || 0) + await calculateTeamPV(rightChildId);
  const matchedPV = Math.min(leftPV, rightPV);

  if (matchedPV <= 0) {
    console.log(`⚠️ No matching PV (${matchedPV})`);
    return null;
  }

  // Check if already has Daily Match today
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const existingDailyMatch = await prisma.commission.findFirst({
    where: {
      userId: user.id,
      type: 'Daily Match',
      date: {
        gte: startOfDay,
        lte: endOfDay
      },
      status: { in: ['Paid', 'Pending'] }
    }
  });

  if (existingDailyMatch) {
    console.log(`  ✅ Already has Daily Match today: $${existingDailyMatch.amount}`);
    return existingDailyMatch;
  }

  // Calculate commission
  const commissionRate = rule.commissionRate;
  const commission = matchedPV * commissionRate;
  const dailyCapAmount = rule.matchCap * rule.perMatchAmount;
  const totalPayout = Math.min(commission, dailyCapAmount);

  // Create wallet if needed
  await prisma.wallet.upsert({
    where: { userId: user.id },
    create: { userId: user.id, balance: 0, currency: 'USD' },
    update: {}
  });

  // Credit wallet
  const { WalletServiceEnhanced } = await import('../src/services/wallet-service-enhanced');
  await WalletServiceEnhanced.creditWallet(
    user.id,
    totalPayout,
    `Daily Match Bonus (${user.rank})`,
    `${user.id}:daily_match:${user.rank}:${today.toISOString().slice(0, 10)}`,
    'daily_match'
  );

  // Create commission record
  const commissionRecord = await prisma.commission.create({
    data: {
      userId: user.id,
      amount: totalPayout,
      type: rule.label,
      status: 'Paid',
      date: new Date()
    }
  });

  console.log(`  ✅ Created Daily Match: $${totalPayout.toFixed(2)} (${matchedPV} PV matched)`);
  return commissionRecord;
}

async function forceDailyMatchAndMatchingBonus(sponsorMemberId: string) {
  console.log(`🔍 Force Daily Match for downlines and Matching Bonus for: ${sponsorMemberId}...\n`);

  try {
    // Find sponsor
    const sponsor = await prisma.user.findFirst({
      where: {
        OR: [
          { memberId: sponsorMemberId },
          { id: sponsorMemberId }
        ]
      },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        rank: true
      }
    });

    if (!sponsor) {
      console.log(`❌ Sponsor not found: ${sponsorMemberId}`);
      return;
    }

    console.log(`👤 Sponsor: ${sponsor.fullName} (${sponsor.memberId}) - Rank: ${sponsor.rank}\n`);

    // Get direct downlines
    const downlines = await prisma.user.findMany({
      where: {
        placementParentId: sponsor.id,
        deleted: false
      },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        rank: true
      }
    });

    console.log(`📋 Downlines: ${downlines.length}\n`);

    // Force Daily Match for each downline
    for (const downline of downlines) {
      console.log(`🔄 Processing ${downline.fullName} (${downline.memberId})...`);
      await forceDailyMatchForUser(downline.id);
      console.log('');
    }

    // Wait a bit for database to commit
    await new Promise(resolve => setTimeout(resolve, 500));

    // Now calculate Matching Bonus for sponsor
    console.log(`💰 Calculating Matching Bonus for sponsor...\n`);
    
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const matchingBonuses = await CommissionCalculationEngineEnhanced.calculateMatchingBonus(
      sponsor.id,
      thirtyDaysAgo,
      now,
      sponsor.rank
    );

    const validMatchingBonuses = matchingBonuses.filter(b => b.amount > 0);
    
    if (validMatchingBonuses.length === 0) {
      console.log(`⚠️ No Matching Bonus calculated. Checking Daily Match commissions...`);
      
      // Check Daily Match for downlines
      const dailyMatchCheck = await prisma.commission.findMany({
        where: {
          userId: { in: downlines.map(d => d.id) },
          type: 'Daily Match',
          status: 'Paid'
        },
        select: {
          userId: true,
          amount: true,
          date: true
        }
      });
      
      console.log(`📊 Daily Match commissions found: ${dailyMatchCheck.length}`);
      dailyMatchCheck.forEach(c => {
        const downline = downlines.find(d => d.id === c.userId);
        console.log(`  - ${downline?.fullName}: $${c.amount} on ${c.date.toISOString()}`);
      });
      
      return;
    }

    // Create or update Matching Bonus
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const existingMatchingBonus = await prisma.commission.findFirst({
      where: {
        userId: sponsor.id,
        type: 'Matching Bonus',
        date: {
          gte: sevenDaysAgo
        },
        status: { in: ['Paid', 'Pending'] }
      },
      orderBy: { date: 'desc' }
    });

    for (const matchingBonus of validMatchingBonuses) {
      if (!existingMatchingBonus) {
        console.log(`➕ Creating Matching Bonus commission...`);
        const commission = await prisma.commission.create({
          data: {
            userId: sponsor.id,
            amount: matchingBonus.amount,
            type: 'Matching Bonus',
            description: matchingBonus.description,
            status: 'Pending',
            date: new Date(),
            metadata: matchingBonus.metadata as any
          }
        });

        const { CommissionService } = await import('../src/services/commission-service');
        await CommissionService.payCommission(commission.id);

        console.log(`✅ Created Matching Bonus: $${matchingBonus.amount.toFixed(2)}`);
        console.log(`   Description: ${matchingBonus.description}`);
      } else {
        if (Math.abs(matchingBonus.amount - existingMatchingBonus.amount) > 0.01) {
          await prisma.commission.update({
            where: { id: existingMatchingBonus.id },
            data: {
              amount: matchingBonus.amount,
              description: matchingBonus.description
            }
          });
          console.log(`✅ Updated Matching Bonus: $${existingMatchingBonus.amount.toFixed(2)} → $${matchingBonus.amount.toFixed(2)}`);
        } else {
          console.log(`ℹ️ Matching Bonus already exists: $${existingMatchingBonus.amount.toFixed(2)}`);
        }
      }
    }

    console.log(`\n✅ Complete!`);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const memberId = process.argv[2] || 'MEM001';
forceDailyMatchAndMatchingBonus(memberId)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

