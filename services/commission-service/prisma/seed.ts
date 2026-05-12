import { PrismaClient } from '@prisma/client';
import { logger } from '../src/utils/logger';

const prisma = new PrismaClient();

async function main() {
  logger.info('Starting commission service database seeding');

  // Create sample users (if they don't exist)
  const sampleUsers = [
    {
      id: 'user-1',
      memberId: 'M001',
      fullName: 'John Doe',
      email: 'john.doe@example.com',
      rank: 'Gold',
      sponsorId: null,
      active: true,
    },
    {
      id: 'user-2',
      memberId: 'M002',
      fullName: 'Jane Smith',
      email: 'jane.smith@example.com',
      rank: 'Silver',
      sponsorId: 'user-1',
      active: true,
    },
    {
      id: 'user-3',
      memberId: 'M003',
      fullName: 'Bob Johnson',
      email: 'bob.johnson@example.com',
      rank: 'Diamond',
      sponsorId: 'user-1',
      active: true,
    },
    {
      id: 'user-4',
      memberId: 'M004',
      fullName: 'Alice Brown',
      email: 'alice.brown@example.com',
      rank: 'Bronze',
      sponsorId: 'user-2',
      active: true,
    },
    {
      id: 'user-5',
      memberId: 'M005',
      fullName: 'Charlie Wilson',
      email: 'charlie.wilson@example.com',
      rank: 'Gold',
      sponsorId: 'user-2',
      active: true,
    },
  ];

  for (const user of sampleUsers) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: user as any,
      create: {
        id: user.id,
        memberId: user.memberId,
        fullName: user.fullName,
        email: user.email,
        rank: user.rank,
        sponsorId: user.sponsorId,
        active: user.active,
      } as any,
    });
  }

  logger.info(`Seeded ${sampleUsers.length} sample users`);

  // Create sample orders
  const sampleOrders = [
    {
      id: 'order-1',
      userId: 'user-2',
      totalAmount: 299.99,
      totalPV: 150,
      status: 'COMPLETED',
    },
    {
      id: 'order-2',
      userId: 'user-3',
      totalAmount: 499.99,
      totalPV: 250,
      status: 'COMPLETED',
    },
    {
      id: 'order-3',
      userId: 'user-4',
      totalAmount: 199.99,
      totalPV: 100,
      status: 'COMPLETED',
    },
    {
      id: 'order-4',
      userId: 'user-5',
      totalAmount: 399.99,
      totalPV: 200,
      status: 'COMPLETED',
    },
  ];

  for (const order of sampleOrders) {
    await prisma.order.upsert({
      where: { id: order.id },
      update: order as any,
      create: {
        id: order.id,
        userId: order.userId,
        totalAmount: order.totalAmount,
        totalPV: order.totalPV,
        status: order.status,
      } as any,
    });
  }

  logger.info(`Seeded ${sampleOrders.length} sample orders`);

  // Create commission rules
  const commissionRules = [
    {
      name: 'Direct Referral Commission',
      type: 'DIRECT',
      level: 1,
      percentage: 10.0,
      minAmount: 0,
      maxAmount: null,
      isActive: true,
      conditions: JSON.stringify({
        description: '10% commission on direct referrals',
      }),
    },
    {
      name: 'Level 2 Commission',
      type: 'LEVEL_2',
      level: 2,
      percentage: 5.0,
      minAmount: 50,
      maxAmount: null,
      isActive: true,
      conditions: JSON.stringify({
        description: '5% commission on level 2 referrals (minimum $50 PV)',
        minUserLevel: 2,
      }),
    },
    {
      name: 'Level 3 Commission',
      type: 'LEVEL_3',
      level: 3,
      percentage: 3.0,
      minAmount: 100,
      maxAmount: null,
      isActive: true,
      conditions: JSON.stringify({
        description: '3% commission on level 3 referrals (minimum $100 PV)',
        minUserLevel: 3,
      }),
    },
    {
      name: 'Level 4 Commission',
      type: 'LEVEL_4',
      level: 4,
      percentage: 2.0,
      minAmount: 150,
      maxAmount: null,
      isActive: true,
      conditions: JSON.stringify({
        description: '2% commission on level 4 referrals (minimum $150 PV)',
        minUserLevel: 4,
      }),
    },
    {
      name: 'Level 5 Commission',
      type: 'LEVEL_5',
      level: 5,
      percentage: 1.0,
      minAmount: 200,
      maxAmount: null,
      isActive: true,
      conditions: JSON.stringify({
        description: '1% commission on level 5 referrals (minimum $200 PV)',
        minUserLevel: 5,
      }),
    },
    {
      name: 'Unilevel Commission',
      type: 'UNILEVEL',
      level: 1,
      percentage: 2.0,
      minAmount: 0,
      maxAmount: null,
      isActive: true,
      conditions: JSON.stringify({
        description: '2% unilevel commission on all levels',
      }),
    },
    {
      name: 'Binary Commission Left',
      type: 'BINARY',
      level: 1,
      percentage: 8.0,
      minAmount: 100,
      maxAmount: null,
      isActive: true,
      conditions: JSON.stringify({
        description: '8% binary commission on weaker leg',
        binaryLeg: 'left',
      }),
    },
    {
      name: 'Binary Commission Right',
      type: 'BINARY',
      level: 1,
      percentage: 8.0,
      minAmount: 100,
      maxAmount: null,
      isActive: true,
      conditions: JSON.stringify({
        description: '8% binary commission on weaker leg',
        binaryLeg: 'right',
      }),
    },
    {
      name: 'Performance Bonus',
      type: 'PERFORMANCE',
      level: 1,
      percentage: 5.0,
      minAmount: 500,
      maxAmount: null,
      isActive: true,
      conditions: JSON.stringify({
        description: '5% performance bonus for high achievers',
        requiredRank: 'Gold',
      }),
    },
    {
      name: 'Leadership Bonus',
      type: 'LEADERSHIP',
      level: 1,
      percentage: 1.0,
      minAmount: 1000,
      maxAmount: null,
      isActive: true,
      conditions: JSON.stringify({
        description: '1% leadership bonus for team leaders',
        requiredRank: 'Diamond',
        minTeamSize: 10,
      }),
    },
  ];

  for (const rule of commissionRules) {
    await (prisma as any).commissionRule.upsert({
      where: { name: rule.name },
      update: rule,
      create: rule,
    });
  }

  logger.info(`Seeded ${commissionRules.length} commission rules`);

  // Create sample commissions
  const sampleCommissions = [
    {
      id: 'comm-1',
      userId: 'user-1', // John Doe gets direct commission from Jane Smith
      orderId: 'order-1',
      type: 'DIRECT',
      level: 1,
      amount: 15.00, // 10% of $150 PV
      percentage: 10.0,
      status: 'PAID',
      paidAt: new Date('2025-01-20T10:00:00Z'),
    },
    {
      id: 'comm-2',
      userId: 'user-1', // John Doe gets level 2 commission from Bob Johnson
      orderId: 'order-2',
      type: 'LEVEL_2',
      level: 2,
      amount: 12.50, // 5% of $250 PV
      percentage: 5.0,
      status: 'PAID',
      paidAt: new Date('2025-01-25T10:00:00Z'),
    },
    {
      id: 'comm-3',
      userId: 'user-2', // Jane Smith gets direct commission from Alice Brown
      orderId: 'order-3',
      type: 'DIRECT',
      level: 1,
      amount: 10.00, // 10% of $100 PV
      percentage: 10.0,
      status: 'PAID',
      paidAt: new Date('2025-01-30T10:00:00Z'),
    },
    {
      id: 'comm-4',
      userId: 'user-2', // Jane Smith gets direct commission from Charlie Wilson
      orderId: 'order-4',
      type: 'DIRECT',
      level: 1,
      amount: 20.00, // 10% of $200 PV
      percentage: 10.0,
      status: 'PENDING',
    },
    {
      id: 'comm-5',
      userId: 'user-1', // John Doe gets level 3 commission from Alice Brown
      orderId: 'order-3',
      type: 'LEVEL_3',
      level: 3,
      amount: 3.00, // 3% of $100 PV
      percentage: 3.0,
      status: 'APPROVED',
    },
    {
      id: 'comm-6',
      userId: 'user-1', // John Doe gets level 3 commission from Charlie Wilson
      orderId: 'order-4',
      type: 'LEVEL_3',
      level: 3,
      amount: 6.00, // 3% of $200 PV
      percentage: 3.0,
      status: 'PENDING',
    },
  ];

  for (const commission of sampleCommissions) {
    await prisma.commission.create({
      data: commission as any,
    });
  }

  logger.info(`Seeded ${sampleCommissions.length} sample commissions`);

  // Create sample commission calculations
  const calculationData = [
    {
      orderId: 'order-1',
      totalAmount: 15.00,
      totalPV: 150,
      calculations: [
        {
          userId: 'user-1',
          type: 'DIRECT',
          level: 1,
          amount: 15.00,
          percentage: 10.0,
        },
      ],
    },
    {
      orderId: 'order-2',
      totalAmount: 12.50,
      totalPV: 250,
      calculations: [
        {
          userId: 'user-1',
          type: 'LEVEL_2',
          level: 2,
          amount: 12.50,
          percentage: 5.0,
        },
      ],
    },
    {
      orderId: 'order-3',
      totalAmount: 13.00,
      totalPV: 100,
      calculations: [
        {
          userId: 'user-2',
          type: 'DIRECT',
          level: 1,
          amount: 10.00,
          percentage: 10.0,
        },
        {
          userId: 'user-1',
          type: 'LEVEL_3',
          level: 3,
          amount: 3.00,
          percentage: 3.0,
        },
      ],
    },
    {
      orderId: 'order-4',
      totalAmount: 26.00,
      totalPV: 200,
      calculations: [
        {
          userId: 'user-2',
          type: 'DIRECT',
          level: 1,
          amount: 20.00,
          percentage: 10.0,
        },
        {
          userId: 'user-1',
          type: 'LEVEL_3',
          level: 3,
          amount: 6.00,
          percentage: 3.0,
        },
      ],
    },
  ];

  for (const calc of calculationData) {
    await (prisma as any).commissionCalculation.create({
      data: {
        orderId: calc.orderId,
        totalAmount: calc.totalAmount,
        totalPV: calc.totalPV,
        calculations: JSON.stringify(calc.calculations),
      },
    });
  }

  logger.info(`Seeded ${calculationData.length} commission calculations`);

  // Create sample payouts
  const samplePayouts = [
    {
      id: 'payout-1',
      userId: 'user-1',
      amount: 36.50, // Total commissions paid
      method: 'BANK_TRANSFER',
      status: 'COMPLETED',
      reference: 'BT20250120001',
      fees: 2.50,
      netAmount: 34.00,
      processedAt: new Date('2025-01-20T09:00:00Z'),
      paidAt: new Date('2025-01-20T10:00:00Z'),
    },
    {
      id: 'payout-2',
      userId: 'user-2',
      amount: 30.00,
      method: 'PAYPAL',
      status: 'COMPLETED',
      reference: 'PP20250130001',
      fees: 1.50,
      netAmount: 28.50,
      processedAt: new Date('2025-01-30T09:00:00Z'),
      paidAt: new Date('2025-01-30T10:00:00Z'),
    },
    {
      id: 'payout-3',
      userId: 'user-1',
      amount: 9.00,
      method: 'BANK_TRANSFER',
      status: 'PENDING',
      fees: 2.50,
      netAmount: 6.50,
    },
    {
      id: 'payout-4',
      userId: 'user-2',
      amount: 20.00,
      method: 'BANK_TRANSFER',
      status: 'PROCESSING',
      fees: 2.50,
      netAmount: 17.50,
      processedAt: new Date('2025-02-01T09:00:00Z'),
    },
  ];

  for (const payout of samplePayouts) {
    await (prisma as any).commissionPayout.create({
      data: payout,
    });
  }

  logger.info(`Seeded ${samplePayouts.length} sample payouts`);

  // Create sample bonuses
  const sampleBonuses = [
    {
      id: 'bonus-1',
      userId: 'user-1',
      type: 'FAST_START',
      amount: 100.00,
      description: 'Fast start bonus for recruiting first downline within 7 days',
      period: '2025-01',
      achievedAt: new Date('2025-01-15T00:00:00Z'),
      paidAt: new Date('2025-01-20T00:00:00Z'),
    },
    {
      id: 'bonus-2',
      userId: 'user-2',
      type: 'MONTHLY',
      amount: 100.00,
      description: 'Monthly performance bonus for $300 in commissions',
      period: '2025-01',
      achievedAt: new Date('2025-02-01T00:00:00Z'),
    },
    {
      id: 'bonus-3',
      userId: 'user-1',
      type: 'QUARTERLY',
      amount: 750.00,
      description: 'Quarterly consistency bonus for maintaining 85% performance',
      period: '2025-Q1',
      achievedAt: new Date('2025-04-01T00:00:00Z'),
    },
    {
      id: 'bonus-4',
      userId: 'user-3',
      type: 'RANK_ADVANCEMENT',
      amount: 500.00,
      description: 'Rank advancement bonus for reaching Diamond level',
      period: '2025-01',
      achievedAt: new Date('2025-01-10T00:00:00Z'),
      paidAt: new Date('2025-01-15T00:00:00Z'),
    },
  ];

  for (const bonus of sampleBonuses) {
    await (prisma as any).commissionBonus.create({
      data: bonus,
    });
  }

  logger.info(`Seeded ${sampleBonuses.length} sample bonuses`);

  // Create commission locks (for dispute handling)
  const sampleLocks = [
    {
      id: 'lock-1',
      userId: 'user-1',
      orderId: 'order-2',
      amount: 12.50,
      reason: 'Pending order verification',
      lockedUntil: new Date('2025-02-15T00:00:00Z'),
    },
  ];

  for (const lock of sampleLocks) {
    await (prisma as any).commissionLock.create({
      data: lock,
    });
  }

  logger.info(`Seeded ${sampleLocks.length} commission locks`);

  logger.info('Commission service database seeding completed successfully');
}

main()
  .catch((e) => {
    logger.error('Error during database seeding', { error: e.message, stack: e.stack });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });