import type { Rank } from '@/lib/types';
import { ranks } from '@/lib/types';
import { prisma } from '@/lib/database';

// Decimal precision helper (consistent with server-actions)
function roundToDecimal(value: number, decimals: number = 2): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

interface PredictiveAnalytics {
  memberId: string;
  riskScore: number; // 0-100, higher = more likely to churn
  predictedVolume: number;
  confidence: number;
  recommendations: string[];
  nextBestActions: {
    action: string;
    expectedImpact: string;
    priority: 'high' | 'medium' | 'low';
  }[];
}

export class PredictiveService {
  constructor() {
    // No database parameter needed - using Prisma directly
  }

  async getPredictiveAnalytics(memberId: string): Promise<PredictiveAnalytics> {
    const member = await prisma.user.findUnique({
      where: {
        id: memberId,
        deleted: false
      }
    });

    if (!member) {
      throw new Error('Member not found');
    }

    // Calculate risk score based on multiple factors
    const riskScore = await this.calculateRiskScore(member);

    // Predict future volume
    const predictedVolume = await this.predictVolume(member);

    // Generate recommendations
    const recommendations = await this.generateRecommendations(member, riskScore);

    // Determine next best actions
    const nextBestActions = await this.getNextBestActions(member, riskScore);

    return {
      memberId,
      riskScore,
      predictedVolume,
      confidence: 0.85, // Based on model accuracy
      recommendations,
      nextBestActions
    };
  }

  async predictMemberCommission(memberId: string, monthsAhead: number = 3): Promise<{
    predictedMonthly: number[];
    confidence: number;
    factors: string[];
    breakdown: {
      binary: number[];
      matching: number[];
      stockist: number[];
      rank: number[];
    };
  }> {
    try {
      const member = await prisma.user.findUnique({
        where: {
          id: memberId,
          deleted: false
        }
      });

      if (!member) {
        throw new Error('Member not found');
      }

      // Get historical commission data (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const historicalCommissions = await prisma.commission.findMany({
        where: {
          userId: memberId,
          date: {
            gte: sixMonthsAgo
          }
        },
        orderBy: {
          date: 'desc'
        }
      });

      // Group commissions by month
      const monthlyTotals = this.groupCommissionsByMonth(historicalCommissions);

      // Calculate growth trends
      const growthRate = this.calculateCommissionGrowthRate(monthlyTotals);
      const avgCommission = monthlyTotals.length > 0 ?
        monthlyTotals.reduce((sum, month) => sum + month.total, 0) / monthlyTotals.length : 0;

      // Factor in current member metrics
      const teamSize = member.teamSize as { total?: number; left?: number; right?: number };
      const teamGrowth = (teamSize?.total || 0) * 0.02; // 2% monthly team growth assumption
      const pvGrowth = member.pv * 0.15; // 15% monthly PV growth assumption
      const rankMultiplier = this.getRankCommissionMultiplier(member.rank as Rank);

      // Generate predictions
      const predictions = [];
      const binaryPredictions = [];
      const matchingPredictions = [];
      const stockistPredictions = [];
      const rankPredictions = [];

      let currentBase = Math.max(avgCommission, 0); // Use actual average, or 0 if no history

      // For new members with no commission history, use a more conservative approach
      if (monthlyTotals.length === 0) {
        // Use member's current potential based on PV and team size
        currentBase = Math.max(member.pv * 0.05, 0); // 5% of PV as base commission estimate
      }

      // If currentBase is still 0, return zero predictions for new members
      if (currentBase === 0 && monthlyTotals.length === 0) {
        const zeroPredictions = Array(monthsAhead).fill(0);
        const result = {
          predictedMonthly: zeroPredictions,
          confidence: 0.1, // Very low confidence for new members with no data
          factors: ['New member with no commission history', 'No personal volume recorded'],
          breakdown: {
            binary: zeroPredictions,
            matching: zeroPredictions,
            stockist: zeroPredictions,
            rank: zeroPredictions,
          }
        };
        return result;
      }

