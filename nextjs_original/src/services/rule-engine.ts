import type {
  BusinessRule,
  RuleExecutionContext,
  RuleExecutionResult,
  RuleValidationResult,
  RuleCondition,
  RuleCalculation,
  RuleConditionType,
} from '@/lib/types';
import { prisma } from '@/lib/database';
import { roundToDecimal, logCalculationAudit } from '@/lib/shared-utils';

export class RuleEngine {
  private rules: BusinessRule[] = [];
  private ruleCache = new Map<string, BusinessRule>();
  private executionCache = new Map<string, RuleExecutionResult>();

  constructor() {
    this.loadRules();
  }

  async loadRules(): Promise<void> {
    try {
      // Load rules from database with fallback to hardcoded rules
      const dbRules = await this.loadRulesFromDatabase();
      this.rules = dbRules.length > 0 ? dbRules : this.getDefaultRules();

      // Update cache
      this.ruleCache.clear();
      this.rules.forEach(rule => this.ruleCache.set(rule.id, rule));

    } catch (error) {
      console.error('Failed to load rules from database, using defaults:', error);
      // Fallback to hardcoded rules
      this.rules = this.getDefaultRules();
      this.ruleCache.clear();
      this.rules.forEach(rule => this.ruleCache.set(rule.id, rule));
    }
  }

  private async loadRulesFromDatabase(): Promise<BusinessRule[]> {
    try {
      const dbRules = await prisma.businessRule.findMany({
        where: { isActive: true },
        orderBy: { priority: 'desc' }
      });

      return dbRules.map(rule => ({
        id: rule.id,
        name: rule.name,
        description: rule.description || '',
        type: rule.type as any,
        category: rule.category as any,
        priority: rule.priority,
        isActive: rule.isActive,
        conditions: rule.conditions as any,
        calculation: rule.calculation as any,
        applicableTo: rule.applicableTo as any,
        frequency: rule.frequency as any,
        payoutTiming: rule.payoutTiming as any,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
        createdBy: rule.createdBy,
        version: rule.version,
        tags: rule.tags as any,
        metadata: rule.metadata as any,
      })) as BusinessRule[];
    } catch (error) {
      console.error('Database rule loading failed:', error);
      return [];
    }
  }

  private getDefaultRules(): BusinessRule[] {
    return [
      {
        id: 'binary-commission',
        name: 'Binary Commission',
        description: 'Standard binary commission based on weaker leg volume',
        type: 'binary_bonus',
        category: 'commission',
        priority: 100,
        isActive: true,
        conditions: [
          {
            type: 'account_type',
            operator: 'equals',
            value: 'distributor'
          },
          {
            type: 'pv',
            operator: 'greater_than',
            value: 50
          }
        ],
        calculation: {
          type: 'percentage',
          baseValue: 0, // Will be set to weaker leg volume
          percentage: 0.10 // 10%
        },
        applicableTo: ['distributor'],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        version: 1,
        tags: ['binary', 'commission', 'volume']
      },
      {
        id: 'stockist-district',
        name: 'District Stockist Bonus',
        description: '2% bonus on personal volume for district stockists',
        type: 'stockist_bonus',
        category: 'bonus',
        priority: 90,
        isActive: true,
        conditions: [
          {
            type: 'account_type',
            operator: 'equals',
            value: 'stockist'
          },
          {
            type: 'custom_condition',
            operator: 'equals',
            value: 'District'
          }
        ],
        calculation: {
          type: 'percentage',
          baseValue: 0, // Will be set to personal volume
          percentage: 0.02 // 2%
        },
        applicableTo: ['stockist'],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        version: 1,
        tags: ['stockist', 'district', 'bonus']
      }
    ];
  }

  async executeRules(context: RuleExecutionContext): Promise<RuleExecutionResult[]> {
    const results: RuleExecutionResult[] = [];
    const cacheKey = this.generateCacheKey(context);

    // Check execution cache
    if (this.executionCache.has(cacheKey)) {
      return [this.executionCache.get(cacheKey)!];
    }

    for (const rule of this.rules) {
      try {
        const result = await this.executeRule(rule, context);
        if (result && result.amount > 0) {
          results.push(result);
          // Cache result
          this.executionCache.set(cacheKey, result);
        }
      } catch (error) {
        console.error(`Error executing rule ${rule.id}:`, error);
        // Log error but continue with other rules
      }
    }

    return results;
  }

