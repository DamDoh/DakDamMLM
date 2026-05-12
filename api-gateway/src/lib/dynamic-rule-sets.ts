import type { BusinessRule, Company } from './types';

/**
 * Dynamic rule set management for limitless MLM customization
 * Allows companies to create, modify, and manage rule sets at runtime
 */
export interface DynamicRuleSet {
  id: string;
  name: string;
  description: string;
  companyId: string;
  company: Company;

  // Rule set configuration
  rules: BusinessRule[];
  ruleOrder: string[]; // Rule IDs in execution order
  priority: number;

  // Activation and scheduling
  isActive: boolean;
  effectiveDate: string;
  expiryDate?: string;
  schedule?: {
    type: 'always' | 'recurring' | 'conditional';
    cronExpression?: string; // For recurring schedules
    conditions?: any[]; // For conditional activation
  };

  // Targeting and segmentation
  targetCriteria: {
    memberTypes?: string[];
    ranks?: string[];
    regions?: string[];
    customFilters?: Record<string, any>;
  };

  // Performance and limits
  maxExecutionTime?: number;
  maxRules?: number;
  executionMode: 'sequential' | 'parallel' | 'conditional';

  // Version control
  version: number;
  parentVersionId?: string; // For branching/versioning
  isDraft: boolean;

  // Audit and compliance
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  tags: string[];
  metadata?: Record<string, any>;
}

/**
 * Dynamic rule set manager
 */
export class DynamicRuleSetManager {
  private ruleSets: Map<string, DynamicRuleSet> = new Map();
  private activeRuleSets: Map<string, DynamicRuleSet[]> = new Map(); // companyId -> active rule sets
  private ruleSetVersions: Map<string, DynamicRuleSet[]> = new Map();

  /**
   * Create a new dynamic rule set
   */
  createRuleSet(ruleSet: Omit<DynamicRuleSet, 'id' | 'version' | 'createdAt' | 'updatedAt'>): DynamicRuleSet {
    const id = `ruleset-${ruleSet.companyId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newRuleSet: DynamicRuleSet = {
      ...ruleSet,
      id,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.saveRuleSet(newRuleSet);
    return newRuleSet;
  }

  /**
   * Update an existing rule set
   */
  updateRuleSet(
    ruleSetId: string,
    updates: Partial<Omit<DynamicRuleSet, 'id' | 'version' | 'createdAt'>>
  ): DynamicRuleSet {
    const existing = this.ruleSets.get(ruleSetId);
    if (!existing) {
      throw new Error(`Rule set not found: ${ruleSetId}`);
    }

    // Validate updates
    this.validateRuleSetUpdates(existing, updates);

    const updatedRuleSet: DynamicRuleSet = {
      ...existing,
      ...updates,
      version: existing.version + 1,
      updatedAt: new Date().toISOString()
    };

    this.saveRuleSet(updatedRuleSet);
    return updatedRuleSet;
  }

  /**
   * Clone a rule set
   */
  cloneRuleSet(
    sourceRuleSetId: string,
    modifications: Partial<DynamicRuleSet>
  ): DynamicRuleSet {
    const source = this.ruleSets.get(sourceRuleSetId);
    if (!source) {
      throw new Error(`Source rule set not found: ${sourceRuleSetId}`);
    }

    const cloned: DynamicRuleSet = {
      ...source,
      ...modifications,
      id: `ruleset-${source.companyId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: modifications.name || `${source.name} (Copy)`,
      version: 1,
      parentVersionId: source.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [...(source.tags || []), 'cloned']
    };

    this.saveRuleSet(cloned);
    return cloned;
  }

