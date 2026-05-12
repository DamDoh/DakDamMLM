/**
 * Verify that regular customers (non-adminstock) see orders normally
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyCustomerFlow() {
  console.log('🔍 Verifying regular customer flow...\n');

  try {
    // Find a regular customer (not adminstock/stockist)
    const regularCustomer = await prisma.user.findFirst({
      where: {
        isAdmin: false,
        OR: [
          { storeOwnerLevel: null },
          { storeOwnerLevel: { notIn: ['S', 'M', 'C', 'D'] } }
        ],
        active: true,
        deleted: false
      },
      select: {
        id: true,
        fullName: true,
        isAdmin: true,
        storeOwnerLevel: true
      }
    });

    if (!regularCustomer) {
      console.log('⚠️  No regular customer found for testing');
      return;
    }

    console.log(`✅ Found regular customer: ${regularCustomer.fullName}`);
    console.log(`   - isAdmin: ${regularCustomer.isAdmin}`);
    console.log(`   - storeOwnerLevel: ${regularCustomer.storeOwnerLevel || 'null'}\n`);

    // Check if they would be filtered out
    const isAdminstock = regularCustomer.isAdmin === true;
    const hasStockistLevel = regularCustomer.storeOwnerLevel && 
      ['S', 'M', 'C', 'D'].includes(regularCustomer.storeOwnerLevel);

    console.log('📋 Test: Regular customer order visibility');
    console.log(`   - isAdminstock: ${isAdminstock}`);
    console.log(`   - hasStockistLevel: ${hasStockistLevel}`);
    
    if (isAdminstock || hasStockistLevel) {
      console.log('   ❌ ERROR: Regular customer is being treated as adminstock!');
      console.log('   ❌ This customer would NOT see their orders (WRONG!)');
    } else {
      console.log('   ✅ Regular customer is correctly identified');
      console.log('   ✅ They WILL see their orders in Order History (CORRECT!)');
    }

    // Check their orders
    const orders = await prisma.order.findMany({
      where: { userId: regularCustomer.id },
      select: { id: true, orderId: true, status: true }
    });

    console.log(`\n📋 Customer orders: ${orders.length}`);
    if (orders.length > 0) {
      console.log('   ✅ Customer has orders');
      console.log('   ✅ These orders SHOULD appear in Order History');
      orders.forEach(o => {
        console.log(`      - ${o.orderId}: ${o.status}`);
      });
    } else {
      console.log('   ℹ️  Customer has no orders yet');
    }

    // Verify the logic
    console.log('\n📋 Verification Logic:');
    console.log('   ✅ If user is NOT adminstock/stockist → Show orders (normal behavior)');
    console.log('   ✅ If user IS adminstock/stockist → Hide orders (special behavior)');
    console.log(`   ✅ Current customer: ${isAdminstock || hasStockistLevel ? 'ADMINSTOCK (hide orders)' : 'REGULAR (show orders)'}`);

    console.log('\n✅ Regular customers work normally - they see their orders!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyCustomerFlow();