  private async executeRule(rule: BusinessRule, context: RuleExecutionContext): Promise<RuleExecutionResult | null> {
    const startTime = Date.now();

    // Check if rule applies to this member type
    if (!this.checkApplicability(rule, context)) {
      return null;
    }

    // Evaluate conditions
    if (!this.evaluateConditions(rule.conditions, context)) {
      return null;
    }

    // Calculate amount
    const amount = this.calculateAmount(rule.calculation, context);

    if (amount <= 0) {
      return null;
    }

    const result: RuleExecutionResult = {
      ruleId: rule.id,
      amount: roundToDecimal(amount),
      breakdown: [{
        component: rule.name,
        amount: roundToDecimal(amount),
        description: rule.description
      }],
      metadata: {
        executionTime: Date.now() - startTime,
        ruleType: rule.type,
        ruleCategory: rule.category,
        priority: rule.priority
      }
    };

    // Log execution
    await logCalculationAudit({
      memberId: context.memberId,
      calculationType: 'rule_engine',
      cycleId: `rule-${Date.now()}`,
      inputs: {
        ruleId: rule.id,
        ruleName: rule.name,
        context: context
      },
      result: amount,
      duration: Date.now() - startTime
    });

    return result;
  }

  private checkApplicability(rule: BusinessRule, context: RuleExecutionContext): boolean {
    // Check account type
    const memberAccountType = context.ranks.current === 'Member' ? 'customer' : 'distributor';
    return rule.applicableTo.includes(memberAccountType as any);
  }

  private evaluateConditions(conditions: RuleCondition[], context: RuleExecutionContext): boolean {
    // Simple AND logic for now - can be extended to support complex boolean logic
    return conditions.every(condition => this.evaluateCondition(condition, context));
  }

