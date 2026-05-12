import { BonusService } from '../../../src/services/BonusService';
import { cacheService } from '../../../src/utils/cache';
import { queueService } from '../../../src/utils/queue';
import { recordBonusAchieved } from '../../../src/utils/metrics';

jest.mock('../../../src/utils/cache');
jest.mock('../../../src/utils/queue');
jest.mock('../../../src/utils/metrics');
jest.mock('../../../src/utils/logger');

describe('BonusService', () => {
  let bonusService: BonusService;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      commissionBonus: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        createMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      commission: {
        findMany: jest.fn(),
        aggregate: jest.fn(),
      },
    };

    bonusService = new BonusService();
    (bonusService as any).prisma = mockPrisma;
  });

  describe('calculateBonuses', () => {
    it('should calculate FAST_START bonuses for new distributors', async () => {
      const period = '2024-01';
      const mockUsers = [
        {
          id: 'user-1',
          rank: 'Bronze',
          createdAt: new Date('2024-01-15'),
          sponsorId: 'sponsor-1',
        },
      ];

      const mockCommissions = [
        { userId: 'user-1', amount: 500, createdAt: new Date('2024-01-16') },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockPrisma.commission.findMany.mockResolvedValue(mockCommissions);
      mockPrisma.commissionBonus.createMany.mockResolvedValue({ count: 1 });

      const result = await bonusService.calculateBonuses(period);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userId: 'user-1',
        type: 'FAST_START',
        amount: 100, // 20% of first commission
        period: '2024-01',
      });
      expect(recordBonusAchieved).toHaveBeenCalledWith('FAST_START', '2024-01');
    });

    it('should calculate MONTHLY bonuses for top performers', async () => {
      const period = '2024-01';
      const mockUsers = [
        {
          id: 'user-1',
          rank: 'Gold',
          createdAt: new Date('2024-01-01'),
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockPrisma.commission.aggregate.mockResolvedValue({
        _sum: { amount: 5000 }, // $5000 in commissions
      });
      mockPrisma.commissionBonus.createMany.mockResolvedValue({ count: 1 });

      const result = await bonusService.calculateBonuses(period);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userId: 'user-1',
        type: 'MONTHLY',
        amount: 250, // 5% of monthly volume
        period: '2024-01',
      });
    });

    it('should calculate RANK_ADVANCEMENT bonuses', async () => {
      const period = '2024-01';
      const mockUsers = [
        {
          id: 'user-1',
          rank: 'Gold', // Recently promoted
          createdAt: new Date('2024-01-01'),
        },
      ];

      // Mock that user was promoted this month
      (bonusService as any).getRankAdvancementBonus = jest.fn().mockResolvedValue(500);

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockPrisma.commissionBonus.createMany.mockResolvedValue({ count: 1 });

      const result = await bonusService.calculateBonuses(period);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userId: 'user-1',
        type: 'RANK_ADVANCEMENT',
        amount: 500,
        period: '2024-01',
      });
    });

    it('should calculate TEAM_BUILDING bonuses for leaders', async () => {
      const period = '2024-01';
      const mockUsers = [
        {
          id: 'user-1',
          rank: 'Diamond',
          createdAt: new Date('2024-01-01'),
        },
      ];

      // Mock team volume calculation
      (bonusService as any).calculateTeamVolume = jest.fn().mockResolvedValue(25000);

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockPrisma.commissionBonus.createMany.mockResolvedValue({ count: 1 });

      const result = await bonusService.calculateBonuses(period);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userId: 'user-1',
        type: 'TEAM_BUILDING',
        amount: 1250, // 5% of team volume
        period: '2024-01',
      });
    });

    it('should not create duplicate bonuses for same period', async () => {
      const period = '2024-01';
      const mockUsers = [
        {
          id: 'user-1',
          rank: 'Bronze',
          createdAt: new Date('2024-01-15'),
        },
      ];

      // Mock existing bonus
      mockPrisma.commissionBonus.findMany.mockResolvedValue([
        { userId: 'user-1', type: 'FAST_START', period: '2024-01' },
      ]);

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await bonusService.calculateBonuses(period);

      expect(result).toHaveLength(0); // No new bonuses created
      expect(mockPrisma.commissionBonus.createMany).not.toHaveBeenCalled();
    });

    it('should handle empty user list', async () => {
      const period = '2024-01';

      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await bonusService.calculateBonuses(period);

      expect(result).toHaveLength(0);
      expect(mockPrisma.commissionBonus.createMany).not.toHaveBeenCalled();
    });
  });

  describe('getBonuses', () => {
    it('should return paginated bonuses with filters', async () => {
      const mockBonuses = [
        { id: 'bonus-1', userId: 'user-1', type: 'FAST_START', amount: 100 },
        { id: 'bonus-2', userId: 'user-2', type: 'MONTHLY', amount: 250 },
      ];

      mockPrisma.commissionBonus.findMany.mockResolvedValue(mockBonuses);
      mockPrisma.commissionBonus.count.mockResolvedValue(2);

      const result = await bonusService.getBonuses({
        page: 1,
        limit: 10,
        type: 'FAST_START',
      });

      expect(result.bonuses).toEqual(mockBonuses);
      expect(result.pagination.total).toBe(2);
    });

    it('should handle date range filtering', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      mockPrisma.commissionBonus.findMany.mockResolvedValue([]);
      mockPrisma.commissionBonus.count.mockResolvedValue(0);

      await bonusService.getBonuses({
        page: 1,
        limit: 10,
        startDate,
        endDate,
      });

      expect(mockPrisma.commissionBonus.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            achievedAt: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          }),
        })
      );
    });
  });

  describe('getBonusById', () => {
    it('should return bonus by ID', async () => {
      const mockBonus = {
        id: 'bonus-1',
        userId: 'user-1',
        type: 'FAST_START',
        amount: 100,
      };

      mockPrisma.commissionBonus.findUnique.mockResolvedValue(mockBonus);

      const result = await bonusService.getBonusById('bonus-1');

      expect(result).toEqual(mockBonus);
    });

    it('should return null for non-existent bonus', async () => {
      mockPrisma.commissionBonus.findUnique.mockResolvedValue(null);

      const result = await bonusService.getBonusById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getUserBonuses', () => {
    it('should return user bonuses with pagination', async () => {
      const mockBonuses = [
        { id: 'bonus-1', type: 'FAST_START', amount: 100, achievedAt: new Date() },
        { id: 'bonus-2', type: 'MONTHLY', amount: 250, achievedAt: new Date() },
      ];

      mockPrisma.commissionBonus.findMany.mockResolvedValue(mockBonuses);
      mockPrisma.commissionBonus.count.mockResolvedValue(2);

      const result = await bonusService.getUserBonuses('user-1', 1, 10, 'FAST_START', '2024-01');

      expect(result.bonuses).toEqual(mockBonuses);
      expect(result.pagination.total).toBe(2);
    });
  });

  describe('getBonusAnalytics', () => {
    it('should return comprehensive bonus analytics', async () => {
      const mockBonuses = [
        { type: 'FAST_START', amount: 1000, achievedAt: new Date() },
        { type: 'MONTHLY', amount: 2500, achievedAt: new Date() },
        { type: 'FAST_START', amount: 800, achievedAt: new Date() },
      ];

      mockPrisma.commissionBonus.findMany.mockResolvedValue(mockBonuses);

      const result = await bonusService.getBonusAnalytics({
        period: 'month',
      });

      expect(result.totalBonuses).toBe(3);
      expect(result.totalAmount).toBe(4300);
      const fastStartBonus = result.bonusesByType.find((b: any) => b.type === 'FAST_START');
      const monthlyBonus = result.bonusesByType.find((b: any) => b.type === 'MONTHLY');
      expect(fastStartBonus?.count).toBe(2);
      expect(monthlyBonus?.count).toBe(1);
      expect(result.topPerformers).toBeDefined();
    });

    it('should identify top performers correctly', async () => {
      const mockBonuses = [
        { userId: 'user-1', type: 'MONTHLY', amount: 1000, achievedAt: new Date() },
        { userId: 'user-2', type: 'MONTHLY', amount: 1500, achievedAt: new Date() },
        { userId: 'user-1', type: 'FAST_START', amount: 500, achievedAt: new Date() },
      ];

      mockPrisma.commissionBonus.findMany.mockResolvedValue(mockBonuses);

      const result = await bonusService.getBonusAnalytics({
        period: 'month',
      });

      expect(result.topPerformers).toHaveLength(2);
      expect(result.topPerformers[0].userId).toBe('user-2'); // Higher total
      expect(result.topPerformers[0].totalBonus).toBe(1500);
    });
  });

  describe('calculateFastStartBonus', () => {
    it('should calculate fast start bonus for new distributor', async () => {
      const user = {
        id: 'user-1',
        rank: 'Bronze',
        createdAt: new Date('2024-01-15'),
      };

      const commissions = [
        { amount: 500, createdAt: new Date('2024-01-16') },
        { amount: 300, createdAt: new Date('2024-01-20') },
      ];

      const bonus = await (bonusService as any).calculateFastStartBonus(user, commissions, '2024-01');

      expect(bonus).toMatchObject({
        userId: 'user-1',
        type: 'FAST_START',
        amount: 160, // 20% of first month's commissions
        period: '2024-01',
      });
    });

    it('should not qualify for fast start bonus after first month', async () => {
      const user = {
        id: 'user-1',
        rank: 'Bronze',
        createdAt: new Date('2023-12-15'), // Old user
      };

      const bonus = await (bonusService as any).calculateFastStartBonus(user, [], '2024-01');

      expect(bonus).toBeNull();
    });
  });

  describe('calculateMonthlyBonus', () => {
    it('should calculate monthly bonus based on commission volume', async () => {
      const user = {
        id: 'user-1',
        rank: 'Gold',
      };

      const monthlyVolume = 10000; // $10,000 in commissions

      const bonus = await (bonusService as any).calculateMonthlyBonus(user, monthlyVolume, '2024-01');

      expect(bonus).toMatchObject({
        userId: 'user-1',
        type: 'MONTHLY',
        amount: 500, // 5% of volume
        period: '2024-01',
      });
    });

    it('should not qualify for monthly bonus below threshold', async () => {
      const user = {
        id: 'user-1',
        rank: 'Bronze',
      };

      const monthlyVolume = 1000; // Below threshold

      const bonus = await (bonusService as any).calculateMonthlyBonus(user, monthlyVolume, '2024-01');

      expect(bonus).toBeNull();
    });
  });

  describe('calculateTeamBuildingBonus', () => {
    it('should calculate team building bonus for leaders', async () => {
      const user = {
        id: 'user-1',
        rank: 'Diamond',
      };

      const teamVolume = 50000; // $50,000 team volume

      const bonus = await (bonusService as any).calculateTeamBuildingBonus(user, teamVolume, '2024-01');

      expect(bonus).toMatchObject({
        userId: 'user-1',
        type: 'TEAM_BUILDING',
        amount: 2500, // 5% of team volume
        period: '2024-01',
      });
    });

    it('should not qualify for team building bonus below rank threshold', async () => {
      const user = {
        id: 'user-1',
        rank: 'Gold', // Below Diamond
      };

      const bonus = await (bonusService as any).calculateTeamBuildingBonus(user, 100000, '2024-01');

      expect(bonus).toBeNull();
    });
  });

  describe('validateBonusData', () => {
    it('should validate bonus data successfully', () => {
      const validData = {
        userId: 'user-123',
        type: 'FAST_START' as const,
        amount: 500,
        period: '2024-01',
      };

      expect(() => (bonusService as any).validateBonusData(validData)).not.toThrow();
    });

    it('should throw error for invalid bonus type', () => {
      const invalidData = {
        userId: 'user-123',
        type: 'INVALID_TYPE' as any,
        amount: 500,
        period: '2024-01',
      };

      expect(() => (bonusService as any).validateBonusData(invalidData))
        .toThrow('Invalid bonus type');
    });

    it('should throw error for negative amount', () => {
      const invalidData = {
        userId: 'user-123',
        type: 'FAST_START' as const,
        amount: -100,
        period: '2024-01',
      };

      expect(() => (bonusService as any).validateBonusData(invalidData))
        .toThrow('Bonus amount must be positive');
    });
  });
});