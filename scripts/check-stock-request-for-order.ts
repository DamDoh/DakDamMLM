import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const targetOrderId = 'ORD-1767865549817-yjlg84';
    console.log(`🔍 Checking stock request for order: ${targetOrderId}\n`);
    
    // Find the order
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { orderId: targetOrderId },
          { id: targetOrderId }
        ]
      },
      include: {
        items: true
      }
    });
    
    if (!order) {
      console.log(`❌ Order not found`);
      return;
    }
    
    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: order.userId },
      select: { fullName: true, firstName: true, surname: true }
    });
    
    const customerName = user?.fullName || `${user?.firstName || ''} ${user?.surname || ''}`.trim();
    
    // Find all stock requests (pending or approved) for this customer/admin
    const adminUsers = await prisma.user.findMany({
      where: { isAdmin: true },
      select: { id: true }
    });
    const adminIds = adminUsers.map(a => a.id);
    
    const orderDate = new Date(order.createdAt);
    const startDate = new Date(orderDate.getTime() - 2 * 60 * 60 * 1000);
    const endDate = new Date(orderDate.getTime() + 2 * 60 * 60 * 1000);
    
    console.log(`Order: ${order.orderId}`);
    console.log(`Customer: ${customerName}`);
    console.log(`Created: ${order.createdAt}\n`);
    
    const stockRequests = await (prisma as any).stockRequest.findMany({
      where: {
        stockistId: { in: adminIds },
        OR: [
          { stockistName: customerName },
          { stockistName: { startsWith: `ORDER:${order.orderId}|` } },
          { stockistName: { startsWith: 'ORDER:' } }
        ],
        createdDate: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        items: true
      },
      orderBy: { createdDate: 'desc' }
    });
    
    console.log(`Found ${stockRequests.length} stock request(s) for this order:\n`);
    
    for (const sr of stockRequests) {
      console.log(`Stock Request: ${sr.id}`);
      console.log(`  Status: ${sr.status}`);
      console.log(`  Stockist Name: ${sr.stockistName}`);
      console.log(`  Created: ${sr.createdDate}`);
      console.log(`  Items: ${sr.items.length}`);
      
      // Check if items match
      const itemsMatch = sr.items.length === order.items.length;
      console.log(`  Items match: ${itemsMatch}`);
      
      if (sr.status === 'approved') {
        console.log(`  ✅ APPROVED - Updating order status...`);
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'Fulfilled' }
        });
        console.log(`  ✅ Order ${order.orderId} updated to 'Fulfilled'`);
      } else if (sr.status === 'pending') {
        console.log(`  ⏳ PENDING - Waiting for admin approval`);
      } else {
        console.log(`  Status: ${sr.status}`);
      }
      
      console.log('');
    }
    
    if (stockRequests.length === 0) {
      console.log(`⚠️  No stock request found for this order.`);
      console.log(`   A stock request should have been created when the order was placed.`);
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
