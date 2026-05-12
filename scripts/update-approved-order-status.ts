import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔍 Finding approved stock requests from orders...\n');
    
    // Find all approved stock requests where stockistName starts with "ORDER:"
    const approvedStockRequests = await (prisma as any).stockRequest.findMany({
      where: {
        status: 'approved',
        stockistName: {
          startsWith: 'ORDER:'
        }
      },
      select: {
        id: true,
        stockistName: true,
        status: true,
        processedDate: true
      }
    });
    
    console.log(`Found ${approvedStockRequests.length} approved stock request(s) from orders:`);
    
    for (const sr of approvedStockRequests) {
      // Extract orderId from format: "ORDER:ORDER_ID|Customer Name"
      const orderIdMatch = sr.stockistName.match(/^ORDER:([^|]+)/);
      if (orderIdMatch && orderIdMatch[1]) {
        const orderId = orderIdMatch[1];
        
        console.log(`\n📦 Processing stock request ${sr.id}:`);
        console.log(`   Order ID: ${orderId}`);
        console.log(`   Customer: ${sr.stockistName.split('|')[1] || 'Unknown'}`);
        
        // Find and update the order
        const updated = await prisma.order.updateMany({
          where: {
            orderId: orderId,
            status: 'Pending' // Only update if still pending
          },
          data: {
            status: 'Fulfilled'
          }
        });
        
        if (updated.count > 0) {
          console.log(`   ✅ Order status updated to 'Fulfilled'`);
        } else {
          // Check if order exists with different status
          const order = await prisma.order.findFirst({
            where: { orderId: orderId },
            select: { id: true, orderId: true, status: true }
          });
          
          if (order) {
            console.log(`   ⚠️  Order found but status is already: ${order.status}`);
          } else {
            console.log(`   ❌ Order not found with orderId: ${orderId}`);
          }
        }
      }
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
