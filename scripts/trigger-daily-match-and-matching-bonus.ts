/**
 * Script to trigger Daily Match for downlines and Matching Bonus for sponsor
 * Usage: npx tsx scripts/trigger-daily-match-and-matching-bonus.ts MEM001
 */

import { PrismaClient } from '@prisma/client';
import { CommissionCalculationEngineEnhanced } from '../src/services/commission-calculation-engine';

const prisma = new PrismaClient();

async function triggerDailyMatchAndMatchingBonus(sponsorMemberId: string) {
  console.log(`🔍 Triggering Daily Match for downlines and Matching Bonus for: ${sponsorMemberId}...\n`);

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
        rank: true,
        email: true,
        password: true
      }
    });

    if (!sponsor) {
      console.log(`❌ Sponsor not found: ${sponsorMemberId}`);
      return;
    }

    console.log(`👤 Sponsor: ${sponsor.fullName} (${sponsor.memberId}) - Rank: ${sponsor.rank}`);

    // Get all direct downlines (G1)
    const downlines = await prisma.user.findMany({
      where: {
        placementParentId: sponsor.id,
        deleted: false
      },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        rank: true,
        email: true,
        password: true,
        children: true,
        pv: true
      }
    });

    console.log(`\n📋 Direct Downlines (G1): ${downlines.length}`);
    
    if (downlines.length === 0) {
      console.log(`⚠️ No downlines found. Cannot calculate Matching Bonus.`);
      return;
    }

    // For each downline, check if they can earn Daily Match and trigger it
    console.log(`\n🔄 Checking and triggering Daily Match for downlines...\n`);
    
    for (const downline of downlines) {
      console.log(`Processing: ${downline.fullName} (${downline.memberId})...`);
      
      const children = downline.children as any;
      const leftChildId = children?.left;
      const rightChildId = children?.right;
      
      // Check if they have both left and right downlines
      if (!leftChildId || !rightChildId) {
        console.log(`  ⚠️ Missing downlines - Left: ${leftChildId ? '✓' : '✗'}, Right: ${rightChildId ? '✓' : '✗'}`);
        continue;
      }

      // Get left and right child PV
      const [leftChild, rightChild] = await Promise.all([
        leftChildId ? prisma.user.findUnique({
          where: { id: leftChildId },
          select: { pv: true, rank: true }
        }) : null,
        rightChildId ? prisma.user.findUnique({
          where: { id: rightChildId },
          select: { pv: true, rank: true }
        }) : null
      ]);

      const leftPV = leftChild?.pv || 0;
      const rightPV = rightChild?.pv || 0;
      const matchedPV = Math.min(leftPV, rightPV);

      console.log(`  📊 Left PV: ${leftPV}, Right PV: ${rightPV}, Matched PV: ${matchedPV}`);

      // Check if they already have Daily Match today
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      
      const existingDailyMatch = await prisma.commission.findFirst({
        where: {
          userId: downline.id,
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
      } else {
        if (matchedPV <= 0) {
          console.log(`  ⚠️ No matching PV (${matchedPV}) - cannot earn Daily Match`);
          console.log(`     Tip: Add PV to left and right downlines to enable Daily Match`);
        } else if (downline.rank === 'Member') {
          console.log(`  ⚠️ Rank is 'Member' - must be Bronze or above to earn Daily Match`);
        } else {
          console.log(`  💡 Has matching PV (${matchedPV}) and rank ${downline.rank} - should be able to earn Daily Match`);
          console.log(`     Daily Match will be calculated automatically when they visit the genealogy page`);
          console.log(`     Or you can manually trigger it by calling POST /api/bonus/daily-match as that user`);
        }
      }
    }

    // Now calculate Matching Bonus for sponsor
    console.log(`\n💰 Calculating Matching Bonus for sponsor (${sponsor.fullName})...`);
    
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const matchingBonuses = await CommissionCalculationEngineEnhanced.calculateMatchingBonus(
      sponsor.id,
      thirtyDaysAgo,
      now,
      sponsor.rank
    );

    console.log(`\n💰 Matching Bonus Results:`, {
      count: matchingBonuses.length,
      bonuses: matchingBonuses.map(b => ({
        amount: b.amount,
        description: b.description
      }))
    });

    const validMatchingBonuses = matchingBonuses.filter(b => b.amount > 0);
    if (validMatchingBonuses.length === 0) {
      console.log(`\n⚠️ No Matching Bonus calculated. Reasons:`);
      console.log(`   1. Downlines don't have Daily Match commissions yet`);
      console.log(`   2. Downlines need matching PV in both legs to earn Daily Match`);
      console.log(`   3. Once downlines earn Daily Match, Matching Bonus will be calculated automatically`);
      return;
    }

    // Create or update Matching Bonus commission
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
      orderBy: {
        date: 'desc'
      }
    });

    for (const matchingBonus of validMatchingBonuses) {
      if (!existingMatchingBonus) {
        console.log(`\n➕ Creating Matching Bonus commission...`);
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

        // Pay commission
        const { CommissionService } = await import('../src/services/commission-service');
        await CommissionService.payCommission(commission.id);

        console.log(`✅ Created Matching Bonus: $${matchingBonus.amount.toFixed(2)}`);
        console.log(`   Description: ${matchingBonus.description}`);
      } else {
        if (Math.abs(matchingBonus.amount - existingMatchingBonus.amount) > 0.01) {
          console.log(`\n🔄 Updating Matching Bonus commission...`);
          await prisma.commission.update({
            where: { id: existingMatchingBonus.id },
            data: {
              amount: matchingBonus.amount,
              description: matchingBonus.description
            }
          });
          console.log(`✅ Updated: $${existingMatchingBonus.amount.toFixed(2)} → $${matchingBonus.amount.toFixed(2)}`);
        } else {
          console.log(`\nℹ️ Matching Bonus already exists: $${existingMatchingBonus.amount.toFixed(2)}`);
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
triggerDailyMatchAndMatchingBonus(memberId)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

