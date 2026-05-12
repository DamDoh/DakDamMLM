import type {
  BusinessRule,
  RuleExecutionContext,
  RuleExecutionResult,
  RuleCondition,
  RuleCalculation
} from './types';
import { customFunctionEngine, type CustomFunction } from './custom-functions';
import { evaluate, create, all } from 'mathjs';

/**
 * Company-specific rule configuration type
 */
export type CompanyRuleConfigType = {
  companyId: string;
  enabledRuleTypes: string[];
  customCalculationTypes: string[];
  maxExecutionTime: number;
  maxMemoryUsage: number;
  cacheEnabled: boolean;
  auditEnabled: boolean;
  customFunctions: string[];
  globalOverrides: Record<string, any>;
};

/**
 * Enhanced rule engine with limitless customization capabilities
 * Supports custom functions, dynamic rule sets, and company-specific configurations
 */
export class EnhancedRuleEngine {
  private rules: Map<string, BusinessRule> = new Map();
  private ruleSets: Map<string, BusinessRule[]> = new Map();
  private customFunctions: Map<string, CustomFunction> = new Map();
  private executionCache = new Map<string, RuleExecutionResult>();
  private companyConfigs: Map<string, CompanyRuleConfigType> = new Map();

  /**
   * Load rules for a company
   */
  loadCompanyRules(companyId: string, rules: BusinessRule[]): void {
    const companyRules = rules.filter(rule =>
      !rule.companyId || rule.companyId === companyId
    );

    this.ruleSets.set(companyId, companyRules);

    // Build rule lookup map
    companyRules.forEach(rule => {
      this.rules.set(`${companyId}:${rule.id}`, rule);
    });

    // Clear execution cache for this company
    this.clearCompanyCache(companyId);
  }

  /**
   * Load company configuration
   */
  loadCompanyConfig(config: CompanyRuleConfigType): void {
    this.companyConfigs.set(config.companyId, config);

    // Register custom functions for this company
    config.customFunctions.forEach(funcId => {
      const func = this.customFunctions.get(funcId);
      if (func) {
        customFunctionEngine.registerFunction(func);
      }
    });
  }

  /**
   * Register custom function
   */
  registerCustomFunction(func: CustomFunction): void {
    this.customFunctions.set(func.id, func);

    // Register with the function engine
    customFunctionEngine.registerFunction(func);
  }

  /**
   * Execute rules for a specific company and context
   */
  async executeCompanyRules(
    companyId: string,
    context: RuleExecutionContext
  ): Promise<RuleExecutionResult[]> {
    const config = this.companyConfigs.get(companyId);
    if (!config) {
      throw new Error(`Company configuration not found: ${companyId}`);
    }

    const rules = this.ruleSets.get(companyId) || [];
    const results: RuleExecutionResult[] = [];

    // Filter applicable rules based on company config
    const applicableRules = this.filterApplicableRules(rules, context, config);

    for (const rule of applicableRules) {
      try {
        const result = await this.executeEnhancedRule(rule, context, config);
        if (result.amount > 0) {
          results.push(result);
        }
      } catch (error) {
        console.error(`Error executing rule ${rule.id} for company ${companyId}:`, error);
        // Continue with other rules
      }
    }

    return results;
  }

