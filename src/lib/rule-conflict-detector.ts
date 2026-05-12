import type { BusinessRule, RuleConflict, ConflictSummary, RuleValidationResult } from './types';

/**
 * Advanced rule conflict detection and validation engine
 */
export class RuleConflictDetector {
  private rules: BusinessRule[] = [];

  /**
   * Load rules for analysis
   */
  loadRules(rules: BusinessRule[]): void {
    this.rules = rules;
  }

  /**
   * Analyze all rules for conflicts
   */
  analyzeConflicts(): RuleConflict[] {
    const conflicts: RuleConflict[] = [];

    // Check for various types of conflicts
    conflicts.push(...this.detectCalculationConflicts());
    conflicts.push(...this.detectConditionConflicts());
    conflicts.push(...this.detectFrequencyConflicts());
    conflicts.push(...this.detectPriorityConflicts());
    conflicts.push(...this.detectOverlappingConditions());

    return conflicts;
  }

  /**
   * Detect calculation conflicts
   */
  private detectCalculationConflicts(): RuleConflict[] {
    const conflicts: RuleConflict[] = [];

    for (let i = 0; i < this.rules.length; i++) {
      for (let j = i + 1; j < this.rules.length; j++) {
        const rule1 = this.rules[i];
        const rule2 = this.rules[j];

        if (this.haveConflictingCalculations(rule1, rule2)) {
          conflicts.push({
            type: 'calculation_conflict',
            severity: 'medium',
            rules: [rule1.id, rule2.id],
            description: `Rules "${rule1.name}" and "${rule2.name}" have conflicting calculation methods`,
            suggestion: 'Review calculation logic to ensure proper precedence and avoid double-counting'
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect condition conflicts
   */
  private detectConditionConflicts(): RuleConflict[] {
    const conflicts: RuleConflict[] = [];

    for (let i = 0; i < this.rules.length; i++) {
      for (let j = i + 1; j < this.rules.length; j++) {
        const rule1 = this.rules[i];
        const rule2 = this.rules[j];

        if (this.haveMutuallyExclusiveConditions(rule1, rule2)) {
          conflicts.push({
            type: 'mutually_exclusive_conditions',
            severity: 'high',
            rules: [rule1.id, rule2.id],
            description: `Rules "${rule1.name}" and "${rule2.name}" have mutually exclusive conditions`,
            suggestion: 'Review conditions to ensure they can both be satisfied or adjust rule logic'
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect frequency conflicts
   */
  private detectFrequencyConflicts(): RuleConflict[] {
    const conflicts: RuleConflict[] = [];

    // Group rules by applicable member types and check frequencies
    const rulesByType = this.groupRulesByApplicableType();

    for (const [memberType, rules] of Object.entries(rulesByType)) {
      const frequencyGroups = this.groupByFrequency(rules);

      for (const freqRules of Object.values(frequencyGroups)) {
        if (freqRules.length > 1 && this.haveConflictingFrequencies(freqRules)) {
          conflicts.push({
            type: 'frequency_mismatch',
            severity: 'low',
            rules: freqRules.map(r => r.id),
            description: `${freqRules.length} rules for ${memberType} have different payout frequencies`,
            suggestion: 'Consider standardizing payout frequencies for consistency'
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect priority conflicts
   */
  private detectPriorityConflicts(): RuleConflict[] {
    const conflicts: RuleConflict[] = [];

    const priorityGroups = this.groupByPriority();

    for (const [priority, rules] of Object.entries(priorityGroups)) {
      if (rules.length > 1) {
        conflicts.push({
          type: 'duplicate_priorities',
          severity: 'medium',
          rules: rules.map(r => r.id),
          description: `${rules.length} rules have the same priority (${priority})`,
          suggestion: 'Assign unique priorities to ensure predictable execution order'
        });
      }
    }

    // Check for priority gaps (optional)
    const priorities = Object.keys(priorityGroups).map(Number).sort((a, b) => a - b);
    for (let i = 0; i < priorities.length - 1; i++) {
      if (priorities[i + 1] - priorities[i] > 10) {
        conflicts.push({
          type: 'priority_gap',
          severity: 'low',
          rules: [],
          description: `Large gap in priorities between ${priorities[i]} and ${priorities[i + 1]}`,
          suggestion: 'Consider filling priority gaps for better organization'
        });
      }
    }

    return conflicts;
  }

  /**
   * Detect overlapping conditions
   */
  private detectOverlappingConditions(): RuleConflict[] {
    const conflicts: RuleConflict[] = [];

    for (let i = 0; i < this.rules.length; i++) {
      for (let j = i + 1; j < this.rules.length; j++) {
        const rule1 = this.rules[i];
        const rule2 = this.rules[j];

        if (this.haveOverlappingConditions(rule1, rule2)) {
          conflicts.push({
            type: 'overlapping_conditions',
            severity: 'low',
            rules: [rule1.id, rule2.id],
            description: `Rules "${rule1.name}" and "${rule2.name}" have overlapping conditions`,
            suggestion: 'Review for potential double-counting or ensure intended behavior'
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if two rules have conflicting calculations
   */
  private haveConflictingCalculations(rule1: BusinessRule, rule2: BusinessRule): boolean {
    // Same category and similar conditions might indicate conflicts
    if (rule1.category !== rule2.category) return false;

    // Check if they apply to same member types
    const rule1ApplicableTo = Array.isArray(rule1.applicableTo) ? rule1.applicableTo : ['distributor'];
    const rule2ApplicableTo = Array.isArray(rule2.applicableTo) ? rule2.applicableTo : ['distributor'];
    const commonTypes = rule1ApplicableTo.filter(type => rule2ApplicableTo.includes(type));
    if (commonTypes.length === 0) return false;

    // Check for similar condition types
    const rule1Conditions = Array.isArray(rule1.conditions) ? rule1.conditions : [];
    const rule2Conditions = Array.isArray(rule2.conditions) ? rule2.conditions : [];
    const rule1ConditionTypes = rule1Conditions.map(c => c?.type || '').filter(Boolean);
    const rule2ConditionTypes = rule2Conditions.map(c => c?.type || '').filter(Boolean);
    const commonConditions = rule1ConditionTypes.filter(c => rule2ConditionTypes.includes(c));

    return commonConditions.length > 0;
  }

  /**
   * Check if two rules have mutually exclusive conditions
   */
  private haveMutuallyExclusiveConditions(rule1: BusinessRule, rule2: BusinessRule): boolean {
    const rule1Conditions = Array.isArray(rule1.conditions) ? rule1.conditions : [];
    const rule2Conditions = Array.isArray(rule2.conditions) ? rule2.conditions : [];
    
    if (rule1Conditions.length === 0 || rule2Conditions.length === 0) return false;

    // Check for direct contradictions in conditions
    for (const cond1 of rule1Conditions) {
      for (const cond2 of rule2Conditions) {
        if (cond1 && cond2 && this.conditionsAreMutuallyExclusive(cond1, cond2)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if two conditions are mutually exclusive
   */
  private conditionsAreMutuallyExclusive(cond1: any, cond2: any): boolean {
    if (cond1.type !== cond2.type) return false;

    // Different rank values are NOT mutually exclusive - they just apply to different ranks
    // Only check for actual contradictions (e.g., greater_than vs less_than with same value)
    if (cond1.type === 'rank' && cond2.type === 'rank') {
      // Different rank values are fine - they apply to different ranks
      // Only flag if both use 'equals' with same operator but different values AND
      // they're in the same rule (which shouldn't happen, but if it does, it's a real conflict)
      return false; // Rank conditions are not mutually exclusive
    }

    // Check for actual contradictions in numeric conditions
    if (cond1.type === cond2.type && typeof cond1.value === 'number' && typeof cond2.value === 'number') {
      // Example: personal_volume > 1000 AND personal_volume < 500 (impossible)
      if (cond1.operator === 'greater_than' && cond2.operator === 'less_than' && cond1.value > cond2.value) {
        return true;
      }
      if (cond1.operator === 'less_than' && cond2.operator === 'greater_than' && cond1.value < cond2.value) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if rules have conflicting frequencies
   */
  private haveConflictingFrequencies(rules: BusinessRule[]): boolean {
    const frequencies = rules.map(r => r.frequency);
    return new Set(frequencies).size > 1;
  }

  /**
   * Check if two rules have overlapping conditions
   */
  private haveOverlappingConditions(rule1: BusinessRule, rule2: BusinessRule): boolean {
    // Simple overlap detection - same condition types
    const rule1Conditions = Array.isArray(rule1.conditions) ? rule1.conditions : [];
    const rule2Conditions = Array.isArray(rule2.conditions) ? rule2.conditions : [];

    const rule1Types = rule1Conditions.map(c => c?.type || '');
    const rule2Types = rule2Conditions.map(c => c?.type || '');

    return rule1Types.some(type => type && rule2Types.includes(type));
  }

  /**
   * Group rules by applicable member types
   */
  private groupRulesByApplicableType(): Record<string, BusinessRule[]> {
    const groups: Record<string, BusinessRule[]> = {};

    this.rules.forEach(rule => {
      const applicableTo = Array.isArray(rule.applicableTo) ? rule.applicableTo : ['distributor'];
      applicableTo.forEach(type => {
        if (!groups[type]) groups[type] = [];
        groups[type].push(rule);
      });
    });

    return groups;
  }

  /**
   * Group rules by frequency
   */
  private groupByFrequency(rules: BusinessRule[]): Record<string, BusinessRule[]> {
    const groups: Record<string, BusinessRule[]> = {};

    rules.forEach(rule => {
      if (!groups[rule.frequency]) groups[rule.frequency] = [];
      groups[rule.frequency].push(rule);
    });

    return groups;
  }

  /**
   * Group rules by priority
   */
  private groupByPriority(): Record<string, BusinessRule[]> {
    const groups: Record<string, BusinessRule[]> = {};

    this.rules.forEach(rule => {
      const priority = rule.priority.toString();
      if (!groups[priority]) groups[priority] = [];
      groups[priority].push(rule);
    });

    return groups;
  }

  /**
   * Get conflict summary
   */
  getConflictSummary(conflicts: RuleConflict[]): ConflictSummary {
    const bySeverity = {
      high: conflicts.filter(c => c.severity === 'high').length,
      medium: conflicts.filter(c => c.severity === 'medium').length,
      low: conflicts.filter(c => c.severity === 'low').length
    };

    const byType: Record<string, number> = {};
    conflicts.forEach(conflict => {
      byType[conflict.type] = (byType[conflict.type] || 0) + 1;
    });

    return {
      total: conflicts.length,
      bySeverity,
      byType
    };
  }

  /**
   * Validate a single rule
   */
  validateRule(rule: BusinessRule): RuleValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Required field validation
    if (!rule.name?.trim()) {
      errors.push('Rule name is required');
    }

    if (!rule.type) {
      errors.push('Rule type is required');
    }

    if (!rule.category) {
      errors.push('Rule category is required');
    }

    // Priority validation
    if (rule.priority < 0 || rule.priority > 1000) {
      warnings.push('Priority should be between 0 and 1000');
    }

    // Condition validation
    const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
    if (conditions.length === 0) {
      warnings.push('Rule has no conditions - will apply to all members');
    }

    if (conditions.length > 10) {
      warnings.push('Rule has many conditions - consider simplifying');
    }

    // Calculation validation - make it optional but validate if provided
    if (rule.calculation && Object.keys(rule.calculation).length > 0) {
      if (rule.calculation.type === 'percentage' && !rule.calculation.percentage) {
        errors.push('Percentage calculation requires percentage value');
      }

      if (rule.calculation.type === 'tiered_percentage' && !rule.calculation.tiers) {
        errors.push('Tiered percentage calculation requires tiers');
      }
    } else {
      warnings.push('Rule has no calculation - may not be functional');
    }

    // Applicable to validation
    if (!rule.applicableTo || rule.applicableTo.length === 0) {
      warnings.push('Rule applies to no member types');
    }

    // Stockist-specific validation
    if (rule.type === 'stockist_bonus') {
      const hasAccountTypeCondition = conditions.some(c => c?.type === 'account_type' && c?.value === 'Stockist');
      const hasStockistLevelCondition = conditions.some(c => c?.type === 'stockist_level');
      
      if (!hasAccountTypeCondition) {
        warnings.push('Stockist bonus rules should include account_type condition set to "Stockist"');
      }
      
      if (!hasStockistLevelCondition) {
        warnings.push('Stockist bonus rules should include stockist_level condition (District, Provincial, Regional, or Commune)');
      }
      
      // Validate stockist level values
      const stockistLevelConditions = conditions.filter(c => c?.type === 'stockist_level');
      const validLevels = ['District', 'Provincial', 'Regional', 'Commune'];
      stockistLevelConditions.forEach(cond => {
        if (cond?.value && !validLevels.includes(cond.value as string)) {
          warnings.push(`Invalid stockist level: ${cond.value}. Valid levels are: ${validLevels.join(', ')}`);
        }
      });
    }

    // Priority uniqueness suggestion
    const samePriorityRules = this.rules.filter(r => r.id !== rule.id && r.priority === rule.priority);
    if (samePriorityRules.length > 0) {
      suggestions.push(`Consider unique priority - ${samePriorityRules.length} other rules have same priority`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Validate all rules
   */
  validateAllRules(): Record<string, RuleValidationResult> {
    const results: Record<string, RuleValidationResult> = {};

    this.rules.forEach(rule => {
      results[rule.id] = this.validateRule(rule);
    });

    return results;
  }

  /**
   * Get optimization suggestions
   */
  getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];

    // Check for inactive rules
    const inactiveRules = this.rules.filter(r => !r.isActive);
    if (inactiveRules.length > 5) {
      suggestions.push(`Consider removing ${inactiveRules.length} inactive rules to improve performance`);
    }

    // Check for rules with no conditions
    const noConditionRules = this.rules.filter(r => {
      const conditions = Array.isArray(r.conditions) ? r.conditions : [];
      return conditions.length === 0;
    });
    if (noConditionRules.length > 0) {
      suggestions.push(`${noConditionRules.length} rules have no conditions - they apply to all members`);
    }

    // Check for high priority rules
    const highPriorityRules = this.rules.filter(r => r.priority > 100);
    if (highPriorityRules.length > 0) {
      suggestions.push(`${highPriorityRules.length} rules have high priority (>100) - ensure correct execution order`);
    }

    return suggestions;
  }
}

// Export singleton instance
export const ruleConflictDetector = new RuleConflictDetector();