/**
 * TEST SETUP AND CONFIGURATION
 *
 * Global test setup for Jest testing framework
 * Configures database, mocks, and test utilities
 * Created: 2025-11-20 (Enhancement)
 */

import { PrismaClient } from '@prisma/client';
import { jest } from '@jest/globals';

// Global test timeout
jest.setTimeout(30000);

// Mock implementations for external services
jest.mock('@/lib/database', () => ({
  prisma: new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || 'file:./test.db'
      }
    }
  })
}));

jest.mock('@/lib/apm-monitoring', () => ({
  apmMonitoring: {
    recordError: jest.fn(),
    recordBusinessMetric: jest.fn(),
    createSpan: jest.fn(() => ({
      setAttributes: jest.fn(),
      setStatus: jest.fn(),
      recordException: jest.fn(),
      end: jest.fn()
    }))
  }
}));

jest.mock('@/lib/advanced-cache', () => ({
  advancedCache: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    getStats: jest.fn(() => ({
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      memoryUsage: 0,
      connectedClients: 0,
      hitRate: 0,
      averageResponseTime: 0
    }))
  },
  userCache: {
    getUserProfile: jest.fn(),
    getUserStats: jest.fn()
  },
  productCache: {
    getProduct: jest.fn(),
    getProductList: jest.fn()
  },
  analyticsCache: {
    getDashboardMetrics: jest.fn()
  }
}));

jest.mock('@/lib/multi-tenant-manager', () => ({
  multiTenantManager: {
    getTenantQuota: jest.fn(),
    checkResourceUsage: jest.fn(() => ({ allowed: true, remaining: 1000, alerts: [] })),
    recordUsage: jest.fn(),
    getTenantMetrics: jest.fn(),
    getScalingRecommendations: jest.fn(() => []),
    updateTenantQuota: jest.fn()
  }
}));

jest.mock('@/lib/advanced-bi-service', () => ({
  advancedBIService: {
    generateBusinessInsights: jest.fn(),
    performCustomerSegmentation: jest.fn(),
    generateForecasts: jest.fn(),
    detectAnomalies: jest.fn(),
    generateStrategicRecommendations: jest.fn(),
    analyzeBusinessPerformance: jest.fn(),
    performCustomAnalysis: jest.fn(),
    trainPredictiveModel: jest.fn(),
    performMarketAnalysis: jest.fn(),
    performCohortAnalysis: jest.fn(),
    buildAttributionModel: jest.fn(),
    calculateCustomerLifetimeValue: jest.fn()
  }
}));

// Mock external services
jest.mock('socket.io', () => ({
  Server: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() }))
  }))
}));

jest.mock('ioredis', () => jest.fn(() => ({
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  info: jest.fn(),
  bgrewriteaof: jest.fn(),
  quit: jest.fn()
})));

