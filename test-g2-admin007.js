/**
 * Test script to manually trigger G2 Binary Bonus for ADMIN007
 * Run with: node test-g2-admin007.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testG2BinaryBonus() {
  try {
    console.log('🔍 Testing G2 Binary Bonus for ADMIN007...\n');

    // 1. Get ADMIN007
    const admin007 = await prisma.user.findFirst({
      where: { memberId: 'ADMIN007' },
      select: {
        id: true,
        memberId: true,
        rank: true,
        active: true,
        deleted: true,
        companyId: true
      }
    });

    if (!admin007) {
      console.log('❌ ADMIN007 not found');
      return;
    }

    console.log('📊 ADMIN007 Info:', {
      id: admin007.id,
      memberId: admin007.memberId,
      rank: admin007.rank,
      active: admin007.active,
      deleted: admin007.deleted
    });

    // 2. Get G1 Downlines (children of ADMIN007)
    const g1Downlines = await prisma.user.findMany({
      where: {
        placementParentId: admin007.id,
        active: true,
        deleted: false
      },
      select: {
        id: true,
        memberId: true,
        rank: true,
        position: true,
        pv: true
      }
    });

    console.log('\n📊 G1 Downlines of ADMIN007:', g1Downlines.length);
    for (const g1 of g1Downlines) {
      console.log(`  - ${g1.memberId} (${g1.rank}) - ${g1.position} leg, PV: ${g1.pv}`);
      
      // Get G2 downlines for each G1
      const g2Downlines = await prisma.user.findMany({
        where: {
          placementParentId: g1.id,
          active: true,
          deleted: false
        },
        select: {
          id: true,
          memberId: true,
          rank: true,
          position: true,
          pv: true
        }
      });

      console.log(`    G2 Downlines: ${g2Downlines.length}`);
      for (const g2 of g2Downlines) {
        console.log(`      - ${g2.memberId} (${g2.rank}) - ${g2.position} leg, PV: ${g2.pv}`);
      }
    }

    // 3. Calculate leg volumes
    console.log('\n📊 Calculating Leg Volumes...');
    
    const leftG1 = g1Downlines.find(g => g.position?.toLowerCase() === 'left');
    const rightG1 = g1Downlines.find(g => g.position?.toLowerCase() === 'right');

    // Calculate left leg total volume (recursive)
    async function calculateLegVolume(memberId) {
      let totalPV = 0;
      const descendants = await prisma.user.findMany({
        where: {
          placementParentId: memberId,
          active: true,
          deleted: false
        },
        select: {
          id: true,
          pv: true
        }
      });

      for (const d of descendants) {
        totalPV += Number(d.pv) || 0;
        totalPV += await calculateLegVolume(d.id);
      }
      return totalPV;
    }

    let leftVolume = 0;
    let rightVolume = 0;

    if (leftG1) {
      leftVolume = (Number(leftG1.pv) || 0) + await calculateLegVolume(leftG1.id);
    }
    if (rightG1) {
      rightVolume = (Number(rightG1.pv) || 0) + await calculateLegVolume(rightG1.id);
    }

    console.log(`  Left Leg Volume: ${leftVolume} PV`);
    console.log(`  Right Leg Volume: ${rightVolume} PV`);

    // 4. Calculate expected G2 bonus
    const g2Rates = {
      'Manager': 0.01,
      'Director': 0.03,
      'President': 0.03,
      'Double President': 0.03
    };
    const g1Rates = {
      'Member': 0.05,
      'Bronze': 0.08,
      'Silver': 0.10,
      'Gold': 0.12,
      'Diamond': 0.14,
      'Manager': 0.15,
      'Director': 0.16,
      'President': 0.17,
      'Double President': 0.18
    };

    const sponsorG1Rate = g1Rates[admin007.rank] || 0.05;
    const sponsorG2Rate = g2Rates[admin007.rank] || 0;

    console.log(`\n📊 Commission Rates for ${admin007.rank}:`);
    console.log(`  G1 Rate: ${(sponsorG1Rate * 100).toFixed(0)}%`);
    console.log(`  G2 Rate: ${(sponsorG2Rate * 100).toFixed(0)}%`);

    // Count eligible G2 downlines
    let leftG2Count = 0;
    let rightG2Count = 0;

    if (leftG1) {
      const leftG2 = await prisma.user.findMany({
        where: {
          placementParentId: leftG1.id,
          active: true,
          deleted: false
        },
        select: { rank: true, memberId: true }
      });
      for (const g2 of leftG2) {
        const rank = (g2.rank || '').trim();
        if (rank !== '' && rank.toLowerCase() !== 'member') {
          leftG2Count++;
          console.log(`  ✅ Left G2 Eligible: ${g2.memberId} (${rank})`);
        } else {
          console.log(`  ❌ Left G2 Not Eligible: ${g2.memberId} (${rank})`);
        }
      }
    }

    if (rightG1) {
      const rightG2 = await prisma.user.findMany({
        where: {
          placementParentId: rightG1.id,
          active: true,
          deleted: false
        },
        select: { rank: true, memberId: true }
      });
      for (const g2 of rightG2) {
        const rank = (g2.rank || '').trim();
        if (rank !== '' && rank.toLowerCase() !== 'member') {
          rightG2Count++;
          console.log(`  ✅ Right G2 Eligible: ${g2.memberId} (${rank})`);
        } else {
          console.log(`  ❌ Right G2 Not Eligible: ${g2.memberId} (${rank})`);
        }
      }
    }

    // 5. Calculate expected bonuses
    console.log('\n📊 Expected Binary Bonus Calculation:');
    
    const leftG1Bonus = leftVolume * sponsorG1Rate;
    const leftG2Bonus = leftVolume * sponsorG2Rate * leftG2Count;
    const leftTotal = leftG1Bonus + leftG2Bonus;

    const rightG1Bonus = rightVolume * sponsorG1Rate;
    const rightG2Bonus = rightVolume * sponsorG2Rate * rightG2Count;
    const rightTotal = rightG1Bonus + rightG2Bonus;

    console.log('  Left Leg:');
    console.log(`    G1 Bonus: ${leftVolume} PV × ${(sponsorG1Rate * 100).toFixed(0)}% = $${leftG1Bonus.toFixed(2)}`);
    console.log(`    G2 Bonus: ${leftVolume} PV × ${(sponsorG2Rate * 100).toFixed(0)}% × ${leftG2Count} = $${leftG2Bonus.toFixed(2)}`);
    console.log(`    Total: $${leftTotal.toFixed(2)}`);
    
    console.log('  Right Leg:');
    console.log(`    G1 Bonus: ${rightVolume} PV × ${(sponsorG1Rate * 100).toFixed(0)}% = $${rightG1Bonus.toFixed(2)}`);
    console.log(`    G2 Bonus: ${rightVolume} PV × ${(sponsorG2Rate * 100).toFixed(0)}% × ${rightG2Count} = $${rightG2Bonus.toFixed(2)}`);
    console.log(`    Total: $${rightTotal.toFixed(2)}`);

    console.log(`\n  💰 TOTAL EXPECTED BINARY BONUS: $${(leftTotal + rightTotal).toFixed(2)}`);
    console.log(`     (G1: $${(leftG1Bonus + rightG1Bonus).toFixed(2)} + G2: $${(leftG2Bonus + rightG2Bonus).toFixed(2)})`);

    // 6. Get existing commissions for comparison
    const existingCommissions = await prisma.commission.findMany({
      where: {
        userId: admin007.id,
        type: 'Binary Bonus'
      },
      orderBy: { date: 'desc' },
      take: 10
    });

    console.log('\n📊 Existing Binary Bonus Commissions:');
    if (existingCommissions.length === 0) {
      console.log('  No Binary Bonus commissions found');
    } else {
      for (const comm of existingCommissions) {
        console.log(`  - $${comm.amount} on ${comm.date.toISOString().split('T')[0]} - ${comm.description || 'No description'}`);
      }
    }

    // 7. Ask if user wants to create G2 bonus
    console.log('\n🔄 Creating G2 Binary Bonus if missing...');

    // Check if G2 bonus exists today
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    const existingG2Today = await prisma.commission.findFirst({
      where: {
        userId: admin007.id,
        type: 'Binary Bonus',
        date: {
          gte: todayStart,
          lte: todayEnd
        },
        description: {
          contains: 'G2'
        }
      }
    });

    if (existingG2Today) {
      console.log('  ℹ️ G2 Binary Bonus already exists today:', existingG2Today.amount);
    } else if (leftG2Bonus > 0 || rightG2Bonus > 0) {
      const totalG2Bonus = leftG2Bonus + rightG2Bonus;
      
      // Create G2 commission
      const newCommission = await prisma.commission.create({
        data: {
          userId: admin007.id,
          type: 'Binary Bonus',
          amount: totalG2Bonus,
          status: 'Paid',
          date: new Date(),
          description: `G2 Binary Bonus: $${totalG2Bonus.toFixed(2)} (${(sponsorG2Rate * 100).toFixed(0)}% × ${leftG2Count + rightG2Count} G2 downline(s))`,
          companyId: admin007.companyId || undefined
        }
      });

      // Add to wallet (find or create wallet for user)
      let wallet = await prisma.wallet.findUnique({
        where: { userId: admin007.id }
      });

      if (!wallet) {
        wallet = await prisma.wallet.create({
          data: {
            userId: admin007.id,
            balance: 0,
            companyId: admin007.companyId || undefined
          }
        });
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + totalG2Bonus;

      await prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: balanceAfter
        }
      });

      // Create wallet transaction
      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'Commission',
          amount: totalG2Bonus,
          balanceBefore,
          balanceAfter,
          description: 'G2 Binary Bonus - Test script',
          referenceId: newCommission.id,
          referenceType: 'commission',
          companyId: admin007.companyId || undefined
        }
      });

      console.log(`  ✅ Created G2 Binary Bonus: $${totalG2Bonus.toFixed(2)}`);
      console.log(`  📋 Commission ID: ${newCommission.id}`);
      console.log(`  💰 Wallet balance: $${balanceBefore.toFixed(2)} → $${balanceAfter.toFixed(2)}`);
    } else {
      console.log('  ⚠️ No G2 bonus to create (no eligible G2 downlines or no volume)');
    }

    console.log('\n✅ Test complete!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testG2BinaryBonus();
