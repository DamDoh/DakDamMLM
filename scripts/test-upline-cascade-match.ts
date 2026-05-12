/**
 * Test script to verify upline cascade and auto-match
 * Tests: When a member joins under "da da", PV flows up to RiThy VoNg and auto-matches
 * 
 * Usage: npx tsx scripts/test-upline-cascade-match.ts
 */

import { PrismaClient } from '@prisma/client';
import { PVMatchingService } from '../src/services/pv-matching-service';
import { checkAndTriggerDailyMatch } from '../src/services/daily-match-trigger';

const prisma = new PrismaClient();

async function testUplineCascade() {
  try {
    console.log('🧪 Testing Upline Cascade and Auto-Match...\n');

    // Find RiThy VoNg (ADMIN002)
    const rithy = await prisma.user.findUnique({
      where: { memberId: 'ADMIN002' },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        rank: true,
        leftWaitingPV: true,
        rightWaitingPV: true,
      },
    });

    if (!rithy) {
      console.error('❌ RiThy VoNg (ADMIN002) not found');
      process.exit(1);
    }

    console.log(`📋 Sponsor: ${rithy.memberId} (${rithy.fullName})`);
    console.log(`   Current Left Waiting PV: ${rithy.leftWaitingPV}`);
    console.log(`   Current Right Waiting PV: ${rithy.rightWaitingPV}\n`);

    // Find "da da" (ADMIN003)
    const dada = await prisma.user.findUnique({
      where: { memberId: 'ADMIN003' },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        rank: true,
        placementParentId: true,
        position: true,
      },
    });

    if (!dada) {
      console.error('❌ da da (ADMIN003) not found');
      process.exit(1);
    }

    console.log(`📋 Member: ${dada.memberId} (${dada.fullName})`);
    console.log(`   Position relative to RiThy: ${dada.position}`);
    console.log(`   Rank: ${dada.rank}\n`);

    // Simulate: A new member with Silver rank joins under "da da" on the LEFT
    console.log('🔄 Simulating: New Silver member joins under "da da" (LEFT leg)...\n');

    // Get current waiting PV for RiThy
    const beforeWaiting = await PVMatchingService.getWaitingPV(rithy.id);
    console.log(`📊 RiThy's Waiting PV BEFORE:`);
    console.log(`   Left: ${beforeWaiting.leftWaitingPV} PV`);
    console.log(`   Right: ${beforeWaiting.rightWaitingPV} PV\n`);

    // Simulate adding 100 PV to RiThy's left leg (from new member under "da da")
    // In real scenario, this happens via triggerUplineRecalculation when member joins
    const newMemberPV = 100; // Silver rank = 100 PV
    
    console.log(`➕ Adding ${newMemberPV} PV to RiThy's LEFT leg...`);
    await PVMatchingService.addNewMemberPVToSponsor(
      'test-member-id', // dummy ID for test
      rithy.id,
      'left',
      newMemberPV
    );

    // Check waiting PV after addition
    const afterAddition = await PVMatchingService.getWaitingPV(rithy.id);
    console.log(`📊 RiThy's Waiting PV AFTER addition:`);
    console.log(`   Left: ${afterAddition.leftWaitingPV} PV`);
    console.log(`   Right: ${afterAddition.rightWaitingPV} PV\n`);

    // Check if auto-match should trigger
    if (afterAddition.leftWaitingPV > 0 && afterAddition.rightWaitingPV > 0) {
      const matchablePV = Math.min(afterAddition.leftWaitingPV, afterAddition.rightWaitingPV);
      console.log(`✅ Both legs have PV - Auto-match should trigger!`);
      console.log(`   Matchable PV: ${matchablePV} PV`);
      console.log(`   Potential Commission: $${(matchablePV * 0.08).toFixed(2)} (8%)\n`);

      // Trigger auto-match
      console.log('🚀 Triggering auto daily match...\n');
      await checkAndTriggerDailyMatch(rithy.id);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Check results
      const afterMatch = await PVMatchingService.getWaitingPV(rithy.id);
      console.log(`📊 RiThy's Waiting PV AFTER match:`);
      console.log(`   Left: ${afterMatch.leftWaitingPV} PV`);
      console.log(`   Right: ${afterMatch.rightWaitingPV} PV\n`);

      // Verify expected result
      const expectedRight = afterAddition.rightWaitingPV - matchablePV;
      if (afterMatch.leftWaitingPV === 0 && afterMatch.rightWaitingPV === expectedRight) {
        console.log(`✅ SUCCESS! Waiting PV updated correctly:`);
        console.log(`   Left: 0 (consumed)`);
        console.log(`   Right: ${afterMatch.rightWaitingPV} (${afterAddition.rightWaitingPV} - ${matchablePV})`);
      } else {
        console.log(`⚠️  Waiting PV doesn't match expected:`);
        console.log(`   Expected: Left=0, Right=${expectedRight}`);
        console.log(`   Actual: Left=${afterMatch.leftWaitingPV}, Right=${afterMatch.rightWaitingPV}`);
      }

      // Check commission
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      const commissions = await prisma.commission.findMany({
        where: {
          userId: rithy.id,
          type: 'Daily Match',
          date: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { date: 'desc' },
      });

      console.log(`\n💰 Commission Records:`);
      if (commissions.length > 0) {
        commissions.forEach((c, i) => {
          console.log(`   ${i + 1}. Amount: $${c.amount}, Status: ${c.status}`);
        });
      } else {
        console.log('   ⚠️  No commissions found');
      }

    } else {
      console.log(`⚠️  Both legs don't have PV yet:`);
      console.log(`   Left: ${afterAddition.leftWaitingPV} PV`);
      console.log(`   Right: ${afterAddition.rightWaitingPV} PV`);
      console.log(`   Auto-match will trigger when both legs have PV > 0`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testUplineCascade()
  .then(() => {
    console.log('\n✅ Test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

