import { PrismaClient } from '@prisma/client';
import { logger } from '../src/utils/logger';

const prisma = new PrismaClient();

async function main() {
  logger.info('Starting payment service database seeding');

  // Create sample users (if they don't exist)
  const sampleUsers = [
    {
      id: 'user-1',
      email: 'john.doe@example.com',
      fullName: 'John Doe',
      memberId: 'M001',
      rank: 'Gold',
      isAdmin: false,
    },
    {
      id: 'user-2',
      email: 'jane.smith@example.com',
      fullName: 'Jane Smith',
      memberId: 'M002',
      rank: 'Silver',
      isAdmin: false,
    },
    {
      id: 'user-3',
      email: 'bob.johnson@example.com',
      fullName: 'Bob Johnson',
      memberId: 'M003',
      rank: 'Diamond',
      isAdmin: false,
    },
    {
      id: 'admin-1',
      email: 'admin@example.com',
      fullName: 'System Admin',
      memberId: 'ADMIN001',
      rank: 'Diamond',
      isAdmin: true,
    },
  ];

  for (const user of sampleUsers) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: user as any,
      create: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        memberId: user.memberId,
        rank: user.rank,
        isAdmin: user.isAdmin,
        active: true,
      } as any,
    });
  }

  logger.info(`Seeded ${sampleUsers.length} sample users`);

  // Create wallets for sample users
  for (const user of sampleUsers) {
    await prisma.wallet.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        balance: user.id === 'user-1' ? 250.00 : user.id === 'user-2' ? 150.00 : user.id === 'user-3' ? 500.00 : 0,
        pendingAmount: 0,
        totalEarned: user.id === 'user-1' ? 350.00 : user.id === 'user-2' ? 200.00 : user.id === 'user-3' ? 650.00 : 0,
        totalWithdrawn: user.id === 'user-1' ? 100.00 : user.id === 'user-2' ? 50.00 : user.id === 'user-3' ? 150.00 : 0,
        currency: 'USD',
        isActive: true,
      } as any,
    });
  }

  logger.info('Seeded wallets for sample users');

  // Create sample payment transactions
  const sampleTransactions = [
    {
      transactionId: 'TXN-2025001',
      userId: 'user-1',
      orderId: 'order-1',
      type: 'PAYMENT',
      method: 'CREDIT_CARD',
      provider: 'STRIPE',
      amount: 49.99,
      currency: 'USD',
      status: 'COMPLETED',
      description: 'Premium Protein Shake purchase',
      processedAt: new Date('2025-01-15T10:00:00Z'),
      fees: 1.75,
      netAmount: 48.24,
    },
    {
      transactionId: 'TXN-2025002',
      userId: 'user-2',
      orderId: 'order-2',
      type: 'PAYMENT',
      method: 'PAYPAL',
      provider: 'PAYPAL',
      amount: 39.99,
      currency: 'USD',
      status: 'COMPLETED',
      description: 'Omega-3 Fish Oil purchase',
      processedAt: new Date('2025-01-20T09:30:00Z'),
      fees: 1.40,
      netAmount: 38.59,
    },
    {
      transactionId: 'TXN-2025003',
      userId: 'user-3',
      commissionId: 'comm-1',
      type: 'COMMISSION',
      method: 'BANK_TRANSFER',
      provider: 'BANK',
      amount: 25.00,
      currency: 'USD',
      status: 'COMPLETED',
      description: 'Commission payout for downline sales',
      processedAt: new Date('2025-01-25T14:00:00Z'),
      fees: 0,
      netAmount: 25.00,
    },
    {
      transactionId: 'TXN-2025004',
      userId: 'user-1',
      type: 'WITHDRAWAL',
      method: 'BANK_TRANSFER',
      provider: 'BANK',
      amount: 100.00,
      currency: 'USD',
      status: 'COMPLETED',
      description: 'Wallet withdrawal to bank account',
      processedAt: new Date('2025-01-28T16:00:00Z'),
      fees: 2.50,
      netAmount: 97.50,
    },
    {
      transactionId: 'TXN-2025005',
      userId: 'user-2',
      orderId: 'order-3',
      type: 'PAYMENT',
      method: 'CREDIT_CARD',
      provider: 'STRIPE',
      amount: 29.99,
      currency: 'USD',
      status: 'FAILED',
      description: 'Vitamin C Complex purchase - Payment failed',
      failedAt: new Date('2025-02-01T11:00:00Z'),
      failureReason: 'Insufficient funds',
      fees: 0,
      netAmount: 0,
    },
  ];

  for (const transaction of sampleTransactions) {
    await (prisma as any).paymentTransaction.upsert({
      where: { transactionId: transaction.transactionId },
      update: transaction,
      create: transaction,
    });
  }

  logger.info(`Seeded ${sampleTransactions.length} sample payment transactions`);

  // Create sample payout requests
  const samplePayouts = [
    {
      userId: 'user-3',
      amount: 200.00,
      method: 'BANK_TRANSFER',
      status: 'COMPLETED',
      accountDetails: {
        bankName: 'Chase Bank',
        accountNumber: '****1234',
        routingNumber: '021000021',
      },
      requestedAt: new Date('2025-01-20T10:00:00Z'),
      processedAt: new Date('2025-01-22T14:00:00Z'),
      completedAt: new Date('2025-01-24T09:00:00Z'),
      fees: 5.00,
      netAmount: 195.00,
      transactionId: 'PT_001_1705756800000',
    },
    {
      userId: 'user-1',
      amount: 150.00,
      method: 'PAYPAL',
      status: 'APPROVED',
      accountDetails: {
        paypalEmail: 'john.doe@example.com',
      },
      requestedAt: new Date('2025-02-01T08:00:00Z'),
      fees: 7.50,
      netAmount: 142.50,
    },
    {
      userId: 'user-2',
      amount: 75.00,
      method: 'BANK_TRANSFER',
      status: 'PENDING',
      accountDetails: {
        bankName: 'Bank of America',
        accountNumber: '****5678',
        routingNumber: '121000358',
      },
      requestedAt: new Date('2025-02-05T12:00:00Z'),
      fees: 3.75,
      netAmount: 71.25,
    },
  ];

  for (const payout of samplePayouts) {
    await (prisma as any).payoutRequest.create({
      data: payout,
    });
  }

  logger.info(`Seeded ${samplePayouts.length} sample payout requests`);

  // Create sample wallet transactions
  const sampleWalletTransactions = [
    {
      walletId: 'wallet-user-1',
      userId: 'user-1',
      type: 'CREDIT',
      amount: 25.00,
      balanceBefore: 225.00,
      balanceAfter: 250.00,
      description: 'Commission earned from downline purchase',
      referenceId: 'comm-2',
      referenceType: 'commission',
      createdAt: new Date('2025-01-18T10:00:00Z'),
    },
    {
      walletId: 'wallet-user-1',
      userId: 'user-1',
      type: 'DEBIT',
      amount: 100.00,
      balanceBefore: 250.00,
      balanceAfter: 150.00,
      description: 'Wallet withdrawal to bank account',
      referenceId: 'TXN-2025004',
      referenceType: 'withdrawal',
      createdAt: new Date('2025-01-28T16:00:00Z'),
    },
    {
      walletId: 'wallet-user-2',
      userId: 'user-2',
      type: 'CREDIT',
      amount: 50.00,
      balanceBefore: 100.00,
      balanceAfter: 150.00,
      description: 'Commission earned from team performance',
      referenceId: 'comm-3',
      referenceType: 'commission',
      createdAt: new Date('2025-01-22T14:00:00Z'),
    },
    {
      walletId: 'wallet-user-3',
      userId: 'user-3',
      type: 'CREDIT',
      amount: 25.00,
      balanceBefore: 475.00,
      balanceAfter: 500.00,
      description: 'Commission payout for downline sales',
      referenceId: 'comm-1',
      referenceType: 'commission',
      createdAt: new Date('2025-01-25T14:00:00Z'),
    },
    {
      walletId: 'wallet-user-3',
      userId: 'user-3',
      type: 'DEBIT',
      amount: 200.00,
      balanceBefore: 500.00,
      balanceAfter: 300.00,
      description: 'Payout to bank account',
      referenceId: 'payout-1',
      referenceType: 'payout',
      createdAt: new Date('2025-01-24T09:00:00Z'),
    },
  ];

  for (const transaction of sampleWalletTransactions) {
    await prisma.walletTransaction.create({
      data: transaction,
    });
  }

  logger.info(`Seeded ${sampleWalletTransactions.length} sample wallet transactions`);

  // Create payment method configurations
  const paymentMethodConfigs = [
    {
      provider: 'STRIPE',
      method: 'CREDIT_CARD',
      name: 'Credit/Debit Card (Stripe)',
      isActive: true,
      config: {
        publicKey: 'pk_test_...',
        secretKey: 'sk_test_...',
      },
      fees: {
        percentage: 2.9,
        fixed: 0.30,
      },
      limits: {
        minAmount: 1.00,
        maxAmount: 10000.00,
      },
    },
    {
      provider: 'PAYPAL',
      method: 'PAYPAL',
      name: 'PayPal',
      isActive: true,
      config: {
        clientId: 'client_id_...',
        clientSecret: 'client_secret_...',
      },
      fees: {
        percentage: 2.9,
        fixed: 0.49,
      },
      limits: {
        minAmount: 1.00,
        maxAmount: 10000.00,
      },
    },
    {
      provider: 'BANK',
      method: 'BANK_TRANSFER',
      name: 'Bank Transfer',
      isActive: true,
      config: {
        supportedCurrencies: ['USD', 'EUR', 'GBP'],
      },
      fees: {
        percentage: 0,
        fixed: 0,
      },
      limits: {
        minAmount: 10.00,
        maxAmount: 50000.00,
      },
    },
  ];

  for (const config of paymentMethodConfigs) {
    await (prisma as any).paymentMethodConfig.upsert({
      where: {
        provider_method: {
          provider: config.provider,
          method: config.method,
        },
      },
      update: config,
      create: config,
    });
  }

  logger.info(`Seeded ${paymentMethodConfigs.length} payment method configurations`);

  logger.info('Payment service database seeding completed successfully');
}

main()
  .catch((e) => {
    logger.error('Error during database seeding', { error: e.message, stack: e.stack });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });