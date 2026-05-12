/**
 * Manual fix script to set waiting PV correctly
 * Example: Left 100 PV, Right 500 PV → After match: Left 0, Right 400
 * 
 * Usage: npx tsx scripts/fix-waiting-pv-manual.ts [sponsorMemberId] [leftPV] [rightPV]
 * Example: npx tsx scripts/fix-waiting-pv-manual.ts ADMIN002 0 400
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixWaitingPV(sponsorMemberId: string, leftPV: number, rightPV: number) {
  try {
    console.log(`🔧 Fixing waiting PV for ${sponsorMemberId}...\n`);

    // Find sponsor
    const sponsor = await prisma.user.findUnique({
      where: { memberId: sponsorMemberId },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        leftWaitingPV: true,
        rightWaitingPV: true,
      },
    });

    if (!sponsor) {
      console.error(`❌ Sponsor not found: ${sponsorMemberId}`);
      process.exit(1);
    }

    console.log(`📋 Current values:`);
    console.log(`   Left Waiting PV: ${sponsor.leftWaitingPV}`);
    console.log(`   Right Waiting PV: ${sponsor.rightWaitingPV}\n`);

    console.log(`📝 Setting new values:`);
    console.log(`   Left Waiting PV: ${leftPV}`);
    console.log(`   Right Waiting PV: ${rightPV}\n`);

    // Update waiting PV
    await prisma.$executeRaw`
      UPDATE "users"
      SET 
        "leftWaitingPV" = ${leftPV},
        "rightWaitingPV" = ${rightPV},
        "updatedAt" = NOW()
      WHERE "id" = ${sponsor.id}
    `;

    // Verify
    const updated = await prisma.user.findUnique({
      where: { id: sponsor.id },
      select: {
        leftWaitingPV: true,
        rightWaitingPV: true,
      },
    });

    console.log(`✅ Updated successfully!`);
    console.log(`   Left Waiting PV: ${updated?.leftWaitingPV}`);
    console.log(`   Right Waiting PV: ${updated?.rightWaitingPV}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get arguments from command line
const sponsorMemberId = process.argv[2];
const leftPV = parseFloat(process.argv[3] || '0');
const rightPV = parseFloat(process.argv[4] || '0');

if (!sponsorMemberId) {
  console.error('❌ Usage: npx tsx scripts/fix-waiting-pv-manual.ts [sponsorMemberId] [leftPV] [rightPV]');
  console.error('   Example: npx tsx scripts/fix-waiting-pv-manual.ts ADMIN002 0 400');
  process.exit(1);
}

// Run the fix
fixWaitingPV(sponsorMemberId, leftPV, rightPV)
  .then(() => {
    console.log('\n✅ Fix completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });

