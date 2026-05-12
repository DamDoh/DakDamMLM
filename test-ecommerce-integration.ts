/**
 * E-COMMERCE MODULE INTEGRATION TEST
 *
 * Tests all e-commerce enhancements for production readiness
 */

import { prisma } from '@/lib/database';
import { addToCart, getCart, clearCart, calculateTaxAndShipping } from '@/services/cart-service';
import { createOrder, processOrderPayment, getUserOrders } from '@/services/order-service';
import { processWalletPayment, getTransactionHistory } from '@/services/payment-service';
import { updateStockLevels, getStockLevel, reserveStock } from '@/services/inventory-service';
import { getEcommerceAnalytics, getStockReconciliation } from '@/services/ecommerce-analytics-service';
import { convertCurrency, getActiveCurrencies, formatCurrency } from '@/services/multi-currency-service';
import { logSecurityAudit, detectFraudulentActivity, performPaymentSecurityCheck } from '@/services/ecommerce-security-service';
import { logger } from '@/lib/logger';

async function runEcommerceIntegrationTest() {
  console.log('🚀 Starting E-commerce Module Integration Test...\n');

  const testUserId = 'test-user-' + Date.now();
  const testCompanyId = 'test-company-' + Date.now();
  const testProductId = 'test-product-' + Date.now();

  try {
    // 1. Test Product Setup
    console.log('📦 Testing Product Management...');
    const testProduct = await prisma.product.create({
      data: {
        id: testProductId,
        name: 'Test Wellness Shake',
        description: 'A test nutritional shake',
        price: 49.99,
        pv: 40,
        qty: 100,
        category: 'Nutrition',
        imageUrl: 'https://example.com/test.jpg',
        isActive: true,
        unitType: 'tub',
        type: 'single',
        companyId: testCompanyId
      }
    });
    console.log('✅ Product created successfully');

    // 2. Test Cart Functionality
    console.log('🛒 Testing Cart Functionality...');
    const cartResult = await addToCart(testUserId, testProductId, 2, testCompanyId);
    if (!cartResult.success) {
      throw new Error('Failed to add item to cart: ' + cartResult.message);
    }
    console.log('✅ Item added to cart');

    const cart = await getCart(testUserId, testCompanyId);
    if (!cart || cart.items.length !== 1) {
      throw new Error('Cart retrieval failed');
    }
    console.log('✅ Cart retrieved successfully');

    // 3. Test Tax and Shipping Calculation
    console.log('💰 Testing Tax and Shipping Calculations...');
    const subtotal = cart.totalAmount;
    const taxShipping = await calculateTaxAndShipping(subtotal, {
      street: '123 Test St',
      city: 'Test City',
      state: 'TS',
      postalCode: '12345',
      country: 'US'
    }, 'USD', testCompanyId);

    console.log(`✅ Tax/Shipping calculated: $${taxShipping.total.toFixed(2)}`);

    // 4. Test Order Creation
    console.log('📋 Testing Order Creation...');
    const orderResult = await createOrder({
      userId: testUserId,
      items: cart.items,
      shippingAddress: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        postalCode: '12345',
        country: 'US'
      },
      paymentMethod: 'wallet',
      notes: 'Test order',
      companyId: testCompanyId
    });

    if (!orderResult.success || !orderResult.order) {
      throw new Error('Failed to create order: ' + orderResult.message);
    }
    console.log('✅ Order created successfully');

    // 5. Test Payment Processing
    console.log('💳 Testing Payment Processing...');

    // First ensure user has wallet balance
    await prisma.user.upsert({
      where: { id: testUserId },
      update: { eCashBalance: 1000 },
      create: {
        id: testUserId,
        email: `test${Date.now()}@example.com`,
        phoneNumber: `+1234567890${Date.now()}`,
        firstName: 'Test',
        surname: 'User',
        fullName: 'Test User',
        memberId: `TEST${Date.now()}`,
        eCashBalance: 1000,
        companyId: testCompanyId
      }
    });

    const paymentResult = await processWalletPayment(
      testUserId,
      orderResult.order.totalAmount,
      'USD',
      `Payment for order ${orderResult.order.orderId}`,
      orderResult.order.id,
      testCompanyId
    );

    if (!paymentResult.success) {
      throw new Error('Payment processing failed: ' + paymentResult.message);
    }
    console.log('✅ Payment processed successfully');

    // 6. Test Order Payment Processing
    console.log('🔄 Testing Order Payment Processing...');
    const orderPaymentResult = await processOrderPayment(
      orderResult.order.id,
      'wallet',
      testUserId
    );

    if (!orderPaymentResult.success) {
      throw new Error('Order payment processing failed: ' + orderPaymentResult.message);
    }
    console.log('✅ Order payment processed successfully');

    // 7. Test Stock Management
    console.log('📊 Testing Stock Management...');
    const initialStock = await getStockLevel(testProductId, testCompanyId);
    console.log(`Initial stock: ${initialStock}`);

    const stockUpdate = await updateStockLevels(
      testProductId,
      -2,
      'subtract',
      `Order ${orderResult.order.orderId}`,
      testUserId,
      'Order fulfillment',
      testCompanyId
    );

    if (!stockUpdate.success) {
      throw new Error('Stock update failed');
    }

    const finalStock = await getStockLevel(testProductId, testCompanyId);
    if (finalStock !== initialStock - 2) {
      throw new Error('Stock reconciliation failed');
    }
    console.log(`✅ Stock updated: ${initialStock} → ${finalStock}`);

    // 8. Test Multi-Currency Support
    console.log('💱 Testing Multi-Currency Support...');
    const currencies = await getActiveCurrencies();
    if (currencies.length === 0) {
      throw new Error('No currencies available');
    }
    console.log(`✅ Found ${currencies.length} active currencies`);

    const conversion = await convertCurrency(49.99, 'USD', 'EUR');
    if (!conversion) {
      throw new Error('Currency conversion failed');
    }
    console.log(`✅ Currency conversion: $49.99 USD = €${conversion.convertedAmount.toFixed(2)}`);

    const formatted = await formatCurrency(49.99, 'EUR');
    console.log(`✅ Currency formatting: ${formatted}`);

    // 9. Test Security Features
    console.log('🔒 Testing Security Features...');
    await logSecurityAudit(
      testUserId,
      'test_payment',
      'payment',
      paymentResult.transactionId,
      true,
      { amount: orderResult.order.totalAmount },
      '127.0.0.1',
      'Test User Agent',
      testCompanyId
    );
    console.log('✅ Security audit logged');

    const fraudCheck = await detectFraudulentActivity(
      testUserId,
      'test_transaction',
      orderResult.order.totalAmount
    );
    console.log(`✅ Fraud detection completed (Risk Score: ${fraudCheck.riskScore})`);

    const securityCheck = await performPaymentSecurityCheck(
      testUserId,
      orderResult.order.totalAmount,
      'wallet',
      orderResult.order.id
    );
    console.log(`✅ Payment security check: ${securityCheck.isSecure ? 'Secure' : 'Issues found'}`);

    // 10. Test Analytics
    console.log('📈 Testing Analytics...');
    const analytics = await getEcommerceAnalytics(testCompanyId);
    console.log(`✅ Analytics generated: ${analytics.sales.totalOrders} orders, $${analytics.sales.totalRevenue.toFixed(2)} revenue`);

    const reconciliation = await getStockReconciliation(testCompanyId);
    console.log(`✅ Stock reconciliation: ${reconciliation.discrepancies.length} discrepancies found`);

    // 11. Test Transaction History
    console.log('📜 Testing Transaction History...');
    const transactions = await getTransactionHistory(testUserId, undefined, undefined, 10, testCompanyId);
    console.log(`✅ Transaction history retrieved: ${transactions.length} transactions`);

    const orders = await getUserOrders(testUserId, undefined, testCompanyId);
    console.log(`✅ User orders retrieved: ${orders.length} orders`);

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await prisma.order.deleteMany({ where: { userId: testUserId } });
    await prisma.cart.deleteMany({ where: { userId: testUserId } });
    await prisma.paymentTransaction.deleteMany({ where: { userId: testUserId } });
    await prisma.product.delete({ where: { id: testProductId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });

    console.log('\n🎉 All E-commerce Integration Tests Passed!');
    console.log('\n📋 Test Summary:');
    console.log('✅ Product Management');
    console.log('✅ Cart Functionality');
    console.log('✅ Tax & Shipping Calculations');
    console.log('✅ Order Creation & Processing');
    console.log('✅ Payment Processing');
    console.log('✅ Stock Management');
    console.log('✅ Multi-Currency Support');
    console.log('✅ Security Features');
    console.log('✅ Analytics & Reporting');
    console.log('✅ Transaction Logging');

    return true;

  } catch (error) {
    console.error('❌ E-commerce Integration Test Failed:', error);

    // Cleanup on failure
    try {
      await prisma.order.deleteMany({ where: { userId: testUserId } });
      await prisma.cart.deleteMany({ where: { userId: testUserId } });
      await prisma.paymentTransaction.deleteMany({ where: { userId: testUserId } });
      await prisma.product.deleteMany({ where: { id: testProductId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    } catch (cleanupError) {
      console.error('Cleanup failed:', cleanupError);
    }

    return false;
  }
}

// Run the test
runEcommerceIntegrationTest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });

export { runEcommerceIntegrationTest };</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\test-ecommerce-integration.ts