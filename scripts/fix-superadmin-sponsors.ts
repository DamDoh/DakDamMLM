/**
 * Script to fix existing database records where members have superadmin as their sponsor
 * Run this once to clean up existing data: npx tsx scripts/fix-superadmin-sponsors.ts
 */

import { PrismaClient } from '@prisma/client';
import { isSuperAdmin } from '../src/lib/superadmin-helper';

const prisma = new PrismaClient();

async function fixSuperadminSponsors() {
  console.log('🔍 Starting fix for superadmin sponsors...');

  try {
    // Get all users
    const allUsers = await prisma.user.findMany({
      where: { deleted: false },
      select: {
        id: true,
        email: true,
        isAdmin: true,
        placementParentId: true,
        fullName: true,
        memberId: true
      }
    });

    console.log(`📊 Found ${allUsers.length} users to check`);

    // Find all superadmin user IDs
    const superadminIds: string[] = [];
    for (const user of allUsers) {
      if (await isSuperAdmin(user.id)) {
        superadminIds.push(user.id);
        console.log(`👤 Found superadmin: ${user.email} (${user.id})`);
      }
    }

    if (superadminIds.length === 0) {
      console.log('ℹ️ No superadmin users found. Nothing to fix.');
      return;
    }

    // Find all members that have superadmin as their placementParentId
    const membersWithSuperadminSponsor = allUsers.filter(user =>
      user.placementParentId && superadminIds.includes(user.placementParentId)
    );

    console.log(`⚠️ Found ${membersWithSuperadminSponsor.length} members with superadmin as placementParentId`);

    if (membersWithSuperadminSponsor.length === 0) {
      console.log('✅ No members have superadmin as sponsor. Database is clean!');
      return;
    }

    // Set placementParentId to NULL for these members
    let fixedCount = 0;
    for (const member of membersWithSuperadminSponsor) {
      await prisma.user.update({
        where: { id: member.id },
        data: { placementParentId: null, position: null }
      });
      fixedCount++;
      console.log(`✅ Fixed: ${member.memberId} (${member.fullName}) - removed superadmin sponsor`);
    }

    console.log(`\n✅ Fixed ${fixedCount} member(s) with superadmin as sponsor`);
    console.log('✅ Database cleanup complete!');
  } catch (error) {
    console.error('❌ Error fixing superadmin sponsors:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixSuperadminSponsors()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

