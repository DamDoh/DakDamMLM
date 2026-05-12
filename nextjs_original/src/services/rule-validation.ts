import type {
  BusinessRule,
  RuleValidationResult,
  RuleCondition,
  RuleCalculation
} from '@/lib/types';

export class RuleValidator {
  /**
   * Validate a single business rule
   */
  static async validateRule(rule: BusinessRule): Promise<RuleValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Basic validation
    if (!rule.name?.trim()) {
      errors.push('Rule name is required');
    }

    if (!rule.description?.trim()) {
      warnings.push('Rule description is recommended for clarity');
    }

    if (!rule.conditions || rule.conditions.length === 0) {
      warnings.push('Rule has no conditions - will apply to all members');
      suggestions.push('Add specific conditions to target the right members');
    }

    if (!rule.applicableTo || rule.applicableTo.length === 0) {
      errors.push('Rule must be applicable to at least one member type');
    }

    // Validate conditions
    if (rule.conditions) {
      rule.conditions.forEach((condition, index) => {
        const conditionErrors = this.validateCondition(condition);
        conditionErrors.forEach(error => {
          errors.push(`Condition ${index + 1}: ${error}`);
        });
      });
    }

    // Validate calculation
    if (rule.calculation) {
      const calculationErrors = this.validateCalculation(rule.calculation);
      calculationErrors.forEach(error => {
        errors.push(`Calculation: ${error}`);
      });
    } else {
      errors.push('Rule must have a calculation method');
    }

    // Business logic validation
    const businessErrors = await this.validateBusinessLogic(rule);
    errors.push(...businessErrors.errors);
    warnings.push(...businessErrors.warnings);
    suggestions.push(...businessErrors.suggestions);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Validate a rule condition
   */
  private static validateCondition(condition: RuleCondition): string[] {
    const errors: string[] = [];

    if (!condition.type) {
      errors.push('Condition type is required');
    }

    if (!condition.operator) {
      errors.push('Condition operator is required');
    }

    if (condition.value === undefined || condition.value === null) {
      errors.push('Condition value is required');
    }

    // Type-specific validation
    switch (condition.type) {
      case 'rank':
        if (typeof condition.value !== 'string') {
          errors.push('Rank condition must have a string value');
        }
        break;
      case 'pv':
      case 'personal_volume':
      case 'gv':
      case 'group_volume':
        if (typeof condition.value !== 'number') {
          errors.push('Volume conditions must have numeric values');
        }
        break;
      case 'direct_recruits':
      case 'total_recruits':
      case 'active_members':
      case 'qualified_legs':
        if (typeof condition.value !== 'number') {
          errors.push('Count conditions must have numeric values');
        }
        break;
    }

    return errors;
  }

  /**
   * Validate calculation configuration
   */
  private static validateCalculation(calculation: RuleCalculation): string[] {
    const errors: string[] = [];

    if (!calculation.type) {
      errors.push('Calculation type is required');
      return errors;
    }

    switch (calculation.type) {
      case 'percentage':
        if (typeof calculation.percentage !== 'number' || calculation.percentage < 0) {
          errors.push('Percentage must be a positive number');
        }
        break;

      case 'fixed_amount':
        if (typeof calculation.baseValue !== 'number' || calculation.baseValue < 0) {
          errors.push('Fixed amount must be a positive number');
        }
        break;

      case 'tiered_percentage':
      case 'tiered_fixed':
        if (!calculation.tiers || !Array.isArray(calculation.tiers) || calculation.tiers.length === 0) {
          errors.push('Tiered calculations must have at least one tier');
        } else {
          calculation.tiers.forEach((tier, index) => {
            if (typeof tier.min !== 'number') {
              errors.push(`Tier ${index + 1}: minimum value must be a number`);
            }
            if (typeof tier.value !== 'number') {
              errors.push(`Tier ${index + 1}: tier value must be a number`);
            }
          });
        }
        break;

      case 'lookup_table':
        if (!calculation.lookupTable || typeof calculation.lookupTable !== 'object') {
          errors.push('Lookup table must be a valid object');
        }
        break;

      case 'formula':
        if (!calculation.formula?.trim()) {
          errors.push('Formula calculations must have a formula expression');
        }
        break;
    }

    return errors;
  }

