import { prisma } from '@/lib/database';
import type { BusinessRule } from '@/lib/types';

export interface RuleVersion {
  id: string;
  ruleId: string;
  version: number;
  data: BusinessRule;
  changes: Partial<BusinessRule>;
  createdAt: Date;
  createdBy: string;
}

export interface RuleBackup {
  id: string;
  rules: BusinessRule[];
  createdAt: Date;
  createdBy: string;
  description?: string;
}

export class RuleVersionManager {
  /**
   * Create a new version when a rule is updated
   */
  static async createVersion(
    ruleId: string,
    changes: Partial<BusinessRule>,
    createdBy: string = 'system'
  ): Promise<void> {
    const currentRule = await prisma.businessRule.findUnique({
      where: { id: ruleId }
    });

    if (!currentRule) {
      throw new Error(`Rule with ID ${ruleId} not found`);
    }

    // Create version snapshot
    await prisma.ruleVersion.create({
      data: {
        ruleId,
        version: currentRule.version,
        data: currentRule as any, // Type assertion for Prisma compatibility
        changes: changes as any, // Type assertion for Json field
        createdBy
      }
    });

    // Update rule version
    await prisma.businessRule.update({
      where: { id: ruleId },
      data: {
        ...changes,
        version: currentRule.version + 1,
        updatedAt: new Date()
      } as any
    });
  }

  /**
   * Rollback a rule to a specific version
   */
  static async rollbackToVersion(
    ruleId: string,
    targetVersion: number,
    rolledBackBy: string = 'system'
  ): Promise<void> {
    const versionData = await prisma.ruleVersion.findFirst({
      where: {
        ruleId,
        version: targetVersion
      }
    });

    if (!versionData) {
      throw new Error(`Version ${targetVersion} not found for rule ${ruleId}`);
    }

    // Create a version snapshot of current state before rollback
    const currentRule = await prisma.businessRule.findUnique({
      where: { id: ruleId }
    });

    if (currentRule) {
      await prisma.ruleVersion.create({
        data: {
          ruleId,
          version: currentRule.version,
          data: currentRule as any,
          changes: { note: `Rolled back to version ${targetVersion}` },
          createdBy: rolledBackBy
        }
      });
    }

    // Restore the target version
    const versionDataObj = versionData.data as any;
    await prisma.businessRule.update({
      where: { id: ruleId },
      data: {
        ...versionDataObj,
        version: { increment: 1 },
        updatedAt: new Date()
      } as any
    });
  }

  /**
   * Get version history for a rule
   */
  static async getVersionHistory(ruleId: string): Promise<RuleVersion[]> {
    const versions = await prisma.ruleVersion.findMany({
      where: { ruleId },
      orderBy: { createdAt: 'desc' }
    });

    return versions.map(v => ({
      id: v.id,
      ruleId: v.ruleId,
      version: v.version,
      data: v.data as unknown as BusinessRule,
      changes: v.changes as unknown as Partial<BusinessRule>,
      createdAt: v.createdAt,
      createdBy: v.createdBy
    }));
  }

  /**
   * Compare two versions of a rule
   */
  static async compareVersions(
    ruleId: string,
    version1: number,
    version2: number
  ): Promise<{
    version1: RuleVersion;
    version2: RuleVersion;
    differences: Record<string, { from: any; to: any }>;
  }> {
    const v1 = await prisma.ruleVersion.findFirst({
      where: { ruleId, version: version1 }
    });
    const v2 = await prisma.ruleVersion.findFirst({
      where: { ruleId, version: version2 }
    });

    if (!v1 || !v2) {
      throw new Error('One or both versions not found');
    }

    const version1Data = {
      id: v1.id,
      ruleId: v1.ruleId,
      version: v1.version,
      data: v1.data as unknown as BusinessRule,
      changes: v1.changes as unknown as Partial<BusinessRule>,
      createdAt: v1.createdAt,
      createdBy: v1.createdBy
    };

    const version2Data = {
      id: v2.id,
      ruleId: v2.ruleId,
      version: v2.version,
      data: v2.data as unknown as BusinessRule,
      changes: v2.changes as unknown as Partial<BusinessRule>,
      createdAt: v2.createdAt,
      createdBy: v2.createdBy
    };

    const differences = this.calculateDifferences(version1Data.data, version2Data.data);

    return {
      version1: version1Data,
      version2: version2Data,
      differences
    };
  }

  /**
   * Create a backup of all rules
   */
  static async createBackup(
    createdBy: string = 'system',
    description?: string
  ): Promise<string> {
    const rules = await prisma.businessRule.findMany();

    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await prisma.ruleBackup.create({
      data: {
        id: backupId,
        rules: rules as any,
        createdBy,
        description
      }
    });

    return backupId;
  }

