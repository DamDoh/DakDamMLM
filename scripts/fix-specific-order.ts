import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const targetOrderId = 'ORD-1767865549817-yjlg84';
    console.log(`🔍 Checking order: ${targetOrderId}\n`);
    
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
      console.log(`❌ Order not found: ${targetOrderId}`);
      return;
    }
    
    console.log(`Order found:`);
    console.log(`  ID: ${order.id}`);
    console.log(`  Order ID: ${order.orderId}`);
    console.log(`  Status: ${order.status}`);
    console.log(`  User ID: ${order.userId}`);
    console.log(`  Created: ${order.createdAt}`);
    console.log(`  Items: ${order.items.length}`);
    console.log(`  Total: $${order.totalAmount || order.amount}`);
    
    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: order.userId },
      select: { fullName: true, firstName: true, surname: true, memberId: true }
    });
    
    const customerName = user?.fullName || `${user?.firstName || ''} ${user?.surname || ''}`.trim();
    console.log(`  Customer: ${customerName}\n`);
    
    // Find approved stock requests for this customer/admin
    const adminUsers = await prisma.user.findMany({
      where: { isAdmin: true },
      select: { id: true }
    });
    const adminIds = adminUsers.map(a => a.id);
    
    const orderDate = new Date(order.createdAt);
    const startDate = new Date(orderDate.getTime() - 2 * 60 * 60 * 1000); // 2 hours before
    const endDate = new Date(orderDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours after
    
    console.log(`Searching for approved stock requests:`);
    console.log(`  Customer: ${customerName}`);
    console.log(`  Date range: ${startDate.toISOString()} to ${endDate.toISOString()}\n`);
    
    const stockRequests = await (prisma as any).stockRequest.findMany({
      where: {
        stockistId: { in: adminIds },
        status: 'approved',
        createdDate: {
          gte: startDate,
          lte: endDate
        }
      }
    });
    
    console.log(`Found ${stockRequests.length} approved stock request(s) in that time range:\n`);
    
    for (const sr of stockRequests) {
      console.log(`  Stock Request: ${sr.id}`);
      console.log(`    Stockist Name: ${sr.stockistName}`);
      console.log(`    Created: ${sr.createdDate}`);
      
      // Check if name matches
      const nameMatch = sr.stockistName && (
        sr.stockistName.includes(customerName) ||
        sr.stockistName.includes(order.orderId) ||
        customerName.includes(sr.stockistName.replace(/^ORDER:[^|]+\|/, ''))
      );
      
      if (nameMatch || sr.stockistName?.startsWith(`ORDER:${order.orderId}|`)) {
        console.log(`    ✅ MATCH FOUND! Updating order status...\n`);
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'Fulfilled' }
        });
        console.log(`    ✅ Order ${order.orderId} status updated to 'Fulfilled'`);
        return;
      }
      console.log('');
    }
    
    console.log(`⚠️  No matching approved stock request found for this order.`);
    console.log(`   The stock request might not have been created yet, or was rejected.`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
