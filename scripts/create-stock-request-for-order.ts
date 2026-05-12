import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const targetOrderId = 'ORD-1767865549817-yjlg84';
    console.log(`🔍 Creating stock request for order: ${targetOrderId}\n`);
    
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
    
    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: order.userId },
      select: { fullName: true, firstName: true, surname: true }
    });
    
    const requesterName = user?.fullName || `${user?.firstName || ''} ${user?.surname || ''}`.trim() || 'Unknown User';
    
    // Find admin user
    const adminUser = await prisma.user.findFirst({
      where: {
        isAdmin: true,
        active: true,
        deleted: false
      },
      select: { id: true, fullName: true }
    });
    
    if (!adminUser) {
      console.log(`❌ No admin user found`);
      return;
    }
    
    console.log(`Order found:`);
    console.log(`  Order ID: ${order.orderId}`);
    console.log(`  Customer: ${requesterName}`);
    console.log(`  Items: ${order.items.length}`);
    console.log(`  Total: $${order.totalAmount || order.amount}`);
    console.log(`  Admin: ${adminUser.fullName} (${adminUser.id})\n`);
    
    // Check if stock request already exists
    const existing = await (prisma as any).stockRequest.findFirst({
      where: {
        stockistName: { startsWith: `ORDER:${order.orderId}|` }
      }
    });
    
    if (existing) {
      console.log(`⚠️  Stock request already exists: ${existing.id}`);
      console.log(`   Status: ${existing.status}`);
      if (existing.status === 'approved') {
        console.log(`   ✅ Updating order status to Fulfilled...`);
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'Fulfilled' }
        });
        console.log(`   ✅ Order status updated!`);
      }
      return;
    }
    
    // Get product details for items
    const itemsWithProducts = await Promise.all(
      order.items.map(async (item: any) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { name: true, price: true }
        });
        return {
          ...item,
          productName: product?.name || 'Unknown Product',
          unitPrice: product?.price || item.price
        };
      })
    );
    
    // Calculate totals
    const totalValue = itemsWithProducts.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    
    // Create stock request
    const stockRequest = await (prisma as any).stockRequest.create({
      data: {
        stockistId: adminUser.id,
        stockistName: `ORDER:${order.orderId}|${requesterName}`,
        stockistLevel: 'District',
        status: 'pending',
        totalValue,
        itemCount: order.items.length,
        items: {
          create: itemsWithProducts.map((item: any) => ({
            productId: item.productId,
            productName: item.productName,
            requestedQuantity: item.quantity,
            unitPrice: item.unitPrice
          }))
        }
      },
      include: {
        items: true
      }
    });
    
    console.log(`✅ Stock request created:`);
    console.log(`   ID: ${stockRequest.id}`);
    console.log(`   Status: ${stockRequest.status}`);
    console.log(`   Items: ${stockRequest.items.length}`);
    console.log(`\n   The admin can now approve this stock request, and the order status will update to 'Fulfilled'`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
