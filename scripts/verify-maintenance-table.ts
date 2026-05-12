import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Verifying maintenance_topup_requests table...');
    
    // Try to query the table
    const count = await prisma.maintenanceTopupRequest.count();
    console.log(`✅ Table exists and is accessible! Current record count: ${count}`);
    
    // Try to query with a simple findFirst
    const test = await prisma.maintenanceTopupRequest.findFirst({
      take: 1
    });
    console.log('✅ Query successful!', test ? 'Found records' : 'No records yet');
    
  } catch (error: any) {
    console.error('❌ Error accessing table:', error.message);
    console.error('Error code:', error.code);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
