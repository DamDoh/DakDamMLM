/**
 * Script to initialize waiting PV columns for existing users
 * Calculates waiting PV based on current live PV and updates the columns
 * 
 * Usage:
 *   npx tsx scripts/initialize-waiting-pv.ts
 */

import { PrismaClient } from '@prisma/client';
import { PVMatchingService } from '../src/services/pv-matching-service';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Initializing waiting PV columns for all users...\n');

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
        fullName: true
      }
    });

    console.log(`📊 Found ${allUsers.length} users to process\n`);

    let successCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors: Array<{ userId: string; memberId: string; error: string }> = [];

    // Process users in batches
    const batchSize = 50;
    for (let i = 0; i < allUsers.length; i += batchSize) {
      const batch = allUsers.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (user) => {
          try {
            // Get current period volume (calculates live PV + carry-forward)
            const currentVolume = await PVMatchingService.getCurrentPeriodVolume(user.id);
            
            // Calculate what the waiting PV would be after matching
            const leftTotalPV = currentVolume.leftTotalPV;
            const rightTotalPV = currentVolume.rightTotalPV;
            const matchedPV = Math.min(leftTotalPV, rightTotalPV);
            const leftWaitingAfterMatch = Math.max(0, leftTotalPV - matchedPV);
            const rightWaitingAfterMatch = Math.max(0, rightTotalPV - matchedPV);

            // Only update if there's actual PV to calculate
            if (leftTotalPV > 0 || rightTotalPV > 0) {
              // Update the waiting PV columns
              await prisma.$executeRaw`
                UPDATE "users" 
                SET "leftWaitingPV" = ${leftWaitingAfterMatch},
                    "rightWaitingPV" = ${rightWaitingAfterMatch},
                    "updatedAt" = NOW()
                WHERE "id" = ${user.id}
              `;

              if (leftWaitingAfterMatch > 0 || rightWaitingAfterMatch > 0) {
                updatedCount++;
                console.log(`✅ ${user.memberId}: Left=${leftWaitingAfterMatch.toFixed(2)}, Right=${rightWaitingAfterMatch.toFixed(2)}`);
              }
            }
            
            successCount++;
            
            if (successCount % 100 === 0) {
              console.log(`\n📈 Processed ${successCount}/${allUsers.length} users...\n`);
            }
          } catch (error) {
            errorCount++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push({ 
              userId: user.id, 
              memberId: user.memberId || 'N/A',
              error: errorMessage 
            });
            console.error(`❌ Error for ${user.memberId}:`, errorMessage);
          }
        })
      );
    }

    console.log('\n' + '='.repeat(50));
    console.log('📈 Initialization Summary:');
    console.log(`   Total users: ${allUsers.length}`);
    console.log(`   ✅ Processed: ${successCount}`);
    console.log(`   📝 Updated with waiting PV: ${updatedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\n⚠️  First 10 errors:');
      errors.slice(0, 10).forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err.memberId}: ${err.error}`);
      });
    }
    
    console.log('='.repeat(50));
    console.log('\n✨ Initialization completed!');
    console.log('   Waiting PV columns now reflect current unmatched PV.\n');

  } catch (error) {
    console.error('💥 Fatal error during initialization:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

