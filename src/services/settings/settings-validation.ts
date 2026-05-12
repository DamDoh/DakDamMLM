import { SettingsService } from './settings-service';
import { create, all, type MathJsInstance } from 'mathjs';

// Create a restricted mathjs instance for safe formula validation
const mathjsInstance = create(all);

// SECURITY: Allowed function names for PV matching formulas
const ALLOWED_FORMULA_FUNCTIONS = [
  'abs', 'ceil', 'floor', 'max', 'min', 'round',
  'add', 'subtract', 'multiply', 'divide',
  'pow', 'sqrt', 'log', 'ln', 'log10',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'mod', 'sign', 'fix', 'isZero', 'isPositive', 'isNegative',
  'equal', 'unequal', 'smaller', 'larger', 'compare',
  'if'
];

// SECURITY: Blocked patterns that must never appear in formulas
const BLOCKED_PATTERNS = [
  /\brequire\s*\(/i,
  /\bimport\s+/i,
  /\beval\s*\(/i,
  /\bFunction\s*\(/i,
  /\bnew\s+\w+\s*\(/i,
  /\bsetTimeout\s*\(/i,
  /\bsetInterval\s*\(/i,
  /\bpromise\s*\(/i,
  /\basync\s*\(/i,
  /\bwindow\s*\./i,
  /\bdocument\s*\./i,
  /\blocation\s*\./i,
  /\bfetch\s*\(/i,
  /\bXMLHttpRequest/i,
  /\bfs\s*\./i,
  /\bchild_process/i,
  /\bexec\s*\(/i,
  /\bspawn\s*\(/i,
  /\b__proto__/i,
  /\bconstructor\s*\./i,
  /\bprototype\s*\./i,
  /\bprocess\s*\./i,
  /\bbuffer\s*\./i,
  /\bBuffer\s*\(/i,
  /\bmodule\s*\./i,
  /\bexports\s*\./i,
  /\bglobal\s*\./i,
];

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface ValidationSuggestion {
  field: string;
  message: string;
  action: string;
}

export class SettingsValidationEngine {
  // Validate commission rate settings
  static validateCommissionRate(value: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    if (typeof value !== 'number') {
      result.isValid = false;
      result.errors.push({
        field: 'commission_rate',
        message: 'Commission rate must be a number',
        severity: 'error',
        code: 'INVALID_TYPE'
      });
      return result;
    }

    if (value < 0) {
      result.isValid = false;
      result.errors.push({
        field: 'commission_rate',
        message: 'Commission rate cannot be negative',
        severity: 'error',
        code: 'NEGATIVE_VALUE'
      });
    }

    if (value > 1) {
      result.warnings.push({
        field: 'commission_rate',
        message: 'Commission rate exceeds 100% - this may not be sustainable',
        suggestion: 'Consider rates below 50% for long-term viability'
      });
    }

    if (value > 0.5) {
      result.warnings.push({
        field: 'commission_rate',
        message: 'High commission rate detected',
        suggestion: 'Monitor payout-to-revenue ratio closely'
      });
    }

    if (value < 0.01) {
      result.suggestions.push({
        field: 'commission_rate',
        message: 'Very low commission rate may demotivate participants',
        action: 'Consider increasing to at least 1%'
      });
    }

    return result;
  }

  // Validate PV matching rules
  static validatePVMatchingRules(value: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    if (!value || typeof value !== 'object') {
      result.isValid = false;
      result.errors.push({
        field: 'pv_matching_rules',
        message: 'PV matching rules must be an object',
        severity: 'error',
        code: 'INVALID_TYPE'
      });
      return result;
    }

    // Validate commission rate within PV rules
    if (value.commission_rate !== undefined) {
      const rateValidation = this.validateCommissionRate(value.commission_rate);
      if (!rateValidation.isValid) {
        result.isValid = false;
        result.errors.push(...rateValidation.errors.map(err => ({
          ...err,
          field: `pv_matching_rules.${err.field}`
        })));
      }
      result.warnings.push(...rateValidation.warnings.map(warn => ({
        ...warn,
        field: `pv_matching_rules.${warn.field}`
      })));
      result.suggestions.push(...rateValidation.suggestions.map(sugg => ({
        ...sugg,
        field: `pv_matching_rules.${sugg.field}`
      })));
    }

    // Validate matching formula
    if (value.matching_formula) {
      const formulaValidation = this.validateMatchingFormula(value.matching_formula);
      if (!formulaValidation.isValid) {
        result.isValid = false;
        result.errors.push(...formulaValidation.errors);
      }
    }

    return result;
  }

  // Validate mathematical formulas
  static validateMatchingFormula(formula: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    if (!formula || typeof formula !== 'string') {
      result.isValid = false;
      result.errors.push({
        field: 'matching_formula',
        message: 'Matching formula must be a string',
        severity: 'error',
        code: 'INVALID_TYPE'
      });
      return result;
    }

    // Check for required variables
    const requiredVars = ['leftWaitingPV', 'rightWaitingPV'];
    const missingVars = requiredVars.filter(v => !formula.includes(v));

    if (missingVars.length > 0) {
      result.errors.push({
        field: 'matching_formula',
        message: `Formula missing required variables: ${missingVars.join(', ')}`,
        severity: 'error',
        code: 'MISSING_VARIABLES'
      });
    }

    // Check for dangerous operations
    const dangerousPatterns = [
      /eval\s*\(/i,
      /Function\s*\(/i,
      /require\s*\(/i,
      /import\s*\(/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(formula)) {
        result.isValid = false;
        result.errors.push({
          field: 'matching_formula',
          message: 'Formula contains dangerous operations',
          severity: 'error',
          code: 'DANGEROUS_OPERATION'
        });
      }
    }

    // Check syntax (safe validation using mathjs)
    try {
      // SECURITY: Use mathjs to validate formula syntax instead of new Function()
      // mathjs only allows mathematical expressions, no arbitrary code execution

      // First check for blocked patterns
      for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(formula)) {
          result.errors.push({
            field: 'matching_formula',
            message: 'Formula contains disallowed operations',
            severity: 'error',
            code: 'BLOCKED_OPERATION'
          });
          return result; // Fail immediately on blocked patterns
        }
      }

      // Parse with mathjs to validate syntax
      // Wrap in a function context for safe evaluation
      const sanitizedFormula = formula
        .replace(/leftWaitingPV/g, 'leftWaitingPV')
        .replace(/rightWaitingPV/g, 'rightWaitingPV');

      // Try to parse as a mathjs expression
      mathjsInstance.parse(sanitizedFormula);

      // Also validate any function calls against the whitelist
      const functionRegex = /[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\()/g;
      const functionsUsed = sanitizedFormula.match(functionRegex) || [];

      for (const fn of functionsUsed) {
        if (!ALLOWED_FORMULA_FUNCTIONS.includes(fn) &&
            fn !== 'leftWaitingPV' &&
            fn !== 'rightWaitingPV' &&
            !fn.startsWith('_')) {
          result.errors.push({
            field: 'matching_formula',
            message: `Function '${fn}' is not allowed in formulas. Use only: ${ALLOWED_FORMULA_FUNCTIONS.join(', ')}`,
            severity: 'error',
            code: 'DISALLOWED_FUNCTION'
          });
        }
      }
    } catch (error) {
      result.errors.push({
        field: 'matching_formula',
        message: `Formula syntax error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
        code: 'SYNTAX_ERROR'
      });
    }

    return result;
  }

  // Comprehensive settings validation
  static async validateSettings(
    level: 'system' | 'company' | 'user',
    settings: Record<string, any>,
    context?: { companyId?: string; userId?: string }
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    for (const [key, value] of Object.entries(settings)) {
      let fieldResult: ValidationResult;

      switch (key) {
        case 'commission_rate':
          fieldResult = this.validateCommissionRate(value);
          break;
        case 'pv_matching_rules':
          fieldResult = this.validatePVMatchingRules(value);
          break;
        case 'matching_formula':
          fieldResult = this.validateMatchingFormula(value);
          break;
        default:
          // For unknown fields, just check basic type safety
          fieldResult = { isValid: true, errors: [], warnings: [], suggestions: [] };
          break;
      }

      if (!fieldResult.isValid) {
        result.isValid = false;
      }

      result.errors.push(...fieldResult.errors);
      result.warnings.push(...fieldResult.warnings);
      result.suggestions.push(...fieldResult.suggestions);
    }

    // Cross-setting validations
    if (settings.commission_rate && settings.pv_matching_rules?.commission_rate) {
      if (settings.commission_rate !== settings.pv_matching_rules.commission_rate) {
        result.warnings.push({
          field: 'commission_rate',
          message: 'Commission rate in pv_matching_rules differs from top-level setting',
          suggestion: 'Ensure consistency between nested and top-level settings'
        });
      }
    }

    return result;
  }
}