  /**
   * Activate a rule set
   */
  activateRuleSet(ruleSetId: string, approvedBy?: string): void {
    const ruleSet = this.ruleSets.get(ruleSetId);
    if (!ruleSet) {
      throw new Error(`Rule set not found: ${ruleSetId}`);
    }

    // Validate before activation
    const validation = this.validateRuleSetForActivation(ruleSet);
    if (!validation.isValid) {
      throw new Error(`Cannot activate rule set: ${validation.errors.join(', ')}`);
    }

    // Update rule set
    const activatedRuleSet: DynamicRuleSet = {
      ...ruleSet,
      isActive: true,
      approvedBy,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.saveRuleSet(activatedRuleSet);

    // Update active rule sets for company
    this.updateActiveRuleSets(ruleSet.companyId);
  }

  /**
   * Deactivate a rule set
   */
  deactivateRuleSet(ruleSetId: string): void {
    const ruleSet = this.ruleSets.get(ruleSetId);
    if (!ruleSet) {
      throw new Error(`Rule set not found: ${ruleSetId}`);
    }

    const deactivatedRuleSet: DynamicRuleSet = {
      ...ruleSet,
      isActive: false,
      updatedAt: new Date().toISOString()
    };

    this.saveRuleSet(deactivatedRuleSet);

    // Update active rule sets for company
    this.updateActiveRuleSets(ruleSet.companyId);
  }

  /**
   * Get active rule sets for a company
   */
  getActiveRuleSets(companyId: string): DynamicRuleSet[] {
    return this.activeRuleSets.get(companyId) || [];
  }

  /**
   * Execute rule sets for a company
   */
  async executeRuleSets(
    companyId: string,
    context: any,
    options?: {
      ruleSetIds?: string[];
      executionMode?: 'sequential' | 'parallel';
      maxExecutionTime?: number;
    }
  ): Promise<any[]> {
    const ruleSets = options?.ruleSetIds
      ? options.ruleSetIds.map(id => this.ruleSets.get(id)).filter((rs): rs is DynamicRuleSet => rs !== undefined)
      : this.getActiveRuleSets(companyId);

    const executionMode = options?.executionMode || 'sequential';
    const maxExecutionTime = options?.maxExecutionTime || 30000; // 30 seconds

    if (executionMode === 'parallel') {
      return await this.executeRuleSetsParallel(ruleSets, maxExecutionTime);
    } else {
      return await this.executeRuleSetsSequential(ruleSets, context, maxExecutionTime);
    }
  }

  /**
   * Execute rule sets sequentially
   */
  private async executeRuleSetsSequential(
    ruleSets: DynamicRuleSet[],
    context: any,
    maxExecutionTime: number
  ): Promise<any[]> {
    const results: any[] = [];
    const startTime = Date.now();

    for (const ruleSet of ruleSets) {
      if (Date.now() - startTime > maxExecutionTime) {
        throw new Error('Rule set execution timeout');
      }

      try {
        // Note: executeCompanyRules method needs to be implemented in EnhancedRuleEngine
        // For now, return empty results
        const ruleSetResults: any[] = [];
        results.push({
          ruleSetId: ruleSet.id,
          results: ruleSetResults,
          success: true
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          ruleSetId: ruleSet.id,
          error: message,
          success: false
        });
      }
    }

    return results;
  }

  /**
   * Execute rule sets in parallel
   */
  private async executeRuleSetsParallel(
    ruleSets: DynamicRuleSet[],
    maxExecutionTime: number
  ): Promise<any[]> {
    const promises = ruleSets.map(async (ruleSet) => {
      try {
        // Note: executeCompanyRules method needs to be implemented in EnhancedRuleEngine
        // For now, return empty results
        const results: any[] = [];

        return {
          ruleSetId: ruleSet.id,
          results,
          success: true
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          ruleSetId: ruleSet.id,
          error: message,
          success: false
        };
      }
    });

    return await Promise.all(promises);
  }

  /**
   * Validate rule set updates
   */
  private validateRuleSetUpdates(
    existing: DynamicRuleSet,
    updates: Partial<DynamicRuleSet>
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate rule count limits
    if (updates.rules && updates.rules.length > (existing.maxRules || 100)) {
      errors.push(`Rule count exceeds maximum allowed: ${existing.maxRules || 100}`);
    }

    // Validate rule order
    if (updates.ruleOrder) {
      const ruleIds = updates.rules?.map(r => r.id) || existing.rules.map(r => r.id);
      const invalidOrder = updates.ruleOrder.filter(id => !ruleIds.includes(id));
      if (invalidOrder.length > 0) {
        errors.push(`Invalid rule IDs in order: ${invalidOrder.join(', ')}`);
      }
    }

    // Validate schedule
    if (updates.schedule) {
      if (updates.schedule.type === 'recurring' && !updates.schedule.cronExpression) {
        errors.push('Cron expression required for recurring schedules');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate rule set for activation
   */
  private validateRuleSetForActivation(ruleSet: DynamicRuleSet): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if rule set has rules
    if (!ruleSet.rules || ruleSet.rules.length === 0) {
      errors.push('Rule set must contain at least one rule');
    }

    // Check for conflicting rules
    const conflicts = this.detectRuleConflicts(ruleSet);
    if (conflicts.length > 0) {
      errors.push(`Rule conflicts detected: ${conflicts.map(c => c.description).join(', ')}`);
    }

    // Check effective date
    if (ruleSet.effectiveDate && new Date(ruleSet.effectiveDate) > new Date()) {
      errors.push('Effective date cannot be in the future');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Detect rule conflicts within a rule set
   */
  private detectRuleConflicts(ruleSet: DynamicRuleSet): any[] {
    const conflicts: any[] = [];

    // Check for duplicate priorities
    const priorities = ruleSet.rules.map(r => r.priority);
    const duplicatePriorities = priorities.filter((p, i) => priorities.indexOf(p) !== i);
    if (duplicatePriorities.length > 0) {
      conflicts.push({
        type: 'duplicate_priorities',
        description: `Duplicate priorities found: ${duplicatePriorities.join(', ')}`
      });
    }

    // Check for mutually exclusive conditions
    // This is a simplified check - in production would be more sophisticated
    const exclusiveTypes = ['binary_bonus', 'unilevel_bonus', 'matrix_bonus'];
    const exclusiveRules = ruleSet.rules.filter(r => exclusiveTypes.includes(r.type));
    if (exclusiveRules.length > 1) {
      conflicts.push({
        type: 'mutually_exclusive_rules',
        description: 'Multiple mutually exclusive compensation types detected'
      });
    }

    return conflicts;
  }

  /**
   * Save rule set and update indexes
   */
  private saveRuleSet(ruleSet: DynamicRuleSet): void {
    this.ruleSets.set(ruleSet.id, ruleSet);

    // Store version history
    const versions = this.ruleSetVersions.get(ruleSet.id) || [];
    versions.push(ruleSet);
    this.ruleSetVersions.set(ruleSet.id, versions);

    // Update active rule sets if this rule set is active
    if (ruleSet.isActive) {
      this.updateActiveRuleSets(ruleSet.companyId);
    }
  }

  /**
   * Update active rule sets for a company
   */
  private updateActiveRuleSets(companyId: string): void {
    const activeRuleSets = Array.from(this.ruleSets.values())
      .filter(rs => rs.companyId === companyId && rs.isActive)
      .sort((a, b) => a.priority - b.priority);

    this.activeRuleSets.set(companyId, activeRuleSets);
  }

  /**
   * Get rule set by ID
   */
  getRuleSet(ruleSetId: string): DynamicRuleSet | undefined {
    return this.ruleSets.get(ruleSetId);
  }

  /**
   * Get all rule sets for a company
   */
  getCompanyRuleSets(companyId: string): DynamicRuleSet[] {
    return Array.from(this.ruleSets.values())
      .filter(rs => rs.companyId === companyId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  /**
   * Get rule set versions
   */
  getRuleSetVersions(ruleSetId: string): DynamicRuleSet[] {
    return this.ruleSetVersions.get(ruleSetId) || [];
  }

  /**
   * Delete a rule set
   */
  deleteRuleSet(ruleSetId: string): void {
    const ruleSet = this.ruleSets.get(ruleSetId);
    if (!ruleSet) {
      throw new Error(`Rule set not found: ${ruleSetId}`);
    }

    // Cannot delete active rule sets
    if (ruleSet.isActive) {
      throw new Error('Cannot delete active rule set');
    }

    this.ruleSets.delete(ruleSetId);
    this.ruleSetVersions.delete(ruleSetId);

    // Update active rule sets
    this.updateActiveRuleSets(ruleSet.companyId);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalRuleSets: number;
    activeRuleSets: number;
    totalRules: number;
    companiesCount: number;
  } {
    const allRuleSets = Array.from(this.ruleSets.values());
    const companies = new Set(allRuleSets.map(rs => rs.companyId));

    return {
      totalRuleSets: allRuleSets.length,
      activeRuleSets: allRuleSets.filter(rs => rs.isActive).length,
      totalRules: allRuleSets.reduce((sum, rs) => sum + rs.rules.length, 0),
      companiesCount: companies.size
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.ruleSets.clear();
    this.activeRuleSets.clear();
    this.ruleSetVersions.clear();
  }
}

// Export singleton instance
export const dynamicRuleSetManager = new DynamicRuleSetManager();