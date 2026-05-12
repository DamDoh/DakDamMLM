// Commission Microservice - MLM Business Logic Engine
// Handles all commission calculations, payouts, and financial operations

import { db, DatabaseUtils } from '../shared/database';
import {
  ServiceErrorHandler,
  ResponseUtils,
  ValidationUtils,
  PerformanceUtils,
  roundToDecimal
} from '../shared/utils';
import type { Member, Commission } from '../shared/types';
import { eventBus, EventTypes, DomainEventCreators } from '../shared/event-bus';

// Commission calculation rules
const COMMISSION_RULES = {
  binary: {
    rate: 0.10, // 10% of weaker leg
    minPV: 50, // Minimum PV for eligibility
  },
  matching: {
    levels: 5,
    baseRate: 0.05, // 5% base rate
  },
  stockist: {
    rates: {
      'District': 0.02,   // 2%
      'Provincial': 0.04, // 4%
      'Regional': 0.06,   // 6%
      'Commune': 0.03,    // 3%
    },
  },
  caps: {
    'Member': 500,
    'Bronze': 1000,
    'Silver': 2500,
    'Gold': 5000,
    'Diamond': 10000,
    'Super Diamond': 12000,
    'Half STAR': 15000,
    'STAR': 20000,
    'Supervisor': 20000,
    'Manager': 25000,
    'Director': 30000,
    'President': 35000,
    'Chairman': 50000,
    'Blue Diamond': 15000,
    'Black Diamond': 20000,
    'Emerald': 18000,
    'Blue Emerald': 22000,
    'Elite': 25000,
    'Crown': 40000,
    'Double Diamond': 15000,
    'Expired': 0,
  },
  inactivity: {
    compressionDays: 90,
  },
};

export interface CommissionCycle {
  id: string;
  startDate: string;
  endDate: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalCommissions: number;
  totalPayout: number;
  memberCount: number;
  createdAt: string;
}

export interface CommissionResult {
  memberId: string;
  binaryBonus: number;
  matchingBonus: number;
  stockistBonus: number;
  rankBonus: number;
  totalCommission: number;
  calculations: {
    leftVolume: number;
    rightVolume: number;
    weakerLegVolume: number;
    binaryRate: number;
    rankMultiplier: number;
  };
}

class CommissionEngine {
  private volumeCache = new Map<string, number>();

