import type {
  BusinessRule,
  RuleExecutionContext,
  RuleExecutionResult,
} from './types';

// IMPORTANT: This file is imported by client components.
// Do NOT import Prisma or any server-only modules here.
// Provide a browser-safe RuleEngine that operates on in-memory rules only.

export class RuleEngine {
  private rules: BusinessRule[] = [];

  // No automatic DB loading in the browser
  async loadRules(rules: BusinessRule[] = []): Promise<void> {
    this.rules = Array.isArray(rules) ? rules : [];
  }

  async executeRules(context: RuleExecutionContext): Promise<RuleExecutionResult[]> {
    // Minimal client-side implementation:
    // - Iterate active rules and produce a simple calculation for demo purposes
    // - Any advanced/DB-backed execution should be done via server APIs
    const results: RuleExecutionResult[] = [];

    for (const rule of this.rules) {
      if (rule && rule.isActive) {
        const amount = 0; // No client-side DB access; real calc should be server-side
        results.push({
          ruleId: rule.id,
          amount,
          breakdown: [],
          metadata: {
            ruleType: rule.type,
            category: rule.category,
            executedOn: 'client',
          },
        });
      }
    }

    return results;
  }
}

// Export a singleton for convenience (client-safe)
export const ruleEngine = new RuleEngine();

export type {
  BusinessRule,
  RuleExecutionContext,
  RuleExecutionResult,
} from './types';