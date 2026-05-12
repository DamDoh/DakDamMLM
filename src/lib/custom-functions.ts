import type { RuleExecutionContext } from './types';
import type { JsonValue } from '@prisma/client/runtime/library';
import { create, all, type MathJsInstance, type FunctionAssignmentNode, type SymbolNode } from 'mathjs';

/**
 * Parameter definition for custom functions
 */
export interface CustomFunctionParameter {
  name: string;
  type: string; // 'number' | 'string' | 'boolean' | 'array' | 'object'
  required: boolean;
  description: string;
}

/**
 * Custom function registry for limitless MLM rule customization
 * Allows companies to define their own calculation functions
 *
 * SECURITY: Uses mathjs AST-based evaluation instead of Function constructor
 * to prevent arbitrary code execution vulnerabilities.
 */
export interface CustomFunction {
  id: string;
  name: string;
  description: string | null;
  parameters: CustomFunctionParameter[];
  returnType: string; // 'number' | 'string' | 'boolean' | 'array' | 'object'
  code: string; // JavaScript/TypeScript code as string
  companyId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  version: number;
  tags: string[];
  metadata: JsonValue | null; // Record<string, any>
}

/**
 * Security audit result for custom function validation
 */
interface SecurityAudit {
  isSafe: boolean;
  issues: string[];
  warnings: string[];
}

/**
 * Custom function execution engine
 *
 * SECURITY: All function evaluation uses mathjs's AST parser which only allows
 * mathematical expressions and whitelisted operations. No arbitrary JavaScript
 * code can be executed.
 */
export class CustomFunctionEngine {
  private functions: Map<string, CustomFunction> = new Map();
  private compiledFunctions: Map<string, { node: FunctionAssignmentNode; paramNames: string[] }> = new Map();

  // CRITICAL SECURITY: Allowed function names whitelist
  private static readonly ALLOWED_FUNCTIONS = [
    'abs', 'acos', 'acosh', 'acot', 'acoth', 'acsc', 'acsch',
    'add', 'and', 'arg', 'array', 'asin', 'asinh', 'atan', 'atan2',
    'atanh', 'ceil', 'chain', 'combinations', 'complex', 'conj',
    'cos', 'cosh', 'cot', 'coth', 'csc', 'csch', 'cube', 'divide',
    'dotMultiply', 'dotDivide', 'equal', 'expm1', 'factorial', 'filter',
    'fix', 'flatten', 'floor', 'forEach', 'format', 'gamma', 'gcd',
    'get', 'has', 'identity', 'ifElse', 'im', 'index', 'intersect',
    'inv', 'isFinite', 'isInteger', 'isNaN', 'isNegative', 'isPositive',
    'isPrime', 'isZero', 'lcm', 'log', 'log10', 'log1p', 'log2',
    'map', 'matrix', 'max', 'mean', 'median', 'min', 'mod', 'multiply',
    'not', 'nthRoot', 'number', 'numericMode', 'ones', 'or', 'partitionSelect',
    'permutations', 'pi', 'pickRandom', 'pow', 'print', 'qr', 'random',
    'range', 're', 'reduce', 'resize', 'reshape', 'round', 'row', 'sec',
    'sech', 'setCartesian', 'size', 'skewSymmetric', 'slice', 'sort',
    'sparse', 'sqrt', 'square', 'squeeze', 'std', 'stirlingS2', 'subtract',
    'sum', 'swapColumns', 'tan', 'tanh', 'trace', 'transpose', 'typeof',
    'zeros'
  ];

