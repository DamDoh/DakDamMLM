/**
 * Script to query waiting_pv table
 * Run this with: npx tsx scripts/query-waiting-pv.ts [user_id]
 */

import { prisma } from '../src/lib/database';

async function queryWaitingPV(userId?: string) {
  try {
    console.log('Querying waiting_pv table...\n');

    let query: any;
    
    if (userId) {
      // Query for specific user
      query = await prisma.$queryRaw<Array<{
        user_id: string;
        date: Date;
        left_live_pv: number;
        right_live_pv: number;
        left_waiting_pv: number;
        right_waiting_pv: number;
        left_total_pv: number;
        right_total_pv: number;
        matched_pv: number;
        commission_earned: number;
        match_count: number;
        last_match_at: Date | null;
        created_at: Date;
        updated_at: Date;
      }>>`
        SELECT 
          user_id,
          date,
          left_live_pv,
          right_live_pv,
          left_waiting_pv,
          right_waiting_pv,
          left_total_pv,
          right_total_pv,
          matched_pv,
          commission_earned,
          match_count,
          last_match_at,
          created_at,
          updated_at
        FROM waiting_pv
        WHERE user_id = ${userId}
        ORDER BY date DESC, updated_at DESC
        LIMIT 20
      `;
    } else {
      // Query all recent records
      query = await prisma.$queryRaw<Array<{
        user_id: string;
        date: Date;
        left_live_pv: number;
        right_live_pv: number;
        left_waiting_pv: number;
        right_waiting_pv: number;
        left_total_pv: number;
        right_total_pv: number;
        matched_pv: number;
        commission_earned: number;
        match_count: number;
        last_match_at: Date | null;
        created_at: Date;
        updated_at: Date;
      }>>`
        SELECT 
          user_id,
          date,
          left_live_pv,
          right_live_pv,
          left_waiting_pv,
          right_waiting_pv,
          left_total_pv,
          right_total_pv,
          matched_pv,
          commission_earned,
          match_count,
          last_match_at,
          created_at,
          updated_at
        FROM waiting_pv
        ORDER BY date DESC, updated_at DESC
        LIMIT 20
      `;
    }

    if (query.length === 0) {
      console.log('No records found in waiting_pv table.');
      return;
    }

    console.log(`Found ${query.length} record(s):\n`);
    console.log('='.repeat(120));
    
    query.forEach((record: {
      user_id: string;
      date: Date;
      left_live_pv: number;
      right_live_pv: number;
      left_waiting_pv: number;
      right_waiting_pv: number;
      left_total_pv: number;
      right_total_pv: number;
      matched_pv: number;
      commission_earned: number;
      match_count: number;
      last_match_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }, index: number) => {
      console.log(`\nRecord ${index + 1}:`);
      console.log(`  User ID: ${record.user_id}`);
      console.log(`  Date: ${record.date}`);
      console.log(`  Left Live PV: ${record.left_live_pv}`);
      console.log(`  Right Live PV: ${record.right_live_pv}`);
      console.log(`  Left Waiting PV: ${record.left_waiting_pv}`);
      console.log(`  Right Waiting PV: ${record.right_waiting_pv}`);
      console.log(`  Left Total PV: ${record.left_total_pv}`);
      console.log(`  Right Total PV: ${record.right_total_pv}`);
      console.log(`  Matched PV: ${record.matched_pv}`);
      console.log(`  Commission Earned: $${record.commission_earned}`);
      console.log(`  Match Count: ${record.match_count}`);
      console.log(`  Last Match At: ${record.last_match_at || 'N/A'}`);
      console.log(`  Created At: ${record.created_at}`);
      console.log(`  Updated At: ${record.updated_at}`);
      
      // Show calculation breakdown
      console.log(`\n  Calculation Breakdown:`);
      console.log(`    Left Total = ${record.left_live_pv} (live) + ${record.left_waiting_pv} (waiting) = ${record.left_total_pv}`);
      console.log(`    Right Total = ${record.right_live_pv} (live) + ${record.right_waiting_pv} (waiting) = ${record.right_total_pv}`);
      console.log(`    Matched = min(${record.left_total_pv}, ${record.right_total_pv}) = ${record.matched_pv}`);
      if (record.matched_pv > 0) {
        const expectedLeftWaiting = Math.max(0, record.left_total_pv - record.matched_pv);
        const expectedRightWaiting = Math.max(0, record.right_total_pv - record.matched_pv);
        console.log(`    Expected Left Waiting = max(0, ${record.left_total_pv} - ${record.matched_pv}) = ${expectedLeftWaiting}`);
        console.log(`    Expected Right Waiting = max(0, ${record.right_total_pv} - ${record.matched_pv}) = ${expectedRightWaiting}`);
        console.log(`    Actual Left Waiting = ${record.left_waiting_pv} ${record.left_waiting_pv === expectedLeftWaiting ? '✓' : '✗ MISMATCH!'}`);
        console.log(`    Actual Right Waiting = ${record.right_waiting_pv} ${record.right_waiting_pv === expectedRightWaiting ? '✓' : '✗ MISMATCH!'}`);
      }
      console.log('-'.repeat(120));
    });

    console.log('\n');
  } catch (error) {
    console.error('Error querying waiting_pv:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get user ID from command line argument
const userId = process.argv[2];

queryWaitingPV(userId)
  .then(() => {
    console.log('Query completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

