const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Rank calculation function (matches src/lib/rank.ts)
function calculateRank(pv) {
  if (pv >= 1000) return 'Diamond';
  if (pv >= 500) return 'Gold';
  if (pv >= 100) return 'Silver';
  if (pv >= 60) return 'Bronze';
  return 'Member';
}

async function fixUserRanks() {
  console.log('🏆 Starting user rank recalculation based on PV...\n');

  try {
    // Get all non-admin users
    const users = await prisma.user.findMany({
      where: {
        isAdmin: false,
        deleted: false
      },
      select: {
        id: true,
        fullName: true,
        memberId: true,
        pv: true,
        rank: true
      }
    });

    console.log(`Found ${users.length} users to check\n`);

    let updatedCount = 0;

    for (const user of users) {
      const currentPV = parseFloat(user.pv) || 0;
      const currentRank = user.rank || 'Member';
      const calculatedRank = calculateRank(currentPV);

      if (currentRank !== calculatedRank) {
        console.log(`\n🔄 Updating rank for ${user.fullName} (${user.memberId})`);
        console.log(`   Current PV: ${currentPV.toFixed(2)}`);
        console.log(`   Current rank: ${currentRank}`);
        console.log(`   Calculated rank: ${calculatedRank}`);

        await prisma.user.update({
          where: { id: user.id },
          data: { rank: calculatedRank }
        });

        console.log(`   ✅ Updated to ${calculatedRank}`);
        updatedCount++;
      } else {
        console.log(`✓ ${user.fullName} (${user.memberId}) - rank correct (${currentRank} with ${currentPV.toFixed(2)} PV)`);
      }
    }

    console.log(`\n✅ Rank recalculation complete! Updated ${updatedCount} user(s).`);
  } catch (error) {
    console.error('❌ Error fixing user ranks:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixUserRanks()
  .then(() => {
    console.log('\n🎉 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