  private evaluateCondition(condition: RuleCondition, context: RuleExecutionContext): boolean {
    const { type, operator, value } = condition;
    const actualValue = this.getConditionValue(type, context);

    switch (operator) {
      case 'equals':
        return actualValue === value;
      case 'not_equals':
        return actualValue !== value;
      case 'greater_than':
        return Number(actualValue) > Number(value);
      case 'less_than':
        return Number(actualValue) < Number(value);
      case 'greater_equal':
        return Number(actualValue) >= Number(value);
      case 'less_equal':
        return Number(actualValue) <= Number(value);
      case 'in':
        return Array.isArray(value) && value.includes(actualValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(actualValue);
      case 'between':
        const [min, max] = value as [number, number];
        return Number(actualValue) >= min && Number(actualValue) <= max;
      case 'contains':
        return String(actualValue).includes(String(value));
      case 'starts_with':
        return String(actualValue).startsWith(String(value));
      case 'ends_with':
        return String(actualValue).endsWith(String(value));
      default:
        return false;
    }
  }

  private getConditionValue(type: RuleConditionType, context: RuleExecutionContext): any {
    switch (type) {
      case 'rank':
        return context.ranks.current;
      case 'pv':
      case 'personal_volume':
        return context.volumes.personal;
      case 'gv':
      case 'group_volume':
        return context.volumes.group;
      case 'direct_recruits':
        return context.team.directRecruits;
      case 'total_recruits':
        return context.team.totalDownline;
      case 'active_members':
        return context.team.activeMembers;
      case 'qualified_legs':
        return context.team.qualifiedLegs;
      case 'paid_as_rank':
        return context.ranks.paidAs;
      case 'time_in_rank':
        // Calculate time in current rank (simplified)
        return 0; // Would need rank history
      case 'consecutive_months':
        return 0; // Would need activity history
      case 'product_purchases':
        return context.products.purchased.length;
      case 'training_completion':
        return 0; // Would need training data
      case 'compliance_status':
        return true; // Would need compliance data
      case 'geographic_location':
        return 'default'; // Would need location data
      case 'account_type':
        return context.ranks.current === 'Member' ? 'customer' : 'distributor';
      case 'tenure':
        // Calculate tenure in months
        return 0; // Would need join date
      case 'performance_level':
        return 'standard'; // Would need performance metrics
      case 'team_size':
        return context.team.totalDownline;
      case 'generation_depth':
        return context.genealogy.generation;
      case 'upline_rank':
        return context.ranks.current; // Simplified
      case 'downline_rank':
        return 'any'; // Would need downline analysis
      case 'sponsor_rank':
        return context.ranks.current; // Simplified
      case 'placement_rank':
        return context.ranks.current; // Simplified
      case 'binary_balance':
        const { left, right } = context.volumes;
        return Math.min(left, right) / Math.max(left, right);
      case 'matrix_position':
        return 0; // Would need matrix data
      case 'unilevel_level':
        return context.genealogy.generation;
      default:
        return context.customData?.[type] || null;
    }
  }

  private calculateAmount(calculation: RuleCalculation, context: RuleExecutionContext): number {
    const { type, baseValue = 0, percentage, tiers, formula, lookupTable } = calculation;

    switch (type) {
      case 'percentage':
        return baseValue * (percentage || 0);

      case 'fixed_amount':
        return baseValue;

      case 'per_unit':
        // Calculate based on volume or other metrics
        return baseValue * context.volumes.personal;

      case 'tiered_percentage':
        if (!tiers) return 0;
        const volume = context.volumes.personal;
        const tier = tiers.find(t => volume >= t.min && (!t.max || volume <= t.max));
        return tier ? (baseValue * (tier.value as number)) : 0;

      case 'tiered_fixed':
        if (!tiers) return 0;
        const vol = context.volumes.personal;
        const fixedTier = tiers.find(t => vol >= t.min && (!t.max || vol <= t.max));
        return fixedTier ? (fixedTier.value as number) : 0;

      case 'formula':
        // Safe formula evaluation without eval() - prevents code injection
        if (formula) {
          return this.evaluateSafeFormula(formula, context);
        }
        return 0;

      case 'lookup_table':
        if (!lookupTable) return 0;
        const key = context.ranks.current;
        return lookupTable[key] || 0;

      case 'conditional':
        // Evaluate conditions and return appropriate value
        return baseValue;

      default:
        return 0;
    }
  }

  async validateRule(rule: BusinessRule): Promise<RuleValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Basic validation
    if (!rule.name.trim()) {
      errors.push('Rule name is required');
    }

    if (!rule.conditions.length) {
      warnings.push('Rule has no conditions - will apply to all members');
    }

    // Check for conflicts with existing rules
    const conflicts = await this.detectConflicts(rule);
    if (conflicts.length > 0) {
      warnings.push(`Potential conflicts with ${conflicts.length} existing rules`);
      suggestions.push('Review overlapping conditions with existing rules');
    }

    // Validate calculation logic
    if (!this.validateCalculation(rule.calculation)) {
      errors.push('Invalid calculation configuration');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  private async detectConflicts(rule: BusinessRule): Promise<BusinessRule[]> {
    const conflicts: BusinessRule[] = [];

    for (const existingRule of this.rules) {
      if (existingRule.id === rule.id) continue;

      // Check for overlapping conditions
      if (this.hasOverlappingConditions(rule.conditions, existingRule.conditions)) {
        conflicts.push(existingRule);
      }
    }

    return conflicts;
  }

  private hasOverlappingConditions(conditions1: RuleCondition[], conditions2: RuleCondition[]): boolean {
    // Simplified overlap detection - can be made more sophisticated
    return conditions1.some(c1 =>
      conditions2.some(c2 => c1.type === c2.type)
    );
  }

  private validateCalculation(calculation: RuleCalculation): boolean {
    switch (calculation.type) {
      case 'percentage':
        return typeof calculation.percentage === 'number' && calculation.percentage >= 0;
      case 'fixed_amount':
        return typeof calculation.baseValue === 'number' && calculation.baseValue >= 0;
      case 'tiered_percentage':
      case 'tiered_fixed':
        return Array.isArray(calculation.tiers) && calculation.tiers.length > 0;
      case 'lookup_table':
        return typeof calculation.lookupTable === 'object' && calculation.lookupTable !== null;
      default:
        return true;
    }
  }

  private generateCacheKey(context: RuleExecutionContext): string {
    // Generate a cache key based on relevant context properties
    return `${context.memberId}-${context.period.start}-${context.period.end}-${JSON.stringify(context.volumes)}`;
  }

  // Public methods for rule management
  async getRule(ruleId: string): Promise<BusinessRule | null> {
    return this.ruleCache.get(ruleId) || null;
  }

  async getAllRules(): Promise<BusinessRule[]> {
    return this.rules;
  }

  async createRule(ruleData: Omit<BusinessRule, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<BusinessRule> {
    try {
      const newRule = await prisma.businessRule.create({
        data: {
          id: `rule-${Date.now()}`,
          name: ruleData.name,
          description: ruleData.description,
          type: ruleData.type,
          category: ruleData.category,
          priority: ruleData.priority,
          isActive: ruleData.isActive,
          conditions: ruleData.conditions as any,
          calculation: ruleData.calculation as any,
          applicableTo: ruleData.applicableTo as any,
          frequency: ruleData.frequency,
          payoutTiming: ruleData.payoutTiming,
          createdBy: ruleData.createdBy,
          tags: ruleData.tags as any,
          metadata: ruleData.metadata as any,
        }
      });

      await this.loadRules(); // Refresh cache
      return this.ruleCache.get(newRule.id)!;
    } catch (error) {
      console.error('Failed to create rule:', error);
      throw error;
    }
  }

  async updateRule(ruleId: string, updates: Partial<BusinessRule>): Promise<BusinessRule | null> {
    try {
      await prisma.businessRule.update({
        where: { id: ruleId },
        data: {
          name: updates.name,
          description: updates.description,
          type: updates.type,
          category: updates.category,
          priority: updates.priority,
          isActive: updates.isActive,
          conditions: updates.conditions as any,
          calculation: updates.calculation as any,
          applicableTo: updates.applicableTo as any,
          frequency: updates.frequency,
          payoutTiming: updates.payoutTiming,
          tags: updates.tags as any,
          metadata: updates.metadata as any,
          updatedAt: new Date(),
        }
      });

      await this.loadRules(); // Refresh cache
      return this.ruleCache.get(ruleId) || null;
    } catch (error) {
      console.error('Failed to update rule:', error);
      return null;
    }
  }

  async deleteRule(ruleId: string): Promise<boolean> {
    try {
      await prisma.businessRule.delete({
        where: { id: ruleId }
      });

      await this.loadRules(); // Refresh cache
      return true;
    } catch (error) {
      console.error('Failed to delete rule:', error);
      return false;
    }
  }

  // Safe formula evaluator - NO eval() to prevent code injection
  private evaluateSafeFormula(formula: string, context: RuleExecutionContext): number {
    try {
      // Replace variables with actual values
      let processedFormula = formula
        .replace(/\bpv\b/gi, context.volumes.personal.toString())
        .replace(/\bgv\b/gi, context.volumes.group.toString())
        .replace(/\bleft\b/gi, (context.volumes.left || 0).toString())
        .replace(/\bright\b/gi, (context.volumes.right || 0).toString())
        .replace(/\bdr\b/gi, context.team.directRecruits.toString())
        .replace(/\btotal\b/gi, context.team.totalDownline.toString());

      // Only allow basic math operations - whitelist approach
      // Remove any non-math characters
      if (!/^[\d\s+\-*/.()]+$/.test(processedFormula)) {
        console.error('Invalid formula contains non-mathematical characters:', formula);
        return 0;
      }

      // CRITICAL SECURITY FIX: Replace Function constructor with math.js or safe evaluation
      // For now, implement a basic safe math evaluator without Function constructor
      const result = this.safeMathEval(processedFormula);

      if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
        console.error('Formula evaluation resulted in invalid number:', formula);
        return 0;
      }

      return Math.max(0, result); // Ensure non-negative
    } catch (error) {
      console.error('Formula evaluation error:', formula, error);
      return 0;
    }
  }

  /**
   * Safe mathematical expression evaluator - NO code execution
   */
  private safeMathEval(expression: string): number {
    // Remove all whitespace
    const expr = expression.replace(/\s/g, '');

    // Basic validation - only allow numbers, operators, parentheses
    if (!/^[\d+\-*/.()]+$/.test(expr)) {
      throw new Error('Invalid mathematical expression');
    }

    // Simple recursive descent parser for basic arithmetic
    return this.parseExpression(expr);
  }

  private parseExpression(expr: string): number {
    let index = 0;

    const parseNumber = (): number => {
      let numStr = '';
      while (index < expr.length && (/\d|\./).test(expr[index])) {
        numStr += expr[index];
        index++;
      }
      const num = parseFloat(numStr);
      if (isNaN(num)) throw new Error('Invalid number');
      return num;
    };

    const parseFactor = (): number => {
      if (expr[index] === '(') {
        index++; // skip '('
        const result = this.parseExpression(expr);
        if (expr[index] !== ')') throw new Error('Missing closing parenthesis');
        index++; // skip ')'
        return result;
      }
      return parseNumber();
    };

    const parseTerm = (): number => {
      let result = parseFactor();
      while (index < expr.length && (expr[index] === '*' || expr[index] === '/')) {
        const op = expr[index];
        index++;
        const next = parseFactor();
        if (op === '*') result *= next;
        else if (op === '/' && next !== 0) result /= next;
        else throw new Error('Division by zero');
      }
      return result;
    };

    let result = parseTerm();
    while (index < expr.length && (expr[index] === '+' || expr[index] === '-')) {
      const op = expr[index];
      index++;
      const next = parseTerm();
      if (op === '+') result += next;
      else result -= next;
    }

    if (index < expr.length) throw new Error('Invalid expression');
    return result;
  }

  // Clear caches
  clearCache(): void {
    this.ruleCache.clear();
    this.executionCache.clear();
  }
}

// Export singleton instance
export const ruleEngine = new RuleEngine();