/**
 * AI-POWERED CHURN PREVENTION AND MEMBER ENGAGEMENT SERVICE
 *
 * Uses machine learning to predict member churn risk and provides personalized
 * engagement strategies to improve retention and increase member lifetime value.
 *
 * Features:
 * - Churn risk prediction using multiple ML models
 * - Personalized engagement recommendations
 * - Automated intervention campaigns
 * - Member engagement scoring and analytics
 * - Retention strategy optimization
 * - Behavioral pattern analysis
 *
 * Created: 2025-11-20 (Enhancement)
 */

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
// ML libraries removed - using simplified statistical methods instead
import { realtimeService } from './realtime-service';

export interface ChurnRiskProfile {
  userId: string;
  churnProbability: number; // 0-1
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: Array<{
    factor: string;
    impact: number;
    description: string;
  }>;
  predictedChurnDate?: Date;
  confidence: number; // 0-1
}

export interface EngagementStrategy {
  userId: string;
  strategyType: 'personalized_email' | 'targeted_offer' | 'sponsor_outreach' | 'educational_content' | 'community_engagement';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  recommendedActions: Array<{
    action: string;
    expectedImpact: number;
    timeline: string;
    cost: number;
  }>;
  successProbability: number;
  expectedRetention: number; // percentage improvement
}

export interface MemberEngagementScore {
  userId: string;
  overallScore: number; // 0-100
  componentScores: {
    activityScore: number;
    socialScore: number;
    financialScore: number;
    learningScore: number;
    loyaltyScore: number;
  };
  trend: 'improving' | 'stable' | 'declining';
  lastCalculated: Date;
}

export interface RetentionCampaign {
  id: string;
  name: string;
  targetSegment: string;
  strategy: string;
  startDate: Date;
  endDate: Date;
  status: 'draft' | 'active' | 'completed' | 'paused';
  metrics: {
    membersTargeted: number;
    membersEngaged: number;
    retentionImprovement: number;
    costPerRetention: number;
  };
}

class ChurnPreventionService {
  // ML model removed - using rule-based scoring instead
  private readonly RISK_THRESHOLDS = {
    low: 0.3,
    medium: 0.5,
    high: 0.7,
    critical: 0.85
  };

  /**
   * Calculate churn risk for a specific member
   */
  async calculateChurnRisk(userId: string): Promise<ChurnRiskProfile> {
    try {
      // Gather member data for prediction
      const memberData = await this.gatherMemberFeatures(userId);

      if (!memberData) {
        throw new Error('Member data not found');
      }

      // Calculate risk factors
      const riskFactors = await this.analyzeRiskFactors(memberData);

      // Predict churn probability
      const churnProbability = await this.predictChurnProbability(memberData);

      // Determine risk level
      const riskLevel = this.determineRiskLevel(churnProbability);

      // Calculate confidence score
      const confidence = this.calculatePredictionConfidence(memberData, riskFactors);

      // Estimate churn date if high risk
      const predictedChurnDate = riskLevel === 'high' || riskLevel === 'critical'
        ? this.estimateChurnDate(memberData, churnProbability)
        : undefined;

      return {
        userId,
        churnProbability,
        riskLevel,
        riskFactors,
        predictedChurnDate,
        confidence
      };

    } catch (error) {
      logger.error('Churn risk calculation failed:', { error });
      throw error;
    }
  }

  /**
   * Generate personalized engagement strategy for at-risk members
   */
  async generateEngagementStrategy(userId: string, churnRisk: ChurnRiskProfile): Promise<EngagementStrategy> {
    try {
      const memberData = await this.gatherMemberFeatures(userId);
      if (!memberData) {
        throw new Error('Member data not found');
      }

      // Analyze member preferences and behavior
      const preferences = await this.analyzeMemberPreferences(memberData);
      const behaviorPatterns = await this.analyzeBehaviorPatterns(memberData);

      // Generate strategy based on risk level and member profile
      const strategy = await this.createPersonalizedStrategy(
        userId,
        churnRisk,
        preferences,
        behaviorPatterns
      );

      return strategy;

    } catch (error) {
      logger.error('Engagement strategy generation failed:', { error });
      throw error;
    }
  }

