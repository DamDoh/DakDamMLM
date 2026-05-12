import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Creating maintenance_topup_requests table...');
    
    // Check if table exists
    const tableExists = await prisma.$queryRawUnsafe<Array<{exists: boolean}>>(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'maintenance_topup_requests'
      ) as exists;
    `);

    if (tableExists[0]?.exists) {
      console.log('✅ Table already exists - skipping creation');
      return;
    }

    // Create table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE maintenance_topup_requests (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        member_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        member_name TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        remark TEXT DEFAULT '',
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
        month TEXT NOT NULL,
        created_date TIMESTAMP DEFAULT NOW(),
        processed_date TIMESTAMP,
        processed_by TEXT REFERENCES users(id),
        proof_url TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes
    await prisma.$executeRawUnsafe(`CREATE INDEX idx_maintenance_topup_member_id ON maintenance_topup_requests(member_id);`);
    await prisma.$executeRawUnsafe(`CREATE INDEX idx_maintenance_topup_status ON maintenance_topup_requests(status);`);
    await prisma.$executeRawUnsafe(`CREATE INDEX idx_maintenance_topup_month ON maintenance_topup_requests(month);`);
    await prisma.$executeRawUnsafe(`CREATE INDEX idx_maintenance_topup_created_date ON maintenance_topup_requests(created_date);`);

    console.log('✅ maintenance_topup_requests table created successfully!');
  } catch (error: any) {
    if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
      console.log('✅ Table already exists - skipping creation');
    } else {
      console.error('❌ Error creating table:', error.message);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

