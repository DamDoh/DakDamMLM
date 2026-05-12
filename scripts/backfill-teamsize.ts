/**
 * Script to backfill teamSize for all existing users
 * 
 * Usage:
 *   npx tsx scripts/backfill-teamsize.ts
 *   or
 *   npm run backfill-teamsize (if added to package.json)
 */

import { PrismaClient } from '@prisma/client';
import { PVMatchingService } from '../src/services/pv-matching-service';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting teamSize backfill for all users...\n');

  try {
    // Get all active, non-deleted users
    const allUsers = await prisma.user.findMany({
      where: {
        deleted: false,
        active: true
      },
      select: {
        id: true,
        email: true,
        memberId: true,
        teamSize: true
      }
    });

    console.log(`📊 Found ${allUsers.length} users to process\n`);

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ userId: string; memberId: string; error: string }> = [];

    // Process users in batches to avoid overwhelming the database
    const batchSize = 50;
    for (let i = 0; i < allUsers.length; i += batchSize) {
      const batch = allUsers.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (user) => {
          try {
            await PVMatchingService.updateTeamSize(user.id);
            successCount++;
            
            if (successCount % 100 === 0) {
              console.log(`✅ Processed ${successCount}/${allUsers.length} users...`);
            }
          } catch (error) {
            errorCount++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push({ 
              userId: user.id, 
              memberId: user.memberId || 'N/A',
              error: errorMessage 
            });
            console.error(`❌ Error updating teamSize for user ${user.memberId}:`, errorMessage);
          }
        })
      );
    }

    console.log('\n' + '='.repeat(50));
    console.log('📈 Backfill Summary:');
    console.log(`   Total users: ${allUsers.length}`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\n⚠️  First 10 errors:');
      errors.slice(0, 10).forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err.memberId}: ${err.error}`);
      });
    }
    
    console.log('='.repeat(50));
    console.log('\n✨ Backfill completed!\n');

  } catch (error) {
    console.error('💥 Fatal error during backfill:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

