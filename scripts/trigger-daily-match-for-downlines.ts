/**
 * Script to trigger Daily Match for downlines and then calculate Matching Bonus for sponsor
 * Usage: npx tsx scripts/trigger-daily-match-for-downlines.ts MEM001
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function triggerDailyMatchForDownlines(sponsorMemberId: string) {
  console.log(`🔍 Triggering Daily Match for downlines of: ${sponsorMemberId}...\n`);

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
        fullName: true
      }
    });

    if (!sponsor) {
      console.log(`❌ Sponsor not found: ${sponsorMemberId}`);
      return;
    }

    console.log(`👤 Sponsor: ${sponsor.fullName} (${sponsor.memberId})`);

    // Get all downlines
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

    console.log(`\n📋 Downlines found: ${downlines.length}`);
    
    if (downlines.length === 0) {
      console.log(`⚠️ No downlines found. Cannot calculate Matching Bonus.`);
      return;
    }

    // For each downline, trigger Daily Match by calling the API
    console.log(`\n🔄 Triggering Daily Match for downlines...\n`);
    
    for (const downline of downlines) {
      console.log(`Processing: ${downline.fullName} (${downline.memberId})...`);
      
      try {
        // Check if they already have Daily Match today
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));
        
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
          console.log(`  ⚠️ No Daily Match found - they need to meet Daily Match requirements first.`);
          console.log(`     Requirements:`);
          console.log(`     - Must be Bronze rank or above (current: ${downline.rank})`);
          console.log(`     - Must have left and right downlines`);
          console.log(`     - Must have matching PV in both legs`);
        }
      } catch (error) {
        console.log(`  ❌ Error checking Daily Match:`, error);
      }
    }

    // Now try to calculate Matching Bonus for sponsor
    console.log(`\n💰 Calculating Matching Bonus for sponsor...`);
    
    // Import the calculation engine
    const { CommissionCalculationEngineEnhanced } = await import('../src/services/commission-calculation-engine');
    
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get sponsor's rank
    const sponsorData = await prisma.user.findUnique({
      where: { id: sponsor.id },
      select: { rank: true }
    });

    if (!sponsorData) {
      console.log(`❌ Could not find sponsor data`);
      return;
    }

    const matchingBonuses = await CommissionCalculationEngineEnhanced.calculateMatchingBonus(
      sponsor.id,
      thirtyDaysAgo,
      now,
      sponsorData.rank
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
      console.log(`\n⚠️ No Matching Bonus calculated. This is because:`);
      console.log(`   1. Downlines don't have Daily Match commissions yet, OR`);
      console.log(`   2. Downlines don't meet Daily Match requirements (need left + right downlines with matching PV)`);
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

        console.log(`✅ Created Matching Bonus: $${matchingBonus.amount} - ${matchingBonus.description}`);
      } else {
        console.log(`ℹ️ Matching Bonus already exists: $${existingMatchingBonus.amount}`);
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
triggerDailyMatchForDownlines(memberId)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