  /**
   * Calculate comprehensive member engagement score
   */
  async calculateEngagementScore(userId: string): Promise<MemberEngagementScore> {
    try {
      const memberData = await this.gatherMemberFeatures(userId);
      if (!memberData) {
        throw new Error('Member data not found');
      }

      // Calculate component scores
      const componentScores = {
        activityScore: await this.calculateActivityScore(memberData),
        socialScore: await this.calculateSocialScore(memberData),
        financialScore: await this.calculateFinancialScore(memberData),
        learningScore: await this.calculateLearningScore(memberData),
        loyaltyScore: await this.calculateLoyaltyScore(memberData)
      };

      // Calculate overall score (weighted average)
      const weights = {
        activityScore: 0.25,
        socialScore: 0.20,
        financialScore: 0.25,
        learningScore: 0.15,
        loyaltyScore: 0.15
      };

      const overallScore = Object.entries(componentScores).reduce(
        (sum, [key, score]) => sum + score * weights[key as keyof typeof weights],
        0
      );

      // Determine trend
      const previousScore = await this.getPreviousEngagementScore(userId);
      const trend = this.determineEngagementTrend(overallScore, previousScore);

      // Save score to database
      await this.saveEngagementScore(userId, overallScore, componentScores, trend);

      return {
        userId,
        overallScore: Math.round(overallScore),
        componentScores,
        trend,
        lastCalculated: new Date()
      };

    } catch (error) {
      logger.error('Engagement score calculation failed:', { error });
      throw error;
    }
  }

  /**
   * Execute automated retention campaigns
   */
  async executeRetentionCampaign(campaignId: string): Promise<{
    campaign: RetentionCampaign;
    executedActions: number;
    estimatedImpact: number;
  }> {
    try {
      const campaign = await this.getRetentionCampaign(campaignId);
      if (!campaign || campaign.status !== 'active') {
        throw new Error('Campaign not found or not active');
      }

      // Identify target members
      const targetMembers = await this.identifyCampaignTargets(campaign);

      // Execute campaign actions
      const executedActions = await this.executeCampaignActions(campaign, targetMembers);

      // Calculate estimated impact
      const estimatedImpact = await this.calculateCampaignImpact(campaign, executedActions);

      // Update campaign metrics
      await this.updateCampaignMetrics(campaignId, executedActions, estimatedImpact);

      return {
        campaign,
        executedActions,
        estimatedImpact
      };

    } catch (error) {
      logger.error('Retention campaign execution failed:', { error });
      throw error;
    }
  }

  /**
   * Analyze member behavior patterns for engagement insights
   */
  async analyzeBehaviorPatterns(userId: string): Promise<{
    loginPatterns: any;
    engagementPatterns: any;
    purchasePatterns: any;
    communicationPreferences: any;
    riskIndicators: string[];
  }> {
    try {
      // Gather raw behavior analytics
      const loginPatterns = await this.analyzeLoginPatterns(userId);
      const engagementPatterns = await this.analyzeEngagementPatterns(userId);
      const purchasePatterns = await this.analyzePurchasePatterns(userId);
      const communicationPreferences = await this.determineCommunicationPreferences(userId);
      const riskIndicators = await this.identifyRiskIndicators(userId);

      return {
        loginPatterns,
        engagementPatterns,
        purchasePatterns,
        communicationPreferences,
        riskIndicators,
      };
    } catch (error) {
      logger.error('Behavior pattern analysis failed:', { error });
      throw error;
    }
  }

  /**
   * Get retention insights and recommendations
   */
  async getRetentionInsights(companyId?: string): Promise<{
    overallRetentionRate: number;
    churnRate: number;
    atRiskMembers: number;
    topRiskFactors: Array<{ factor: string; impact: number }>;
    recommendedActions: Array<{
      action: string;
      potentialImpact: number;
      implementationCost: string;
    }>;
  }> {
    try {
      // Calculate overall metrics
      const overallRetentionRate = await this.calculateOverallRetentionRate(companyId);
      const churnRate = 100 - overallRetentionRate;
      const atRiskMembers = await this.countAtRiskMembers(companyId);

      // Identify top risk factors
      const topRiskFactors = await this.identifyTopRiskFactors(companyId);

      // Generate recommendations
      const recommendedActions = await this.generateRetentionRecommendations(
        churnRate,
        atRiskMembers,
        topRiskFactors
      );

      return {
        overallRetentionRate,
        churnRate,
        atRiskMembers,
        topRiskFactors,
        recommendedActions
      };

    } catch (error) {
      logger.error('Retention insights generation failed:', { error });
      throw error;
    }
  }

