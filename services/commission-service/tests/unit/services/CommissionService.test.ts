import { CommissionService } from '../../../src/services/CommissionService';
import { cacheService } from '../../../src/utils/cache';
import { queueService } from '../../../src/utils/queue';
import { recordCommissionCalculated, recordCommissionAmount } from '../../../src/utils/metrics';

jest.mock('../../../src/utils/cache');
jest.mock('../../../src/utils/queue');
jest.mock('../../../src/utils/metrics');
jest.mock('../../../src/utils/logger');

describe('CommissionService', () => {
  let commissionService: CommissionService;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      commission: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      commissionCalculation: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
      },
    };

    commissionService = new CommissionService();
    (commissionService as any).prisma = mockPrisma;
  });

  describe('calculateCommissions', () => {
    it('should calculate commissions for a valid order', async () => {
      const orderId = 'order-123';
      const mockOrder = {
        id: orderId,
        userId: 'user-123',
        totalAmount: 1000,
        totalPV: 500,
      };

      const mockUser = {
        id: 'user-123',
        sponsorId: 'sponsor-123',
        rank: 'Bronze',
      };

      const mockRules = [
        {
          id: 'rule-1',
          type: 'DIRECT',
          level: 1,
          percentage: 10,
          isActive: true,
        },
      ];

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (commissionService as any).ruleService.getActiveRules = jest.fn().mockResolvedValue(mockRules);

      const result = await commissionService.calculateCommissions(orderId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userId: 'sponsor-123',
        orderId,
        type: 'DIRECT',
        level: 1,
        amount: 100, // 10% of 1000
        percentage: 10,
      });
      expect(recordCommissionCalculated).toHaveBeenCalledWith('DIRECT', 1);
      expect(recordCommissionAmount).toHaveBeenCalledWith(100, 'DIRECT');
    });

    it('should throw error for non-existent order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(commissionService.calculateCommissions('invalid-order'))
        .rejects.toThrow('Order not found');
    });

    it('should handle orders with no eligible sponsors', async () => {
      const mockOrder = {
        id: 'order-123',
        userId: 'user-123',
        totalAmount: 1000,
        totalPV: 500,
      };

      const mockUser = {
        id: 'user-123',
        sponsorId: null, // No sponsor
        rank: 'Bronze',
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await commissionService.calculateCommissions('order-123');

      expect(result).toHaveLength(0);
    });

    it('should calculate multi-level commissions correctly', async () => {
      const orderId = 'order-123';
      const mockOrder = {
        id: orderId,
        userId: 'user-123',
        totalAmount: 1000,
        totalPV: 500,
      };

      const mockUsers = {
        'user-123': { id: 'user-123', sponsorId: 'sponsor-1', rank: 'Bronze' },
        'sponsor-1': { id: 'sponsor-1', sponsorId: 'sponsor-2', rank: 'Gold' },
        'sponsor-2': { id: 'sponsor-2', sponsorId: null, rank: 'Diamond' },
      };

      const mockRules = [
        { id: 'rule-1', type: 'DIRECT', level: 1, percentage: 10, isActive: true },
        { id: 'rule-2', type: 'LEVEL_2', level: 2, percentage: 5, isActive: true },
        { id: 'rule-3', type: 'LEVEL_3', level: 3, percentage: 2, isActive: true },
      ];

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.user.findUnique.mockImplementation((query: any) =>
        Promise.resolve(mockUsers[query.where.id as keyof typeof mockUsers])
      );
      (commissionService as any).ruleService.getActiveRules = jest.fn().mockResolvedValue(mockRules);

      const result = await commissionService.calculateCommissions(orderId);

      expect(result).toHaveLength(3);
      expect(result.find(c => c.level === 1)?.amount).toBe(100); // 10% of 1000
      expect(result.find(c => c.level === 2)?.amount).toBe(50);  // 5% of 1000
      expect(result.find(c => c.level === 3)?.amount).toBe(20);  // 2% of 1000
    });

    it('should respect commission caps and minimums', async () => {
      const orderId = 'order-123';
      const mockOrder = {
        id: orderId,
        userId: 'user-123',
        totalAmount: 100, // Small order
        totalPV: 50,
      };

      const mockUser = {
        id: 'user-123',
        sponsorId: 'sponsor-123',
        rank: 'Bronze',
      };

      const mockRules = [
        {
          id: 'rule-1',
          type: 'DIRECT',
          level: 1,
          percentage: 10,
          minAmount: 50, // Minimum commission amount
          maxAmount: 200, // Maximum commission amount
          isActive: true,
        },
      ];

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (commissionService as any).ruleService.getActiveRules = jest.fn().mockResolvedValue(mockRules);

      const result = await commissionService.calculateCommissions(orderId);

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(50); // Capped at minimum
    });
  });

  describe('getCommissions', () => {
    it('should return paginated commissions with filters', async () => {
      const mockCommissions = [
        { id: 'comm-1', userId: 'user-1', amount: 100, status: 'PENDING' },
        { id: 'comm-2', userId: 'user-2', amount: 200, status: 'PAID' },
      ];

      mockPrisma.commission.findMany.mockResolvedValue(mockCommissions);
      mockPrisma.commission.count.mockResolvedValue(2);

      const result = await commissionService.getCommissions({
        page: 1,
        limit: 10,
        status: 'PENDING',
        userId: 'user-1',
      });

      expect(result.commissions).toEqual(mockCommissions);
      expect(result.pagination.total).toBe(2);
      expect(mockPrisma.commission.findMany).toHaveBeenCalledWith({
        where: {
          status: 'PENDING',
          userId: 'user-1',
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should handle date range filtering', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      mockPrisma.commission.findMany.mockResolvedValue([]);
      mockPrisma.commission.count.mockResolvedValue(0);

      await commissionService.getCommissions({
        page: 1,
        limit: 10,
        startDate,
        endDate,
      });

      expect(mockPrisma.commission.findMany).toHaveBeenCalledWith(
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

  describe('getCommissionById', () => {
    it('should return commission by ID', async () => {
      const mockCommission = { id: 'comm-1', userId: 'user-1', amount: 100 };

      mockPrisma.commission.findUnique.mockResolvedValue(mockCommission);

      const result = await commissionService.getCommissionById('comm-1');

      expect(result).toEqual(mockCommission);
    });

    it('should return null for non-existent commission', async () => {
      mockPrisma.commission.findUnique.mockResolvedValue(null);

      const result = await commissionService.getCommissionById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateCommissionStatus', () => {
    it('should update commission status successfully', async () => {
      const mockCommission = {
        id: 'comm-1',
        userId: 'user-1',
        amount: 100,
        status: 'PENDING',
      };

      mockPrisma.commission.findUnique.mockResolvedValue(mockCommission);
      mockPrisma.commission.update.mockResolvedValue({
        ...mockCommission,
        status: 'PAID',
        paidAt: new Date(),
      });

      const result = await commissionService.updateCommissionStatus('comm-1', 'PAID');

      expect(result.status).toBe('PAID');
      expect((result as any).paidAt).toBeDefined();
    });

    it('should throw error for non-existent commission', async () => {
      mockPrisma.commission.findUnique.mockResolvedValue(null);

      await expect(commissionService.updateCommissionStatus('non-existent', 'PAID'))
        .rejects.toThrow('Commission not found');
    });
  });

  describe('getUserCommissions', () => {
    it('should return user commissions with pagination', async () => {
      const mockCommissions = [
        { id: 'comm-1', amount: 100, status: 'PAID' },
        { id: 'comm-2', amount: 200, status: 'PENDING' },
      ];

      mockPrisma.commission.findMany.mockResolvedValue(mockCommissions);
      mockPrisma.commission.count.mockResolvedValue(2);

      const result = await commissionService.getUserCommissions('user-1', 1, 10, 'PAID');

      expect(result.commissions).toEqual(mockCommissions);
      expect(result.pagination.total).toBe(2);
    });
  });

  describe('getUserCommissionStats', () => {
    it('should calculate user commission statistics', async () => {
      const mockCommissions = [
        { amount: 100, status: 'PAID', type: 'DIRECT', createdAt: new Date('2024-01-01') },
        { amount: 200, status: 'PAID', type: 'LEVEL_2', createdAt: new Date('2024-01-15') },
        { amount: 50, status: 'PENDING', type: 'DIRECT', createdAt: new Date('2024-01-30') },
      ];

      mockPrisma.commission.findMany.mockResolvedValue(mockCommissions);

      const result = await commissionService.getUserCommissionStats('user-1', 'month');

      expect(result.totalAmount).toBe(300); // 100 + 200
      expect(result.totalCommissions).toBe(3);
    });
  });

  describe('deleteCommission', () => {
    it('should delete commission successfully', async () => {
      mockPrisma.commission.findUnique.mockResolvedValue({ id: 'comm-1' });
      mockPrisma.commission.delete.mockResolvedValue({ id: 'comm-1' });

      await expect(commissionService.deleteCommission('comm-1')).resolves.not.toThrow();
    });

    it('should throw error for non-existent commission', async () => {
      mockPrisma.commission.findUnique.mockResolvedValue(null);

      await expect(commissionService.deleteCommission('non-existent'))
        .rejects.toThrow('Commission not found');
    });
  });

  describe('getCommissionAnalytics', () => {
    it('should return comprehensive analytics', async () => {
      const mockCommissions = [
        { type: 'DIRECT', amount: 1000, status: 'PAID', createdAt: new Date() },
        { type: 'LEVEL_2', amount: 500, status: 'PAID', createdAt: new Date() },
        { type: 'DIRECT', amount: 200, status: 'PENDING', createdAt: new Date() },
      ];

      mockPrisma.commission.findMany.mockResolvedValue(mockCommissions);

      const result = await commissionService.getCommissionAnalytics({
        period: 'month',
      });

      expect(result.totalCommissions).toBe(3);
      expect(result.totalAmount).toBe(1700);
      expect(result.paidAmount).toBe(1500);
      expect(result.pendingAmount).toBe(200);
    });
  });
});