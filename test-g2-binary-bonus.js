/**
 * Test script to manually trigger G2 Binary Bonus calculation for ADMIN002
 * 
 * This script will:
 * 1. Find ADMIN002 (President rank)
 * 2. Calculate commissions including G2 Binary Bonus
 * 3. Show the breakdown including G2 bonus
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testG2BinaryBonus() {
  try {
    console.log('🔍 Testing G2 Binary Bonus for ADMIN002...\n');

    // Find ADMIN002
    const admin002 = await prisma.user.findUnique({
      where: { memberId: 'ADMIN002' },
      select: {
        id: true,
        memberId: true,
        rank: true,
        fullName: true
      }
    });

    if (!admin002) {
      console.error('❌ ADMIN002 not found!');
      return;
    }

    console.log(`✅ Found user: ${admin002.fullName} (${admin002.memberId}, ${admin002.rank})`);
    console.log(`   User ID: ${admin002.id}\n`);

    // Get G1 downlines
    const g1Downlines = await prisma.user.findMany({
      where: {
        placementParentId: admin002.id,
        active: true,
        deleted: false
      },
      select: {
        id: true,
        memberId: true,
        rank: true,
        position: true,
        fullName: true
      }
    });

    console.log(`📊 G1 Downlines found: ${g1Downlines.length}`);
    g1Downlines.forEach(g1 => {
      console.log(`   - ${g1.fullName} (${g1.memberId}, ${g1.rank}) - ${g1.position} leg`);
    });
    console.log('');

    // Get G2 downlines (children of G1)
    let totalG2Count = 0;
    for (const g1 of g1Downlines) {
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
          fullName: true
        }
      });

      if (g2Downlines.length > 0) {
        console.log(`📊 G2 Downlines under ${g1.memberId} (${g1.position} leg): ${g2Downlines.length}`);
        g2Downlines.forEach(g2 => {
          console.log(`   - ${g2.fullName} (${g2.memberId}, ${g2.rank}) - ${g2.position} leg`);
          if (g2.rank && g2.rank.trim().toLowerCase() !== 'member') {
            totalG2Count++;
          }
        });
        console.log('');
      }
    }

    console.log(`📊 Total eligible G2 downlines: ${totalG2Count}\n`);

    // Check G2 rates
    const g2Rates = {
      'Manager': 0.01,   // 1% G2
      'Director': 0.03,  // 3% G2
      'President': 0.03, // 3% G2
      'Double President': 0.03 // 3% G2
    };

    const sponsorG2Rate = g2Rates[admin002.rank] || 0;
    console.log(`💰 Sponsor G2 Rate: ${(sponsorG2Rate * 100).toFixed(0)}% (${admin002.rank})\n`);

    // Calculate volume for left and right legs
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const today = new Date();

    // Get left leg volume
    const leftLegG1 = g1Downlines.find(g => g.position?.toLowerCase() === 'left');
    let leftVolume = 0;
    if (leftLegG1) {
      // Calculate volume for left leg subtree
      const leftOrders = await prisma.order.findMany({
        where: {
          userId: leftLegG1.id,
          date: {
            gte: thirtyDaysAgo,
            lte: today
          },
          status: { in: ['Completed', 'Delivered'] }
        },
        include: {
          items: {
            select: { pv: true }
          }
        }
      });

      leftVolume = leftOrders.reduce((sum, order) => {
        const orderPV = order.items.reduce((itemSum, item) => itemSum + (item.pv || 0), 0);
        return sum + orderPV;
      }, 0);

      // Also get G2 volumes
      const leftG2Downlines = await prisma.user.findMany({
        where: {
          placementParentId: leftLegG1.id,
          active: true,
          deleted: false
        },
        select: { id: true }
      });

      for (const g2 of leftG2Downlines) {
        const g2Orders = await prisma.order.findMany({
          where: {
            userId: g2.id,
            date: {
              gte: thirtyDaysAgo,
              lte: today
            },
            status: { in: ['Completed', 'Delivered'] }
          },
          include: {
            items: {
              select: { pv: true }
            }
          }
        });

        const g2PV = g2Orders.reduce((sum, order) => {
          const orderPV = order.items.reduce((itemSum, item) => itemSum + (item.pv || 0), 0);
          return sum + orderPV;
        }, 0);
        leftVolume += g2PV;
      }
    }

    console.log(`📊 Left Leg Volume: ${leftVolume} PV\n`);

    // Calculate expected G2 bonus
    if (sponsorG2Rate > 0 && totalG2Count > 0 && leftVolume > 0) {
      const expectedG2Bonus = Math.round(leftVolume * sponsorG2Rate * totalG2Count * 100) / 100;
      console.log(`💰 Expected G2 Binary Bonus:`);
      console.log(`   Left Volume: ${leftVolume} PV`);
      console.log(`   G2 Rate: ${(sponsorG2Rate * 100).toFixed(0)}%`);
      console.log(`   Eligible G2 Downlines: ${totalG2Count}`);
      console.log(`   Calculation: ${leftVolume} PV × ${(sponsorG2Rate * 100).toFixed(0)}% × ${totalG2Count} = $${expectedG2Bonus.toFixed(2)}\n`);
    }

    // Check existing commissions
    console.log('📋 Checking existing commissions...\n');
    const recentCommissions = await prisma.commission.findMany({
      where: {
        userId: admin002.id,
        type: 'Binary Bonus',
        date: {
          gte: thirtyDaysAgo
        }
      },
      orderBy: {
        date: 'desc'
      },
      take: 5
    });

    console.log(`Found ${recentCommissions.length} recent Binary Bonus commissions:`);
    recentCommissions.forEach((comm, idx) => {
      console.log(`\n${idx + 1}. ${comm.description || 'Binary Bonus'}`);
      console.log(`   Amount: $${comm.amount.toFixed(2)}`);
      console.log(`   Date: ${comm.date.toISOString().split('T')[0]}`);
      console.log(`   Status: ${comm.status}`);
    });

    console.log('\n✅ Test complete!');
    console.log('\n💡 To recalculate commissions with G2 bonus:');
    console.log('   1. Go to Admin → Commissions');
    console.log('   2. Click "Calculate Commissions"');
    console.log('   3. Or use the API: POST /api/commissions/calculate');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testG2BinaryBonus();