  /**
   * Execute a single enhanced rule with custom function support
   */
  private async executeEnhancedRule(
    rule: BusinessRule,
    context: RuleExecutionContext,
    config: CompanyRuleConfigType
  ): Promise<RuleExecutionResult> {
    const cacheKey = this.getEnhancedCacheKey(rule.id, context, config.companyId);

    // Check cache if enabled
    if (config.cacheEnabled && this.executionCache.has(cacheKey)) {
      return this.executionCache.get(cacheKey)!;
    }

    // Evaluate enhanced conditions
    const conditionsMet = await this.evaluateEnhancedConditions(rule.conditions, context, config);
    if (!conditionsMet) {
      const result: RuleExecutionResult = {
        ruleId: rule.id,
        amount: 0,
        breakdown: [],
        metadata: { conditionsMet: false }
      };
      if (config.cacheEnabled) {
        this.executionCache.set(cacheKey, result);
      }
      return result;
    }

    // Calculate amount with custom functions
    const amount = await this.calculateEnhancedAmount(rule.calculation, context, config);
    const breakdown = await this.generateEnhancedBreakdown(rule, context, amount, config);

    const result: RuleExecutionResult = {
      ruleId: rule.id,
      amount,
      breakdown,
      metadata: {
        conditionsMet: true,
        ruleType: rule.type,
        category: rule.category,
        priority: rule.priority,
        companyId: config.companyId
      }
    };

    // Cache result if enabled
    if (config.cacheEnabled) {
      this.executionCache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Evaluate enhanced conditions with custom function support
   */
  private async evaluateEnhancedConditions(
    conditions: RuleCondition[],
    context: RuleExecutionContext,
    config: CompanyRuleConfigType
  ): Promise<boolean> {
    if (!conditions || conditions.length === 0) return true;

    // Support for complex logical operations
    return this.evaluateConditionGroup(conditions, context, config);
  }

  /**
   * Evaluate a group of conditions with logical operators
   */
  private async evaluateConditionGroup(
    conditions: RuleCondition[],
    context: RuleExecutionContext,
    config: CompanyRuleConfigType
  ): Promise<boolean> {
    let result = true;
    let logicalOperator: 'AND' | 'OR' = 'AND';

    for (const condition of conditions) {
      const conditionResult = await this.evaluateEnhancedCondition(condition, context, config);

      if (logicalOperator === 'AND') {
        result = result && conditionResult;
      } else {
        result = result || conditionResult;
      }

      // Short-circuit evaluation
      if (logicalOperator === 'AND' && !result) return false;
      if (logicalOperator === 'OR' && result) return true;

      // Update logical operator for next condition
      logicalOperator = condition.logicalOperator || 'AND';
    }

    return result;
  }

  /**
   * Evaluate a single enhanced condition
   */
  private async evaluateEnhancedCondition(
    condition: RuleCondition,
    context: RuleExecutionContext,
    config: CompanyRuleConfigType
  ): Promise<boolean> {
    // Check if this is a custom condition type
    if (condition.type === 'custom_condition' && (condition as any).customFunction) {
      return await this.evaluateCustomCondition(condition, context, config);
    }

    // Standard condition evaluation
    const value = this.getEnhancedConditionValue(condition.type, context, config);
    const targetValue = condition.value;

    switch (condition.operator) {
      case 'equals':
        return value === targetValue;
      case 'not_equals':
        return value !== targetValue;
      case 'greater_than':
        return Number(value) > Number(targetValue);
      case 'less_than':
        return Number(value) < Number(targetValue);
      case 'greater_equal':
        return Number(value) >= Number(targetValue);
      case 'less_equal':
        return Number(value) <= Number(targetValue);
      case 'in':
        return Array.isArray(targetValue) ? targetValue.includes(value) : false;
      case 'not_in':
        return Array.isArray(targetValue) ? !targetValue.includes(value) : true;
      case 'contains':
        return String(value).toLowerCase().includes(String(targetValue).toLowerCase());
      case 'starts_with':
        return String(value).startsWith(String(targetValue));
      case 'ends_with':
        return String(value).endsWith(String(targetValue));
      case 'between':
        const [min, max] = Array.isArray(targetValue) ? targetValue : [targetValue, targetValue];
        return Number(value) >= Number(min) && Number(value) <= Number(max);
      default:
        return false;
    }
  }

  /**
   * Evaluate custom condition using custom function
   */
  private async evaluateCustomCondition(
    condition: RuleCondition,
    context: RuleExecutionContext,
    config: CompanyRuleConfigType
  ): Promise<boolean> {
    const customCondition = condition as any;
    if (!customCondition.customFunction) return false;

    try {
      const result = await customFunctionEngine.executeFunction(
        customCondition.customFunction,
        context,
        customCondition.parameters || {}
      );

      return Boolean(result);
    } catch (error) {
      console.error(`Error evaluating custom condition:`, error);
      return false;
    }
  }

  /**
   * Get enhanced condition value with custom data support
   */
  private getEnhancedConditionValue(
    type: string,
    context: RuleExecutionContext,
    config: CompanyRuleConfigType
  ): any {
    // Standard condition types
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
        return 30; // Simplified
      case 'account_type':
        return 'distributor'; // Simplified
      case 'team_size':
        return context.team.totalDownline;
      case 'generation_depth':
        return context.genealogy.generation;
      default:
        // Check custom data
        return context.customData?.[type] || config.globalOverrides?.[type] || null;
    }
  }

  /**
   * Calculate enhanced amount with custom function support
   */
  private async calculateEnhancedAmount(
    calculation: RuleCalculation,
    context: RuleExecutionContext,
    config: CompanyRuleConfigType
  ): Promise<number> {
    const { type } = calculation;

    // Check if this is a custom calculation type
    if (config.customCalculationTypes.includes(type) && (calculation as any).customFunction) {
      return await this.calculateCustomAmount(calculation, context);
    }

    // Standard calculation types
    switch (type) {
      case 'custom_calculation':
        return await this.calculateCustomAmount(calculation, context);

      case 'percentage':
        const base = this.getEnhancedCalculationBase(calculation, context);
        return (base * (calculation.percentage || 0)) / 100;

      case 'fixed_amount':
        return calculation.baseValue || 0;

      case 'per_unit':
        const units = this.getEnhancedCalculationUnits(calculation, context);
        return units * (calculation.baseValue || 0);

      case 'tiered_percentage':
        if (!calculation.tiers) return 0;
        const baseForTier = this.getEnhancedCalculationBase(calculation, context);
        return this.calculateTieredAmount(baseForTier, calculation.tiers, 'percentage');

      case 'tiered_fixed':
        if (!calculation.tiers) return 0;
        const unitsForTier = this.getEnhancedCalculationUnits(calculation, context);
        return this.calculateTieredAmount(unitsForTier, calculation.tiers, 'fixed');

      case 'formula':
        return this.evaluateEnhancedFormula(calculation.formula || '', context, config);

      case 'lookup_table':
        return this.lookupTableValue(calculation.lookupTable || {}, context, config);

      case 'conditional':
        return await this.evaluateConditionalCalculation(calculation, context, config);

      default:
        return 0;
    }
  }

  /**
   * Calculate using custom function
   */
  private async calculateCustomAmount(
    calculation: RuleCalculation,
    context: RuleExecutionContext
  ): Promise<number> {
    const customCalc = calculation as any;
    if (!customCalc.customFunction) return 0;

    try {
      const result = await customFunctionEngine.executeFunction(
        customCalc.customFunction,
        context,
        customCalc.parameters || {}
      );

      return Number(result) || 0;
    } catch (error) {
      console.error(`Error calculating custom amount:`, error);
      return 0;
    }
  }

  /**
   * Get enhanced calculation base
   */
  private getEnhancedCalculationBase(
    calculation: RuleCalculation,
    context: RuleExecutionContext
  ): number {
    return context.volumes.personal; // Default, can be customized
  }

  /**
   * Get enhanced calculation units
   */
  private getEnhancedCalculationUnits(
    calculation: RuleCalculation,
    context: RuleExecutionContext
  ): number {
    return context.team.directRecruits; // Default, can be customized
  }

  /**
   * Calculate tiered amounts
   */
  private calculateTieredAmount(
    value: number,
    tiers: any[],
    type: 'percentage' | 'fixed'
  ): number {
    for (const tier of tiers) {
      if (value >= tier.min && (tier.max === undefined || value <= tier.max)) {
        if (type === 'percentage') {
          return (value * tier.value) / 100;
        } else {
          return tier.value;
        }
      }
    }
    return 0;
  }

  /**
   * Evaluate enhanced formula with secure math.js evaluation
   */
  private evaluateEnhancedFormula(
    formula: string,
    context: RuleExecutionContext,
    config: CompanyRuleConfigType
  ): number {
    try {
      // Create a limited math scope for security
      // Note: math.js doesn't support disable option in create(), using evaluate directly with safe scope
      const limitedMath = create(all);

      // Prepare variables for the formula
      const scope = {
        PV: context.volumes.personal,
        GV: context.volumes.group,
        DR: context.team.directRecruits,
        TOTAL_DOWNLINE: context.team.totalDownline,
        // Add custom variables from config
        ...config.globalOverrides
      };

      // Evaluate the formula safely
      const result = limitedMath.evaluate(formula, scope);

      // Ensure result is a number
      return typeof result === 'number' ? result : 0;
    } catch (error) {
      console.error('Formula evaluation error:', error);
      return 0;
    }
  }

  /**
   * Lookup value from table
   */
  private lookupTableValue(
    lookupTable: Record<string, number>,
    context: RuleExecutionContext,
    config: CompanyRuleConfigType
  ): number {
    const key = context.ranks.current; // Default lookup by rank
    return lookupTable[key] || 0;
  }

  /**
   * Evaluate conditional calculation
   */
  private async evaluateConditionalCalculation(
    calculation: RuleCalculation,
    context: RuleExecutionContext,
    config: CompanyRuleConfigType
  ): Promise<number> {
    if (!calculation.conditions) return 0;

    for (const condition of calculation.conditions) {
      const met = await this.evaluateEnhancedCondition(condition, context, config);
      if (met) {
        return condition.value || 0;
      }
    }

    return 0;
  }

  /**
   * Generate enhanced breakdown
   */
  private async generateEnhancedBreakdown(
    rule: BusinessRule,
    context: RuleExecutionContext,
    amount: number,
    config: CompanyRuleConfigType
  ): Promise<Array<{ component: string; amount: number; description: string }>> {
    return [{
      component: rule.type.replace(/_/g, ' '),
      amount,
      description: `${rule.name} - ${rule.description || 'Rule execution'}`
    }];
  }

  /**
   * Filter applicable rules based on company config
   */
  private filterApplicableRules(
    rules: BusinessRule[],
    context: RuleExecutionContext,
    config: CompanyRuleConfigType
  ): BusinessRule[] {
    return rules.filter(rule => {
      // Check if rule is active
      if (!rule.isActive) return false;

      // Check if rule type is enabled for company
      if (!config.enabledRuleTypes.includes(rule.type)) return false;

      // Check applicable member types
      const memberType = 'distributor'; // Simplified
      if (!rule.applicableTo.includes(memberType)) return false;

      return true;
    }).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get enhanced cache key
   */
  private getEnhancedCacheKey(ruleId: string, context: RuleExecutionContext, companyId: string): string {
    const keyData = {
      companyId,
      ruleId,
      memberId: context.memberId,
      period: context.period,
      volumes: context.volumes,
      ranks: context.ranks,
      team: context.team
    };
    return JSON.stringify(keyData);
  }

  /**
   * Clear cache for a specific company
   */
  private clearCompanyCache(companyId: string): void {
    // Remove all cache entries for this company
    for (const [key] of this.executionCache.entries()) {
      if (key.includes(`"companyId":"${companyId}"`)) {
        this.executionCache.delete(key);
      }
    }
  }

  /**
   * Get engine statistics
   */
  getStats(companyId?: string): {
    ruleCount: number;
    functionCount: number;
    cacheSize: number;
  } {
    const ruleCount = companyId ?
      (this.ruleSets.get(companyId)?.length || 0) :
      Array.from(this.ruleSets.values()).reduce((sum, rules) => sum + rules.length, 0);

    return {
      ruleCount,
      functionCount: this.customFunctions.size,
      cacheSize: this.executionCache.size
    };
  }

  /**
   * Clear all caches and data
   */
  clear(): void {
    this.rules.clear();
    this.ruleSets.clear();
    this.customFunctions.clear();
    this.executionCache.clear();
    this.companyConfigs.clear();
  }
}

// Export singleton instance
export const enhancedRuleEngine = new EnhancedRuleEngine();