      for (let i = 1; i <= monthsAhead; i++) {
        // Apply growth factors
        const monthMultiplier = Math.pow(1 + growthRate + teamGrowth + pvGrowth, i * 0.1);
        const rankAdjusted = currentBase * monthMultiplier * rankMultiplier;

        // Distribute across commission types (rough estimates)
        const binaryAmount = roundToDecimal(rankAdjusted * 0.6); // 60% binary
        const matchingAmount = roundToDecimal(rankAdjusted * 0.25); // 25% matching
        const stockistAmount = member.storeOwnerLevel ? roundToDecimal(rankAdjusted * 0.1) : 0; // 10% if stockist
        const rankAmount = roundToDecimal(rankAdjusted * 0.05); // 5% rank bonuses

        const totalMonthly = roundToDecimal(binaryAmount + matchingAmount + stockistAmount + rankAmount);

        predictions.push(totalMonthly);
        binaryPredictions.push(binaryAmount);
        matchingPredictions.push(matchingAmount);
        stockistPredictions.push(stockistAmount);
        rankPredictions.push(rankAmount);

        currentBase = totalMonthly; // Use prediction as base for next month
      }

      // Calculate confidence based on data quality
      const confidence = this.calculatePredictionConfidence(monthlyTotals, member);

      const factors = this.generatePredictionFactors({
        pv: member.pv,
        rank: member.rank,
        teamSize: member.teamSize,
        storeOwnerLevel: member.storeOwnerLevel || undefined
      }, growthRate, teamGrowth);

      const result = {
        predictedMonthly: predictions,
        confidence,
        factors,
        breakdown: {
          binary: binaryPredictions,
          matching: matchingPredictions,
          stockist: stockistPredictions,
          rank: rankPredictions,
        }
      };