  // Main commission calculation cycle
  async runCommissionCycle(): Promise<CommissionCycle> {
    const timerId = PerformanceUtils.startTimer('runCommissionCycle');
    const cycleId = `cycle-${Date.now()}`;

    try {
      console.log(`Commission: Starting cycle ${cycleId}`);

      // Get all active members
      const allMembersData = await db.user.findMany({
        where: { active: true }
      });

      const allMembers = new Map<string, Member>();
      allMembersData.forEach(member => {
        allMembers.set(member.id, {
          id: member.id,
          memberId: member.memberId || '',
          firstName: member.firstName,
          surname: member.surname,
          fullName: member.fullName,
          email: member.email,
          avatarUrl: member.avatarUrl || '/images/default-avatar.png',
          rank: member.rank as any,
          storeOwnerLevel: member.storeOwnerLevel as any,
          accountType: 'Distributor',
          pv: member.pv,
          pvDate: member.pvDate?.toString() || undefined,
          teamSize: (member.teamSize as any) || { left: 0, right: 0, total: 0 },
          joinDate: member.createdAt.toISOString(),
          sponsorId: member.sponsorId,
          placementParentId: member.placementParentId,
          position: member.position as any,
          children: (member.children as any) || { left: null, right: null },
          active: member.active,
          phoneNumber: member.phoneNumber,
          lastActivityDate: member.lastActivityDate?.toString() || undefined,
          isAdmin: member.isAdmin,
          addresses: (member.addresses as any) || [],
        } as Member);
      });

      // Calculate sponsor relationships
      const directlySponsoredMap = new Map<string, string[]>();
      allMembers.forEach(member => {
        if (member.sponsorId && allMembers.has(member.sponsorId)) {
          if (!directlySponsoredMap.has(member.sponsorId)) {
            directlySponsoredMap.set(member.sponsorId, []);
          }
          directlySponsoredMap.get(member.sponsorId)!.push(member.id);
        }
      });

      // Process rank advancements
      const rankUpBonuses = await this.processRankAdvancements(allMembers, directlySponsoredMap, cycleId);

      // Process binary and stockist commissions
      const commissionResults = new Map<string, CommissionResult>();
      let totalPayout = 0;
      let memberCount = 0;

      for (const member of allMembers.values()) {
        const result = await this.calculateMemberCommissions(member, allMembers, cycleId);
        if (result) {
          commissionResults.set(member.id, result);
          totalPayout += result.totalCommission;
          memberCount++;
        }
      }

      // Process matching bonuses
      const matchingBonuses = await this.processMatchingBonuses(commissionResults, allMembers, cycleId);

      // Save all commissions to database
      await this.saveCommissionsToDatabase([...rankUpBonuses, ...matchingBonuses]);

      const duration = PerformanceUtils.endTimer(timerId);
      console.log(`Commission: Cycle ${cycleId} completed in ${duration}ms - ${memberCount} members, $${totalPayout} total payout`);

      // Publish cycle completion event
      await eventBus.publish(DomainEventCreators.commissionCalculated('system', cycleId, totalPayout, 'cycle'));

      return {
        id: cycleId,
        startDate: new Date(Date.now() - duration).toISOString(),
        endDate: new Date().toISOString(),
        status: 'completed',
        totalCommissions: rankUpBonuses.length + matchingBonuses.length,
        totalPayout,
        memberCount,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      PerformanceUtils.endTimer(timerId);
      console.error('Commission cycle failed:', error);
      throw ServiceErrorHandler.createError('COMMISSION_ERROR', 'Commission cycle failed');
    }
  }

  // Calculate all commissions for a single member
  private async calculateMemberCommissions(
    member: Member,
    allMembers: Map<string, Member>,
    cycleId: string
  ): Promise<CommissionResult | null> {
    const startTime = Date.now();

    try {
      // Check eligibility
      if (!member.active || member.accountType !== 'Distributor' || member.pv < COMMISSION_RULES.binary.minPV) {
        return null;
      }

      const result: CommissionResult = {
        memberId: member.id,
        binaryBonus: 0,
        matchingBonus: 0,
        stockistBonus: 0,
        rankBonus: 0,
        totalCommission: 0,
        calculations: {
          leftVolume: 0,
          rightVolume: 0,
          weakerLegVolume: 0,
          binaryRate: COMMISSION_RULES.binary.rate,
          rankMultiplier: this.getRankMultiplier(member.rank),
        },
      };

      // Calculate binary bonus
      const binaryBonus = await this.calculateBinaryBonus(member, allMembers, cycleId);
      if (binaryBonus) {
        result.binaryBonus = binaryBonus.amount;
        result.calculations.leftVolume = binaryBonus.calculations.leftVolume;
        result.calculations.rightVolume = binaryBonus.calculations.rightVolume;
        result.calculations.weakerLegVolume = binaryBonus.calculations.weakerLegVolume;
      }

      // Calculate stockist bonus
      const stockistBonus = await this.calculateStockistBonus(member, cycleId);
      if (stockistBonus) {
        result.stockistBonus = stockistBonus.amount;
      }

      // Calculate total commission
      result.totalCommission = result.binaryBonus + result.matchingBonus + result.stockistBonus + result.rankBonus;

      // Log audit trail
      await this.logCommissionAudit({
        memberId: member.id,
        calculationType: 'member_total',
        cycleId,
        inputs: {
          binaryBonus: result.binaryBonus,
          stockistBonus: result.stockistBonus,
          rankBonus: result.rankBonus,
        },
        result: result.totalCommission,
        duration: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      console.error(`Failed to calculate commissions for member ${member.id}:`, error);
      return null;
    }
  }

  // Calculate binary bonus for a member
  private async calculateBinaryBonus(
    member: Member,
    allMembers: Map<string, Member>,
    cycleId: string
  ): Promise<{ amount: number; calculations: any } | null> {
    try {
      const leftVolume = await this.getLegVolume(member.children.left, allMembers);
      const rightVolume = await this.getLegVolume(member.children.right, allMembers);

      const weakerLegVolume = Math.min(leftVolume, rightVolume);

      if (weakerLegVolume <= 0) {
        return null;
      }

      const potentialCommission = roundToDecimal(weakerLegVolume * COMMISSION_RULES.binary.rate);
      const maxPayout = COMMISSION_RULES.caps[member.rank] || 0;
      const commissionAmount = roundToDecimal(Math.min(potentialCommission, maxPayout));

      if (commissionAmount <= 0) {
        return null;
      }

      return {
        amount: commissionAmount,
        calculations: {
          leftVolume,
          rightVolume,
          weakerLegVolume,
          binaryRate: COMMISSION_RULES.binary.rate,
          rank: member.rank,
          maxPayout,
        },
      };
    } catch (error) {
      console.error(`Failed to calculate binary bonus for ${member.id}:`, error);
      return null;
    }
  }

  // Calculate stockist bonus for a member
  private async calculateStockistBonus(
    member: Member,
    cycleId: string
  ): Promise<{ amount: number } | null> {
    try {
      if (!member.active || !member.storeOwnerLevel || member.pv <= 0) {
        return null;
      }

      const rate = COMMISSION_RULES.stockist.rates[member.storeOwnerLevel];
      if (!rate) {
        return null;
      }

      const commissionAmount = roundToDecimal(member.pv * rate);

      if (commissionAmount <= 0) {
        return null;
      }

      return { amount: commissionAmount };
    } catch (error) {
      console.error(`Failed to calculate stockist bonus for ${member.id}:`, error);
      return null;
    }
  }

  // Process matching bonuses for all eligible uplines
  private async processMatchingBonuses(
    commissionResults: Map<string, CommissionResult>,
    allMembers: Map<string, Member>,
    cycleId: string
  ): Promise<Commission[]> {
    const matchingBonuses: Commission[] = [];

    try {
      for (const [memberId, result] of commissionResults.entries()) {
        if (result.binaryBonus > 0) {
          const member = allMembers.get(memberId);
          if (member) {
            const bonuses = await this.calculateMatchingBonus(member, result.binaryBonus, allMembers, cycleId);
            matchingBonuses.push(...bonuses);
          }
        }
      }

      return matchingBonuses;
    } catch (error) {
      console.error('Failed to process matching bonuses:', error);
      return [];
    }
  }

  // Calculate matching bonus for a single member
  private async calculateMatchingBonus(
    member: Member,
    commissionAmount: number,
    allMembers: Map<string, Member>,
    cycleId: string
  ): Promise<Commission[]> {
    const bonuses: Commission[] = [];
    let currentId = member.sponsorId;
    let level = 1;

    while (currentId && level <= COMMISSION_RULES.matching.levels) {
      const upline = allMembers.get(currentId);

      if (upline && upline.active && upline.accountType === 'Distributor' && upline.pv >= COMMISSION_RULES.binary.minPV) {
        const matchRate = roundToDecimal(COMMISSION_RULES.matching.baseRate / level);
        const bonusAmount = roundToDecimal(commissionAmount * matchRate);

        if (bonusAmount > 0) {
          const bonus: Commission = {
            id: `MATCH-${upline.id}-${member.id}-${level}-${Date.now()}`,
            userId: upline.id,
            date: new Date().toISOString(),
            type: `Level ${level} Matching Bonus`,
            status: 'Paid',
            amount: bonusAmount,
          };

          bonuses.push(bonus);

          // Log audit trail
          await this.logCommissionAudit({
            memberId: upline.id,
            calculationType: 'matching',
            cycleId,
            inputs: {
              sourceMemberId: member.id,
              sourceCommission: commissionAmount,
              level,
              matchRate,
            },
            result: bonusAmount,
            duration: 0,
          });
        }
      }

      currentId = upline?.sponsorId ?? null;
      level++;
    }

    return bonuses;
  }

  // Process rank advancements
  private async processRankAdvancements(
    allMembers: Map<string, Member>,
    directlySponsoredMap: Map<string, string[]>,
    cycleId: string
  ): Promise<Commission[]> {
    const rankUpBonuses: Commission[] = [];

    try {
      for (const member of allMembers.values()) {
        const directRecruits = directlySponsoredMap.get(member.id)?.length || 0;
        const rankUpBonus = await this.checkRankAdvancement(member, directRecruits, allMembers, cycleId);

        if (rankUpBonus) {
          rankUpBonuses.push(rankUpBonus);
        }
      }

      return rankUpBonuses;
    } catch (error) {
      console.error('Failed to process rank advancements:', error);
      return [];
    }
  }

  // Check if member qualifies for rank advancement
  private async checkRankAdvancement(
    member: Member,
    directRecruits: number,
    allMembers: Map<string, Member>,
    cycleId: string
  ): Promise<Commission | null> {
    try {
      // Define rank requirements (simplified version)
      const rankRequirements = [
        { rank: 'Bronze', personalPV: 1000, groupPV: 3000, directRecruits: 2, bonus: 100 },
        { rank: 'Silver', personalPV: 2500, groupPV: 7500, directRecruits: 5, bonus: 250 },
        { rank: 'Gold', personalPV: 5000, groupPV: 15000, directRecruits: 10, bonus: 500 },
        { rank: 'Diamond', personalPV: 25000, groupPV: 75000, directRecruits: 50, bonus: 1000 },
      ];

      const currentRankIndex = this.getRankIndex(member.rank);

      for (let i = rankRequirements.length - 1; i >= 0; i--) {
        const requirement = rankRequirements[i];
        const requirementRankIndex = this.getRankIndex(requirement.rank);

        if (requirementRankIndex > currentRankIndex) {
          const groupPV = await this.calculateGroupPV(member.id, allMembers);

          if (
            member.pv >= requirement.personalPV &&
            groupPV >= requirement.groupPV &&
            directRecruits >= requirement.directRecruits
          ) {
            // Update member rank
            await db.user.update({
              where: { id: member.id },
              data: { rank: requirement.rank }
            });

            const bonusCommission: Commission = {
              id: `RANK-${member.id}-${requirement.rank}-${Date.now()}`,
              userId: member.id,
              date: new Date().toISOString(),
              type: `Rank Achievement: ${requirement.rank}`,
              status: 'Paid',
              amount: requirement.bonus,
            };

            // Publish rank advancement event
            await eventBus.publish(DomainEventCreators.rankAdvanced(member.id, requirement.rank, requirement.bonus));

            return bonusCommission;
          }
        }
      }

      return null;
    } catch (error) {
      console.error(`Failed to check rank advancement for ${member.id}:`, error);
      return null;
    }
  }

  // Calculate group PV for a member
  private async calculateGroupPV(memberId: string, allMembers: Map<string, Member>): Promise<number> {
    const cacheKey = `groupPV-${memberId}`;
    const cached = this.volumeCache.get(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    const member = allMembers.get(memberId);
    if (!member) return 0;

    let groupPV = 0;
    const queue: string[] = [];
    const visited = new Set<string>();

    if (member.children.left) {
      queue.push(member.children.left);
      visited.add(member.children.left);
    }
    if (member.children.right) {
      queue.push(member.children.right);
      visited.add(member.children.right);
    }

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentMember = allMembers.get(currentId);

      if (currentMember) {
        groupPV += currentMember.pv;

        if (currentMember.children.left && !visited.has(currentMember.children.left)) {
          queue.push(currentMember.children.left);
          visited.add(currentMember.children.left);
        }
        if (currentMember.children.right && !visited.has(currentMember.children.right)) {
          queue.push(currentMember.children.right);
          visited.add(currentMember.children.right);
        }
      }
    }

    this.volumeCache.set(cacheKey, groupPV);
    return groupPV;
  }

  // Get leg volume for binary calculation
  private async getLegVolume(memberId: string | null, allMembers: Map<string, Member>): Promise<number> {
    if (!memberId) return 0;

    const cacheKey = `legVolume-${memberId}`;
    const cached = this.volumeCache.get(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    let totalVolume = 0;
    const queue = [memberId];
    const visited = new Set<string>();
    visited.add(memberId);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const member = allMembers.get(currentId);

      if (member) {
        totalVolume += member.pv;

        if (member.children.left && !visited.has(member.children.left)) {
          queue.push(member.children.left);
          visited.add(member.children.left);
        }
        if (member.children.right && !visited.has(member.children.right)) {
          queue.push(member.children.right);
          visited.add(member.children.right);
        }
      }
    }

    this.volumeCache.set(cacheKey, totalVolume);
    return totalVolume;
  }

  // Helper methods
  private getRankMultiplier(rank: string): number {
    const multipliers: Record<string, number> = {
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

  private getRankIndex(rank: string): number {
    const ranks = [
      'Member', 'Bronze', 'Silver', 'Gold', 'Diamond', 'Super Diamond',
      'Half STAR', 'STAR', 'Supervisor', 'Manager', 'Director',
      'President', 'Chairman', 'Blue Diamond', 'Black Diamond',
      'Emerald', 'Blue Emerald', 'Elite', 'Crown', 'Double Diamond', 'Expired'
    ];

    return ranks.indexOf(rank);
  }

  // Save commissions to database
  private async saveCommissionsToDatabase(commissions: Commission[]): Promise<void> {
    if (commissions.length === 0) return;

    try {
      await DatabaseUtils.batchInsert(
        commissions,
        100,
        async (batch: Commission[]) => {
          const prismaCommissions = batch.map(c => ({
            id: c.id,
            userId: c.userId,
            date: new Date(c.date),
            type: c.type,
            status: c.status,
            amount: c.amount,
          }));

          await db.commission.createMany({
            data: prismaCommissions,
            skipDuplicates: true,
          });
        }
      );

      console.log(`Commission: Saved ${commissions.length} commissions to database`);
    } catch (error) {
      console.error('Failed to save commissions to database:', error);
      throw ServiceErrorHandler.createError('DATABASE_ERROR', 'Failed to save commissions');
    }
  }

  // Audit logging
  private async logCommissionAudit(audit: {
    memberId: string;
    calculationType: string;
    cycleId: string;
    inputs: Record<string, any>;
    result: number;
    duration: number;
  }): Promise<void> {
    console.log(`Commission Audit [${audit.calculationType}]: Member ${audit.memberId}, Result: $${audit.result}, Duration: ${audit.duration}ms`);
  }

  // Health check
  async healthCheck(): Promise<{ status: string; cacheSize: number; timestamp: string }> {
    try {
      await db.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        cacheSize: this.volumeCache.size,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        cacheSize: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Export singleton instance
let commissionEngineInstance: CommissionEngine | null = null;

function getCommissionEngine(): CommissionEngine {
  if (!commissionEngineInstance) {
    commissionEngineInstance = new CommissionEngine();
  }
  return commissionEngineInstance;
}

// Server actions for API routes
export async function runCommissionCycleServer(): Promise<CommissionCycle> {
  try {
    const engine = getCommissionEngine();
    return await engine.runCommissionCycle();
  } catch (error) {
    console.error('Failed to run commission cycle:', error);
    throw error;
  }
}

export async function getCommissionHistoryServer(memberId: string, limit: number = 50): Promise<Commission[]> {
  try {
    const commissions = await db.commission.findMany({
      where: { userId: memberId },
      orderBy: { date: 'desc' },
      take: limit,
    });

    return commissions.map(c => ({
      id: c.id,
      userId: c.userId,
      date: c.date.toISOString(),
      type: c.type,
      status: c.status as 'Paid' | 'Pending' | 'Failed',
      amount: c.amount,
    }));
  } catch (error) {
    console.error('Failed to get commission history:', error);
    return [];
  }
}

export async function getTotalCommissionsServer(memberId: string): Promise<number> {
  try {
    const result = await db.commission.aggregate({
      where: { userId: memberId },
      _sum: { amount: true },
    });

    return Number(result._sum.amount) || 0;
  } catch (error) {
    console.error('Failed to get total commissions:', error);
    return 0;
  }
}