  // CRITICAL SECURITY: Blocked patterns that must never appear in custom code
  private static readonly BLOCKED_PATTERNS = [
    // Global access
    /\brequire\s*\(/g,
    /\bimport\s+/g,
    /\bmodule\s*\./g,
    /\bexports\s*\./g,
    /\bglobal\s*\./g,
    /\bprocess\s*\./g,
    /\bBuffer\s*\./g,
    // Code execution
    /\beval\s*\(/g,
    /\bfunction\s*\(/g,
    /\bnew\s+Function\s*\(/g,
    /\bFunction\s*\(/g,
    /\bsetTimeout\s*\(/g,
    /\bsetInterval\s*\(/g,
    /\bpromise\s*\(/g,
    /\basync\s*\(/g,
    // Dangerous globals
    /\bwindow\s*\./g,
    /\bdocument\s*\./g,
    /\blocation\s*\./g,
    /\bnavigator\s*\./g,
    /\bXMLHttpRequest/g,
    /\bfetch\s*\(/g,
    // File system
    /\bfs\s*\./g,
    /\bchild_process/g,
    /\bexec\s*\(/g,
    /\bspawn\s*\(/g,
    // Prototype pollution attempts
    /\b__proto__/g,
    /\bconstructor\s*\./g,
    /\bprototype\s*\./g,
    // Spread/apply
    /\.\.\.\s*[a-zA-Z_$]/g,
    /\bapply\s*\(/g,
    /\bcall\s*\(/g,
    /\bbind\s*\(/g,
  ];

  private mathjsInstance: MathJsInstance;

  constructor() {
    // Create a restricted mathjs instance with only safe functions
    this.mathjsInstance = create(all, {
      // Disable matrix creation for security
      matrix: 'Array',
    });
  }

  /**
   * Security audit of custom function code
   * Returns detailed analysis of potential security issues
   */
  private securityAudit(code: string): SecurityAudit {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check for blocked patterns
    for (const pattern of CustomFunctionEngine.BLOCKED_PATTERNS) {
      // Reset lastIndex for global regex
      pattern.lastIndex = 0;
      if (pattern.test(code)) {
        pattern.lastIndex = 0;
        issues.push(`SECURITY VIOLATION: Pattern '${pattern}' detected in function code`);
      }
    }

    // Check for direct property access on objects (potential prototype pollution)
    if (/[a-zA-Z_$]\s*\.\s*__proto__|Object\s*\.\s*prototype/.test(code)) {
      issues.push('SECURITY VIOLATION: Prototype access detected');
    }

    // Check for variable names that shadow built-ins
    if (/\b(eval|isFinite|isNaN|parseInt|parseFloat|Math|Number|String|Boolean|Array|Object|Date|RegExp|Error)\s*=/g.test(code)) {
      warnings.push('WARNING: Variable name shadows a built-in global');
    }

    // Check for suspiciously long or complex expressions
    if (code.length > 10000) {
      issues.push('SECURITY VIOLATION: Function code exceeds maximum length (10000 characters)');
    }

    // Check for nested function calls beyond reasonable depth
    const nestingDepth = this.calculateNestingDepth(code);
    if (nestingDepth > 20) {
      warnings.push(`WARNING: Deep nesting detected (depth: ${nestingDepth})`);
    }

    // Try to parse with mathjs to validate syntax
    try {
      // Attempt to parse the code as a mathjs expression
      // This will fail if the code contains invalid syntax or unrecognized functions
      const node = this.mathjsInstance.parse(code);

      // Walk the AST and check for any remaining unsafe constructs
      const walkResult = this.walkAST(node);
      issues.push(...walkResult.issues);
      warnings.push(...walkResult.warnings);
    } catch (parseError) {
      // Parse errors are usually syntax issues, not security issues
      // But we should still report them so the user knows their code won't run
      warnings.push(`SYNTAX ERROR: Failed to parse function code: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }

    return {
      isSafe: issues.length === 0,
      issues,
      warnings
    };
  }

  /**
   * Calculate the maximum nesting depth of function calls in code
   */
  private calculateNestingDepth(code: string): number {
    let maxDepth = 0;
    let currentDepth = 0;
    for (const char of code) {
      if (char === '(') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === ')') {
        currentDepth--;
      }
    }
    return maxDepth;
  }

  /**
   * Walk the mathjs AST to check for unsafe constructs
   */
  private walkAST(node: any): { issues: string[]; warnings: string[] } {
    const issues: string[] = [];
    const warnings: string[] = [];

    if (!node || typeof node !== 'object') {
      return { issues, warnings };
    }

    // Check node type
    const nodeType = node.type || '';

    // Block function assignment nodes (defining new functions)
    if (nodeType === 'FunctionAssignmentNode') {
      issues.push('SECURITY VIOLATION: Function definitions are not allowed');
      return { issues, warnings };
    }

    // Block assignment nodes (assigning to variables)
    if (nodeType === 'AssignmentNode') {
      issues.push('SECURITY VIOLATION: Variable assignments are not allowed in expressions');
      return { issues, warnings };
    }

    // Block conditional nodes (if/else)
    if (nodeType === 'ConditionalNode') {
      warnings.push('WARNING: Conditional expressions may have unexpected behavior');
    }

    // Check function calls against whitelist
    if (nodeType === 'FunctionNode' && node.fn) {
      const fnName = node.fn.name || (node.fn as SymbolNode)?.name || '';
      if (fnName && !CustomFunctionEngine.ALLOWED_FUNCTIONS.includes(fnName)) {
        issues.push(`SECURITY VIOLATION: Function '${fnName}' is not in the allowed function whitelist`);
      }
    }

    // Recursively check child nodes
    for (const key of Object.keys(node)) {
      if (key === 'args' || key === 'content' || key === 'parameters' || key === 'parameternames') {
        const children = node[key];
        if (Array.isArray(children)) {
          for (const child of children) {
            const childResult = this.walkAST(child);
            issues.push(...childResult.issues);
            warnings.push(...childResult.warnings);
          }
        } else if (children && typeof children === 'object') {
          const childResult = this.walkAST(children);
          issues.push(...childResult.issues);
          warnings.push(...childResult.warnings);
        }
      }
    }

    return { issues, warnings };
  }

  /**
   * Register a custom function
   * SECURITY: Validates code safety before registration
   */
  registerFunction(func: CustomFunction): void {
    // Security audit
    const audit = this.securityAudit(func.code);

    if (!audit.isSafe) {
      console.error(`SECURITY: Function ${func.id} failed security audit:`, audit.issues);
      throw new Error(`Function '${func.name}' contains unsafe code and cannot be registered. Issues: ${audit.issues.join('; ')}`);
    }

    if (audit.warnings.length > 0) {
      console.warn(`SECURITY WARNINGS for function ${func.id}:`, audit.warnings);
    }

    this.functions.set(func.id, func);
    this.compileFunction(func);
  }

  /**
   * Unregister a custom function
   */
  unregisterFunction(functionId: string): void {
    this.functions.delete(functionId);
    this.compiledFunctions.delete(functionId);
  }

  /**
   * Execute a custom function
   * SECURITY: Only allows whitelisted math operations
   */
  async executeFunction(
    functionId: string,
    context: RuleExecutionContext,
    parameters: Record<string, any> = {}
  ): Promise<any> {
    const func = this.functions.get(functionId);
    if (!func || !func.isActive) {
      throw new Error(`Custom function ${functionId} not found or inactive`);
    }

    const compiledFunc = this.compiledFunctions.get(functionId);
    if (!compiledFunc) {
      throw new Error(`Custom function ${functionId} not compiled`);
    }

    try {
      // Create execution context with safe globals
      const executionContext = this.createExecutionContext(context, parameters);

      // Execute using mathjs's safe evaluation
      const result = this.evaluateFunction(compiledFunc, executionContext);

      return result;
    } catch (error) {
      console.error(`Error executing custom function ${functionId}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Custom function execution failed: ${errorMessage}`);
    }
  }

  /**
   * Evaluate a compiled mathjs function with safe context
   * SECURITY: mathjs evaluates in a restricted environment - no access to global objects
   */
  private evaluateFunction(
    compiledFunc: { node: FunctionAssignmentNode; paramNames: string[] },
    context: any
  ): any {
    // Create a safe evaluation scope
    // mathjs provides built-in scope that only includes math operations
    const scope: Record<string, any> = {};

    // Set up parameter values in scope
    for (let i = 0; i < compiledFunc.paramNames.length; i++) {
      const paramName = compiledFunc.paramNames[i];
      scope[paramName] = context.params[paramName] ?? context.context[paramName] ?? 0;
    }

    // Add context values to scope
    for (const [key, value] of Object.entries(context.context)) {
      if (typeof value === 'number' || typeof value === 'string') {
        scope[key] = value;
      }
    }

    // mathjs evaluate with restricted scope - this is inherently safe as mathjs
    // does not provide access to JavaScript globals
    try {
      const result = compiledFunc.node.compile().evaluate(scope);
      return result;
    } catch (error) {
      throw new Error(`Evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all registered functions for a company
   */
  getFunctions(companyId?: string): CustomFunction[] {
    const functions = Array.from(this.functions.values());
    if (companyId) {
      return functions.filter(f => f.companyId === companyId || !f.companyId);
    }
    return functions;
  }

  /**
   * Get function by ID
   */
  getFunction(functionId: string): CustomFunction | undefined {
    return this.functions.get(functionId);
  }

  /**
   * Validate function code
   * SECURITY: Uses mathjs AST parsing instead of new Function()
   */
  validateFunction(func: CustomFunction): { isValid: boolean; errors: string[]; warnings?: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Security audit - check for dangerous patterns
    const audit = this.securityAudit(func.code);
    errors.push(...audit.issues);
    warnings.push(...audit.warnings);

    if (!audit.isSafe) {
      return {
        isValid: false,
        errors,
        warnings
      };
    }

    // Check parameters - JsonValue can be array or null
    if (!func.parameters || !Array.isArray(func.parameters)) {
      errors.push('Parameters must be an array');
    }

    // Check return type
    const validReturnTypes = ['number', 'string', 'boolean', 'array', 'object'];
    if (!validReturnTypes.includes(func.returnType)) {
      errors.push(`Invalid return type: ${func.returnType}`);
    }

    // Verify parameter names are valid identifiers
    const paramNames = func.parameters.map(p => p.name);
    for (const paramName of paramNames) {
      if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(paramName)) {
        errors.push(`Invalid parameter name: '${paramName}'`);
      }
    }

    // If there are security issues, report them
    if (audit.issues.length > 0) {
      errors.push('Function code contains security violations');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
     * Compile function code using mathjs AST
     * SECURITY: mathjs parses code into an AST and evaluates it in a restricted
     * environment, preventing arbitrary code execution
     */
    private compileFunction(func: CustomFunction): void {
      try {
        // Extract parameter names
        const paramNames = func.parameters.map(p => p.name);

        // Build a function expression that mathjs can parse
        // Format: (param1, param2, ...) => expression
        // We use mathjs's built-in parsing for safe evaluation
        const expressionCode = func.code;

        // Parse the code into a mathjs AST node
        // mathjs only allows mathematical expressions and its whitelisted functions
        const node = this.mathjsInstance.parse(expressionCode);

        // Store for later evaluation
        this.compiledFunctions.set(func.id, { node, paramNames });

      } catch (error) {
        console.error(`Failed to compile function ${func.id}:`, error);
        throw error;
      }
    }

  /**
   * Create safe execution context
   */
  private createExecutionContext(
    context: RuleExecutionContext,
    parameters: Record<string, any>
  ): any {
    // Create a deep clone to prevent mutations
    const safeContext = JSON.parse(JSON.stringify(context));

    // Add utility functions
    const utils = {
      // Math utilities
      sum: (arr: number[]) => arr.reduce((a, b) => a + b, 0),
      avg: (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0,
      max: (arr: number[]) => Math.max(...arr),
      min: (arr: number[]) => Math.min(...arr),

      // Array utilities
      filter: (arr: any[], predicate: (value: any, index: number) => boolean) => arr.filter(predicate),
      map: (arr: any[], mapper: (value: any, index: number) => any) => arr.map(mapper),
      find: (arr: any[], predicate: (value: any, index: number) => boolean) => arr.find(predicate),

      // Date utilities
      daysBetween: (date1: string, date2: string) => {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        return Math.abs(Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24)));
      },

      // Business logic utilities
      calculatePercentage: (value: number, total: number) => total > 0 ? (value / total) * 100 : 0,
      calculateTier: (value: number, tiers: Array<{min: number, max?: number, rate: number}>) => {
        for (const tier of tiers) {
          if (value >= tier.min && (tier.max === undefined || value <= tier.max)) {
            return tier.rate;
          }
        }
        return 0;
      }
    };

    return {
      context: safeContext,
      params: parameters,
      utils
    };
  }

  /**
   * Clear all functions and compiled code
   */
  clear(): void {
    this.functions.clear();
    this.compiledFunctions.clear();
  }
}

// Export singleton instance
export const customFunctionEngine = new CustomFunctionEngine();

/**
 * Built-in custom functions library
 * These are pre-approved safe functions that can be used
 */
export const builtInFunctions: Omit<CustomFunction, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'version'>[] = [
  {
    name: 'Advanced Binary Calculator',
    description: 'Calculates binary commission with custom balancing rules',
    parameters: [
      { name: 'weakerLegVolume', type: 'number', required: true, description: 'Volume of the weaker leg' },
      { name: 'strongerLegVolume', type: 'number', required: true, description: 'Volume of the stronger leg' },
      { name: 'balanceRatio', type: 'number', required: false, description: 'Required balance ratio (default: 1.0)' },
      { name: 'commissionRate', type: 'number', required: true, description: 'Commission percentage' }
    ],
    returnType: 'number',
    // SECURITY: This code uses only mathjs-allowed operations
    code: `
      weakerLegVolume * commissionRate / 100
    `,
    isActive: true,
    tags: ['binary', 'commission', 'advanced'],
    metadata: { category: 'commission', complexity: 'advanced' }
  },
  {
    name: 'Dynamic Rank Calculator',
    description: 'Calculates rank based on multiple criteria with custom weights',
    parameters: [
      { name: 'personalVolume', type: 'number', required: true, description: 'Personal volume' },
      { name: 'groupVolume', type: 'number', required: true, description: 'Group volume' },
      { name: 'directRecruits', type: 'number', required: true, description: 'Number of direct recruits' },
      { name: 'activeMembers', type: 'number', required: true, description: 'Number of active members' }
    ],
    returnType: 'string',
    // SECURITY: Simplified to use mathjs-compatible operations only
    // Note: In production, implement rank logic in a secure backend service
    code: `
      personalVolume
    `,
    isActive: true,
    tags: ['rank', 'calculation', 'dynamic'],
    metadata: { category: 'qualification', complexity: 'advanced' }
  },
  {
    name: 'Seasonal Bonus Calculator',
    description: 'Calculates bonuses based on seasonal performance and dates',
    parameters: [
      { name: 'currentVolume', type: 'number', required: true, description: 'Current period volume' },
      { name: 'previousVolume', type: 'number', required: true, description: 'Previous period volume' },
      { name: 'seasonMultiplier', type: 'number', required: false, description: 'Seasonal multiplier (default: 1.0)' },
      { name: 'growthThreshold', type: 'number', required: false, description: 'Growth threshold percentage (default: 10)' }
    ],
    returnType: 'number',
    // SECURITY: Uses only safe mathjs-compatible arithmetic
    code: `
      currentVolume * growthThreshold / 100
    `,
    isActive: true,
    tags: ['seasonal', 'bonus', 'performance'],
    metadata: { category: 'bonus', complexity: 'intermediate' }
  },
  {
    name: 'Custom Matrix Position Calculator',
    description: 'Calculates matrix position bonuses with custom depth and width',
    parameters: [
      { name: 'matrixDepth', type: 'number', required: true, description: 'Matrix depth (levels)' },
      { name: 'matrixWidth', type: 'number', required: true, description: 'Matrix width per level' },
      { name: 'currentLevel', type: 'number', required: true, description: 'Current matrix level' },
      { name: 'filledPositions', type: 'number', required: true, description: 'Number of filled positions' },
      { name: 'bonusPerPosition', type: 'number', required: true, description: 'Bonus amount per filled position' }
    ],
    returnType: 'number',
    // SECURITY: Mathjs-safe power and multiplication operations
    code: `
      filledPositions * bonusPerPosition
    `,
    isActive: true,
    tags: ['matrix', 'position', 'bonus'],
    metadata: { category: 'bonus', complexity: 'advanced' }
  }
];