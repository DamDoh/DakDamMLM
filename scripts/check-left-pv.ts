/**
 * Check why left PV is not showing
 */

import { prisma } from '../src/lib/database';

async function checkLeftPV() {
  try {
    console.log('🔍 Checking Left PV for MEM001 (RiThy VoNg)...\n');

    // Find the user
    const user = await prisma.user.findFirst({
      where: {
        memberId: 'MEM001',
        active: true,
        deleted: false
      },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        pv: true,
        placementParentId: true,
        position: true
      }
    });

    if (!user) {
      console.log('❌ MEM001 not found');
      return;
    }

    console.log(`✅ Found: ${user.fullName} (${user.memberId})`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Lifetime PV: ${user.pv}`);
    console.log(`   Parent ID: ${user.placementParentId}`);
    console.log(`   Position: ${user.position}\n`);

    // Check ALL orders (not just current month)
    const allOrders = await prisma.order.findMany({
      where: {
        userId: user.id
      },
      include: {
        items: {
          select: {
            pv: true,
            quantity: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    console.log(`📦 Total Orders (all time): ${allOrders.length}`);
    if (allOrders.length > 0) {
      allOrders.forEach((order, idx) => {
        const orderPV = order.items.reduce((sum, item) => {
          return sum + (Number(item.pv) || 0) * (item.quantity || 0);
        }, 0);
        console.log(`\n   Order ${idx + 1}:`);
        console.log(`      Status: ${order.status}`);
        console.log(`      Date: ${order.createdAt.toISOString()}`);
        console.log(`      PV: ${orderPV}`);
        console.log(`      Items: ${order.items.length}`);
        order.items.forEach((item, i) => {
          console.log(`         Item ${i + 1}: PV=${item.pv}, Qty=${item.quantity}`);
        });
      });
    }

    // Check current month orders
    const now = new Date();
    const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    
    console.log(`\n📅 Current Month Start: ${currentMonth.toISOString()}`);
    console.log(`📅 Current Date: ${now.toISOString()}\n`);

    const currentMonthOrders = await prisma.order.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: currentMonth
        },
        status: {
          in: ['Pending', 'Processing', 'Fulfilled', 'COMPLETED', 'Delivered']
        }
      },
      include: {
        items: {
          select: {
            pv: true,
            quantity: true
          }
        }
      }
    });

    console.log(`📦 Current Month Orders: ${currentMonthOrders.length}`);
    if (currentMonthOrders.length > 0) {
      let totalPV = 0;
      currentMonthOrders.forEach((order) => {
        const orderPV = order.items.reduce((sum, item) => {
          return sum + (Number(item.pv) || 0) * (item.quantity || 0);
        }, 0);
        totalPV += orderPV;
        console.log(`   - ${order.status} on ${order.createdAt.toISOString()}: ${orderPV} PV`);
      });
      console.log(`\n✅ Total Current Month PV: ${totalPV}`);
    } else {
      console.log(`   ⚠️  No orders found in current month with matching status`);
      
      // Check what statuses exist
      const allStatuses = await prisma.order.findMany({
        where: {
          userId: user.id,
          createdAt: {
            gte: currentMonth
          }
        },
        select: {
          status: true
        },
        distinct: ['status']
      });

      if (allStatuses.length > 0) {
        console.log(`\n   📋 Found orders with statuses:`);
        allStatuses.forEach(s => console.log(`      - ${s.status}`));
      }
    }

    // Check parent's view
    if (user.placementParentId) {
      console.log(`\n🔍 Checking parent's perspective...`);
      const parent = await prisma.user.findFirst({
        where: {
          id: user.placementParentId
        },
        select: {
          id: true,
          memberId: true,
          fullName: true
        }
      });

      if (parent) {
        console.log(`   Parent: ${parent.fullName} (${parent.memberId})`);
        console.log(`   This user is in the ${user.position} position of parent\n`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkLeftPV();

