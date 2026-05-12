import { PrismaClient } from '@prisma/client';
import { jest } from '@jest/globals';

// Extend global types for Jest
declare global {
  var testUtils: {
    createTestUser: (overrides?: any) => Promise<any>;
    createTestOrder: (userId: string, overrides?: any) => Promise<any>;
    createTestCommissionRule: (overrides?: any) => Promise<any>;
    waitForQueueProcessing: (ms?: number) => Promise<void>;
  };
  var prisma: PrismaClient;
}

// Mock external dependencies
jest.mock('../src/utils/cache');
jest.mock('../src/utils/queue');
jest.mock('../src/utils/logger');
jest.mock('../src/utils/metrics');

// Setup test database
const prisma = new PrismaClient();

// Global test setup
beforeAll(async () => {
  // Connect to test database
  await prisma.$connect();
});

afterAll(async () => {
  // Disconnect from test database
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clear all tables before each test
  const tableNames = [
    'CommissionLock',
    'CommissionBonus',
    'CommissionPayout',
    'CommissionCalculation',
    'Commission',
    'CommissionRule',
    'Order',
    'User',
  ];

  for (const tableName of tableNames) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${tableName}";`);
  }

  // Reset all mocks
  jest.clearAllMocks();
});

// Custom matchers
expect.extend({
  toBeValidCommission(received: any) {
    const pass = received &&
      typeof received.id === 'string' &&
      typeof received.userId === 'string' &&
      typeof received.amount === 'number' &&
      typeof received.type === 'string' &&
      typeof received.status === 'string';

    return {
      message: () => `expected ${received} to be a valid commission object`,
      pass,
    };
  },

  toBeValidPayout(received: any) {
    const pass = received &&
      typeof received.id === 'string' &&
      typeof received.userId === 'string' &&
      typeof received.amount === 'number' &&
      typeof received.method === 'string' &&
      typeof received.status === 'string';

    return {
      message: () => `expected ${received} to be a valid payout object`,
      pass,
    };
  },

  toBeValidBonus(received: any) {
    const pass = received &&
      typeof received.id === 'string' &&
      typeof received.userId === 'string' &&
      typeof received.amount === 'number' &&
      typeof received.type === 'string' &&
      received.achievedAt instanceof Date;

    return {
      message: () => `expected ${received} to be a valid bonus object`,
      pass,
    };
  },
});

// Global test utilities
global.testUtils = {
  createTestUser: async (overrides: any = {}) => {
    const defaultUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      memberId: `M${Date.now()}`,
      fullName: 'Test User',
      email: `test${Date.now()}@example.com`,
      rank: 'Bronze',
      sponsorId: null,
      active: true,
    };

    const userData = { ...defaultUser, ...overrides };
    return await prisma.user.create({
      data: userData,
    });
  },

  createTestOrder: async (userId: string, overrides: any = {}) => {
    const defaultOrder = {
      id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      totalAmount: 100.00,
      totalPV: 50,
      status: 'COMPLETED',
    };

    const orderData = { ...defaultOrder, ...overrides };
    return await prisma.order.create({
      data: orderData,
    });
  },

  createTestCommissionRule: async (overrides: any = {}) => {
    const defaultRule = {
      name: `Test Rule ${Date.now()}`,
      type: 'DIRECT',
      level: 1,
      percentage: 10.0,
      minAmount: 0,
      isActive: true,
    };

    const ruleData = { ...defaultRule, ...overrides };
    return await (prisma as any).commissionRule.create({
      data: ruleData,
    });
  },

  waitForQueueProcessing: (ms: number = 100) => new Promise(resolve => setTimeout(resolve, ms)),
};

// Export prisma for use in tests
global.prisma = prisma;