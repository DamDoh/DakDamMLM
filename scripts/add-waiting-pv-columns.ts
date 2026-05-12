/**
 * Script to add leftWaitingPV and rightWaitingPV columns to users table
 * 
 * Usage:
 *   npx tsx scripts/add-waiting-pv-columns.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Adding leftWaitingPV and rightWaitingPV columns to users table...\n');

  try {
    // Step 1: Drop the JSON waitingPV column if it exists
    console.log('Step 1: Dropping old waitingPV JSON column (if exists)...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "users" 
      DROP COLUMN IF EXISTS "waitingPV";
    `);
    console.log('✅ Old waitingPV column dropped (or didn\'t exist)\n');

    // Step 2: Add leftWaitingPV column
    console.log('Step 2: Adding leftWaitingPV column...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "leftWaitingPV" DOUBLE PRECISION DEFAULT 0;
    `);
    console.log('✅ leftWaitingPV column added\n');

    // Step 3: Add rightWaitingPV column
    console.log('Step 3: Adding rightWaitingPV column...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "rightWaitingPV" DOUBLE PRECISION DEFAULT 0;
    `);
    console.log('✅ rightWaitingPV column added\n');

    // Step 4: Update existing users to have default values
    console.log('Step 4: Updating existing users with default values...');
    const updateLeft = await prisma.$executeRawUnsafe(`
      UPDATE "users" 
      SET "leftWaitingPV" = 0
      WHERE "leftWaitingPV" IS NULL;
    `);
    console.log(`✅ Updated ${updateLeft} users for leftWaitingPV`);

    const updateRight = await prisma.$executeRawUnsafe(`
      UPDATE "users" 
      SET "rightWaitingPV" = 0
      WHERE "rightWaitingPV" IS NULL;
    `);
    console.log(`✅ Updated ${updateRight} users for rightWaitingPV\n`);

    // Step 5: Verify the columns exist
    console.log('Step 5: Verifying columns...');
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('leftWaitingPV', 'rightWaitingPV')
      ORDER BY column_name;
    `;

    console.log('\n📊 Columns found in users table:');
    columns.forEach(col => {
      console.log(`   ✅ ${col.column_name}`);
    });

    console.log('\n✨ Migration completed successfully!');
    console.log('   You should now see leftWaitingPV and rightWaitingPV columns in your database.\n');

  } catch (error) {
    console.error('💥 Error running migration:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

