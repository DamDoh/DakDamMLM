import type { BusinessRule } from './types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Enhanced business rule validation
 * Validates calculation formulas, conditions logic, and business constraints
 */
export function validateBusinessRuleEnhanced(rule: Partial<BusinessRule>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Validate basic structure
  if (!rule.name || rule.name.length < 3) {
    errors.push('Rule name must be at least 3 characters');
  }

  if (!rule.description || rule.description.length < 10) {
    errors.push('Rule description must be at least 10 characters');
  }

  if (!rule.type) {
    errors.push('Rule type is required');
  }

  if (!rule.category) {
    errors.push('Rule category is required');
  }

  // Validate calculation structure (only if provided and not empty)
  if (rule.calculation && typeof rule.calculation === 'object' && Object.keys(rule.calculation).length > 0) {
    const calc = rule.calculation as any;
    
    if (!calc.type) {
      errors.push('Calculation type is required');
    } else {
      switch (calc.type) {
        case 'percentage':
          if (typeof calc.rate !== 'number') {
            errors.push('Percentage calculation requires numeric rate');
          } else {
            if (calc.rate < 0 || calc.rate > 1) {
              errors.push('Percentage rate must be between 0 and 1 (e.g., 0.1 for 10%)');
            }
            if (calc.rate > 0.5) {
              warnings.push('High commission rate (>50%) detected - verify this is intentional');
            }
          }
          break;

        case 'fixed':
          if (typeof calc.amount !== 'number') {
            errors.push('Fixed calculation requires numeric amount');
          } else if (calc.amount < 0) {
            errors.push('Fixed amount cannot be negative');
          }
          break;

        case 'tiered':
          if (!Array.isArray(calc.tiers) || calc.tiers.length === 0) {
            errors.push('Tiered calculation requires at least one tier');
          } else {
            // Validate each tier
            calc.tiers.forEach((tier: any, index: number) => {
              if (typeof tier.min !== 'number') {
                errors.push(`Tier ${index + 1}: min value must be numeric`);
              }
              if (tier.max !== undefined && typeof tier.max !== 'number') {
                errors.push(`Tier ${index + 1}: max value must be numeric`);
              }
              if (typeof tier.rate !== 'number') {
                errors.push(`Tier ${index + 1}: rate must be numeric`);
              }
              if (tier.min < 0) {
                errors.push(`Tier ${index + 1}: min cannot be negative`);
              }
              if (tier.max && tier.max <= tier.min) {
                errors.push(`Tier ${index + 1}: max must be greater than min`);
              }
            });

            // Check for gaps in tiers
            const sortedTiers = [...calc.tiers].sort((a, b) => a.min - b.min);
            for (let i = 0; i < sortedTiers.length - 1; i++) {
              const current = sortedTiers[i];
              const next = sortedTiers[i + 1];
              if (current.max && next.min > current.max + 1) {
                warnings.push(`Gap detected between tier ${i + 1} (max: ${current.max}) and tier ${i + 2} (min: ${next.min})`);
              }
            }
          }
          break;

        case 'formula':
          if (!calc.expression || typeof calc.expression !== 'string') {
            errors.push('Formula calculation requires expression string');
          } else {
            // Basic formula validation
            const validationResult = validateFormula(calc.expression);
            if (!validationResult.isValid) {
              errors.push(`Invalid formula: ${validationResult.error}`);
            } else {
              suggestions.push('Formula looks valid - test with simulation before activating');
            }
          }
          break;

        default:
          errors.push(`Unknown calculation type: ${calc.type}`);
      }

      // Validate cap if present
      if (calc.cap !== undefined) {
        if (typeof calc.cap !== 'number' || calc.cap < 0) {
          errors.push('Cap must be a positive number');
        }
      }

      // Validate minimum if present
      if (calc.minimum !== undefined) {
        if (typeof calc.minimum !== 'number' || calc.minimum < 0) {
          errors.push('Minimum must be a positive number');
        }
      }

      if (calc.minimum && calc.cap && calc.minimum > calc.cap) {
        errors.push('Minimum cannot be greater than cap');
      }
    }
  } else {
    // Calculation is optional - some rules might not need it
    warnings.push('No calculation defined - rule may not be functional');
  }

  // Validate conditions
  if (rule.conditions && Array.isArray(rule.conditions)) {
    rule.conditions.forEach((condition: any, index: number) => {
      if (!condition.field) {
        errors.push(`Condition ${index + 1}: field is required`);
      }
      if (!condition.operator) {
        errors.push(`Condition ${index + 1}: operator is required`);
      }
      if (condition.value === undefined) {
        errors.push(`Condition ${index + 1}: value is required`);
      }

      // Validate operator
      const validOperators = ['equals', 'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual', 'contains', 'in', 'notEquals'];
      if (condition.operator && !validOperators.includes(condition.operator)) {
        errors.push(`Condition ${index + 1}: invalid operator '${condition.operator}'`);
      }
    });
  }

  // Validate applicableTo
  if (rule.applicableTo && Array.isArray(rule.applicableTo)) {
    const validTypes = ['distributor', 'stockist', 'customer'];
    rule.applicableTo.forEach((type: any) => {
      if (!validTypes.includes(type)) {
        errors.push(`Invalid applicableTo type: ${type}`);
      }
    });
  } else {
    warnings.push('applicableTo not specified - will default to [distributor]');
  }

  // Validate frequency
  if (rule.frequency) {
    const validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'once'];
    if (!validFrequencies.includes(rule.frequency)) {
      errors.push(`Invalid frequency: ${rule.frequency}`);
    }
  }

  // Validate priority
  if (rule.priority !== undefined) {
    if (typeof rule.priority !== 'number' || rule.priority < 0 || rule.priority > 100) {
      errors.push('Priority must be a number between 0 and 100');
    }
  }

  // Business logic suggestions
  if (rule.category === 'commission' && !rule.conditions?.length) {
    suggestions.push('Consider adding eligibility conditions (e.g., minimum PV, active status)');
  }

  if (rule.category === 'bonus' && !rule.calculation) {
    warnings.push('Bonus rules typically need calculation logic');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
}

/**
 * Validate mathematical formula expressions
 */
function validateFormula(expression: string): { isValid: boolean; error?: string } {
  try {
    // Check for dangerous functions
    const dangerous = ['eval', 'Function', 'setTimeout', 'setInterval', 'require', 'import'];
    for (const keyword of dangerous) {
      if (expression.includes(keyword)) {
        return { isValid: false, error: `Dangerous keyword detected: ${keyword}` };
      }
    }

    // Check for valid mathematical operators and functions
    const validPattern = /^[0-9+\-*/(). a-zA-Z_]+$/;
    if (!validPattern.test(expression)) {
      return { isValid: false, error: 'Formula contains invalid characters' };
    }

    // Check balanced parentheses
    let balance = 0;
    for (const char of expression) {
      if (char === '(') balance++;
      if (char === ')') balance--;
      if (balance < 0) {
        return { isValid: false, error: 'Unbalanced parentheses - too many closing brackets' };
      }
    }
    if (balance !== 0) {
      return { isValid: false, error: 'Unbalanced parentheses - unclosed brackets' };
    }

    // Check for division by zero patterns
    if (expression.includes('/0') || expression.includes('/ 0')) {
      return { isValid: false, error: 'Potential division by zero detected' };
    }

    return { isValid: true };
  } catch (error) {
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : 'Unknown validation error' 
    };
  }
}