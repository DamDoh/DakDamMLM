import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { SettingAnalyticsService } from './setting-enhancements';

export interface SettingsContext {
  companyId?: string;
  userId?: string;
}

export interface ResolvedSetting {
  key: string;
  value: any;
  source: 'system' | 'company' | 'user';
  effectiveDate: Date;
  expiryDate?: Date;
}

export class SettingsService {
  private static cache = new Map<string, { value: ResolvedSetting; expires: number }>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // --------------------------------------------------------------------------
  // Get resolved setting with hierarchical precedence (User > Company > System)
  // --------------------------------------------------------------------------
  static async getResolvedSetting(key: string, context: SettingsContext = {}): Promise<ResolvedSetting | null> {
    // Track analytics
    await SettingAnalyticsService.trackAccess(key, 'resolved', context);
    const cacheKey = `${key}:${context.companyId || 'global'}:${context.userId || 'anonymous'}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }

    try {
      // 1. Try user-specific setting (highest precedence)
      if (context.userId) {
        const userSetting = await prisma.userSetting.findFirst({
          where: {
            userId: context.userId,
            key,
            isActive: true,
            effectiveDate: { lte: new Date() },
            OR: [
              { expiryDate: null },
              { expiryDate: { gt: new Date() } }
            ]
          },
          orderBy: { effectiveDate: 'desc' }
        });

        if (userSetting) {
          const resolved: ResolvedSetting = {
            key,
            value: userSetting.value,
            source: 'user',
            effectiveDate: userSetting.effectiveDate,
            expiryDate: userSetting.expiryDate || undefined
          };
          this.cache.set(cacheKey, { value: resolved, expires: Date.now() + this.CACHE_TTL });
          return resolved;
        }
      }

      // 2. Try company-specific setting
      if (context.companyId) {
        const companySetting = await prisma.companySetting.findFirst({
          where: {
            companyId: context.companyId,
            key,
            isActive: true,
            effectiveDate: { lte: new Date() },
            OR: [
              { expiryDate: null },
              { expiryDate: { gt: new Date() } }
            ]
          },
          orderBy: { effectiveDate: 'desc' }
        });

        if (companySetting) {
          const resolved: ResolvedSetting = {
            key,
            value: companySetting.value,
            source: 'company',
            effectiveDate: companySetting.effectiveDate,
            expiryDate: companySetting.expiryDate || undefined
          };
          this.cache.set(cacheKey, { value: resolved, expires: Date.now() + this.CACHE_TTL });
          return resolved;
        }
      }

      // 3. Fall back to system default (lowest precedence)
      const systemDefault = await prisma.systemDefault.findFirst({
        where: {
          key,
          isActive: true
        },
        orderBy: { version: 'desc' }
      });

      if (systemDefault) {
        const resolved: ResolvedSetting = {
          key,
          value: systemDefault.value,
          source: 'system',
          effectiveDate: systemDefault.createdAt,
          expiryDate: undefined
        };
        this.cache.set(cacheKey, { value: resolved, expires: Date.now() + this.CACHE_TTL });
        return resolved;
      }

      return null;
    } catch (error) {
      logger.error('Error resolving setting', {
        key,
        context,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Get commission rate with fallback to hardcoded 8%
  // --------------------------------------------------------------------------
  static async getCommissionRate(context: SettingsContext = {}): Promise<number> {
    const setting = await this.getResolvedSetting('commission_rate', context);
    return setting?.value ?? 0.08;
  }

  // --------------------------------------------------------------------------
  // Get PV matching rules
  // --------------------------------------------------------------------------
  static async getPVMatchingRules(context: SettingsContext = {}): Promise<any> {
    const setting = await this.getResolvedSetting('pv_matching_rules', context);
    return setting?.value ?? {
      commission_rate: 0.08,
      matching_formula: "min(leftWaitingPV, rightWaitingPV)",
      post_match_adjustment: {
        larger_leg_formula: "larger - smaller",
        smaller_leg_formula: "0"
      }
    };
  }

  // --------------------------------------------------------------------------
  // Create or update setting with audit logging
  // --------------------------------------------------------------------------
  static async setSetting(
    level: 'system' | 'company' | 'user',
    key: string,
    value: any,
    metadata: {
      category: string;
      description?: string;
      reason?: string;
      performedBy: string;
      companyId?: string;
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    try {
      let settingId: string;
      let oldValue: any = null;

      if (level === 'system') {
        // Get existing system default
        const existing = await prisma.systemDefault.findUnique({ where: { key } });
        oldValue = existing?.value || null;

        const updated = await prisma.systemDefault.upsert({
          where: { key },
          update: {
            value,
            category: metadata.category,
            description: metadata.description,
            updatedAt: new Date(),
            version: { increment: 1 }
          },
          create: {
            key,
            value,
            category: metadata.category,
            description: metadata.description,
            createdBy: metadata.performedBy
          }
        });
        settingId = updated.id;

      } else if (level === 'company' && metadata.companyId) {
        const existing = await prisma.companySetting.findUnique({
          where: { companyId_key: { companyId: metadata.companyId, key } }
        });
        oldValue = existing?.value || null;

        const updated = await prisma.companySetting.upsert({
          where: { companyId_key: { companyId: metadata.companyId, key } },
          update: {
            value,
            category: metadata.category,
            description: metadata.description,
            updatedAt: new Date(),
            version: { increment: 1 }
          },
          create: {
            companyId: metadata.companyId,
            key,
            value,
            category: metadata.category,
            description: metadata.description,
            createdBy: metadata.performedBy
          }
        });
        settingId = updated.id;

      } else if (level === 'user' && metadata.userId) {
        const existing = await prisma.userSetting.findUnique({
          where: { userId_key: { userId: metadata.userId, key } }
        });
        oldValue = existing?.value || null;

        const updated = await prisma.userSetting.upsert({
          where: { userId_key: { userId: metadata.userId, key } },
          update: {
            value,
            category: metadata.category,
            description: metadata.description,
            updatedAt: new Date(),
            version: { increment: 1 }
          },
          create: {
            userId: metadata.userId,
            key,
            value,
            category: metadata.category,
            description: metadata.description,
            createdBy: metadata.performedBy
          }
        });
        settingId = updated.id;
      } else {
        throw new Error('Invalid setting level or missing required IDs');
      }

      // Log the change
      await prisma.settingsAuditLog.create({
        data: {
          settingId,
          settingType: level === 'system' ? 'system_default' : level === 'company' ? 'company_setting' : 'user_setting',
          key,
          oldValue,
          newValue: value,
          category: metadata.category,
          action: oldValue === null ? 'create' : 'update',
          reason: metadata.reason,
          companyId: metadata.companyId,
          userId: metadata.userId,
          performedBy: metadata.performedBy,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent
        }
      });

      // Clear cache for this key
      this.invalidateCache(key);

      logger.info('Setting updated', { level, key, performedBy: metadata.performedBy });
    } catch (error) {
      logger.error('Error setting value', {
        level,
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Invalidate cache for a specific key
  // --------------------------------------------------------------------------
  private static invalidateCache(key: string): void {
    for (const [cacheKey] of this.cache) {
      if (cacheKey.startsWith(`${key}:`)) {
        this.cache.delete(cacheKey);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Get all settings for a context
  // --------------------------------------------------------------------------
  static async getAllResolvedSettings(context: SettingsContext = {}): Promise<Record<string, ResolvedSetting>> {
    const settings: Record<string, ResolvedSetting> = {};

    // Get all system defaults
    const systemDefaults = await prisma.systemDefault.findMany({
      where: { isActive: true }
    });

    // Get company overrides if context provided
    const companyOverrides = context.companyId ? await prisma.companySetting.findMany({
      where: {
        companyId: context.companyId,
        isActive: true,
        effectiveDate: { lte: new Date() },
        OR: [
          { expiryDate: null },
          { expiryDate: { gt: new Date() } }
        ]
      }
    }) : [];

    // Get user overrides if context provided
    const userOverrides = context.userId ? await prisma.userSetting.findMany({
      where: {
        userId: context.userId,
        isActive: true,
        effectiveDate: { lte: new Date() },
        OR: [
          { expiryDate: null },
          { expiryDate: { gt: new Date() } }
        ]
      }
    }) : [];

    // Build resolved settings with precedence
    const allKeys = new Set([
      ...systemDefaults.map(s => s.key),
      ...companyOverrides.map(s => s.key),
      ...userOverrides.map(s => s.key)
    ]);

    for (const key of allKeys) {
      const resolved = await this.getResolvedSetting(key, context);
      if (resolved) {
        settings[key] = resolved;
      }
    }

    return settings;
  }
}