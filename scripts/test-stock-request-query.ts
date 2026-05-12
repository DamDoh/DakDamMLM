import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔍 Testing stock request query for admin...\n');
    
    // Simulate what the API does
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
    console.log('Stockist IDs:', stockistIds);
    console.log('All IDs (combined):', allIds);
    console.log('');
    
    // Query with where clause
    const whereClause: any = {
      status: 'pending',
      stockistId: { in: allIds }
    };
    
    console.log('Query whereClause:', JSON.stringify(whereClause, null, 2));
    console.log('');
    
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
      orderBy: { createdDate: 'desc' }
    });
    
    console.log(`Found ${stockRequests.length} stock request(s) matching query:`);
    stockRequests.forEach((req: any, index: number) => {
      console.log(`\n${index + 1}. Request ID: ${req.id}`);
      console.log(`   Stockist ID: ${req.stockistId}`);
      console.log(`   Is admin ID? ${adminIds.includes(req.stockistId)}`);
      console.log(`   Stockist Name: ${req.stockistName}`);
      console.log(`   Status: ${req.status}`);
      console.log(`   Items: ${req.items?.length || 0}`);
    });
    
    // Now test the filter
    console.log('\n🔍 Testing filter logic...\n');
    const adminIdsForFilter = adminUsers.map(a => a.id);
    const filtered = stockRequests.filter((req: any) => {
      if (adminIdsForFilter.includes(req.stockistId)) {
        console.log(`✅ Including order-based request: ${req.id} (stockistId: ${req.stockistId})`);
        return true;
      }
      
      if (req.stockist && req.stockist.storeOwnerLevel && 
          ['S', 'M', 'C', 'D'].includes(req.stockist.storeOwnerLevel)) {
        const stockistFullName = req.stockist.fullName || 
          `${req.stockist.firstName || ''} ${req.stockist.surname || ''}`.trim();
        const requestStockistName = req.stockistName || '';
        const match = stockistFullName.toLowerCase() === requestStockistName.toLowerCase();
        if (match) {
          console.log(`✅ Including self-request from stockist: ${req.id}`);
        }
        return match;
      }
      console.log(`❌ Filtering out: ${req.id} (no match)`);
      return false;
    });
    
    console.log(`\n📊 Result: ${filtered.length} request(s) after filtering`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
