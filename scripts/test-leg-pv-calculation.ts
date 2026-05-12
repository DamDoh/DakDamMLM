/**
 * Test script to verify leg PV calculation includes all members
 * Usage: npx tsx scripts/test-leg-pv-calculation.ts USER_ID
 */

import { PrismaClient } from '@prisma/client';
import { PVMatchingService } from '../src/services/pv-matching-service';

const prisma = new PrismaClient();

async function main() {
  const userId = process.argv[2];
  
  if (!userId) {
    console.log('Usage: npx tsx scripts/test-leg-pv-calculation.ts USER_ID');
    process.exit(1);
  }

  console.log(`🔍 Testing leg PV calculation for user: ${userId}\n`);

  try {
    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        children: true
      }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log(`👤 User: ${user.fullName} (${user.memberId})\n`);

    // Calculate leg PV
    const [leftLegPV, rightLegPV] = await Promise.all([
      PVMatchingService.calculateLegPV(userId, 'left'),
      PVMatchingService.calculateLegPV(userId, 'right')
    ]);

    console.log(`📊 Leg PV Calculation:`);
    console.log(`   Left Leg PV: ${leftLegPV}`);
    console.log(`   Right Leg PV: ${rightLegPV}\n`);

    // Get waiting PV from database
    const carryForward = await PVMatchingService.getCarryForwardWaitingPV(userId);
    console.log(`💾 Database Waiting PV:`);
    console.log(`   Left Waiting PV: ${carryForward.leftWaitingPV}`);
    console.log(`   Right Waiting PV: ${carryForward.rightWaitingPV}\n`);

    // Calculate waiting PV (as per current formula)
    const leftWaitingAfterMatch = Math.max(0, leftLegPV - rightLegPV);
    const rightWaitingAfterMatch = Math.max(0, rightLegPV - leftLegPV);

    console.log(`✅ Calculated Waiting PV (display):`);
    console.log(`   Left Waiting PV: ${leftWaitingAfterMatch}`);
    console.log(`   Right Waiting PV: ${rightWaitingAfterMatch}\n`);

    // Get current period volume
    const currentVolume = await PVMatchingService.getCurrentPeriodVolume(userId);
    console.log(`📈 Current Period Volume Result:`);
    console.log(`   Left PV: ${currentVolume.leftPV}`);
    console.log(`   Right PV: ${currentVolume.rightPV}`);
    console.log(`   Left Waiting PV: ${currentVolume.leftWaitingPV}`);
    console.log(`   Right Waiting PV: ${currentVolume.rightWaitingPV}\n`);

    // List all members in left leg
    console.log(`👥 Members in Left Leg:`);
    const leftChildren = await prisma.user.findMany({
      where: {
        placementParentId: userId,
        position: 'left',
        deleted: false,
        active: true
      },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        pv: true,
        rank: true
      }
    });

    for (const child of leftChildren) {
      console.log(`   - ${child.fullName} (${child.memberId}): ${child.pv} PV (${child.rank})`);
      
      // Get grandchildren
      const grandchildren = await prisma.user.findMany({
        where: {
          placementParentId: child.id,
          deleted: false,
          active: true
        },
        select: {
          id: true,
          memberId: true,
          fullName: true,
          pv: true,
          rank: true
        }
      });

      for (const grandchild of grandchildren) {
        console.log(`     └─ ${grandchild.fullName} (${grandchild.memberId}): ${grandchild.pv} PV (${grandchild.rank})`);
      }
    }

    console.log(`\n👥 Members in Right Leg:`);
    const rightChildren = await prisma.user.findMany({
      where: {
        placementParentId: userId,
        position: 'right',
        deleted: false,
        active: true
      },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        pv: true,
        rank: true
      }
    });

    for (const child of rightChildren) {
      console.log(`   - ${child.fullName} (${child.memberId}): ${child.pv} PV (${child.rank})`);
    }

  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

