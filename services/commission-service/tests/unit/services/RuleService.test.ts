import { RuleService } from '../../../src/services/RuleService';
import { cacheService } from '../../../src/utils/cache';

jest.mock('../../../src/utils/cache');
jest.mock('../../../src/utils/logger');

describe('RuleService', () => {
  let ruleService: RuleService;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      commissionRule: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };

    ruleService = new RuleService();
    (ruleService as any).prisma = mockPrisma;
  });

  describe('createRule', () => {
    it('should create a commission rule successfully', async () => {
      const ruleData = {
        name: 'Direct Commission Rule',
        type: 'DIRECT' as const,
        level: 1,
        percentage: 10.0,
        minAmount: 0,
        maxAmount: 1000,
        isActive: true,
        conditions: { minRank: 'Bronze' },
      };

      const expectedRule = {
        id: 'rule-123',
        ...ruleData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.commissionRule.create.mockResolvedValue(expectedRule);

      const result = await ruleService.createRule(ruleData);

      expect(result).toEqual(expectedRule);
      expect(mockPrisma.commissionRule.create).toHaveBeenCalledWith({
        data: ruleData,
      });
    });

    it('should validate required fields', async () => {
      const invalidData = {
        name: 'Invalid Rule',
        // Missing required fields
      };

      await expect(ruleService.createRule(invalidData))
        .rejects.toThrow('Validation failed');
    });

    it('should validate percentage range', async () => {
      const invalidData = {
        name: 'Invalid Rule',
        type: 'DIRECT' as const,
        level: 1,
        percentage: 150, // Invalid percentage
        isActive: true,
      };

      await expect(ruleService.createRule(invalidData))
        .rejects.toThrow('Percentage must be between 0 and 100');
    });
  });

  describe('getRules', () => {
    it('should return paginated rules with filters', async () => {
      const mockRules = [
        { id: 'rule-1', name: 'Direct Rule', type: 'DIRECT', isActive: true },
        { id: 'rule-2', name: 'Level 2 Rule', type: 'LEVEL_2', isActive: true },
      ];

      mockPrisma.commissionRule.findMany.mockResolvedValue(mockRules);
      mockPrisma.commissionRule.count.mockResolvedValue(2);

      const result = await ruleService.getRules({
        page: 1,
        limit: 10,
        type: 'DIRECT',
        isActive: true,
      });

      expect(result.rules).toEqual(mockRules);
      expect(result.pagination.total).toBe(2);
    });

    it('should apply multiple filters correctly', async () => {
      mockPrisma.commissionRule.findMany.mockResolvedValue([]);
      mockPrisma.commissionRule.count.mockResolvedValue(0);

      await ruleService.getRules({
        page: 1,
        limit: 10,
        type: 'LEVEL_2',
        isActive: false,
      });

      expect(mockPrisma.commissionRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            type: 'LEVEL_2',
            isActive: false,
          },
        })
      );
    });
  });

  describe('getRuleById', () => {
    it('should return rule by ID', async () => {
      const mockRule = {
        id: 'rule-1',
        name: 'Direct Rule',
        type: 'DIRECT',
        percentage: 10,
      };

      mockPrisma.commissionRule.findUnique.mockResolvedValue(mockRule);

      const result = await ruleService.getRuleById('rule-1');

      expect(result).toEqual(mockRule);
    });

    it('should return null for non-existent rule', async () => {
      mockPrisma.commissionRule.findUnique.mockResolvedValue(null);

      const result = await ruleService.getRuleById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateRule', () => {
    it('should update rule successfully', async () => {
      const updateData = {
        name: 'Updated Rule Name',
        percentage: 15.0,
        isActive: false,
      };

      const existingRule = {
        id: 'rule-1',
        name: 'Old Rule Name',
        type: 'DIRECT',
        percentage: 10,
        isActive: true,
      };

      const updatedRule = {
        ...existingRule,
        ...updateData,
        updatedAt: new Date(),
      };

      mockPrisma.commissionRule.findUnique.mockResolvedValue(existingRule);
      mockPrisma.commissionRule.update.mockResolvedValue(updatedRule);

      const result = await ruleService.updateRule('rule-1', updateData);

      expect(result).toEqual(updatedRule);
      expect(result.name).toBe('Updated Rule Name');
      expect(result.percentage).toBe(15);
      expect(result.isActive).toBe(false);
    });

    it('should throw error for non-existent rule', async () => {
      mockPrisma.commissionRule.findUnique.mockResolvedValue(null);

      await expect(ruleService.updateRule('non-existent', { name: 'New Name' }))
        .rejects.toThrow('Commission rule not found');
    });

    it('should validate updated data', async () => {
      const existingRule = {
        id: 'rule-1',
        name: 'Existing Rule',
        type: 'DIRECT',
        percentage: 10,
        isActive: true,
      };

      const invalidUpdate = {
        percentage: -5, // Invalid percentage
      };

      mockPrisma.commissionRule.findUnique.mockResolvedValue(existingRule);

      await expect(ruleService.updateRule('rule-1', invalidUpdate))
        .rejects.toThrow('Percentage must be between 0 and 100');
    });
  });

  describe('deleteRule', () => {
    it('should delete rule successfully', async () => {
      const mockRule = { id: 'rule-1', name: 'Test Rule' };

      mockPrisma.commissionRule.findUnique.mockResolvedValue(mockRule);
      mockPrisma.commissionRule.delete.mockResolvedValue(mockRule);

      await expect(ruleService.deleteRule('rule-1')).resolves.not.toThrow();
      expect(mockPrisma.commissionRule.delete).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
      });
    });

    it('should throw error for non-existent rule', async () => {
      mockPrisma.commissionRule.findUnique.mockResolvedValue(null);

      await expect(ruleService.deleteRule('non-existent'))
        .rejects.toThrow('Commission rule not found');
    });
  });

  describe('getActiveRules', () => {
    it('should return only active rules', async () => {
      const mockActiveRules = [
        { id: 'rule-1', name: 'Active Rule 1', isActive: true },
        { id: 'rule-2', name: 'Active Rule 2', isActive: true },
      ];

      mockPrisma.commissionRule.findMany.mockResolvedValue(mockActiveRules);

      const result = await ruleService.getActiveRules();

      expect(result).toEqual(mockActiveRules);
      expect(mockPrisma.commissionRule.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { level: 'asc' },
      });
    });

    it('should return empty array when no active rules', async () => {
      mockPrisma.commissionRule.findMany.mockResolvedValue([]);

      const result = await ruleService.getActiveRules();

      expect(result).toEqual([]);
    });
  });

  describe('validateRuleData', () => {
    it('should validate complete rule data successfully', () => {
      const validData = {
        name: 'Valid Rule',
        type: 'DIRECT' as const,
        level: 1,
        percentage: 10.5,
        minAmount: 0,
        maxAmount: 1000,
        isActive: true,
        conditions: { minRank: 'Bronze' },
      };

      expect(() => (ruleService as any).validateRuleData(validData)).not.toThrow();
    });

    it('should throw error for missing required fields', () => {
      const invalidData = {
        name: 'Invalid Rule',
        // Missing type, level, percentage
      };

      expect(() => (ruleService as any).validateRuleData(invalidData))
        .toThrow('Rule type is required');
    });

    it('should validate rule type', () => {
      const invalidData = {
        name: 'Invalid Rule',
        type: 'INVALID_TYPE' as any,
        level: 1,
        percentage: 10,
        isActive: true,
      };

      expect(() => (ruleService as any).validateRuleData(invalidData))
        .toThrow('Invalid rule type');
    });

    it('should validate percentage range', () => {
      const invalidData = {
        name: 'Invalid Rule',
        type: 'DIRECT' as const,
        level: 1,
        percentage: 150, // Over 100%
        isActive: true,
      };

      expect(() => (ruleService as any).validateRuleData(invalidData))
        .toThrow('Percentage must be between 0 and 100');
    });

    it('should validate level range', () => {
      const invalidData = {
        name: 'Invalid Rule',
        type: 'LEVEL_2' as const,
        level: 0, // Invalid level
        percentage: 10,
        isActive: true,
      };

      expect(() => (ruleService as any).validateRuleData(invalidData))
        .toThrow('Level must be between 1 and 10');
    });

    it('should validate amount ranges', () => {
      const invalidData = {
        name: 'Invalid Rule',
        type: 'DIRECT' as const,
        level: 1,
        percentage: 10,
        minAmount: 1000,
        maxAmount: 500, // min > max
        isActive: true,
      };

      expect(() => (ruleService as any).validateRuleData(invalidData))
        .toThrow('Maximum amount must be greater than minimum amount');
    });
  });

  describe('evaluateRuleConditions', () => {
    it('should evaluate simple conditions correctly', async () => {
      const rule = {
        conditions: { minRank: 'Gold', minVolume: 5000 },
      };

      const context = {
        userRank: 'Diamond',
        monthlyVolume: 10000,
      };

      const result = await (ruleService as any).evaluateRuleConditions(rule, context);

      expect(result).toBe(true);
    });

    it('should reject when conditions not met', async () => {
      const rule = {
        conditions: { minRank: 'Gold', minVolume: 5000 },
      };

      const context = {
        userRank: 'Bronze', // Below minimum rank
        monthlyVolume: 10000,
      };

      const result = await (ruleService as any).evaluateRuleConditions(rule, context);

      expect(result).toBe(false);
    });

    it('should handle complex conditions with AND/OR logic', async () => {
      const rule = {
        conditions: {
          $or: [
            { minRank: 'Diamond' },
            { minVolume: 10000 },
          ],
        },
      };

      const context1 = { userRank: 'Gold', monthlyVolume: 15000 }; // Meets volume condition
      const context2 = { userRank: 'Diamond', monthlyVolume: 1000 }; // Meets rank condition

      const result1 = await (ruleService as any).evaluateRuleConditions(rule, context1);
      const result2 = await (ruleService as any).evaluateRuleConditions(rule, context2);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('should return true for rules without conditions', async () => {
      const rule = { conditions: null };
      const context = { userRank: 'Bronze' };

      const result = await (ruleService as any).evaluateRuleConditions(rule, context);

      expect(result).toBe(true);
    });
  });

  describe('calculateCommissionAmount', () => {
    it('should calculate commission amount correctly', () => {
      const rule = {
        percentage: 10,
        minAmount: 5,
        maxAmount: 500,
      };

      const baseAmount = 1000;

      const amount = (ruleService as any).calculateCommissionAmount(rule, baseAmount);

      expect(amount).toBe(100); // 10% of 1000
    });

    it('should respect minimum amount', () => {
      const rule = {
        percentage: 1, // Would be $10
        minAmount: 50, // But minimum is $50
        maxAmount: 500,
      };

      const baseAmount = 1000;

      const amount = (ruleService as any).calculateCommissionAmount(rule, baseAmount);

      expect(amount).toBe(50); // Capped at minimum
    });

    it('should respect maximum amount', () => {
      const rule = {
        percentage: 20, // Would be $2000
        minAmount: 0,
        maxAmount: 1000, // But maximum is $1000
      };

      const baseAmount = 10000;

      const amount = (ruleService as any).calculateCommissionAmount(rule, baseAmount);

      expect(amount).toBe(1000); // Capped at maximum
    });
  });
});