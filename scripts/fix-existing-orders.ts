import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔍 Finding all approved stock requests and matching orders...\n');
    
    // Find all approved stock requests where stockistId is an admin (order-based requests)
    const adminUsers = await prisma.user.findMany({
      where: {
        isAdmin: true,
        active: true,
        deleted: false
      },
      select: { id: true }
    });
    
    const adminIds = adminUsers.map(a => a.id);
    
    const approvedStockRequests = await (prisma as any).stockRequest.findMany({
      where: {
        status: 'approved',
        stockistId: { in: adminIds }
      },
      select: {
        id: true,
        stockistName: true,
        status: true,
        createdDate: true,
        stockistId: true
      }
    });
    
    console.log(`Found ${approvedStockRequests.length} approved stock request(s) with admin stockistId:\n`);
    
    for (const sr of approvedStockRequests) {
      console.log(`Stock Request: ${sr.id}`);
      console.log(`  Stockist Name: ${sr.stockistName}`);
      console.log(`  Created: ${sr.createdDate}`);
      
      // Try to find matching order by:
      // 1. If stockistName starts with "ORDER:", extract orderId
      if (sr.stockistName && sr.stockistName.startsWith('ORDER:')) {
        const orderIdMatch = sr.stockistName.match(/^ORDER:([^|]+)/);
        if (orderIdMatch && orderIdMatch[1]) {
          const orderId = orderIdMatch[1];
          console.log(`  Order ID from name: ${orderId}`);
          
          const updated = await prisma.order.updateMany({
            where: {
              orderId: orderId,
              status: 'Pending'
            },
            data: {
              status: 'Fulfilled'
            }
          });
          
          if (updated.count > 0) {
            console.log(`  ✅ Updated order ${orderId} to Fulfilled`);
          } else {
            const order = await prisma.order.findFirst({
              where: { orderId: orderId },
              select: { status: true }
            });
            console.log(`  ℹ️  Order ${orderId} status: ${order?.status || 'Not found'}`);
          }
        }
      } else {
        // 2. Find order by customer name and date
        const customerName = sr.stockistName;
        console.log(`  Searching for order by customer name: ${customerName}`);
        
        // Find user by name
        const customer = await prisma.user.findFirst({
          where: {
            OR: [
              { fullName: { contains: customerName, mode: 'insensitive' } },
              { firstName: { contains: customerName.split(' ')[0] || '', mode: 'insensitive' } }
            ]
          },
          select: { id: true, fullName: true }
        });
        
        if (customer) {
          console.log(`  Found customer: ${customer.fullName} (${customer.id})`);
          
          // Find pending orders for this customer created around the same time
          const orderDate = new Date(sr.createdDate);
          const startDate = new Date(orderDate.getTime() - 24 * 60 * 60 * 1000); // 1 day before
          const endDate = new Date(orderDate.getTime() + 24 * 60 * 60 * 1000); // 1 day after
          
          const orders = await prisma.order.findMany({
            where: {
              userId: customer.id,
              status: 'Pending',
              createdAt: {
                gte: startDate,
                lte: endDate
              }
            },
            select: {
              id: true,
              orderId: true,
              status: true,
              createdAt: true
            }
          });
          
          if (orders.length > 0) {
            console.log(`  Found ${orders.length} pending order(s) around that time:`);
            for (const order of orders) {
              const updated = await prisma.order.update({
                where: { id: order.id },
                data: { status: 'Fulfilled' }
              });
              console.log(`    ✅ Updated ${order.orderId} to Fulfilled`);
            }
          } else {
            console.log(`  ℹ️  No pending orders found for this customer around that time`);
          }
        } else {
          console.log(`  ⚠️  Customer not found by name`);
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
