import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔍 Checking all pending orders...\n');
    
    const pendingOrders = await prisma.order.findMany({
      where: {
        status: 'Pending'
      },
      include: {
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`Found ${pendingOrders.length} pending order(s):\n`);
    
    for (const order of pendingOrders) {
      console.log(`Order ID: ${order.orderId}`);
      console.log(`  Database ID: ${order.id}`);
      console.log(`  Status: ${order.status}`);
      console.log(`  Created: ${order.createdAt}`);
      console.log(`  Items: ${order.items.length}`);
      console.log(`  Total: $${order.totalAmount || order.amount}`);
      
      // Check if there's an approved stock request for this order
      // Find by matching customer and date
      const user = await prisma.user.findUnique({
        where: { id: order.userId },
        select: { fullName: true, firstName: true, surname: true }
      });
      
      const customerName = user?.fullName || `${user?.firstName || ''} ${user?.surname || ''}`.trim();
      
      if (customerName) {
        const adminUsers = await prisma.user.findMany({
          where: { isAdmin: true },
          select: { id: true }
        });
        const adminIds = adminUsers.map(a => a.id);
        
        const orderDate = new Date(order.createdAt);
        const startDate = new Date(orderDate.getTime() - 24 * 60 * 60 * 1000);
        const endDate = new Date(orderDate.getTime() + 24 * 60 * 60 * 1000);
        
        const stockRequests = await (prisma as any).stockRequest.findMany({
          where: {
            stockistId: { in: adminIds },
            status: 'approved',
            OR: [
              { stockistName: customerName },
              { stockistName: { startsWith: `ORDER:${order.orderId}|` } }
            ],
            createdDate: {
              gte: startDate,
              lte: endDate
            }
          }
        });
        
        if (stockRequests.length > 0) {
          console.log(`  ✅ Found ${stockRequests.length} approved stock request(s) - updating order to Fulfilled`);
          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'Fulfilled' }
          });
        } else {
          console.log(`  ⚠️  No approved stock request found`);
        }
      }
      
      console.log('');
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