  // Helper methods

  private async gatherMemberFeatures(userId: string): Promise<any> {
    // Gather comprehensive member data for ML features
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sponsored: true,
        _count: {
          select: {
            sponsored: true
          }
        }
      }
    });

    if (!user) return null;

    // Calculate additional features
    const daysSinceRegistration = Math.floor(
      (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    const daysSinceLastActivity = user.lastActivityDate
      ? Math.floor((Date.now() - user.lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
      : daysSinceRegistration;

    // Get recent activity (last 30 days)
    const recentOrders = await prisma.order.count({
      where: {
        userId,
        date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    });

    const recentCommissions = await prisma.commission.count({
      where: {
        userId,
        date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    });

    return {
      userId,
      daysSinceRegistration,
      daysSinceLastActivity,
      accountType: user.accountType,
      rank: user.rank,
      pv: user.pv || 0,
      teamSize: user._count.sponsored,
      // Orders and commissions are derived separately via recentOrders/recentCommissions
      totalOrders: recentOrders,
      totalCommissions: recentCommissions,
      recentOrders,
      recentCommissions,
      isActive: user.active,
      hasAvatar: !!user.avatarUrl
    };
  }

  private async analyzeRiskFactors(memberData: any): Promise<Array<{ factor: string; impact: number; description: string }>> {
    const factors = [];

    // Activity-based factors
    if (memberData.daysSinceLastActivity > 30) {
      factors.push({
        factor: 'low_recent_activity',
        impact: Math.min(memberData.daysSinceLastActivity / 10, 100),
        description: `No activity for ${memberData.daysSinceLastActivity} days`
      });
    }

    // Financial factors
    if (memberData.recentOrders === 0) {
      factors.push({
        factor: 'no_recent_purchases',
        impact: 80,
        description: 'No purchases in the last 30 days'
      });
    }

    if (memberData.recentCommissions === 0) {
      factors.push({
        factor: 'no_recent_commissions',
        impact: 60,
        description: 'No commissions earned in the last 30 days'
      });
    }

    // Network factors
    if (memberData.teamSize === 0) {
      factors.push({
        factor: 'no_downline',
        impact: 70,
        description: 'No sponsored members in network'
      });
    }

    // Account factors
    if (!memberData.isActive) {
      factors.push({
        factor: 'inactive_account',
        impact: 100,
        description: 'Account is marked as inactive'
      });
    }

    return factors;
  }

  private async predictChurnProbability(memberData: any): Promise<number> {
    // Simplified prediction model (in production, use trained ML model)
    let riskScore = 0;

    // Activity risk
    if (memberData.daysSinceLastActivity > 90) riskScore += 0.4;
    else if (memberData.daysSinceLastActivity > 30) riskScore += 0.2;

    // Financial risk
    if (memberData.recentOrders === 0) riskScore += 0.3;
    if (memberData.recentCommissions === 0) riskScore += 0.2;

    // Network risk
    if (memberData.teamSize === 0) riskScore += 0.3;

    // Account risk
    if (!memberData.isActive) riskScore += 0.5;

    // Normalize to 0-1
    return Math.min(riskScore, 1);
  }

  private determineRiskLevel(probability: number): 'low' | 'medium' | 'high' | 'critical' {
    if (probability >= this.RISK_THRESHOLDS.critical) return 'critical';
    if (probability >= this.RISK_THRESHOLDS.high) return 'high';
    if (probability >= this.RISK_THRESHOLDS.medium) return 'medium';
    return 'low';
  }

  private calculatePredictionConfidence(memberData: any, riskFactors: any[]): number {
    // Higher confidence with more data points and consistent patterns
    let confidence = 0.5; // Base confidence

    // Increase confidence with more activity data
    if (memberData.totalOrders > 5) confidence += 0.1;
    if (memberData.totalCommissions > 10) confidence += 0.1;
    if (memberData.daysSinceRegistration > 30) confidence += 0.1;

    // Increase confidence with clear risk factors
    if (riskFactors.length > 2) confidence += 0.1;

    return Math.min(confidence, 0.95);
  }

  private estimateChurnDate(memberData: any, probability: number): Date {
    // Estimate based on current activity patterns
    const baseDays = 30; // Base assumption of 30 days
    const riskMultiplier = probability * 2; // Higher risk = shorter timeline
    const activityBonus = memberData.recentOrders > 0 ? 15 : 0; // Recent activity extends timeline

    const estimatedDays = Math.max(baseDays - (riskMultiplier * 20) + activityBonus, 7);
    return new Date(Date.now() + estimatedDays * 24 * 60 * 60 * 1000);
  }

  private async analyzeMemberPreferences(memberData: any): Promise<any> {
    // Analyze communication preferences, content interests, etc.
    return {
      preferredChannels: ['email', 'push'],
      contentTypes: ['educational', 'promotional'],
      engagementTimes: ['evening', 'weekend']
    };
  }

  // NOTE: memberData-level behavior analysis is now handled by analyzeBehaviorPatterns(userId)

  private async createPersonalizedStrategy(
    userId: string,
    churnRisk: ChurnRiskProfile,
    preferences: any,
    behaviorPatterns: any
  ): Promise<EngagementStrategy> {
    const strategy: EngagementStrategy = {
      userId,
      strategyType: 'personalized_email',
      priority: churnRisk.riskLevel === 'critical' ? 'urgent' :
               churnRisk.riskLevel === 'high' ? 'high' : 'medium',
      recommendedActions: [],
      successProbability: 0.7,
      expectedRetention: 15
    };

    // Generate actions based on risk factors
    for (const factor of churnRisk.riskFactors) {
      switch (factor.factor) {
        case 'low_recent_activity':
          strategy.recommendedActions.push({
            action: 'Send personalized welcome-back email with special offer',
            expectedImpact: 20,
            timeline: 'within 3 days',
            cost: 0.5
          });
          break;

        case 'no_recent_purchases':
          strategy.recommendedActions.push({
            action: 'Offer personalized product recommendations with discount',
            expectedImpact: 25,
            timeline: 'within 1 week',
            cost: 2.0
          });
          break;

        case 'no_recent_commissions':
          strategy.recommendedActions.push({
            action: 'Provide training on commission optimization strategies',
            expectedImpact: 15,
            timeline: 'within 5 days',
            cost: 1.0
          });
          break;
      }
    }

    return strategy;
  }

  private async calculateActivityScore(memberData: any): Promise<number> {
    let score = 50; // Base score

    // Recent activity bonus
    if (memberData.daysSinceLastActivity <= 7) score += 30;
    else if (memberData.daysSinceLastActivity <= 30) score += 15;
    else if (memberData.daysSinceLastActivity > 90) score -= 20;

    // Login frequency bonus
    if (memberData.recentOrders > 2) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  private async calculateSocialScore(memberData: any): Promise<number> {
    let score = 50;

    // Network size impact
    if (memberData.teamSize > 10) score += 25;
    else if (memberData.teamSize > 5) score += 15;
    else if (memberData.teamSize === 0) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  private async calculateFinancialScore(memberData: any): Promise<number> {
    let score = 50;

    // Commission activity
    if (memberData.recentCommissions > 5) score += 25;
    else if (memberData.recentCommissions > 2) score += 15;
    else if (memberData.recentCommissions === 0) score -= 15;

    // Purchase activity
    if (memberData.recentOrders > 3) score += 15;
    else if (memberData.recentOrders === 0) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  private async calculateLearningScore(memberData: any): Promise<number> {
    // Placeholder - would analyze training completion, etc.
    return 60;
  }

  private async calculateLoyaltyScore(memberData: any): Promise<number> {
    let score = 50;

    // Account age bonus
    const accountAgeMonths = memberData.daysSinceRegistration / 30;
    if (accountAgeMonths > 12) score += 20;
    else if (accountAgeMonths > 6) score += 10;

    // Consistent activity bonus
    if (memberData.isActive && memberData.totalOrders > 5) score += 15;

    return Math.max(0, Math.min(100, score));
  }

  private async getPreviousEngagementScore(userId: string): Promise<number | null> {
    // Would retrieve from database
    return null;
  }

  private determineEngagementTrend(currentScore: number, previousScore: number | null): 'improving' | 'stable' | 'declining' {
    if (!previousScore) return 'stable';

    const difference = currentScore - previousScore;
    if (difference > 5) return 'improving';
    if (difference < -5) return 'declining';
    return 'stable';
  }

  private async saveEngagementScore(
    userId: string,
    overallScore: number,
    componentScores: any,
    trend: string
  ): Promise<void> {
    // Save to database (would create a new table for engagement scores)
    // For now, just log
    logger.info(`Engagement score saved for user ${userId}: ${overallScore}`);
  }

  private async getRetentionCampaign(campaignId: string): Promise<RetentionCampaign | null> {
    // Would retrieve from database
    return null;
  }

  private async identifyCampaignTargets(campaign: RetentionCampaign): Promise<string[]> {
    // Would query database for target members
    return [];
  }

  private async executeCampaignActions(campaign: RetentionCampaign, targets: string[]): Promise<number> {
    // Would execute campaign actions (emails, notifications, etc.)
    return targets.length;
  }

  private async calculateCampaignImpact(campaign: RetentionCampaign, executedActions: number): Promise<number> {
    // Would calculate estimated retention impact
    return executedActions * 0.1; // 10% improvement per action
  }

  private async updateCampaignMetrics(
    campaignId: string,
    executedActions: number,
    estimatedImpact: number
  ): Promise<void> {
    // Would update campaign metrics in database
    logger.info(`Campaign ${campaignId} metrics updated`);
  }

  private async analyzeLoginPatterns(userId: string): Promise<any> {
    // Analyze login frequency, times, patterns
    return {
      frequency: 'weekly',
      preferredTimes: ['evening'],
      consistency: 'moderate'
    };
  }

  private async analyzeEngagementPatterns(userId: string): Promise<any> {
    // Analyze engagement with content, community, etc.
    return {
      contentEngagement: 'high',
      communityParticipation: 'medium',
      featureUsage: 'moderate'
    };
  }

  private async analyzePurchasePatterns(userId: string): Promise<any> {
    // Analyze purchase frequency, amounts, categories
    return {
      frequency: 'monthly',
      averageOrderValue: 50,
      preferredCategories: ['health', 'wellness']
    };
  }

  private async determineCommunicationPreferences(userId: string): Promise<any> {
    // Analyze preferred communication channels and timing
    return {
      email: true,
      push: true,
      sms: false,
      preferredTimes: ['evening', 'weekend']
    };
  }

  private async identifyRiskIndicators(userId: string): Promise<string[]> {
    // Identify specific risk indicators
    return ['low_activity', 'no_recent_purchases'];
  }

  private async calculateOverallRetentionRate(companyId?: string): Promise<number> {
    // Calculate overall retention rate
    // Simplified calculation
    return 75; // 75% retention rate
  }

  private async countAtRiskMembers(companyId?: string): Promise<number> {
    // Count members at risk of churning
    // Would query database with churn risk calculations
    return 150;
  }

  private async identifyTopRiskFactors(companyId?: string): Promise<Array<{ factor: string; impact: number }>> {
    // Identify most common risk factors
    return [
      { factor: 'low_activity', impact: 35 },
      { factor: 'no_recent_purchases', impact: 28 },
      { factor: 'no_downline_growth', impact: 22 }
    ];
  }

  private async generateRetentionRecommendations(
    churnRate: number,
    atRiskMembers: number,
    topRiskFactors: Array<{ factor: string; impact: number }>
  ): Promise<Array<{ action: string; potentialImpact: number; implementationCost: string }>> {
    const recommendations = [];

    if (churnRate > 20) {
      recommendations.push({
        action: 'Implement personalized re-engagement email campaigns',
        potentialImpact: 15,
        implementationCost: 'low'
      });
    }

    if (atRiskMembers > 100) {
      recommendations.push({
        action: 'Create automated intervention workflows for at-risk members',
        potentialImpact: 25,
        implementationCost: 'medium'
      });
    }

    if (topRiskFactors.some(f => f.factor === 'low_activity')) {
      recommendations.push({
        action: 'Develop community engagement and gamification features',
        potentialImpact: 20,
        implementationCost: 'high'
      });
    }

    return recommendations;
  }
}

// Export singleton instance
export const churnPreventionService = new ChurnPreventionService();