// Feature Flag System
// Enterprise-grade feature flag management with A/B testing support

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description?: string;
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  rules: FeatureFlagRule[];
  variants?: FeatureFlagVariant[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface FeatureFlagRule {
  type: 'user' | 'company' | 'percentage' | 'environment' | 'custom';
  condition: any;
  value: boolean;
}

export interface FeatureFlagVariant {
  name: string;
  percentage: number; // Percentage of users to see this variant
  config?: Record<string, any>;
}

export interface FeatureEvaluationContext {
  userId?: string;
  companyId?: string;
  userAgent?: string;
  ipAddress?: string;
  environment?: string;
  customAttributes?: Record<string, any>;
}

class FeatureFlagService {
  private static instance: FeatureFlagService;
  private flags = new Map<string, FeatureFlag>();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.loadFlagsFromDatabase();
    // Refresh cache every 5 minutes
    setInterval(() => this.loadFlagsFromDatabase(), this.cacheExpiry);
  }

  static getInstance(): FeatureFlagService {
    if (!FeatureFlagService.instance) {
      FeatureFlagService.instance = new FeatureFlagService();
    }
    return FeatureFlagService.instance;
  }

  // Evaluate if a feature is enabled for a given context
  async isEnabled(
    flagKey: string,
    context: FeatureEvaluationContext = {}
  ): Promise<boolean> {
    const flag = this.flags.get(flagKey);
    if (!flag) {
      logger.warn(`Feature flag not found: ${flagKey}`);
      return false;
    }

    if (!flag.enabled) {
      return false;
    }

    // Check all rules
    for (const rule of flag.rules) {
      const ruleResult = await this.evaluateRule(rule, context);
      if (ruleResult !== null) {
        return ruleResult;
      }
    }

    // If no rules match, use rollout percentage
    return this.evaluateRolloutPercentage(flag.rolloutPercentage, context);
  }

  // Get variant for A/B testing
  async getVariant(
    flagKey: string,
    context: FeatureEvaluationContext = {}
  ): Promise<string | null> {
    const flag = this.flags.get(flagKey);
    if (!flag?.variants?.length) {
      return null;
    }

    const hash = this.generateHash(flagKey, context);
    const normalizedHash = hash % 100;

    let cumulativePercentage = 0;
    for (const variant of flag.variants) {
      cumulativePercentage += variant.percentage;
      if (normalizedHash < cumulativePercentage) {
        return variant.name;
      }
    }

    return null; // Fallback to control
  }

  // Get feature configuration with variant overrides
  async getFeatureConfig(
    flagKey: string,
    context: FeatureEvaluationContext = {}
  ): Promise<Record<string, any> | null> {
    const flag = this.flags.get(flagKey);
    if (!flag) return null;

    const variant = await this.getVariant(flagKey, context);
    if (variant) {
      const variantConfig = flag.variants?.find(v => v.name === variant);
      return variantConfig?.config || {};
    }

    return {};
  }

  // Create or update a feature flag
  async upsertFlag(
    flagData: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>,
    userId: string
  ): Promise<FeatureFlag> {
    try {
      // Validate flag data
      this.validateFlagData(flagData);

      const existingFlag = await prisma.featureFlag.findUnique({
        where: { key: flagData.key },
        include: { rules: true, variants: true },
      });

      if (existingFlag) {
        // Update existing flag
        const updatedFlag = await prisma.featureFlag.update({
          where: { id: existingFlag.id },
          data: {
            name: flagData.name,
            description: flagData.description,
            enabled: flagData.enabled,
            rolloutPercentage: flagData.rolloutPercentage,
            updatedAt: new Date(),
            rules: {
              deleteMany: {},
              create: flagData.rules.map(rule => ({
                type: rule.type,
                condition: rule.condition,
                value: rule.value,
              })),
            },
            variants: flagData.variants ? {
              deleteMany: {},
              create: flagData.variants.map(variant => ({
                name: variant.name,
                percentage: variant.percentage,
                config: variant.config,
              })),
            } : undefined,
          },
          include: { rules: true, variants: true },
        });

        const formattedFlag = this.formatFlagFromDB(updatedFlag);
        this.flags.set(flagData.key, formattedFlag);

        logger.info('Feature flag updated', { key: flagData.key, updatedBy: userId });
        return formattedFlag;
      } else {
        // Create new flag
        const newFlag = await prisma.featureFlag.create({
          data: {
            name: flagData.name,
            key: flagData.key,
            description: flagData.description,
            enabled: flagData.enabled,
            rolloutPercentage: flagData.rolloutPercentage,
            createdBy: userId,
            rules: {
              create: flagData.rules.map(rule => ({
                type: rule.type,
                condition: rule.condition,
                value: rule.value,
              })),
            },
            variants: flagData.variants ? {
              create: flagData.variants.map(variant => ({
                name: variant.name,
                percentage: variant.percentage,
                config: variant.config,
              })),
            } : undefined,
          },
          include: { rules: true, variants: true },
        });

        const formattedFlag = this.formatFlagFromDB(newFlag);
        this.flags.set(flagData.key, formattedFlag);

        logger.info('Feature flag created', { key: flagData.key, createdBy: userId });
        return formattedFlag;
      }
    } catch (error) {
      logger.error('Failed to upsert feature flag:', error);
      throw error;
    }
  }

  // Delete a feature flag
  async deleteFlag(flagKey: string, userId: string): Promise<void> {
    try {
      const flag = await prisma.featureFlag.findUnique({
        where: { key: flagKey },
      });

      if (!flag) {
        throw new Error('Feature flag not found');
      }

      await prisma.featureFlag.delete({
        where: { id: flag.id },
      });

      this.flags.delete(flagKey);

      logger.info('Feature flag deleted', { key: flagKey, deletedBy: userId });
    } catch (error) {
      logger.error('Failed to delete feature flag:', error);
      throw error;
    }
  }

  // Get all feature flags
  async getAllFlags(): Promise<FeatureFlag[]> {
    return Array.from(this.flags.values());
  }

  // Get flag statistics
  async getFlagStats(flagKey: string): Promise<{
    totalEvaluations: number;
    enabledCount: number;
    disabledCount: number;
    variantDistribution: Record<string, number>;
  }> {
    // This would typically integrate with analytics/monitoring system
    // For now, return mock data
    return {
      totalEvaluations: 0,
      enabledCount: 0,
      disabledCount: 0,
      variantDistribution: {},
    };
  }

  // Private helper methods

  private async loadFlagsFromDatabase(): Promise<void> {
    try {
      const flags = await prisma.featureFlag.findMany({
        include: { rules: true, variants: true },
      });

      this.flags.clear();
      for (const flag of flags) {
        const formattedFlag = this.formatFlagFromDB(flag);
        this.flags.set(flag.key, formattedFlag);
      }

      logger.info(`Loaded ${flags.length} feature flags from database`);
    } catch (error) {
      logger.error('Failed to load feature flags from database:', error);
    }
  }

  private formatFlagFromDB(dbFlag: any): FeatureFlag {
    return {
      id: dbFlag.id,
      name: dbFlag.name,
      key: dbFlag.key,
      description: dbFlag.description,
      enabled: dbFlag.enabled,
      rolloutPercentage: dbFlag.rolloutPercentage,
      rules: dbFlag.rules.map((rule: any) => ({
        type: rule.type,
        condition: rule.condition,
        value: rule.value,
      })),
      variants: dbFlag.variants?.map((variant: any) => ({
        name: variant.name,
        percentage: variant.percentage,
        config: variant.config,
      })),
      createdAt: dbFlag.createdAt,
      updatedAt: dbFlag.updatedAt,
      createdBy: dbFlag.createdBy,
    };
  }

  private async evaluateRule(
    rule: FeatureFlagRule,
    context: FeatureEvaluationContext
  ): Promise<boolean | null> {
    switch (rule.type) {
      case 'user':
        return context.userId === rule.condition.userId ? rule.value : null;

      case 'company':
        return context.companyId === rule.condition.companyId ? rule.value : null;

      case 'environment':
        return context.environment === rule.condition.environment ? rule.value : null;

      case 'percentage':
        // Already handled by rollout percentage
        return null;

      case 'custom':
        return this.evaluateCustomRule(rule, context);

      default:
        return null;
    }
  }

  private evaluateRolloutPercentage(
    percentage: number,
    context: FeatureEvaluationContext
  ): boolean {
    const identifier = context.userId || context.companyId || 'anonymous';
    const hash = this.generateHash(identifier, context);
    const normalizedHash = hash % 100;
    return normalizedHash < percentage;
  }

  private evaluateCustomRule(rule: FeatureFlagRule, context: FeatureEvaluationContext): boolean | null {
    // Custom rule evaluation logic
    // This could include complex conditions like:
    // - User subscription tier
    // - Geographic location
    // - Time-based conditions
    // - etc.

    try {
      const condition = rule.condition;
      let result = true;

      // Evaluate each condition
      for (const [key, expectedValue] of Object.entries(condition)) {
        const actualValue = context.customAttributes?.[key] || context[key as keyof FeatureEvaluationContext];

        if (actualValue !== expectedValue) {
          result = false;
          break;
        }
      }

      return result ? rule.value : null;
    } catch (error) {
      logger.error('Custom rule evaluation failed:', error);
      return null;
    }
  }

  private generateHash(identifier: string, context: FeatureEvaluationContext): number {
    const input = `${identifier}:${JSON.stringify(context)}`;
    let hash = 0;

    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash);
  }

  private validateFlagData(flagData: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>): void {
    if (!flagData.key || !flagData.key.match(/^[a-zA-Z0-9_-]+$/)) {
      throw new Error('Invalid flag key. Use only letters, numbers, hyphens, and underscores.');
    }

    if (flagData.rolloutPercentage < 0 || flagData.rolloutPercentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100.');
    }

    if (flagData.variants) {
      const totalPercentage = flagData.variants.reduce((sum, variant) => sum + variant.percentage, 0);
      if (totalPercentage > 100) {
        throw new Error('Total variant percentage cannot exceed 100%.');
      }
    }

    // Validate rules
    for (const rule of flagData.rules) {
      if (!['user', 'company', 'percentage', 'environment', 'custom'].includes(rule.type)) {
        throw new Error(`Invalid rule type: ${rule.type}`);
      }
    }
  }
}

export const featureFlagService = FeatureFlagService.getInstance();
export default featureFlagService;