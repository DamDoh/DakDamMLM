/**
 * Script to check and fix Matching Bonus for a specific member
 * Usage: npx tsx scripts/check-and-fix-matching-bonus.ts MEM001
 */

import { PrismaClient } from '@prisma/client';
import { isSuperAdmin, canEarnCommissions } from '../src/lib/superadmin-helper';
import { CommissionCalculationEngineEnhanced } from '../src/services/commission-calculation-engine';

const prisma = new PrismaClient();

async function checkAndFixMatchingBonus(memberIdOrCode: string) {
  console.log(`🔍 Checking Matching Bonus for member: ${memberIdOrCode}...\n`);

  try {
    // Find the member by memberId or email
    const member = await prisma.user.findFirst({
      where: {
        OR: [
          { memberId: memberIdOrCode },
          { id: memberIdOrCode },
          { email: memberIdOrCode }
        ]
      },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        email: true,
        rank: true,
        isAdmin: true,
        active: true,
        deleted: true,
        placementParentId: true,
        children: true
      }
    });

    if (!member) {
      console.log(`❌ Member not found: ${memberIdOrCode}`);
      return;
    }

    console.log(`👤 Member found:`, {
      id: member.id,
      memberId: member.memberId,
      name: member.fullName,
      email: member.email,
      rank: member.rank,
      isAdmin: member.isAdmin
    });

    // Check if superadmin
    const isSuperadmin = await isSuperAdmin(member.id);
    console.log(`\n🔐 Is Superadmin: ${isSuperadmin}`);
    if (isSuperadmin) {
      console.log(`❌ Superadmin cannot earn Matching Bonus`);
      return;
    }

    // Check if has downlines via placementParentId
    const downlinesViaPlacement = await prisma.user.count({
      where: {
        placementParentId: member.id,
        deleted: false
      }
    });
    console.log(`\n📊 Downlines via placementParentId: ${downlinesViaPlacement}`);

    // Check if has downlines via children JSON
    const children = member.children as any;
    const leftChildId = children?.left;
    const rightChildId = children?.right;
    const hasChildren = !!(leftChildId || rightChildId);
    console.log(`📊 Has children in JSON: ${hasChildren} (left: ${leftChildId || 'none'}, right: ${rightChildId || 'none'})`);

    // Check canEarnCommissions
    const canEarn = await canEarnCommissions(member.id);
    console.log(`\n💰 Can Earn Commissions: ${canEarn}`);

    // Get all downlines (using getAllDownlinesWithGenerations logic)
    const allDownlines = await prisma.user.findMany({
      where: {
        placementParentId: member.id,
        deleted: false
      },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        rank: true
      }
    });

    console.log(`\n📋 Direct Downlines (G1):`, allDownlines.map(d => ({
      id: d.id,
      memberId: d.memberId,
      name: d.fullName,
      rank: d.rank
    })));

    // Check if downlines have Daily Match commissions
    if (allDownlines.length === 0) {
      console.log(`\n⚠️ No downlines found. Matching Bonus cannot be calculated.`);
      return;
    }

    const downlineIds = allDownlines.map(d => d.id);
    const dailyMatchCommissions = await prisma.commission.findMany({
      where: {
        userId: { in: downlineIds },
        type: 'Daily Match',
        status: 'Paid'
      },
      select: {
        id: true,
        userId: true,
        amount: true,
        date: true
      },
      orderBy: {
        date: 'desc'
      },
      take: 100
    });

    console.log(`\n📊 Daily Match Commissions from downlines:`, {
      count: dailyMatchCommissions.length,
      commissions: dailyMatchCommissions.map(c => ({
        userId: c.userId,
        amount: c.amount,
        date: c.date.toISOString()
      }))
    });

    if (dailyMatchCommissions.length === 0) {
      console.log(`\n⚠️ No Daily Match commissions found for downlines. Matching Bonus requires downlines to have earned Daily Match.`);
      return;
    }

    // Calculate Matching Bonus
    console.log(`\n🔄 Calculating Matching Bonus for ${member.fullName}...`);
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const matchingBonuses = await CommissionCalculationEngineEnhanced.calculateMatchingBonus(
      member.id,
      thirtyDaysAgo,
      now,
      member.rank
    );

    console.log(`\n💰 Matching Bonus Results:`, {
      count: matchingBonuses.length,
      bonuses: matchingBonuses.map(b => ({
        amount: b.amount,
        description: b.description,
        metadata: b.metadata
      }))
    });

    const validMatchingBonuses = matchingBonuses.filter(b => b.amount > 0);
    if (validMatchingBonuses.length === 0) {
      console.log(`\n⚠️ No valid Matching Bonus calculated (all amounts are 0 or empty)`);
      return;
    }

    // Check if Matching Bonus commission already exists
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const existingMatchingBonus = await prisma.commission.findFirst({
      where: {
        userId: member.id,
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

    if (existingMatchingBonus) {
      console.log(`\nℹ️ Matching Bonus commission already exists:`, {
        id: existingMatchingBonus.id,
        amount: existingMatchingBonus.amount,
        status: existingMatchingBonus.status,
        date: existingMatchingBonus.date.toISOString()
      });
      
      // Update if amount changed
      for (const matchingBonus of validMatchingBonuses) {
        if (Math.abs(matchingBonus.amount - existingMatchingBonus.amount) > 0.01) {
          console.log(`\n🔄 Updating Matching Bonus commission...`);
          await prisma.commission.update({
            where: { id: existingMatchingBonus.id },
            data: {
              amount: matchingBonus.amount,
              description: matchingBonus.description
            }
          });
          console.log(`✅ Updated: $${existingMatchingBonus.amount} → $${matchingBonus.amount}`);
        }
      }
    } else {
      // Create new Matching Bonus commission
      console.log(`\n➕ Creating new Matching Bonus commission...`);
      for (const matchingBonus of validMatchingBonuses) {
        const matchingBonusCommission = await prisma.commission.create({
          data: {
            userId: member.id,
            amount: matchingBonus.amount,
            type: 'Matching Bonus',
            description: matchingBonus.description,
            status: 'Pending',
            date: new Date(),
            metadata: matchingBonus.metadata as any
          }
        });

        // Pay commission immediately
        const { CommissionService } = await import('../src/services/commission-service');
        await CommissionService.payCommission(matchingBonusCommission.id);

        console.log(`✅ Created Matching Bonus commission:`, {
          id: matchingBonusCommission.id,
          amount: matchingBonus.amount,
          description: matchingBonus.description,
          status: 'Paid'
        });
      }
    }

    console.log(`\n✅ Matching Bonus check and fix complete!`);
  } catch (error) {
    console.error('❌ Error checking/fixing Matching Bonus:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get member ID from command line args
const memberId = process.argv[2] || 'MEM001';
checkAndFixMatchingBonus(memberId)
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