      return result;
    } catch (error) {
      throw error;
    }
  }

  private groupCommissionsByMonth(commissions: any[]): Array<{month: string, total: number, count: number}> {
    const monthlyMap = new Map<string, {total: number, count: number}>();

    commissions.forEach(commission => {
      const date = new Date(commission.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { total: 0, count: 0 });
      }

      const monthData = monthlyMap.get(monthKey)!;
      monthData.total += commission.amount;
      monthData.count += 1;
    });

    return Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  private calculateCommissionGrowthRate(monthlyTotals: Array<{month: string, total: number, count: number}>): number {
    if (monthlyTotals.length < 2) return 0.05; // Default 5% growth

    const recent = monthlyTotals.slice(-3); // Last 3 months
    const earlier = monthlyTotals.slice(-6, -3); // Previous 3 months

    const recentAvg = recent.reduce((sum, m) => sum + m.total, 0) / recent.length;
    const earlierAvg = earlier.length > 0 ?
      earlier.reduce((sum, m) => sum + m.total, 0) / earlier.length : recentAvg;

    if (earlierAvg === 0) return 0.05;

    const growthRate = (recentAvg - earlierAvg) / earlierAvg;
    return Math.max(-0.1, Math.min(growthRate, 0.5)); // Bound between -10% and +50%
  }

  private getRankCommissionMultiplier(rank: Rank): number {
    const multipliers: Record<Rank, number> = {
      'Member': 1.0,
      'Bronze': 1.2,
      'Silver': 1.5,
      'Gold': 2.0,
      'Diamond': 3.0,
      'Super Diamond': 4.0,
      'Half STAR': 5.0,
      'STAR': 6.0,
      'Supervisor': 7.0,
      'Manager': 8.0,
      'Director': 10.0,
      'President': 12.0,
      'Chairman': 15.0,
      'Blue Diamond': 4.0,
      'Black Diamond': 5.0,
      'Emerald': 6.0,
      'Blue Emerald': 7.0,
      'Elite': 8.0,
      'Crown': 12.0,
      'Double Diamond': 4.0,
      'Expired': 0.5,
    };

    return multipliers[rank] || 1.0;
  }

  private calculatePredictionConfidence(
    monthlyTotals: Array<{month: string, total: number, count: number}>,
    member: { pv: number; active: boolean; rank: string; teamSize?: any }
  ): number {
    let confidence = 0.5; // Base confidence

    // Data quality factors
    if (monthlyTotals.length >= 6) confidence += 0.2; // Good historical data
    if (monthlyTotals.length >= 3) confidence += 0.1; // Decent data
    if (member.pv > 500) confidence += 0.1; // Strong PV
    const teamSize = member.teamSize;
    if ((teamSize?.total || 0) > 10) confidence += 0.1; // Good team size
    if (member.active) confidence += 0.1; // Active member

    // Rank factors
    const rankIndex = ranks.indexOf(member.rank as Rank);
    confidence += Math.min(rankIndex * 0.02, 0.1); // Higher rank = more predictable

    return Math.min(confidence, 0.95); // Max 95% confidence
  }

  private generatePredictionFactors(member: { pv: number; rank: string; teamSize?: any; storeOwnerLevel?: string }, growthRate: number, teamGrowth: number): string[] {
    const factors = [];

    if (growthRate > 0.1) factors.push('Strong historical growth trend');
    else if (growthRate > 0) factors.push('Moderate growth trend');
    else factors.push('Stable commission history');

    if (member.pv > 1000) factors.push('High personal volume');
    else if (member.pv > 500) factors.push('Good personal volume');

    const teamSize = member.teamSize;
    if ((teamSize?.total || 0) > 50) factors.push('Large team size');
    else if ((teamSize?.total || 0) > 10) factors.push('Growing team');

    if (teamGrowth > 0.05) factors.push('Team expansion opportunity');

    const rankIndex = ranks.indexOf(member.rank as Rank);
    if (rankIndex >= ranks.indexOf('Gold')) factors.push('High rank position');

    if (member.storeOwnerLevel) factors.push('Stockist bonus potential');

    return factors;
  }

  private async calculateRiskScore(member: { active: boolean; lastActivityDate?: Date | null; pv: number; teamSize?: any; createdAt: Date }): Promise<number> {
    let riskScore = 0;

    if (!member.active) riskScore += 40;
    else if (member.lastActivityDate) {
        const lastActivity = member.lastActivityDate.getTime();
        const daysSinceLastActivity = (Date.now() - lastActivity) / (1000 * 3600 * 24);
        if (daysSinceLastActivity > 30) riskScore += 20;
    }

    if (member.pv < 100) riskScore += 25;

    const teamSize = member.teamSize;
    if ((teamSize?.total || 0) < 3) riskScore += 15;

    const daysSinceJoin = (Date.now() - member.createdAt.getTime()) / (1000 * 3600 * 24);
    if (daysSinceJoin < 30) riskScore += 10;

    return Math.min(riskScore, 100);
  }

  private async predictVolume(member: { pv: number }): Promise<number> {
    const baseVolume = member.pv || 0;
    const growthRate = 0.1; // 10% monthly growth assumption

    return Math.round(baseVolume * (1 + growthRate));
  }

  private async generateRecommendations(member: { pv: number; teamSize?: any }, riskScore: number): Promise<string[]> {
    const recommendations: string[] = [];

    if (riskScore > 70) {
      recommendations.push('Schedule immediate coaching session');
      recommendations.push('Review compensation plan understanding');
    }

    const teamSize = member.teamSize;
    if ((teamSize?.total || 0) < 3) {
      recommendations.push('Focus on team building activities');
      recommendations.push('Attend leadership training');
    }

    if (member.pv < 100) {
      recommendations.push('Increase product knowledge');
      recommendations.push('Set personal volume goals');
    }

    return recommendations;
  }

  private async getNextBestActions(member: { teamSize?: any }, riskScore: number): Promise<PredictiveAnalytics['nextBestActions']> {
    const actions: PredictiveAnalytics['nextBestActions'] = [];

    if (riskScore > 60) {
      actions.push({
        action: 'Personal coaching session',
        expectedImpact: 'Reduce churn risk by 40%',
        priority: 'high'
      });
    }

    actions.push({
      action: 'Product training webinar',
      expectedImpact: 'Increase personal volume by 25%',
      priority: 'medium'
    });

    const teamSize = member.teamSize;
    if ((teamSize?.total || 0) > 0) {
      actions.push({
        action: 'Team building event',
        expectedImpact: 'Improve team retention by 30%',
        priority: 'medium'
      });
    }

    return actions;
  }
}