// Global test utilities
// @ts-ignore - Type conflicts with other test setup files that define different testUtils
(global as any).testUtils = {
  // Create test user
  createTestUser: (overrides: any = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    phoneNumber: '+1234567890',
    password: 'hashedpassword',
    firstName: 'Test',
    surname: 'User',
    fullName: 'Test User',
    memberId: 'TEST001',
    accountType: 'Customer',
    sponsorId: null,
    companyId: 'test-company-id',
    active: true,
    isAdmin: false,
    rank: 'Member',
    pv: 0,
    pvDate: null,
    teamSize: '{"left":0,"right":0,"total":0}',
    children: '{"left":null,"right":null}',
    placementParentId: null,
    position: null,
    avatarUrl: null,
    addresses: '[]',
    lastActivityDate: new Date(),
    deleted: false,
    deletedDate: null,
    deletedBy: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastFailedLogin: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  // Create test product
  createTestProduct: (overrides: any = {}) => ({
    id: 'test-product-id',
    name: 'Test Product',
    description: 'A test product',
    price: 100,
    pv: 50,
    qty: 100,
    category: 'Test Category',
    imageUrl: null,
    isActive: true,
    unitType: 'piece',
    type: 'single',
    originalPrice: null,
    packageItems: null,
    rating: null,
    companyId: 'test-company-id',
    isGlobalProduct: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  // Create test order
  createTestOrder: (overrides: any = {}) => ({
    id: 'test-order-id',
    orderId: 'ORD-001',
    userId: 'test-user-id',
    date: new Date(),
    status: 'Pending',
    itemCount: 1,
    amount: 100,
    totalAmount: 100,
    companyId: 'test-company-id',
    idempotencyKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  // Create test commission
  createTestCommission: (overrides: any = {}) => ({
    id: 'test-commission-id',
    userId: 'test-user-id',
    date: new Date(),
    type: 'Binary',
    status: 'Pending',
    amount: 50,
    companyId: 'test-company-id',
    ...overrides
  }),

  // Mock request/response objects
  createMockRequest: (overrides: any = {}) => ({
    method: 'GET',
    url: 'http://localhost:3000/api/test',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '127.0.0.1'
    },
    json: jest.fn(),
    nextUrl: new URL('http://localhost:3000/api/test'),
    ...overrides
  }),

  createMockResponse: () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    headers: new Map()
  }),

  // Database cleanup utilities
  cleanupDatabase: async () => {
    const { prisma } = await import('@/lib/database');
    // Clean up in reverse dependency order
    await prisma.auditLog.deleteMany();
    await prisma.inventoryTransaction.deleteMany();
    await prisma.memberAgreement.deleteMany();
    await prisma.complianceDocument.deleteMany();
    await prisma.financialControl.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.emailVerification.deleteMany();
    await prisma.commissionDispute.deleteMany();
    await prisma.genealogyMovement.deleteMany();
    await prisma.stockRequestItem.deleteMany();
    await prisma.stockRequest.deleteMany();
    await (prisma as any).ecommTopupRequest.deleteMany();
    await prisma.notificationPreference.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.memberProgress.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.commission.deleteMany();
    await prisma.stockItem.deleteMany();
    await prisma.product.deleteMany();
    await prisma.referralRelationship.deleteMany();
    await prisma.referralLink.deleteMany();
    await prisma.walletTransfer.deleteMany();
    await prisma.walletTransaction.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.alert.deleteMany();
    await prisma.dSARRequest.deleteMany();
    await prisma.otpDeliveryLog.deleteMany();
    await prisma.otpCode.deleteMany();
    await prisma.otpSettings.deleteMany();
    await prisma.user.deleteMany();
    await prisma.companyRuleConfig.deleteMany();
    await prisma.dynamicRuleSet.deleteMany();
    await prisma.ruleExecutionSummary.deleteMany();
    await prisma.ruleValidationLog.deleteMany();
    await prisma.ruleExecutionLog.deleteMany();
    await prisma.ruleSetBusinessRule.deleteMany();
    await prisma.ruleSet.deleteMany();
    await prisma.businessRule.deleteMany();
    await prisma.ruleTemplate.deleteMany();
    await prisma.customFunction.deleteMany();
    await prisma.ruleVersion.deleteMany();
    await prisma.ruleBackup.deleteMany();
    await prisma.company.deleteMany();
  },

  // Performance testing utilities
  measurePerformance: async <T>(
    operation: () => Promise<T>,
    iterations: number = 1
  ): Promise<{
    result: T;
    duration: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
  }> => {
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      const result = await operation();
      const duration = Date.now() - start;
      durations.push(duration);

      if (i === 0) {
        var finalResult = result;
      }
    }

    return {
      result: finalResult!,
      duration: durations.reduce((sum, d) => sum + d, 0),
      averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations)
    };
  },

  // Load testing utilities
  simulateLoad: async (
    operation: () => Promise<any>,
    concurrentUsers: number,
    totalRequests: number
  ): Promise<{
    totalDuration: number;
    averageResponseTime: number;
    requestsPerSecond: number;
    successRate: number;
    errorCount: number;
  }> => {
    const promises: Promise<any>[] = [];
    const results: { success: boolean; duration: number }[] = [];

    for (let i = 0; i < totalRequests; i++) {
      promises.push(
        (async () => {
          const start = Date.now();
          try {
            await operation();
            results.push({ success: true, duration: Date.now() - start });
          } catch (error) {
            results.push({ success: false, duration: Date.now() - start });
          }
        })()
      );

      // Control concurrency
      if (promises.length >= concurrentUsers) {
        await Promise.all(promises.splice(0, concurrentUsers));
      }
    }

    // Wait for remaining promises
    await Promise.all(promises);

    const totalDuration = Math.max(...results.map(r => r.duration));
    const averageResponseTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const successCount = results.filter(r => r.success).length;
    const successRate = (successCount / results.length) * 100;

    return {
      totalDuration,
      averageResponseTime,
      requestsPerSecond: totalRequests / (totalDuration / 1000),
      successRate,
      errorCount: results.length - successCount
    };
  }
};

// Setup and teardown hooks
beforeAll(async () => {
  // Global setup
  console.log('Setting up test environment...');
});

afterAll(async () => {
  // Global cleanup
  console.log('Cleaning up test environment...');

  // Close database connections
  const { prisma } = await import('@/lib/database');
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Reset all mocks before each test
  jest.clearAllMocks();

  // Clean database before each test
  await (global as any).testUtils.cleanupDatabase();
});

afterEach(async () => {
  // Additional cleanup if needed
});

// Export types for TypeScript
// Note: Type may conflict with services/commission-service/tests/setup.ts
// Using any to allow different test setups to coexist
declare global {
  // @ts-ignore - Allow different test setup files to define different testUtils types
  // eslint-disable-next-line no-var
  var testUtils: any;
}