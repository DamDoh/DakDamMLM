import { Commission, CommissionPayout, CommissionBonus, CommissionRule } from '../../../shared/types';

// Custom Jest matchers for domain-specific validations
expect.extend({
  toBeValidCommission(commission: any) {
    const pass = (
      commission &&
      typeof commission.id === 'string' &&
      typeof commission.userId === 'string' &&
      typeof commission.orderId === 'string' &&
      typeof commission.amount === 'number' &&
      commission.amount > 0 &&
      ['DIRECT', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'LEVEL_5', 'UNILEVEL', 'BINARY', 'MATRIX', 'GENERATIONAL', 'PERFORMANCE', 'LOYALTY', 'LEADERSHIP', 'TRAVEL', 'CAR', 'HOUSE'].includes(commission.type) &&
      typeof commission.level === 'number' &&
      commission.level >= 1 &&
      ['PENDING', 'APPROVED', 'PAID', 'CANCELLED', 'HELD', 'LOCKED'].includes(commission.status)
    );

    return {
      message: () => `Expected ${JSON.stringify(commission)} to be a valid commission`,
      pass,
    };
  },

  toBeValidCommissionPayout(payout: any) {
    const pass = (
      payout &&
      typeof payout.id === 'string' &&
      typeof payout.userId === 'string' &&
      typeof payout.amount === 'number' &&
      payout.amount >= 50 && payout.amount <= 50000 &&
      ['BANK_TRANSFER', 'PAYPAL', 'CHECK', 'WIRE_TRANSFER', 'CRYPTO', 'GIFT_CARD'].includes(payout.method) &&
      ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'].includes(payout.status) &&
      typeof payout.fees === 'number' &&
      typeof payout.netAmount === 'number' &&
      payout.netAmount > 0
    );

    return {
      message: () => `Expected ${JSON.stringify(payout)} to be a valid commission payout`,
      pass,
    };
  },

  toBeValidCommissionBonus(bonus: any) {
    const pass = (
      bonus &&
      typeof bonus.id === 'string' &&
      typeof bonus.userId === 'string' &&
      typeof bonus.amount === 'number' &&
      bonus.amount > 0 &&
      ['FAST_START', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'RANK_ADVANCEMENT', 'RECRUITMENT', 'TEAM_BUILDING', 'BREAKAWAY'].includes(bonus.type) &&
      typeof bonus.period === 'string' &&
      /^\d{4}-\d{2}$/.test(bonus.period) // YYYY-MM format
    );

    return {
      message: () => `Expected ${JSON.stringify(bonus)} to be a valid commission bonus`,
      pass,
    };
  },

  toBeValidCommissionRule(rule: any) {
    const pass = (
      rule &&
      typeof rule.id === 'string' &&
      typeof rule.name === 'string' &&
      rule.name.length > 0 &&
      ['DIRECT', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'LEVEL_5', 'UNILEVEL', 'BINARY', 'MATRIX', 'GENERATIONAL', 'PERFORMANCE', 'LOYALTY', 'LEADERSHIP', 'TRAVEL', 'CAR', 'HOUSE'].includes(rule.type) &&
      typeof rule.level === 'number' &&
      rule.level >= 1 && rule.level <= 10 &&
      typeof rule.percentage === 'number' &&
      rule.percentage >= 0 && rule.percentage <= 100 &&
      typeof rule.minAmount === 'number' &&
      rule.minAmount >= 0 &&
      typeof rule.maxAmount === 'number' &&
      rule.maxAmount > rule.minAmount &&
      typeof rule.isActive === 'boolean'
    );

    return {
      message: () => `Expected ${JSON.stringify(rule)} to be a valid commission rule`,
      pass,
    };
  },

  toHaveValidCommissionAnalytics(analytics: any) {
    const pass = (
      analytics &&
      typeof analytics.totalCommissions === 'number' &&
      analytics.totalCommissions >= 0 &&
      typeof analytics.totalAmount === 'number' &&
      analytics.totalAmount >= 0 &&
      typeof analytics.paidCommissions === 'number' &&
      analytics.paidCommissions >= 0 &&
      typeof analytics.paidAmount === 'number' &&
      analytics.paidAmount >= 0 &&
      typeof analytics.pendingCommissions === 'number' &&
      analytics.pendingCommissions >= 0 &&
      typeof analytics.pendingAmount === 'number' &&
      analytics.pendingAmount >= 0 &&
      analytics.commissionByType &&
      typeof analytics.commissionByType === 'object' &&
      analytics.commissionByLevel &&
      typeof analytics.commissionByLevel === 'object' &&
      Array.isArray(analytics.topEarners)
    );

    return {
      message: () => `Expected ${JSON.stringify(analytics)} to have valid commission analytics structure`,
      pass,
    };
  },

  toHaveValidPayoutAnalytics(analytics: any) {
    const pass = (
      analytics &&
      typeof analytics.totalPayouts === 'number' &&
      analytics.totalPayouts >= 0 &&
      typeof analytics.totalAmount === 'number' &&
      analytics.totalAmount >= 0 &&
      typeof analytics.successfulPayouts === 'number' &&
      analytics.successfulPayouts >= 0 &&
      typeof analytics.failedPayouts === 'number' &&
      analytics.failedPayouts >= 0 &&
      analytics.payoutByMethod &&
      typeof analytics.payoutByMethod === 'object' &&
      Array.isArray(analytics.monthlyTrends)
    );

    return {
      message: () => `Expected ${JSON.stringify(analytics)} to have valid payout analytics structure`,
      pass,
    };
  },

  toHaveValidBonusAnalytics(analytics: any) {
    const pass = (
      analytics &&
      typeof analytics.totalBonuses === 'number' &&
      analytics.totalBonuses >= 0 &&
      typeof analytics.totalAmount === 'number' &&
      analytics.totalAmount >= 0 &&
      analytics.bonusesByType &&
      typeof analytics.bonusesByType === 'object' &&
      Array.isArray(analytics.topPerformers)
    );

    return {
      message: () => `Expected ${JSON.stringify(analytics)} to have valid bonus analytics structure`,
      pass,
    };
  },

  toHaveValidPaginationStructure(result: any) {
    const pass = (
      result &&
      result.data &&
      Array.isArray(result.data) &&
      result.pagination &&
      typeof result.pagination.page === 'number' &&
      typeof result.pagination.limit === 'number' &&
      typeof result.pagination.total === 'number' &&
      typeof result.pagination.totalPages === 'number' &&
      typeof result.pagination.hasNext === 'boolean' &&
      typeof result.pagination.hasPrev === 'boolean'
    );

    return {
      message: () => `Expected ${JSON.stringify(result)} to have valid pagination structure`,
      pass,
    };
  },

  toHaveValidApiResponseStructure(response: any) {
    const pass = (
      response &&
      typeof response.success === 'boolean' &&
      typeof response.timestamp === 'string' &&
      typeof response.requestId === 'string' &&
      (response.success ? response.data !== undefined : response.error !== undefined)
    );

    return {
      message: () => `Expected ${JSON.stringify(response)} to have valid API response structure`,
      pass,
    };
  },
});

// Type declarations for TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidCommission(): R;
      toBeValidCommissionPayout(): R;
      toBeValidCommissionBonus(): R;
      toBeValidCommissionRule(): R;
      toHaveValidCommissionAnalytics(): R;
      toHaveValidPayoutAnalytics(): R;
      toHaveValidBonusAnalytics(): R;
      toHaveValidPaginationStructure(): R;
      toHaveValidApiResponseStructure(): R;
    }
  }
}

export {};