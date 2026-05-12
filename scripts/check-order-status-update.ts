import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const orderId = 'cmk5ga3f3000kzle1blfcs8fx';
    console.log(`🔍 Checking order status for: ${orderId}\n`);
    
    // Find order by ID or orderId
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id: orderId },
          { orderId: orderId }
        ]
      },
      include: {
        items: true
      }
    });
    
    if (!order) {
      console.log(`❌ Order not found: ${orderId}`);
      
      // Try to find by partial match
      const allOrders = await prisma.order.findMany({
        where: {
          userId: {
            startsWith: 'cmk40'
          }
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderId: true,
          status: true,
          createdAt: true
        }
      });
      
      console.log('\nRecent orders for RiThy VoNg:');
      allOrders.forEach(o => {
        console.log(`  - Order ID: ${o.orderId}`);
        console.log(`    Database ID: ${o.id}`);
        console.log(`    Status: ${o.status}`);
        console.log(`    Created: ${o.createdAt.toLocaleDateString()}`);
        console.log('');
      });
      
      return;
    }
    
    console.log(`Order found:`);
    console.log(`  Database ID: ${order.id}`);
    console.log(`  Order ID: ${order.orderId}`);
    console.log(`  Status: ${order.status}`);
    console.log(`  Created: ${order.createdAt}`);
    console.log(`  Items: ${order.items.length}\n`);
    
    // Check for approved stock request
    const stockRequests = await (prisma as any).stockRequest.findMany({
      where: {
        stockistName: { startsWith: `ORDER:${order.orderId}|` },
        status: { in: ['approved', 'Approved'] }
      },
      orderBy: { processedDate: 'desc' }
    });
    
    console.log(`Found ${stockRequests.length} approved stock request(s) for this order:\n`);
    
    stockRequests.forEach((sr: any) => {
      console.log(`  Stock Request: ${sr.id}`);
      console.log(`    Status: ${sr.status}`);
      console.log(`    Processed: ${sr.processedDate ? new Date(sr.processedDate).toLocaleString() : 'Not set'}`);
      console.log(`    Stockist Name: ${sr.stockistName}`);
      console.log('');
    });
    
    // If order is still pending but stock request is approved, update it
    if (order.status === 'Pending' && stockRequests.length > 0) {
      console.log(`⚠️  Order is still 'Pending' but stock request is approved!`);
      console.log(`   Updating order status to 'Fulfilled'...\n`);
      
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'Fulfilled' }
      });
      
      console.log(`✅ Order status updated to 'Fulfilled'!`);
    } else if (order.status !== 'Pending') {
      console.log(`✅ Order status is already: ${order.status}`);
    } else {
      console.log(`⚠️  No approved stock request found for this order`);
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
