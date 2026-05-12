import { PrismaClient } from '@prisma/client';
import { cacheService } from '../utils/cache';
import { logger } from '../utils/logger';

const db = new PrismaClient();

interface RuleQuery {
  page: number;
  limit: number;
  type?: string;
  isActive?: boolean;
}

export class RuleService {
  async createRule(ruleData: any) {
    const rule = await (db as any).commissionRule.create({
      data: ruleData,
    });

    // Invalidate cache
    await cacheService.invalidateCommissionRulesCache();

    logger.info('Commission rule created', {
      ruleId: rule.id,
      name: rule.name,
      type: rule.type,
      level: rule.level,
    });

    return rule;
  }

  async getRules(query: RuleQuery) {
    const { page, limit, type, isActive } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive;

    const [rules, total] = await Promise.all([
      (db as any).commissionRule.findMany({
        where,
        orderBy: [
          { level: 'asc' },
          { type: 'asc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      (db as any).commissionRule.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      rules,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getRuleById(ruleId: string) {
    return await (db as any).commissionRule.findUnique({
      where: { id: ruleId },
    });
  }

  async updateRule(ruleId: string, updates: any) {
    const rule = await (db as any).commissionRule.update({
      where: { id: ruleId },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });

    // Invalidate cache
    await cacheService.invalidateCommissionRulesCache();

    logger.info('Commission rule updated', {
      ruleId,
      name: rule.name,
      changes: Object.keys(updates),
    });

    return rule;
  }

  async deleteRule(ruleId: string) {
    const rule = await (db as any).commissionRule.findUnique({
      where: { id: ruleId },
      select: { name: true, type: true },
    });

    if (!rule) {
      throw new Error('Commission rule not found');
    }

    await (db as any).commissionRule.delete({
      where: { id: ruleId },
    });

    // Invalidate cache
    await cacheService.invalidateCommissionRulesCache();

    logger.info('Commission rule deleted', {
      ruleId,
      name: rule.name,
      type: rule.type,
    });
  }

  async getActiveRules() {
    // Try cache first
    const cacheKey = 'active_commission_rules';
    const cached = await cacheService.getCachedCommissionRules();
    if (cached) {
      return cached;
    }

    // Fetch from database
    const rules = await (db as any).commissionRule.findMany({
      where: { isActive: true },
      orderBy: { level: 'asc' },
    });

    // Cache for 1 hour
    await cacheService.setCachedCommissionRules(rules, 3600);
    return rules;
  }

  async getActiveRulesByType(type: string) {
    // Try cache first
    const allRules = await cacheService.getCachedCommissionRules();
    if (allRules) {
      return allRules.filter((rule: any) => rule.type === type && rule.isActive);
    }

    // Fetch from database
    const rules = await (db as any).commissionRule.findMany({
      where: {
        type: type as any,
        isActive: true,
      },
      orderBy: { level: 'asc' },
    });

    return rules;
  }

  async validateRule(ruleData: any): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Required fields validation
    if (!ruleData.name || ruleData.name.trim().length === 0) {
      errors.push('Rule name is required');
    }

    if (!ruleData.type) {
      errors.push('Rule type is required');
    }

    if (!ruleData.level || ruleData.level < 1) {
      errors.push('Rule level must be a positive integer');
    }

    if (!ruleData.percentage || ruleData.percentage < 0 || ruleData.percentage > 100) {
      errors.push('Rule percentage must be between 0 and 100');
    }

    // Business logic validation
    if (ruleData.minAmount && ruleData.minAmount < 0) {
      errors.push('Minimum amount cannot be negative');
    }

    if (ruleData.maxAmount && ruleData.maxAmount < 0) {
      errors.push('Maximum amount cannot be negative');
    }

    if (ruleData.minAmount && ruleData.maxAmount && ruleData.minAmount > ruleData.maxAmount) {
      errors.push('Minimum amount cannot be greater than maximum amount');
    }

    // Check for duplicate rules
    if (ruleData.name) {
      const existingRule = await (db as any).commissionRule.findFirst({
        where: {
          name: ruleData.name,
          ...(ruleData.id ? { id: { not: ruleData.id } } : {}),
        },
      });

      if (existingRule) {
        errors.push('Rule name must be unique');
      }
    }

    // Type-specific validation
    if (ruleData.type) {
      const validTypes = [
        'DIRECT', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'LEVEL_5',
        'UNILEVEL', 'BINARY', 'MATRIX', 'GENERATIONAL',
        'PERFORMANCE', 'LOYALTY', 'LEADERSHIP', 'TRAVEL', 'CAR', 'HOUSE'
      ];

      if (!validTypes.includes(ruleData.type)) {
        errors.push(`Invalid rule type. Must be one of: ${validTypes.join(', ')}`);
      }

      // Level validation based on type
      if (ruleData.type === 'DIRECT' && ruleData.level !== 1) {
        errors.push('Direct commission rules must have level 1');
      }

      if (['LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'LEVEL_5'].includes(ruleData.type)) {
        const expectedLevel = parseInt(ruleData.type.split('_')[1]);
        if (ruleData.level !== expectedLevel) {
          errors.push(`${ruleData.type} rules must have level ${expectedLevel}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async getRuleAnalytics(ruleId: string) {
    const rule = await this.getRuleById(ruleId);
    if (!rule) {
      throw new Error('Commission rule not found');
    }

    const [usageStats, performanceStats] = await Promise.all([
      // Usage statistics
      db.commission.count({
        where: {
          type: rule.type,
          // Note: In a real implementation, you'd need to link commissions to specific rules
        },
      }),
      // Performance statistics
      db.commission.aggregate({
        where: {
          type: rule.type,
          // Note: In a real implementation, you'd need to link commissions to specific rules
        },
        _count: true,
        _sum: {
          amount: true,
        },
      }),
    ]);

    return {
      ruleId,
      ruleName: rule.name,
      ruleType: rule.type,
      ruleLevel: rule.level,
      percentage: rule.percentage,
      totalUsage: usageStats,
      totalCommissions: performanceStats._count,
      totalAmount: performanceStats._sum.amount || 0,
      averageCommission: performanceStats._count > 0
        ? (performanceStats._sum.amount || 0) / performanceStats._count
        : 0,
      isActive: rule.isActive,
      createdAt: rule.createdAt,
    };
  }

  async bulkUpdateRules(ruleUpdates: Array<{ id: string; updates: any }>) {
    const results = [];

    for (const update of ruleUpdates) {
      try {
        const rule = await this.updateRule(update.id, update.updates);
        results.push({
          id: update.id,
          success: true,
          data: rule,
        });
      } catch (error) {
        results.push({
          id: update.id,
          success: false,
          error: (error as Error).message,
        });
      }
    }

    // Invalidate cache once after all updates
    await cacheService.invalidateCommissionRulesCache();

    logger.info('Bulk rule updates completed', {
      total: ruleUpdates.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    });

    return results;
  }

  async cloneRule(ruleId: string, newName: string) {
    const originalRule = await this.getRuleById(ruleId);
    if (!originalRule) {
      throw new Error('Original rule not found');
    }

    const clonedRule = await this.createRule({
      ...originalRule,
      id: undefined, // Let database generate new ID
      name: newName,
      createdAt: undefined,
      updatedAt: undefined,
    });

    logger.info('Commission rule cloned', {
      originalRuleId: ruleId,
      clonedRuleId: clonedRule.id,
      newName,
    });

    return clonedRule;
  }

  async getRulesSummary() {
    const [totalRules, activeRules, rulesByType] = await Promise.all([
      (db as any).commissionRule.count(),
      (db as any).commissionRule.count({ where: { isActive: true } }),
      (db as any).commissionRule.groupBy({
        by: ['type'],
        _count: true,
        where: { isActive: true },
      }),
    ]);

    return {
      totalRules,
      activeRules,
      inactiveRules: totalRules - activeRules,
      rulesByType: rulesByType.map((type: typeof rulesByType[number]) => ({
        type: type.type,
        count: type._count,
      })),
    };
  }

  // Utility methods for commission calculation
  async getApplicableRules(orderAmount: number, orderPV: number, userLevel: number = 1) {
    const rules = await (db as any).commissionRule.findMany({
      where: {
        isActive: true,
        OR: [
          { minAmount: { lte: orderPV } },
          { minAmount: undefined },
        ],
        AND: [
          {
            OR: [
              { maxAmount: { gte: orderPV } },
              { maxAmount: null },
            ],
          },
        ],
      },
      orderBy: [
        { level: 'asc' },
        { percentage: 'desc' },
      ],
    });

    // Filter rules based on additional conditions
    return rules.filter((rule: typeof rules[number]) => {
      // Check custom conditions if they exist
      if (rule.conditions) {
        try {
          const conditions = typeof rule.conditions === 'string'
            ? JSON.parse(rule.conditions)
            : rule.conditions;

          // Apply custom logic based on conditions
          // This is a simplified implementation
          if (conditions.minUserLevel && userLevel < conditions.minUserLevel) {
            return false;
          }

          if (conditions.maxUserLevel && userLevel > conditions.maxUserLevel) {
            return false;
          }

          if (conditions.requiredRank && !this.checkRankCondition(userLevel, conditions.requiredRank)) {
            return false;
          }
        } catch (error) {
          logger.warn('Failed to parse rule conditions', {
            ruleId: rule.id,
            error: (error as Error).message,
          });
          return false;
        }
      }

      return true;
    });
  }

  private checkRankCondition(userLevel: number, requiredRank: string): boolean {
    // Simplified rank checking logic
    // In a real implementation, you'd have a proper rank hierarchy
    const rankLevels: Record<string, number> = {
      'Member': 1,
      'Bronze': 2,
      'Silver': 3,
      'Gold': 4,
      'Diamond': 5,
      'Super Diamond': 6,
      'STAR': 7,
      'Elite': 8,
      'Supervisor': 9,
      'Manager': 10,
      'Director': 11,
      'President': 12,
      'Chairman': 13,
      'Black Diamond': 14,
      'Emerald': 15,
      'Blue Emerald': 16,
    };

    return userLevel >= (rankLevels[requiredRank] || 1);
  }
}