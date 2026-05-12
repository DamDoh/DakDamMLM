import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔍 Testing API query logic directly...\n');
    
    // Simulate the exact API logic
    const adminUsers = await prisma.user.findMany({
      where: {
        isAdmin: true,
        active: true,
        deleted: false
      },
      select: { id: true }
    });
    
    const stockistMembers = await prisma.user.findMany({
      where: {
        storeOwnerLevel: { in: ['S', 'M', 'C', 'D'] },
        active: true,
        deleted: false
      },
      select: { id: true }
    });
    
    const stockistIds = stockistMembers.map(m => m.id);
    const adminIds = adminUsers.map(a => a.id);
    const allIds = [...new Set([...stockistIds, ...adminIds])];
    
    console.log('Admin IDs:', adminIds);
    console.log('Combined IDs for query:', allIds.slice(0, 5), '...');
    console.log('');
    
    // Create where clause
    const whereClause: any = {
      status: 'pending',
      stockistId: { in: allIds }
    };
    
    console.log('Query whereClause:', JSON.stringify(whereClause, null, 2));
    console.log('');
    
    // Fetch stock requests
    const stockRequests = await (prisma as any).stockRequest.findMany({
      where: whereClause,
      include: {
        items: true,
        stockist: {
          select: {
            id: true,
            firstName: true,
            surname: true,
            memberId: true,
            storeOwnerLevel: true,
            fullName: true
          }
        }
      },
      orderBy: { createdDate: 'desc' },
      take: 100
    });
    
    console.log(`📦 Fetched ${stockRequests.length} stock request(s) from database:`);
    stockRequests.forEach((req: any) => {
      console.log(`  - ID: ${req.id}`);
      console.log(`    Stockist ID: ${req.stockistId}`);
      console.log(`    Stockist Name: ${req.stockistName}`);
      console.log(`    Status: ${req.status}`);
      console.log(`    Stockist Level: ${req.stockist?.storeOwnerLevel || 'N/A'}`);
      console.log('');
    });
    
    // Now apply the filter
    console.log('🔍 Applying admin filter...\n');
    const filteredRequests = stockRequests.filter((req: any) => {
      // Check if stockistId is an admin ID
      if (adminIds.includes(req.stockistId)) {
        console.log(`✅ INCLUDED (order-based): ${req.id} - stockistId is admin`);
        return true;
      }
      
      // Check if it's a stockist self-request
      if (req.stockist && req.stockist.storeOwnerLevel && 
          ['S', 'M', 'C', 'D'].includes(req.stockist.storeOwnerLevel)) {
        const stockistFullName = req.stockist.fullName || 
          `${req.stockist.firstName || ''} ${req.stockist.surname || ''}`.trim();
        const requestStockistName = req.stockistName || '';
        const match = stockistFullName.toLowerCase() === requestStockistName.toLowerCase();
        if (match) {
          console.log(`✅ INCLUDED (stockist self-request): ${req.id}`);
        } else {
          console.log(`❌ EXCLUDED (downline request): ${req.id} - name mismatch`);
        }
        return match;
      }
      
      console.log(`❌ EXCLUDED (no match): ${req.id}`);
      return false;
    });
    
    console.log(`\n📊 Final result: ${filteredRequests.length} request(s) after filtering`);
    console.log('');
    console.log('Requests that will be shown:');
    filteredRequests.forEach((req: any) => {
      console.log(`  - ${req.id} (${req.stockistName})`);
    });
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
