import type { BusinessRule, RuleValidationResult, RuleConflict } from './types';

/**
 * Advanced rule validation and conflict detection engine
 * Ensures rule integrity and prevents problematic configurations
 */
interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  condition: (rule: BusinessRule, context?: any) => boolean;
  message: string;
  suggestion?: string;
}

export class RuleValidationEngine {
  private validationRules: Map<string, ValidationRule> = new Map();

  constructor() {
    this.initializeValidationRules();
  }

  /**
   * Validate a single rule
   */
  validateRule(rule: BusinessRule, context?: any): RuleValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Run all validation rules
    for (const validationRule of this.validationRules.values()) {
      try {
        const conditionMet = validationRule.condition(rule, context);

        if (conditionMet) {
          const message = this.interpolateMessage(validationRule.message, rule);

          switch (validationRule.severity) {
            case 'error':
              errors.push(message);
              break;
            case 'warning':
              warnings.push(message);
              break;
            case 'info':
              suggestions.push(message);
              break;
          }

          if (validationRule.suggestion) {
            suggestions.push(validationRule.suggestion);
          }
        }
      } catch (error) {
        console.error(`Error running validation rule ${validationRule.id}:`, error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Validate multiple rules for conflicts
   */
  validateRuleSet(rules: BusinessRule[], context?: any): {
    results: RuleValidationResult[];
    conflicts: RuleConflict[];
    summary: {
      totalRules: number;
      validRules: number;
      rulesWithErrors: number;
      rulesWithWarnings: number;
      totalConflicts: number;
    };
  } {
    const results: RuleValidationResult[] = [];
    const conflicts: RuleConflict[] = [];

    // Validate individual rules
    for (const rule of rules) {
      const result = this.validateRule(rule, context);
      results.push(result);
    }

    // Detect conflicts between rules
    conflicts.push(...this.detectConflicts(rules));

    const summary = {
      totalRules: rules.length,
      validRules: results.filter(r => r.isValid).length,
      rulesWithErrors: results.filter(r => r.errors.length > 0).length,
      rulesWithWarnings: results.filter(r => r.warnings.length > 0).length,
      totalConflicts: conflicts.length
    };

    return { results, conflicts, summary };
  }

  /**
   * Detect conflicts between rules
   */
  private detectConflicts(rules: BusinessRule[]): RuleConflict[] {
    const conflicts: RuleConflict[] = [];

    // Check for duplicate priorities
    const priorityGroups = this.groupBy(rules, 'priority');
    for (const [priority, groupRules] of priorityGroups.entries()) {
      if (groupRules.length > 1) {
        conflicts.push({
          type: 'duplicate_priorities',
          severity: 'medium',
          rules: groupRules.map(r => r.id),
          description: `Multiple rules have the same priority: ${priority}`,
          suggestion: 'Adjust rule priorities to ensure unique execution order'
        });
      }
    }

    // Check for mutually exclusive rule types
    const exclusiveTypes = [
      ['binary_bonus', 'unilevel_bonus'],
      ['binary_bonus', 'matrix_bonus'],
      ['unilevel_bonus', 'matrix_bonus']
    ];

    for (const [type1, type2] of exclusiveTypes) {
      const type1Rules = rules.filter(r => r.type === type1);
      const type2Rules = rules.filter(r => r.type === type2);

      if (type1Rules.length > 0 && type2Rules.length > 0) {
        conflicts.push({
          type: 'mutually_exclusive_conditions',
          severity: 'high',
          rules: [...type1Rules, ...type2Rules].map(r => r.id),
          description: `Rules combine mutually exclusive compensation types: ${type1} and ${type2}`,
          suggestion: 'Choose one compensation structure or use separate rule sets'
        });
      }
    }

    // Check for overlapping conditions that might cause double payments
    conflicts.push(...this.detectOverlappingConditions(rules));

    // Check for priority gaps that might cause unexpected execution order
    conflicts.push(...this.detectPriorityGaps(rules));

    return conflicts;
  }

  /**
   * Detect overlapping conditions
   */
  private detectOverlappingConditions(rules: BusinessRule[]): RuleConflict[] {
    const conflicts: RuleConflict[] = [];

    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const rule1 = rules[i];
        const rule2 = rules[j];

        if (this.haveOverlappingConditions(rule1, rule2)) {
          conflicts.push({
            type: 'overlapping_conditions',
            severity: 'medium',
            rules: [rule1.id, rule2.id],
            description: `Rules "${rule1.name}" and "${rule2.name}" have overlapping conditions`,
            suggestion: 'Review conditions to ensure no double payments occur'
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if two rules have overlapping conditions
   */
  private haveOverlappingConditions(rule1: BusinessRule, rule2: BusinessRule): boolean {
    // Simplified check - in production would be more sophisticated
    // Check if they apply to the same member types and have similar conditions

    const commonMemberTypes = rule1.applicableTo.filter(type =>
      rule2.applicableTo.includes(type)
    );

    if (commonMemberTypes.length === 0) return false;

    // Check for similar rank conditions
    const rule1RankCondition = rule1.conditions.find(c => c.type === 'rank');
    const rule2RankCondition = rule2.conditions.find(c => c.type === 'rank');

    if (rule1RankCondition && rule2RankCondition) {
      if (rule1RankCondition.operator === 'greater_equal' &&
          rule2RankCondition.operator === 'greater_equal') {
        // Both require minimum ranks - check if ranges overlap
        return true; // Simplified
      }
    }

    return false;
  }

  /**
   * Detect priority gaps
   */
  private detectPriorityGaps(rules: BusinessRule[]): RuleConflict[] {
    const conflicts: RuleConflict[] = [];
    const priorities = rules.map(r => r.priority).sort((a, b) => a - b);

    for (let i = 0; i < priorities.length - 1; i++) {
      const gap = priorities[i + 1] - priorities[i];
      if (gap > 100) { // Arbitrary gap threshold
        conflicts.push({
          type: 'priority_gap',
          severity: 'low',
          rules: rules.filter(r => r.priority === priorities[i] || r.priority === priorities[i + 1]).map(r => r.id),
          description: `Large priority gap between rules: ${gap} points`,
          suggestion: 'Consider adjusting priorities for better organization'
        });
      }
    }

    return conflicts;
  }

  /**
   * Initialize built-in validation rules
   */
  private initializeValidationRules(): void {
    const rules: ValidationRule[] = [
      {
        id: 'missing_name',
        name: 'Missing Rule Name',
        description: 'Rule must have a name',
        severity: 'error',
        condition: (rule) => !rule.name || rule.name.trim().length === 0,
        message: 'Rule name is required',
        suggestion: 'Provide a descriptive name for the rule'
      },
      {
        id: 'invalid_priority',
        name: 'Invalid Priority',
        description: 'Rule priority must be between 0 and 1000',
        severity: 'error',
        condition: (rule) => rule.priority < 0 || rule.priority > 1000,
        message: 'Rule priority must be between 0 and 1000',
        suggestion: 'Adjust priority to a value between 0 and 1000'
      },
      {
        id: 'empty_conditions',
        name: 'Empty Conditions',
        description: 'Rule should have at least one condition',
        severity: 'warning',
        condition: (rule) => !rule.conditions || rule.conditions.length === 0,
        message: 'Rule has no conditions - it will apply to all members',
        suggestion: 'Add conditions to control when this rule applies'
      },
      {
        id: 'no_calculation',
        name: 'Missing Calculation',
        description: 'Rule must have a calculation method',
        severity: 'error',
        condition: (rule) => !rule.calculation,
        message: 'Rule must have a calculation method',
        suggestion: 'Define how this rule calculates amounts'
      },
      {
        id: 'invalid_percentage',
        name: 'Invalid Percentage',
        description: 'Percentage calculations must be between 0 and 100',
        severity: 'error',
        condition: (rule) => rule.calculation.type === 'percentage' &&
          (rule.calculation.percentage! < 0 || rule.calculation.percentage! > 100),
        message: 'Percentage must be between 0 and 100',
        suggestion: 'Adjust percentage to a valid range'
      },
      {
        id: 'high_commission_rate',
        name: 'High Commission Rate',
        description: 'Commission rates above 20% may be unsustainable',
        severity: 'warning',
        condition: (rule) => rule.category === 'commission' &&
          rule.calculation.type === 'percentage' &&
          rule.calculation.percentage! > 20,
        message: 'Commission rate is above 20% - review for sustainability',
        suggestion: 'Consider lower commission rates for long-term viability'
      },
      {
        id: 'no_applicable_members',
        name: 'No Applicable Members',
        description: 'Rule applies to no member types',
        severity: 'error',
        condition: (rule) => !rule.applicableTo || rule.applicableTo.length === 0,
        message: 'Rule must apply to at least one member type',
        suggestion: 'Specify which member types this rule applies to'
      },
      {
        id: 'invalid_frequency',
        name: 'Invalid Frequency',
        description: 'Rule frequency must be valid',
        severity: 'error',
        condition: (rule) => !['weekly', 'monthly', 'quarterly', 'annually', 'one_time', 'continuous'].includes(rule.frequency),
        message: 'Invalid rule frequency',
        suggestion: 'Use a valid frequency: weekly, monthly, quarterly, annually, one_time, or continuous'
      },
      {
        id: 'future_effective_date',
        name: 'Future Effective Date',
        description: 'Rule has a future effective date',
        severity: 'info',
        condition: (rule) => rule.metadata?.effectiveDate && new Date(rule.metadata.effectiveDate) > new Date(),
        message: 'Rule will become effective in the future',
        suggestion: 'Rule is scheduled to activate later'
      }
    ];

    rules.forEach(rule => this.validationRules.set(rule.id, rule));
  }

  /**
   * Add custom validation rule
   */
  addValidationRule(rule: ValidationRule): void {
    this.validationRules.set(rule.id, rule);
  }

  /**
   * Remove validation rule
   */
  removeValidationRule(ruleId: string): void {
    this.validationRules.delete(ruleId);
  }

  /**
   * Interpolate message with rule data
   */
  private interpolateMessage(message: string, rule: BusinessRule): string {
    return message
      .replace(/\{name\}/g, rule.name)
      .replace(/\{type\}/g, rule.type)
      .replace(/\{priority\}/g, rule.priority.toString());
  }

  /**
   * Group array by key
   */
  private groupBy<T>(array: T[], key: keyof T): Map<any, T[]> {
    const groups = new Map<any, T[]>();
    array.forEach(item => {
      const groupKey = item[key];
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(item);
    });
    return groups;
  }

  /**
   * Get validation statistics
   */
  getStats(): {
    totalValidationRules: number;
    rulesBySeverity: Record<string, number>;
  } {
    const rulesBySeverity = {
      error: 0,
      warning: 0,
      info: 0
    };

    for (const rule of this.validationRules.values()) {
      rulesBySeverity[rule.severity]++;
    }

    return {
      totalValidationRules: this.validationRules.size,
      rulesBySeverity
    };
  }
}

// Export singleton instance
export const ruleValidationEngine = new RuleValidationEngine();