  /**
   * Restore rules from a backup
   */
  static async restoreBackup(
    backupId: string,
    restoredBy: string = 'system'
  ): Promise<void> {
    const backup = await prisma.ruleBackup.findUnique({
      where: { id: backupId }
    });

    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }

    // Create backup of current state before restore
    await this.createBackup(restoredBy, `Pre-restore backup before restoring ${backupId}`);

    // Clear existing rules
    await prisma.businessRule.deleteMany();

    // Restore from backup
    const rulesArray = backup.rules as any as BusinessRule[];
    for (const rule of rulesArray) {
      await prisma.businessRule.create({
        data: rule as any
      });
    }
  }

  /**
   * Get list of available backups
   */
  static async getBackups(): Promise<RuleBackup[]> {
    const backups = await prisma.ruleBackup.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return backups.map(b => ({
      id: b.id,
      rules: b.rules as unknown as BusinessRule[],
      createdAt: b.createdAt,
      createdBy: b.createdBy,
      description: b.description || undefined
    }));
  }

  /**
   * Delete old versions (cleanup)
   */
  static async cleanupVersions(
    ruleId: string,
    keepVersions: number = 10
  ): Promise<number> {
    const versions = await prisma.ruleVersion.findMany({
      where: { ruleId },
      orderBy: { createdAt: 'desc' },
      skip: keepVersions
    });

    if (versions.length > 0) {
      await prisma.ruleVersion.deleteMany({
        where: {
          id: { in: versions.map(v => v.id) }
        }
      });
    }

    return versions.length;
  }

  /**
   * Get rule statistics
   */
  static async getRuleStats(ruleId: string): Promise<{
    totalVersions: number;
    firstVersion: Date;
    lastVersion: Date;
    averageChangesPerVersion: number;
  }> {
    const versions = await prisma.ruleVersion.findMany({
      where: { ruleId },
      orderBy: { createdAt: 'asc' }
    });

    if (versions.length === 0) {
      throw new Error(`No versions found for rule ${ruleId}`);
    }

    const totalChanges = versions.reduce((sum, v) => {
      const changesObj = v.changes as any;
      return sum + (changesObj && typeof changesObj === 'object' ? Object.keys(changesObj).length : 0);
    }, 0);
    const averageChangesPerVersion = versions.length > 0 ? totalChanges / versions.length : 0;

    return {
      totalVersions: versions.length,
      firstVersion: versions[0].createdAt,
      lastVersion: versions[versions.length - 1].createdAt,
      averageChangesPerVersion
    };
  }

  /**
   * Bulk version operations
   */
  static async bulkRollback(
    rollbacks: Array<{ ruleId: string; targetVersion: number }>,
    rolledBackBy: string = 'system'
  ): Promise<void> {
    for (const rollback of rollbacks) {
      await this.rollbackToVersion(rollback.ruleId, rollback.targetVersion, rolledBackBy);
    }
  }

  /**
   * Calculate differences between two objects
   */
  private static calculateDifferences(
    obj1: any,
    obj2: any,
    path: string = ''
  ): Record<string, { from: any; to: any }> {
    const differences: Record<string, { from: any; to: any }> = {};

    const allKeys = [...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})];
    const keys = Array.from(new Set(allKeys));

    for (const key of keys) {
      const fullPath = path ? `${path}.${key}` : key;
      const val1 = obj1?.[key];
      const val2 = obj2?.[key];

      if (Array.isArray(val1) && Array.isArray(val2)) {
        if (JSON.stringify(val1) !== JSON.stringify(val2)) {
          differences[fullPath] = { from: val1, to: val2 };
        }
      } else if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
        const nestedDiffs = this.calculateDifferences(val1, val2, fullPath);
        Object.assign(differences, nestedDiffs);
      } else if (val1 !== val2) {
        differences[fullPath] = { from: val1, to: val2 };
      }
    }

    return differences;
  }

  /**
   * Validate version data integrity
   */
  static async validateVersionIntegrity(ruleId: string): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      const versions = await prisma.ruleVersion.findMany({
        where: { ruleId },
        orderBy: { version: 'asc' }
      });

      // Check version sequence
      for (let i = 0; i < versions.length - 1; i++) {
        if (versions[i + 1].version !== versions[i].version + 1) {
          issues.push(`Version gap between ${versions[i].version} and ${versions[i + 1].version}`);
        }
      }

      // Check data integrity
      for (const version of versions) {
        if (!version.data || typeof version.data !== 'object') {
          issues.push(`Version ${version.version} has invalid data`);
        }
      }

    } catch (error) {
      issues.push(`Database error during validation: ${error}`);
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }
}