import { PayoutService } from '../../../src/services/PayoutService';
import { cacheService } from '../../../src/utils/cache';
import { queueService } from '../../../src/utils/queue';
import { recordPayoutProcessed } from '../../../src/utils/metrics';

jest.mock('../../../src/utils/cache');
jest.mock('../../../src/utils/queue');
jest.mock('../../../src/utils/metrics');
jest.mock('../../../src/utils/logger');

describe('PayoutService', () => {
  let payoutService: PayoutService;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      commissionPayout: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      commission: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    payoutService = new PayoutService();
    (payoutService as any).prisma = mockPrisma;
  });

  describe('createPayout', () => {
    it('should create payout successfully', async () => {
      const payoutData = {
        userId: 'user-123',
        amount: 1000,
        method: 'BANK_TRANSFER' as const,
        reference: 'REF123',
      };

      const mockUser = {
        id: 'user-123',
        fullName: 'John Doe',
        email: 'john@example.com',
      };

      const expectedPayout = {
        id: 'payout-123',
        ...payoutData,
        status: 'PENDING',
        fees: 0,
        netAmount: 1000,
        createdAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.commissionPayout.create.mockResolvedValue(expectedPayout);

      const result = await payoutService.createPayout(payoutData);

      expect(result).toEqual(expectedPayout);
      expect(mockPrisma.commissionPayout.create).toHaveBeenCalledWith({
        data: {
          ...payoutData,
          status: 'PENDING',
          fees: 0,
          netAmount: 1000,
        },
      });
    });

    it('should calculate fees for different methods', async () => {
      const payoutData = {
        userId: 'user-123',
        amount: 1000,
        method: 'PAYPAL' as const,
      };

      const mockUser = {
        id: 'user-123',
        fullName: 'John Doe',
        email: 'john@example.com',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.commissionPayout.create.mockResolvedValue({
        id: 'payout-123',
        ...payoutData,
        status: 'PENDING',
        fees: 29.99, // PayPal fee
        netAmount: 970.01,
      });

      const result = await payoutService.createPayout(payoutData);

      expect(result.fees).toBe(29.99);
      expect(result.netAmount).toBe(970.01);
    });

    it('should throw error for non-existent user', async () => {
      const payoutData = {
        userId: 'non-existent',
        amount: 1000,
        method: 'BANK_TRANSFER' as const,
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(payoutService.createPayout(payoutData))
        .rejects.toThrow('User not found');
    });

    it('should validate minimum payout amount', async () => {
      const payoutData = {
        userId: 'user-123',
        amount: 10, // Below minimum
        method: 'BANK_TRANSFER' as const,
      };

      const mockUser = {
        id: 'user-123',
        fullName: 'John Doe',
        email: 'john@example.com',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(payoutService.createPayout(payoutData))
        .rejects.toThrow('Minimum payout amount is $50');
    });

    it('should validate maximum payout amount', async () => {
      const payoutData = {
        userId: 'user-123',
        amount: 100000, // Above maximum
        method: 'BANK_TRANSFER' as const,
      };

      const mockUser = {
        id: 'user-123',
        fullName: 'John Doe',
        email: 'john@example.com',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(payoutService.createPayout(payoutData))
        .rejects.toThrow('Maximum payout amount is $50,000');
    });
  });

  describe('getPayouts', () => {
    it('should return paginated payouts with filters', async () => {
      const mockPayouts = [
        { id: 'payout-1', userId: 'user-1', amount: 1000, status: 'PENDING' },
        { id: 'payout-2', userId: 'user-2', amount: 2000, status: 'COMPLETED' },
      ];

      mockPrisma.commissionPayout.findMany.mockResolvedValue(mockPayouts);
      mockPrisma.commissionPayout.count.mockResolvedValue(2);

      const result = await payoutService.getPayouts({
        page: 1,
        limit: 10,
        status: 'PENDING',
        method: 'BANK_TRANSFER',
      });

      expect(result.payouts).toEqual(mockPayouts);
      expect(result.pagination.total).toBe(2);
    });

    it('should handle date range filtering', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      mockPrisma.commissionPayout.findMany.mockResolvedValue([]);
      mockPrisma.commissionPayout.count.mockResolvedValue(0);

      await payoutService.getPayouts({
        page: 1,
        limit: 10,
        startDate,
        endDate,
      });

      expect(mockPrisma.commissionPayout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          }),
        })
      );
    });
  });

  describe('getPayoutById', () => {
    it('should return payout by ID', async () => {
      const mockPayout = { id: 'payout-1', userId: 'user-1', amount: 1000 };

      mockPrisma.commissionPayout.findUnique.mockResolvedValue(mockPayout);

      const result = await payoutService.getPayoutById('payout-1');

      expect(result).toEqual(mockPayout);
    });

    it('should return null for non-existent payout', async () => {
      mockPrisma.commissionPayout.findUnique.mockResolvedValue(null);

      const result = await payoutService.getPayoutById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getUserPayouts', () => {
    it('should return user payouts with pagination', async () => {
      const mockPayouts = [
        { id: 'payout-1', amount: 1000, status: 'COMPLETED' },
        { id: 'payout-2', amount: 2000, status: 'PENDING' },
      ];

      mockPrisma.commissionPayout.findMany.mockResolvedValue(mockPayouts);
      mockPrisma.commissionPayout.count.mockResolvedValue(2);

      const result = await payoutService.getUserPayouts('user-1', 1, 10, 'COMPLETED');

      expect(result.payouts).toEqual(mockPayouts);
      expect(result.pagination.total).toBe(2);
    });
  });

  describe('updatePayoutStatus', () => {
    it('should update payout status to COMPLETED', async () => {
      const mockPayout = {
        id: 'payout-1',
        userId: 'user-1',
        amount: 1000,
        status: 'PENDING',
        method: 'BANK_TRANSFER',
      };

      const updatedPayout = {
        ...mockPayout,
        status: 'COMPLETED',
        paidAt: new Date(),
        processedAt: new Date(),
      };

      mockPrisma.commissionPayout.findUnique.mockResolvedValue(mockPayout);
      mockPrisma.commissionPayout.update.mockResolvedValue(updatedPayout);

      const result = await payoutService.updatePayoutStatus('payout-1', 'COMPLETED');

      expect(result.status).toBe('COMPLETED');
      expect(result.paidAt).toBeDefined();
      expect(result.processedAt).toBeDefined();
      expect(recordPayoutProcessed).toHaveBeenCalledWith('BANK_TRANSFER', 'success');
    });

    it('should update payout status to FAILED', async () => {
      const mockPayout = {
        id: 'payout-1',
        userId: 'user-1',
        amount: 1000,
        status: 'PROCESSING',
        method: 'PAYPAL',
      };

      mockPrisma.commissionPayout.findUnique.mockResolvedValue(mockPayout);
      mockPrisma.commissionPayout.update.mockResolvedValue({
        ...mockPayout,
        status: 'FAILED',
      });

      const result = await payoutService.updatePayoutStatus('payout-1', 'FAILED');

      expect(result.status).toBe('FAILED');
      expect(recordPayoutProcessed).toHaveBeenCalledWith('PAYPAL', 'failed');
    });

    it('should throw error for invalid status transition', async () => {
      const mockPayout = {
        id: 'payout-1',
        userId: 'user-1',
        amount: 1000,
        status: 'COMPLETED', // Already completed
      };

      mockPrisma.commissionPayout.findUnique.mockResolvedValue(mockPayout);

      await expect(payoutService.updatePayoutStatus('payout-1', 'PENDING'))
        .rejects.toThrow('Invalid status transition');
    });

    it('should throw error for non-existent payout', async () => {
      mockPrisma.commissionPayout.findUnique.mockResolvedValue(null);

      await expect(payoutService.updatePayoutStatus('non-existent', 'COMPLETED'))
        .rejects.toThrow('Payout not found');
    });
  });


  describe('getPayoutAnalytics', () => {
    it('should return comprehensive payout analytics', async () => {
      const mockPayouts = [
        { method: 'BANK_TRANSFER', amount: 1000, status: 'COMPLETED', createdAt: new Date(), processedAt: new Date() },
        { method: 'PAYPAL', amount: 500, status: 'COMPLETED', createdAt: new Date(), processedAt: new Date() },
        { method: 'BANK_TRANSFER', amount: 2000, status: 'FAILED', createdAt: new Date() },
      ];

      mockPrisma.commissionPayout.findMany.mockResolvedValue(mockPayouts);

      const result = await payoutService.getPayoutAnalytics({
        period: 'month',
      });

      expect(result.totalPayouts).toBe(3);
      expect(result.totalAmount).toBe(3500);
      expect(result.successfulPayouts).toBe(2);
      expect(result.failedPayouts).toBe(1);
      const bankTransfer = result.payoutsByMethod.find((p: any) => p.method === 'BANK_TRANSFER');
      const paypal = result.payoutsByMethod.find((p: any) => p.method === 'PAYPAL');
      expect(bankTransfer?.count).toBe(2);
      expect(paypal?.count).toBe(1);
    });

    it('should calculate average processing time', async () => {
      const createdAt = new Date('2024-01-01T10:00:00Z');
      const processedAt = new Date('2024-01-01T10:30:00Z'); // 30 minutes later

      const mockPayouts = [
        {
          method: 'BANK_TRANSFER',
          amount: 1000,
          status: 'COMPLETED',
          createdAt,
          processedAt,
        },
      ];

      mockPrisma.commissionPayout.findMany.mockResolvedValue(mockPayouts);

      const result = await payoutService.getPayoutAnalytics({
        period: 'month',
      });

      expect(result.averageProcessingTime).toBe(30); // 30 minutes
    });
  });

  describe('validatePayoutData', () => {
    it('should validate payout data successfully', () => {
      const validData = {
        userId: 'user-123',
        amount: 1000,
        method: 'BANK_TRANSFER' as const,
      };

      expect(() => (payoutService as any).validatePayoutData(validData)).not.toThrow();
    });

    it('should throw error for invalid amount', () => {
      const invalidData = {
        userId: 'user-123',
        amount: -100,
        method: 'BANK_TRANSFER' as const,
      };

      expect(() => (payoutService as any).validatePayoutData(invalidData))
        .toThrow('Invalid payout amount');
    });

    it('should throw error for invalid method', () => {
      const invalidData = {
        userId: 'user-123',
        amount: 1000,
        method: 'INVALID_METHOD' as any,
      };

      expect(() => (payoutService as any).validatePayoutData(invalidData))
        .toThrow('Invalid payout method');
    });
  });
});