/**
 * Check current state and fix/trigger match if needed
 * This will check RiThy VoNg's waiting PV and trigger match if both legs have PV
 * 
 * Usage: npx tsx scripts/check-and-fix-current-state.ts
 */

import { PrismaClient } from '@prisma/client';
import { PVMatchingService } from '../src/services/pv-matching-service';
import { checkAndTriggerDailyMatch } from '../src/services/daily-match-trigger';

const prisma = new PrismaClient();

async function checkAndFix() {
  try {
    console.log('🔍 Checking current state for RiThy VoNg (ADMIN002)...\n');

    // Find RiThy VoNg
    const rithy = await prisma.user.findUnique({
      where: { memberId: 'ADMIN002' },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        rank: true,
        active: true,
        deleted: true,
      },
    });

    if (!rithy) {
      console.error('❌ RiThy VoNg (ADMIN002) not found');
      process.exit(1);
    }

    console.log(`📋 Sponsor: ${rithy.memberId} (${rithy.fullName})`);
    console.log(`   Rank: ${rithy.rank}`);
    console.log(`   Active: ${rithy.active}`);
    console.log(`   Deleted: ${rithy.deleted}\n`);

    // Check maintenance
    const { hasMaintenancePaid } = await import('../src/lib/maintenance');
    const maintenancePaid = await hasMaintenancePaid(rithy.id);
    console.log(`💰 Maintenance Status: ${maintenancePaid ? '✅ Paid' : '❌ Not Paid'}\n`);

    // Check if can earn commissions
    const { canEarnCommissions } = await import('../src/lib/superadmin-helper');
    const canEarn = await canEarnCommissions(rithy.id);
    console.log(`📊 Can Earn Commissions: ${canEarn ? '✅ Yes' : '❌ No'}\n`);

    // Get current waiting PV
    const waitingPV = await PVMatchingService.getWaitingPV(rithy.id);
    console.log(`📊 Current Waiting PV:`);
    console.log(`   Left: ${waitingPV.leftWaitingPV} PV`);
    console.log(`   Right: ${waitingPV.rightWaitingPV} PV\n`);

    const matchablePV = Math.min(waitingPV.leftWaitingPV, waitingPV.rightWaitingPV);
    
    if (matchablePV <= 0) {
      console.log('⚠️  No matchable PV (both legs need PV > 0)');
      console.log(`   Current: Left=${waitingPV.leftWaitingPV}, Right=${waitingPV.rightWaitingPV}`);
      process.exit(0);
    }

    console.log(`✅ Matchable PV: ${matchablePV} PV`);
    console.log(`   Potential Commission: $${(matchablePV * 0.08).toFixed(2)} (8%)\n`);

    // Check if already paid today
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const existingCommission = await prisma.commission.findFirst({
      where: {
        userId: rithy.id,
        type: 'Daily Match',
        date: { gte: startOfDay, lte: endOfDay },
        status: { in: ['Paid', 'Pending'] },
      },
      orderBy: { date: 'desc' },
    });

    if (existingCommission) {
      console.log(`⚠️  Already has commission today: $${existingCommission.amount}`);
      console.log(`   Commission ID: ${existingCommission.id}`);
      console.log(`   Date: ${existingCommission.date}\n`);
      
      // Check if waiting PV was updated correctly
      const expectedRight = waitingPV.rightWaitingPV - matchablePV;
      if (waitingPV.leftWaitingPV === 0 && waitingPV.rightWaitingPV === expectedRight) {
        console.log('✅ Waiting PV is correct after match');
        console.log(`   Left: ${waitingPV.leftWaitingPV} (consumed)`);
        console.log(`   Right: ${waitingPV.rightWaitingPV} (${waitingPV.rightWaitingPV + matchablePV} - ${matchablePV})`);
      } else {
        console.log('⚠️  Waiting PV may not be updated correctly');
        console.log(`   Expected after match: Left=0, Right=${expectedRight}`);
        console.log(`   Actual: Left=${waitingPV.leftWaitingPV}, Right=${waitingPV.rightWaitingPV}`);
        console.log('\n🔄 Fixing waiting PV...');
        
        // Fix waiting PV
        const fixedRight = waitingPV.rightWaitingPV > matchablePV 
          ? waitingPV.rightWaitingPV - matchablePV 
          : 0;
        await PVMatchingService.updateWaitingPV(rithy.id, 0, fixedRight);
        
        console.log(`✅ Fixed: Left=0, Right=${fixedRight}`);
      }
    } else {
      if (!maintenancePaid) {
        console.log('⚠️  Maintenance not paid - auto-trigger will skip');
        console.log('   You can still manually trigger via API: POST /api/bonus/daily-match\n');
      } else {
        console.log('🚀 No commission today - triggering daily match...\n');
        
        // Trigger daily match
        await checkAndTriggerDailyMatch(rithy.id);
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check results
      const afterWaitingPV = await PVMatchingService.getWaitingPV(rithy.id);
      console.log(`📊 After Match:`);
      console.log(`   Left: ${afterWaitingPV.leftWaitingPV} PV`);
      console.log(`   Right: ${afterWaitingPV.rightWaitingPV} PV\n`);
      
      // Check commission
      const newCommission = await prisma.commission.findFirst({
        where: {
          userId: rithy.id,
          type: 'Daily Match',
          date: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { date: 'desc' },
      });
      
      if (newCommission) {
        console.log(`✅ Commission created: $${newCommission.amount}`);
        console.log(`   Status: ${newCommission.status}`);
      } else {
        console.log('⚠️  No commission created - check logs for errors');
      }
      }
    }

    // Final state
    const finalWaitingPV = await PVMatchingService.getWaitingPV(rithy.id);
    console.log(`\n📊 Final Waiting PV:`);
    console.log(`   Left: ${finalWaitingPV.leftWaitingPV} PV`);
    console.log(`   Right: ${finalWaitingPV.rightWaitingPV} PV`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run
checkAndFix()
  .then(() => {
    console.log('\n✅ Done! Refresh your browser to see updated values.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

