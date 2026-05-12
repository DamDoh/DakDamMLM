/**
 * Test script to verify Matching Bonus works correctly for new members
 * This simulates the flow: Create sponsor -> Create downlines -> Earn Daily Match -> Get Matching Bonus
 */

import { PrismaClient } from '@prisma/client';
import { CommissionCalculationEngineEnhanced } from '../src/services/commission-calculation-engine';

const prisma = new PrismaClient();

async function testMatchingBonusFlow() {
  console.log('🧪 Testing Matching Bonus Flow for New Members\n');
  
  try {
    // Step 1: Create a sponsor (Silver rank)
    console.log('Step 1: Creating sponsor...');
    const sponsor = await prisma.user.create({
      data: {
        email: `test-sponsor-${Date.now()}@test.com`,
        password: 'hashedpassword',
        fullName: 'Test Sponsor',
        firstName: 'Test',
        surname: 'Sponsor',
        memberId: `TEST${Date.now()}`,
        phoneNumber: `+123456789${Date.now()}`,
        rank: 'Silver',
        active: true,
        pv: 100,
        placementParentId: null,
        sponsorId: null,
        children: { left: null, right: null },
        teamSize: {},
        addresses: []
      }
    });
    console.log(`✅ Created sponsor: ${sponsor.memberId} (${sponsor.rank})`);

    // Step 2: Create left downline
    console.log('\nStep 2: Creating left downline...');
    const leftDownline = await prisma.user.create({
      data: {
        email: `test-left-${Date.now()}@test.com`,
        password: 'hashedpassword',
        fullName: 'Test Left',
        firstName: 'Test',
        surname: 'Left',
        memberId: `LEFT${Date.now()}`,
        phoneNumber: `+123456790${Date.now()}`,
        rank: 'Bronze',
        active: true,
        pv: 50,
        placementParentId: sponsor.id,
        position: 'left',
        sponsorId: sponsor.id,
        children: { left: null, right: null },
        teamSize: {},
        addresses: []
      }
    });
    console.log(`✅ Created left downline: ${leftDownline.memberId}`);

    // Step 3: Create right downline
    console.log('\nStep 3: Creating right downline...');
    const rightDownline = await prisma.user.create({
      data: {
        email: `test-right-${Date.now()}@test.com`,
        password: 'hashedpassword',
        fullName: 'Test Right',
        firstName: 'Test',
        surname: 'Right',
        memberId: `RIGHT${Date.now()}`,
        phoneNumber: `+123456791${Date.now()}`,
        rank: 'Bronze',
        active: true,
        pv: 50,
        placementParentId: sponsor.id,
        position: 'right',
        sponsorId: sponsor.id,
        children: { left: null, right: null },
        teamSize: {},
        addresses: []
      }
    });
    console.log(`✅ Created right downline: ${rightDownline.memberId}`);

    // Step 4: Update sponsor's children
    console.log('\nStep 4: Updating sponsor children...');
    await prisma.user.update({
      where: { id: sponsor.id },
      data: {
        children: { left: leftDownline.id, right: rightDownline.id }
      }
    });
    console.log('✅ Updated sponsor children');

    // Step 5: Create Daily Match commission for left downline
    console.log('\nStep 5: Creating Daily Match for left downline...');
    const leftDailyMatch = await prisma.commission.create({
      data: {
        userId: leftDownline.id,
        amount: 8.00,
        type: 'Daily Match',
        description: 'Daily Match Bonus',
        status: 'Paid',
        date: new Date()
      }
    });
    console.log(`✅ Created Daily Match: $${leftDailyMatch.amount} for ${leftDownline.memberId}`);

    // Step 6: Trigger Matching Bonus calculation for sponsor
    console.log('\nStep 6: Calculating Matching Bonus for sponsor...');
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const matchingBonuses = await CommissionCalculationEngineEnhanced.calculateMatchingBonus(
      sponsor.id,
      thirtyDaysAgo,
      now,
      sponsor.rank
    );

    console.log(`\n📊 Matching Bonus Results:`);
    console.log(`   Found ${matchingBonuses.length} Matching Bonus entries`);
    
    matchingBonuses.forEach((mb, i) => {
      console.log(`   ${i + 1}. $${mb.amount.toFixed(2)} - ${mb.description}`);
    });

    // Step 7: Create Daily Match for right downline and check again
    console.log('\nStep 7: Creating Daily Match for right downline...');
    const rightDailyMatch = await prisma.commission.create({
      data: {
        userId: rightDownline.id,
        amount: 8.00,
        type: 'Daily Match',
        description: 'Daily Match Bonus',
        status: 'Paid',
        date: new Date()
      }
    });
    console.log(`✅ Created Daily Match: $${rightDailyMatch.amount} for ${rightDownline.memberId}`);

    // Step 8: Recalculate Matching Bonus
    console.log('\nStep 8: Recalculating Matching Bonus for sponsor...');
    const matchingBonuses2 = await CommissionCalculationEngineEnhanced.calculateMatchingBonus(
      sponsor.id,
      thirtyDaysAgo,
      now,
      sponsor.rank
    );

    console.log(`\n📊 Updated Matching Bonus Results:`);
    console.log(`   Found ${matchingBonuses2.length} Matching Bonus entries`);
    
    matchingBonuses2.forEach((mb, i) => {
      console.log(`   ${i + 1}. $${mb.amount.toFixed(2)} - ${mb.description}`);
    });

    // Expected: Silver rank gets 30% of $8 = $2.40 per leg
    const expectedLeft = 2.40;
    const expectedRight = 2.40;
    
    const leftMB = matchingBonuses2.find(mb => mb.metadata?.leg === 'left');
    const rightMB = matchingBonuses2.find(mb => mb.metadata?.leg === 'right');
    
    console.log('\n✅ Test Results:');
    console.log(`   Expected Left: $${expectedLeft.toFixed(2)}`);
    console.log(`   Actual Left: $${leftMB?.amount.toFixed(2) || '0.00'}`);
    console.log(`   Expected Right: $${expectedRight.toFixed(2)}`);
    console.log(`   Actual Right: $${rightMB?.amount.toFixed(2) || '0.00'}`);
    
    if (leftMB && Math.abs(leftMB.amount - expectedLeft) < 0.01) {
      console.log('   ✅ Left leg Matching Bonus is correct!');
    } else {
      console.log('   ❌ Left leg Matching Bonus is incorrect!');
    }
    
    if (rightMB && Math.abs(rightMB.amount - expectedRight) < 0.01) {
      console.log('   ✅ Right leg Matching Bonus is correct!');
    } else {
      console.log('   ❌ Right leg Matching Bonus is incorrect!');
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await prisma.commission.deleteMany({ where: { userId: { in: [leftDownline.id, rightDownline.id, sponsor.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [leftDownline.id, rightDownline.id, sponsor.id] } } });
    console.log('✅ Cleanup complete');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testMatchingBonusFlow();
