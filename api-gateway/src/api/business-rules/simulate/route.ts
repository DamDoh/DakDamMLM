import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { rateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { ApiResponseUtil, API_MESSAGES } from '@/lib/api-response';
import { prisma } from '@/lib/database';
import type { BusinessRule } from '@/lib/types';

/**
 * POST /api/business-rules/simulate
 * Simulate business rule changes without committing to database
 * Allows testing rule modifications before going live
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 30 });
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for rule simulation', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent')
      }, request);
      return rateLimitResult.response!;
    }

    // Authenticate and authorize admin access
    const authenticatedRequest = await requireAdmin(async (req) => {
      return NextResponse.json({ user: req.user });
    })(request);

    if (authenticatedRequest.status === 401 || authenticatedRequest.status === 403) {
      return authenticatedRequest;
    }

    const user = (authenticatedRequest as any).user;
    const body = await request.json();
    const { rule, testData } = body;

    // Validate required fields
    if (!rule) {
      return ApiResponseUtil.validationError([{
        field: 'rule',
        message: 'Rule definition is required for simulation'
      }]);
    }

    // Validate test data
    if (!testData || !testData.memberId) {
      return ApiResponseUtil.validationError([{
        field: 'testData',
        message: 'Test data with memberId is required'
      }]);
    }

    // Fetch member data for simulation
    const member = await prisma.user.findUnique({
      where: { id: testData.memberId }
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Test member not found' },
        { status: 404 }
      );
    }

    // Simulate rule execution
    const simulationResult = await simulateRuleExecution(rule, member, testData);

    logger.info('Rule simulation completed', {
      userId: user.id,
      ruleName: rule.name,
      testMemberId: testData.memberId,
      duration: Date.now() - startTime
    }, request);

    return ApiResponseUtil.success(simulationResult, 'Rule simulation completed successfully');

  } catch (error) {
    logger.error('Rule simulation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for')
    }, request);

    return ApiResponseUtil.error(API_MESSAGES.SERVER_ERROR);
  }
}

/**
 * Simulate rule execution without database changes
 */
async function simulateRuleExecution(
  rule: Partial<BusinessRule>,
  member: any,
  testData: any
): Promise<{
  passed: boolean;
  result: number;
  breakdown: Array<{ component: string; amount: number; description: string }>;
  warnings: string[];
  metadata: Record<string, any>;
}> {
  const warnings: string[] = [];
  const breakdown: Array<{ component: string; amount: number; description: string }> = [];
  let totalResult = 0;

  try {
    // Check conditions
    const conditionsPassed = await evaluateConditions(rule.conditions || [], member, testData);
    
    if (!conditionsPassed.passed) {
      return {
        passed: false,
        result: 0,
        breakdown: [],
        warnings: conditionsPassed.warnings,
        metadata: {
          failedConditions: conditionsPassed.failedConditions
        }
      };
    }

    warnings.push(...conditionsPassed.warnings);

    // Simulate calculation
    const calculation = rule.calculation as any;
    
    if (calculation?.type === 'percentage') {
      const baseAmount = testData.baseAmount || member.pv || 0;
      const rate = calculation.rate || 0;
      const amount = Math.round(baseAmount * rate * 100) / 100;
      
      breakdown.push({
        component: 'Percentage Calculation',
        amount,
        description: `${baseAmount} × ${rate * 100}% = ${amount}`
      });
      
      totalResult = amount;
    } else if (calculation?.type === 'fixed') {
      const amount = calculation.amount || 0;
      
      breakdown.push({
        component: 'Fixed Amount',
        amount,
        description: `Fixed bonus: ${amount}`
      });
      
      totalResult = amount;
    } else if (calculation?.type === 'tiered') {
      const baseAmount = testData.baseAmount || member.pv || 0;
      const tiers = calculation.tiers || [];
      
      let applicableTier = tiers[0];
      for (const tier of tiers) {
        if (baseAmount >= tier.min && (!tier.max || baseAmount <= tier.max)) {
          applicableTier = tier;
          break;
        }
      }
      
      if (applicableTier) {
        const amount = Math.round(baseAmount * applicableTier.rate * 100) / 100;
        breakdown.push({
          component: 'Tiered Calculation',
          amount,
          description: `${baseAmount} at ${applicableTier.rate * 100}% (tier ${applicableTier.min}-${applicableTier.max || '∞'})`
        });
        totalResult = amount;
      }
    }

    // Apply caps if defined
    if (calculation?.cap) {
      const cap = calculation.cap;
      if (totalResult > cap) {
        warnings.push(`Result capped from ${totalResult} to ${cap}`);
        breakdown.push({
          component: 'Cap Applied',
          amount: -(totalResult - cap),
          description: `Maximum cap: ${cap}`
        });
        totalResult = cap;
      }
    }

    return {
      passed: true,
      result: totalResult,
      breakdown,
      warnings,
      metadata: {
        ruleType: rule.type,
        calculationType: calculation?.type,
        memberPV: member.pv,
        memberRank: member.rank,
        testDataUsed: testData
      }
    };

  } catch (error) {
    logger.error('Rule simulation execution error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ruleName: rule.name
    });
    
    return {
      passed: false,
      result: 0,
      breakdown: [],
      warnings: [
        'Simulation error: ' + (error instanceof Error ? error.message : 'Unknown error')
      ],
      metadata: {}
    };
  }
}

/**
 * Evaluate rule conditions
 */
async function evaluateConditions(
  conditions: any[],
  member: any,
  testData: any
): Promise<{
  passed: boolean;
  warnings: string[];
  failedConditions: string[];
}> {
  const warnings: string[] = [];
  const failedConditions: string[] = [];

  if (!conditions || conditions.length === 0) {
    return { passed: true, warnings, failedConditions };
  }

  for (const condition of conditions) {
    const { field, operator, value } = condition;
    
    // Get field value from member or test data
    const fieldValue = testData[field] ?? member[field];
    
    let conditionMet = false;
    
    switch (operator) {
      case 'equals':
        conditionMet = fieldValue === value;
        break;
      case 'greaterThan':
        conditionMet = fieldValue > value;
        break;
      case 'lessThan':
        conditionMet = fieldValue < value;
        break;
      case 'greaterThanOrEqual':
        conditionMet = fieldValue >= value;
        break;
      case 'lessThanOrEqual':
        conditionMet = fieldValue <= value;
        break;
      case 'contains':
        conditionMet = String(fieldValue).includes(String(value));
        break;
      case 'in':
        conditionMet = Array.isArray(value) && value.includes(fieldValue);
        break;
      default:
        warnings.push(`Unknown operator: ${operator}`);
        conditionMet = false;
    }
    
    if (!conditionMet) {
      failedConditions.push(
        `${field} ${operator} ${value} (actual: ${fieldValue})`
      );
    }
  }

  return {
    passed: failedConditions.length === 0,
    warnings,
    failedConditions
  };
}