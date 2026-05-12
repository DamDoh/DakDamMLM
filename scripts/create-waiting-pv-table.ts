/**
 * Script to create waiting_pv and pv_match_transactions tables
 * Run this with: npx tsx scripts/create-waiting-pv-table.ts
 */

import { prisma } from '../src/lib/database';

async function createWaitingPvTable() {
  try {
    console.log('Creating waiting_pv and pv_match_transactions tables...');

    // Create waiting_pv table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS waiting_pv (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        
        -- Current live PV from downlines (recalculated daily)
        left_live_pv NUMERIC(12, 2) NOT NULL DEFAULT 0,
        right_live_pv NUMERIC(12, 2) NOT NULL DEFAULT 0,
        
        -- Carry-forward waiting PV from previous matches
        left_waiting_pv NUMERIC(12, 2) NOT NULL DEFAULT 0,
        right_waiting_pv NUMERIC(12, 2) NOT NULL DEFAULT 0,
        
        -- Total PV (live + waiting) for matching
        left_total_pv NUMERIC(12, 2) NOT NULL DEFAULT 0,
        right_total_pv NUMERIC(12, 2) NOT NULL DEFAULT 0,
        
        -- Matched PV amount for this day
        matched_pv NUMERIC(12, 2) NOT NULL DEFAULT 0,
        
        -- Commission earned from this match
        commission_earned NUMERIC(12, 2) NOT NULL DEFAULT 0,
        
        -- Track matching history
        match_count INT NOT NULL DEFAULT 0,
        last_match_at TIMESTAMP,
        
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        
        -- Unique constraint: one record per user per day
        UNIQUE (user_id, date),
        
        -- Foreign key
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    // Create indexes for waiting_pv
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_waiting_pv_user ON waiting_pv(user_id)
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_waiting_pv_date ON waiting_pv(date)
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_waiting_pv_user_date ON waiting_pv(user_id, date)
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_waiting_pv_matched ON waiting_pv(matched_pv)
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_waiting_pv_commission ON waiting_pv(commission_earned)
    `;

    // Create pv_match_transactions table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS pv_match_transactions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        
        -- Match details
        left_pv_used NUMERIC(12, 2) NOT NULL DEFAULT 0,
        right_pv_used NUMERIC(12, 2) NOT NULL DEFAULT 0,
        matched_pv NUMERIC(12, 2) NOT NULL DEFAULT 0,
        
        -- Waiting PV after this match
        left_waiting_after NUMERIC(12, 2) NOT NULL DEFAULT 0,
        right_waiting_after NUMERIC(12, 2) NOT NULL DEFAULT 0,
        
        -- Commission details
        commission_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.08,
        commission_earned NUMERIC(12, 2) NOT NULL DEFAULT 0,
        
        -- Rank and cap info at time of match
        member_rank VARCHAR(50),
        daily_cap_matches INT,
        matches_used INT,
        
        -- Trigger info (what caused this match)
        trigger_type VARCHAR(50),
        trigger_member_id VARCHAR(255),
        
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    // Create indexes for pv_match_transactions
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_pv_match_tx_user ON pv_match_transactions(user_id)
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_pv_match_tx_date ON pv_match_transactions(created_at)
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_pv_match_tx_trigger ON pv_match_transactions(trigger_member_id)
    `;

    console.log('✅ Successfully created waiting_pv and pv_match_transactions tables!');
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createWaitingPvTable()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

