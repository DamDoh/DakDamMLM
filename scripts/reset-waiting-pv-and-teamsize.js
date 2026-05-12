/**
 * Reset waiting PV and teamSize columns for all users
 * Run this script to clear old data and reset to defaults
 * 
 * Usage: node scripts/reset-waiting-pv-and-teamsize.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resetColumns() {
  try {
    console.log('🔄 Starting reset of leftWaitingPV, rightWaitingPV, and teamSize...');

    // Reset all users' waiting PV and teamSize
    const result = await prisma.$executeRaw`
      UPDATE "users"
      SET 
        "leftWaitingPV" = 0,
        "rightWaitingPV" = 0,
        "teamSize" = '{"left":0,"right":0,"total":0}'::jsonb,
        "updatedAt" = NOW()
      WHERE "deleted" = false
    `;

    console.log(`✅ Reset ${result} users' waiting PV and teamSize columns`);

    // Verify the reset
    const usersWithData = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "users"
      WHERE "deleted" = false
        AND (
          "leftWaitingPV" != 0 
          OR "rightWaitingPV" != 0
          OR "teamSize"::text != '{"left":0,"right":0,"total":0}'
        )
    `;

    const remainingCount = Number(usersWithData[0]?.count || 0);
    
    if (remainingCount > 0) {
      console.warn(`⚠️  Warning: ${remainingCount} users still have non-zero values`);
    } else {
      console.log('✅ All users successfully reset to zero/default values');
    }

    // Show summary
    const totalUsers = await prisma.user.count({
      where: { deleted: false }
    });

    console.log('\n📊 Summary:');
    console.log(`   Total active users: ${totalUsers}`);
    console.log(`   Users reset: ${result}`);
    console.log(`   Remaining issues: ${remainingCount}`);

  } catch (error) {
    console.error('❌ Error resetting columns:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
resetColumns()
  .then(() => {
    console.log('\n✅ Reset completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Reset failed:', error);
    process.exit(1);
  });

