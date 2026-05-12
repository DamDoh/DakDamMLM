import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔍 Checking stock requests created from orders...\n');
    
    // Get all stock requests where stockistId is an admin
    const adminUsers = await prisma.user.findMany({
      where: {
        isAdmin: true,
        active: true,
        deleted: false
      },
      select: { id: true, email: true, fullName: true }
    });
    
    console.log(`Found ${adminUsers.length} admin user(s):`);
    adminUsers.forEach(admin => {
      console.log(`  - ${admin.email} (${admin.fullName}) - ID: ${admin.id}`);
    });
    
    const adminIds = adminUsers.map(a => a.id);
    
    if (adminIds.length === 0) {
      console.log('\n❌ No admin users found! Stock requests from orders cannot be created.');
      return;
    }
    
    // Find stock requests where stockistId is an admin (these are from orders)
    const stockRequests = await (prisma as any).stockRequest.findMany({
      where: {
        stockistId: { in: adminIds },
        status: 'pending'
      },
      include: {
        items: true,
        stockist: {
          select: {
            id: true,
            email: true,
            fullName: true,
            isAdmin: true
          }
        }
      },
      orderBy: { createdDate: 'desc' },
      take: 10
    });
    
    console.log(`\n📦 Found ${stockRequests.length} pending stock request(s) from orders:`);
    
    if (stockRequests.length === 0) {
      console.log('  - No pending stock requests found where stockistId is an admin user.');
      console.log('\n💡 This means either:');
      console.log('  1. No orders have been placed yet');
      console.log('  2. Stock requests were not created when orders were placed');
      console.log('  3. All stock requests have been processed (approved/rejected)');
    } else {
      stockRequests.forEach((req: any, index: number) => {
        console.log(`\n${index + 1}. Stock Request ID: ${req.id}`);
        console.log(`   - Status: ${req.status}`);
        console.log(`   - Stockist ID (admin): ${req.stockistId}`);
        console.log(`   - Stockist Name (customer): ${req.stockistName}`);
        console.log(`   - Stockist Level: ${req.stockistLevel}`);
        console.log(`   - Created: ${req.createdDate}`);
        console.log(`   - Items: ${req.items?.length || 0}`);
        if (req.items && req.items.length > 0) {
          req.items.forEach((item: any) => {
            console.log(`     • ${item.productName} x${item.requestedQuantity}`);
          });
        }
      });
    }
    
    // Also check recent orders
    console.log('\n📋 Checking recent orders...\n');
    const recentOrders = await prisma.order.findMany({
      where: {
        status: 'Pending'
      },
      include: {
        items: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    console.log(`Found ${recentOrders.length} pending order(s):`);
    for (let index = 0; index < recentOrders.length; index++) {
      const order: any = recentOrders[index];
      // Fetch user data separately since Order doesn't have user relation
      const user = await prisma.user.findUnique({
        where: { id: order.userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          memberId: true
        }
      }).catch(() => null);
      
      console.log(`\n${index + 1}. Order ID: ${order.orderId}`);
      console.log(`   - User: ${user?.fullName || 'Unknown'} (${user?.email || order.userId})`);
      console.log(`   - Created: ${order.createdAt}`);
      console.log(`   - Items: ${order.items?.length || 0}`);
      console.log(`   - Total: $${order.totalAmount || 0}`);
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