  /**
   * Validate business logic and rules
   */
  private static async validateBusinessLogic(rule: BusinessRule): Promise<{
    errors: string[];
    warnings: string[];
    suggestions: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Commission cap validation for commission rules
    if (rule.category === 'commission' && rule.calculation.type === 'percentage') {
      if (!rule.calculation.cap || rule.calculation.cap <= 0) {
        warnings.push('Commission rules should have payout caps for risk management');
        suggestions.push('Consider adding a maximum payout limit');
      }
    }

    // Priority validation
    if (rule.priority < 0 || rule.priority > 1000) {
      errors.push('Rule priority must be between 0 and 1000');
    }

    // High priority warnings
    if (rule.priority > 500 && rule.conditions.length === 0) {
      warnings.push('High priority rules should have specific conditions');
    }

    // Frequency validation
    const validFrequencies = ['weekly', 'monthly', 'quarterly', 'annually', 'one_time', 'continuous'];
    if (!validFrequencies.includes(rule.frequency)) {
      errors.push('Invalid payout frequency');
    }

    // Timing validation
    const validTimings = ['immediate', 'end_of_period', 'achievement_date', 'qualification_date'];
    if (!validTimings.includes(rule.payoutTiming)) {
      errors.push('Invalid payout timing');
    }

    return { errors, warnings, suggestions };
  }

  /**
   * Detect conflicts between rules
   */
  static async detectConflicts(rule: BusinessRule): Promise<BusinessRule[]> {
    // This would query the database for conflicting rules
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Validate rule set compatibility
   */
  static async validateRuleSet(rules: BusinessRule[]): Promise<RuleValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for duplicate priorities
    const priorities = new Map<number, BusinessRule[]>();
    rules.forEach(rule => {
      if (!priorities.has(rule.priority)) {
        priorities.set(rule.priority, []);
      }
      priorities.get(rule.priority)!.push(rule);
    });

    priorities.forEach((rulesWithPriority, priority) => {
      if (rulesWithPriority.length > 1) {
        warnings.push(`Multiple rules have priority ${priority}: ${rulesWithPriority.map(r => r.name).join(', ')}`);
      }
    });

    // Check for conflicting conditions
    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const conflicts = this.detectConditionConflicts(rules[i], rules[j]);
        if (conflicts.length > 0) {
          warnings.push(`Potential conflicts between "${rules[i].name}" and "${rules[j].name}": ${conflicts.join(', ')}`);
        }
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
   * Detect conflicts between two rules' conditions
   */
  private static detectConditionConflicts(rule1: BusinessRule, rule2: BusinessRule): string[] {
    const conflicts: string[] = [];

    // Check if rules apply to overlapping member types
    const overlappingTypes = rule1.applicableTo.filter(type => rule2.applicableTo.includes(type));
    if (overlappingTypes.length === 0) {
      return conflicts; // No conflict if different member types
    }

    // Check for overlapping conditions
    rule1.conditions.forEach(condition1 => {
      rule2.conditions.forEach(condition2 => {
        if (condition1.type === condition2.type) {
          conflicts.push(`Both rules check ${condition1.type}`);
        }
      });
    });

    return conflicts;
  }

  /**
   * Validate rule performance impact
   */
  static async validatePerformanceImpact(rule: BusinessRule): Promise<{
    performanceScore: number;
    recommendations: string[];
  }> {
    let score = 100;
    const recommendations: string[] = [];

    // Complex conditions reduce performance
    if (rule.conditions.length > 10) {
      score -= 20;
      recommendations.push('Consider simplifying conditions or splitting into multiple rules');
    }

    // Formula calculations are slower
    if (rule.calculation.type === 'formula') {
      score -= 15;
      recommendations.push('Formula calculations are slower - consider using simpler calculation types');
    }

    // Lookup tables can be memory intensive
    if (rule.calculation.type === 'lookup_table') {
      score -= 10;
      recommendations.push('Lookup tables increase memory usage - ensure they are necessary');
    }

    return {
      performanceScore: Math.max(0, score),
      recommendations
    };
  }
}