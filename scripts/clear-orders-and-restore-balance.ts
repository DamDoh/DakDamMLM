import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Find user RiThy VoNg
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { fullName: { contains: 'RiThy', mode: 'insensitive' } },
          { firstName: { contains: 'RiThy', mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        memberId: true,
        fullName: true,
        firstName: true,
        surname: true
      }
    });

    if (!user) {
      console.log('❌ User RiThy VoNg not found');
      return;
    }

    console.log(`Found user: ${user.fullName || `${user.firstName} ${user.surname}`} (${user.memberId})`);
    console.log(`User ID: ${user.id}\n`);

    // Get current balance
    const allCommissions = await prisma.commission.findMany({
      where: { userId: user.id }
    });
    const currentBalance = allCommissions.reduce((sum, c) => sum + c.amount, 0);
    console.log(`Current E-Cash Balance: $${currentBalance.toFixed(2)}\n`);

    // Find all orders for this user
    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      include: { items: true }
    });

    console.log(`📦 Found ${orders.length} order(s) to delete:\n`);
    orders.forEach(order => {
      console.log(`   - Order ID: ${order.orderId}`);
      console.log(`     Status: ${order.status}`);
      console.log(`     Amount: $${order.totalAmount || order.amount}`);
      console.log(`     Items: ${order.items.length}`);
      console.log(`     Date: ${order.createdAt.toLocaleDateString()}`);
      console.log('');
    });

    // Find E-Cash Purchase commissions
    const purchaseCommissions = await prisma.commission.findMany({
      where: {
        userId: user.id,
        type: 'E-Cash Purchase'
      }
    });

    console.log(`🛒 Found ${purchaseCommissions.length} E-Cash Purchase commission(s) to delete:\n`);
    purchaseCommissions.forEach(comm => {
      console.log(`   - Commission ID: ${comm.id}`);
      console.log(`     Amount: $${comm.amount}`);
      console.log(`     Description: ${comm.description || 'No description'}`);
      console.log(`     Date: ${comm.date.toLocaleDateString()}`);
      console.log('');
    });

    if (orders.length === 0 && purchaseCommissions.length === 0) {
      console.log('✅ No orders or purchase commissions to clear');
      return;
    }

    // Delete orders and purchase commissions in a transaction
    console.log('🗑️  Deleting orders and purchase commissions...\n');

    await prisma.$transaction(async (tx) => {
      // Delete order items first (cascade should handle this, but being explicit)
      for (const order of orders) {
        await tx.orderItem.deleteMany({
          where: { orderId: order.orderId }
        });
      }

      // Delete orders
      if (orders.length > 0) {
        const deletedOrders = await tx.order.deleteMany({
          where: { userId: user.id }
        });
        console.log(`   ✅ Deleted ${deletedOrders.count} order(s)`);
      }

      // Delete E-Cash Purchase commissions
      if (purchaseCommissions.length > 0) {
        const deletedCommissions = await tx.commission.deleteMany({
          where: {
            userId: user.id,
            type: 'E-Cash Purchase'
          }
        });
        console.log(`   ✅ Deleted ${deletedCommissions.count} E-Cash Purchase commission(s)`);
      }
    });

    // Verify new balance
    const updatedCommissions = await prisma.commission.findMany({
      where: { userId: user.id }
    });
    const newBalance = updatedCommissions.reduce((sum, c) => sum + c.amount, 0);

    console.log('\n✅ Cleanup complete!\n');
    console.log(`📊 Balance Summary:`);
    console.log(`   Previous Balance: $${currentBalance.toFixed(2)}`);
    console.log(`   New Balance: $${newBalance.toFixed(2)}`);
    console.log(`   Difference: $${(newBalance - currentBalance).toFixed(2)}\n`);

    // Verify no orders remain
    const remainingOrders = await prisma.order.count({
      where: { userId: user.id }
    });

    if (remainingOrders === 0) {
      console.log('✅ All orders cleared successfully');
    } else {
      console.log(`⚠️  Warning: ${remainingOrders} order(s) still exist`);
    }

    // Verify no purchase commissions remain
    const remainingPurchases = await prisma.commission.count({
      where: {
        userId: user.id,
        type: 'E-Cash Purchase'
      }
    });

    if (remainingPurchases === 0) {
      console.log('✅ All E-Cash Purchase commissions cleared successfully');
    } else {
      console.log(`⚠️  Warning: ${remainingPurchases} E-Cash Purchase commission(s) still exist`);
    }

    console.log('\n✅ Ready for testing! E-Cash balance is now $' + newBalance.toFixed(2));
    console.log('   You can now make a new purchase and test the checkout flow.');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
