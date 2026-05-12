/**
 * Debug script to check why PV calculation is not working
 */

import { prisma } from '../src/lib/database';
import { PVMatchingService } from '../src/services/pv-matching-service';

async function debugPVCalculation() {
  try {
    console.log('🔍 Debugging PV Calculation...\n');

    // Get the first active user
    const user = await prisma.user.findFirst({
      where: {
        active: true,
        deleted: false
      },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        pv: true
      }
    });

    if (!user) {
      console.log('❌ No active users found');
      return;
    }

    console.log(`📌 Testing for user: ${user.fullName} (${user.memberId})`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Lifetime PV: ${user.pv}\n`);

    // Check current month orders
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    console.log(`📅 Current month start: ${currentMonth.toISOString()}\n`);

    // Check orders for this user
    const userOrders = await prisma.order.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: currentMonth
        }
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
      take: 5
    });

    console.log(`📦 Orders found: ${userOrders.length}`);
    userOrders.forEach((order, idx) => {
      const orderPV = order.items.reduce((sum, item) => {
        return sum + (Number(item.pv) || 0) * (item.quantity || 0);
      }, 0);
      console.log(`   Order ${idx + 1}: Status="${order.status}", PV=${orderPV}, Items=${order.items.length}, Date=${order.createdAt.toISOString()}`);
    });
    console.log('');

    // Check children
    const children = await prisma.user.findMany({
      where: {
        placementParentId: user.id,
        deleted: false,
        active: true
      },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        position: true,
        pv: true
      }
    });

    console.log(`👥 Direct children: ${children.length}`);
    children.forEach((child) => {
      console.log(`   - ${child.fullName} (${child.memberId}): Position=${child.position}, Lifetime PV=${child.pv}`);
    });
    console.log('');

    // Test PV calculation
    console.log('🧮 Calculating Current Period Volume...\n');
    const volumeData = await PVMatchingService.getCurrentPeriodVolume(user.id);

    console.log('✅ Results:');
    console.log(`   Left PV: ${volumeData.leftPV}`);
    console.log(`   Right PV: ${volumeData.rightPV}`);
    console.log(`   Matched PV: ${volumeData.matchedPV}`);
    console.log(`   Left Waiting PV: ${volumeData.leftWaitingPV}`);
    console.log(`   Right Waiting PV: ${volumeData.rightWaitingPV}`);
    console.log(`   Left Total PV: ${volumeData.leftTotalPV}`);
    console.log(`   Right Total PV: ${volumeData.rightTotalPV}`);
    console.log(`   Left Members: ${volumeData.leftMembers}`);
    console.log(`   Right Members: ${volumeData.rightMembers}`);

    // Check left leg manually
    if (children.find(c => c.position === 'left')) {
      const leftChild = children.find(c => c.position === 'left')!;
      console.log(`\n🔍 Checking Left Leg (${leftChild.fullName}):`);
      
      const leftOrders = await prisma.order.findMany({
        where: {
          userId: leftChild.id,
          createdAt: { gte: currentMonth }
        },
        include: {
          items: {
            select: { pv: true, quantity: true }
          }
        }
      });

      const leftPV = leftOrders.reduce((sum, order) => {
        return sum + order.items.reduce((itemSum, item) => {
          return itemSum + (Number(item.pv) || 0) * (item.quantity || 0);
        }, 0);
      }, 0);

      console.log(`   Orders: ${leftOrders.length}, Calculated PV: ${leftPV}`);
    }

    // Check right leg manually
    if (children.find(c => c.position === 'right')) {
      const rightChild = children.find(c => c.position === 'right')!;
      console.log(`\n🔍 Checking Right Leg (${rightChild.fullName}):`);
      
      const rightOrders = await prisma.order.findMany({
        where: {
          userId: rightChild.id,
          createdAt: { gte: currentMonth }
        },
        include: {
          items: {
            select: { pv: true, quantity: true }
          }
        }
      });

      const rightPV = rightOrders.reduce((sum, order) => {
        return sum + order.items.reduce((itemSum, item) => {
          return itemSum + (Number(item.pv) || 0) * (item.quantity || 0);
        }, 0);
      }, 0);

      console.log(`   Orders: ${rightOrders.length}, Calculated PV: ${rightPV}`);
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

debugPVCalculation();

