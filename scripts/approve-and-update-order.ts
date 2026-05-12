import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const targetOrderId = 'ORD-1767865549817-yjlg84';
    console.log(`🔍 Finding and updating order: ${targetOrderId}\n`);
    
    // Find the order
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { orderId: targetOrderId },
          { id: targetOrderId }
        ]
      }
    });
    
    if (!order) {
      console.log(`❌ Order not found`);
      return;
    }
    
    // Find approved stock request for this order
    const stockRequest = await (prisma as any).stockRequest.findFirst({
      where: {
        stockistName: { startsWith: `ORDER:${order.orderId}|` },
        status: 'approved'
      }
    });
    
    if (stockRequest) {
      console.log(`✅ Found approved stock request: ${stockRequest.id}`);
      console.log(`   Updating order status to 'Fulfilled'...\n`);
      
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'Fulfilled' }
      });
      
      console.log(`✅ Order ${order.orderId} status updated to 'Fulfilled'!`);
    } else {
      // Check for pending stock request
      const pendingStockRequest = await (prisma as any).stockRequest.findFirst({
        where: {
          stockistName: { startsWith: `ORDER:${order.orderId}|` },
          status: 'pending'
        }
      });
      
      if (pendingStockRequest) {
        console.log(`⏳ Found pending stock request: ${pendingStockRequest.id}`);
        console.log(`   Waiting for admin approval...`);
        console.log(`   Once approved, order status will automatically update to 'Fulfilled'`);
      } else {
        console.log(`⚠️  No stock request found for this order`);
        console.log(`   Order status: ${order.status}`);
        console.log(`   You can manually update it if needed.`);
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
