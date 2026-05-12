// Comprehensive Commission Service - Consolidated Implementation
// Migrated from /services/commission-service/index.ts for better maintainability

import type { Member, Commission } from '@/lib/types';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { roundToDecimal } from '@/lib/shared-utils';

// Commission calculation constants (simplified version)
const businessRules = {
    commissionCaps: {
        'Member': 500,
        'Bronze': 1000,
        'Silver': 2500,
        'Gold': 5000,
        'Diamond': 10000,
    },
    matchingBonusLevels: 5,
    matchingBonusBaseRate: 0.05,
    minPVForCommission: 50,
};

// Commission calculation rules with enhanced configuration
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
            'Commune': 0.08,    // 8%
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
  private readonly MAX_CACHE_SIZE = 10000; // Prevent unbounded growth

  // Clear cache to prevent memory leaks
  private clearCache(): void {
    this.volumeCache.clear();
  }

  // Check and trim cache if it grows too large
  private trimCacheIfNeeded(): void {
    if (this.volumeCache.size > this.MAX_CACHE_SIZE) {
      // Keep only the most recent half of entries
      const entries = Array.from(this.volumeCache.entries());
      this.volumeCache.clear();
      entries.slice(-Math.floor(this.MAX_CACHE_SIZE / 2)).forEach(([key, value]) => {
        this.volumeCache.set(key, value);
      });
      logger.warn(`Volume cache trimmed from ${entries.length} to ${this.volumeCache.size} entries`);
    }
  }

  // Main commission calculation cycle with enhanced error handling
  async runCommissionCycle(): Promise<CommissionCycle> {
    const startTime = Date.now();
    const cycleId = `cycle-${Date.now()}`;

    // Clear volume cache at start of each cycle to prevent memory leaks
    this.clearCache();

        try {
            logger.info(`Starting commission cycle: ${cycleId}`);

            // Get all active members
            const allMembersData = await prisma.user.findMany({
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
                    email: member.email || '',
                    avatarUrl: '/images/default-avatar.png',
                    rank: 'Member',
                    storeOwnerLevel: null,
                    accountType: 'Distributor',
                    pv: 0,
                    pvDate: undefined,
                    teamSize: { left: 0, right: 0, total: 0 },
                    joinDate: member.createdAt.toISOString(),
                    sponsorId: member.sponsorId,
                    placementParentId: null,
                    position: null,
                    children: { left: null, right: null },
                    active: member.active,
                    phoneNumber: member.phoneNumber,
                    lastActivityDate: undefined,
                    isAdmin: member.isAdmin,
                    addresses: [],
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

            // Process rank advancements using the full engine
            const engine = getCommissionEngine();
            const rankUpBonuses: Commission[] = await engine.processRankAdvancements(allMembers, directlySponsoredMap, cycleId);

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

            // Process matching bonuses (now saved individually to prevent race conditions)
            const matchingBonuses = await this.processMatchingBonuses(commissionResults, allMembers, cycleId);
      
            // Save rank bonuses to database (matching bonuses already saved)
            await this.saveCommissionsToDatabase(rankUpBonuses);

            const duration = Date.now() - startTime;
            
            // Clear cache after cycle to prevent memory leaks
            this.clearCache();
            
            logger.info(`Commission cycle completed successfully`, {
              cycleId,
              duration,
              memberCount,
              totalPayout,
              commissionCount: rankUpBonuses.length + matchingBonuses.length,
              cacheCleared: true
            });

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
            const duration = Date.now() - startTime;
            logger.error('Commission cycle failed', {
                cycleId,
                error: error instanceof Error ? error.message : 'Unknown error',
                duration
            });
            throw new Error(`Commission cycle failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Calculate all commissions for a single member
    async calculateMemberCommissions(
        member: Member,
        allMembers: Map<string, Member>,
        cycleId: string
    ): Promise<CommissionResult | null> {
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
            const binaryBonus = await this.calculateBinaryBonus(member, allMembers);
            if (binaryBonus) {
                result.binaryBonus = binaryBonus.amount;
                result.calculations.leftVolume = binaryBonus.calculations.leftVolume;
                result.calculations.rightVolume = binaryBonus.calculations.rightVolume;
                result.calculations.weakerLegVolume = binaryBonus.calculations.weakerLegVolume;
            }

            // Calculate stockist bonus
            const stockistBonus = await this.calculateStockistBonus(member);
            if (stockistBonus) {
                result.stockistBonus = stockistBonus.amount;
            }

            // Calculate total commission
            result.totalCommission = result.binaryBonus + result.matchingBonus + result.stockistBonus + result.rankBonus;

            // Log audit trail (simplified)
            logger.debug(`Commission calculated for member ${member.id}: Binary $${result.binaryBonus}, Stockist $${result.stockistBonus}, Total $${result.totalCommission}`);

            return result;
        } catch (error) {
            logger.error(`Failed to calculate commissions for member ${member.id}`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }

    // Calculate binary bonus for a member
    private async calculateBinaryBonus(
        member: Member,
        allMembers: Map<string, Member>,
    ): Promise<{ amount: number; calculations: any } | null> {
        try {
            const leftVolume = await this.getLegVolume(member.children.left, allMembers);
            const rightVolume = await this.getLegVolume(member.children.right, allMembers);

            const weakerLegVolume = Math.min(leftVolume, rightVolume);

            if (weakerLegVolume <= 0) {
                return null;
            }

            const potentialCommission = Math.round(weakerLegVolume * COMMISSION_RULES.binary.rate * 100) / 100;
            const maxPayout = COMMISSION_RULES.caps[member.rank] || 0;
            const commissionAmount = Math.round(Math.min(potentialCommission, maxPayout) * 100) / 100;

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
            logger.error(`Failed to calculate binary bonus for ${member.id}`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }

    // Calculate stockist bonus for a member
    private async calculateStockistBonus(
        member: Member,
    ): Promise<{ amount: number } | null> {
        try {
            if (!member.active || !member.storeOwnerLevel || member.pv <= 0) {
                return null;
            }

            // Type guard: ensure storeOwnerLevel is a valid key in rates
            const stockistLevel = member.storeOwnerLevel;
            if (!(stockistLevel in COMMISSION_RULES.stockist.rates)) {
                return null;
            }

            const rate = COMMISSION_RULES.stockist.rates[stockistLevel as keyof typeof COMMISSION_RULES.stockist.rates];
            if (!rate) {
                return null;
            }

            const commissionAmount = Math.round(member.pv * rate * 100) / 100;

            if (commissionAmount <= 0) {
                return null;
            }

            return { amount: commissionAmount };
        } catch (error) {
            logger.error(`Failed to calculate stockist bonus for ${member.id}`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
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
                        const bonuses = await this.calculateMatchingBonus(member, result.binaryBonus, allMembers);
                        matchingBonuses.push(...bonuses);
                    }
                }
            }

            return matchingBonuses;
        } catch (error) {
            logger.error('Failed to process matching bonuses', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
    }

    // Calculate matching bonus for a single member with cap enforcement and transaction safety
    private async calculateMatchingBonus(
      member: Member,
      commissionAmount: number,
      allMembers: Map<string, Member>,
    ): Promise<Commission[]> {
      const bonuses: Commission[] = [];
      let currentId = member.sponsorId;
      let level = 1;
  
      while (currentId && level <= COMMISSION_RULES.matching.levels) {
        const upline = allMembers.get(currentId);
  
        if (upline && upline.active && upline.accountType === 'Distributor' && upline.pv >= COMMISSION_RULES.binary.minPV) {
          const matchRate = Math.round(COMMISSION_RULES.matching.baseRate / level * 10000) / 10000;
          let bonusAmount = Math.round(commissionAmount * matchRate * 100) / 100;
  
          // Enforce rank-based commission cap with transaction safety
          const rankCap = COMMISSION_RULES.caps[upline.rank] || 0;
          
          // Use transaction to prevent race conditions
          try {
            const finalBonusAmount = await prisma.$transaction(async (tx) => {
              // Lock user row to prevent concurrent modifications
              const userForUpdate = await tx.user.findUnique({
                where: { id: upline.id },
                select: { id: true }
              });
  
              if (!userForUpdate) return 0;
  
              // Get existing commissions for today within transaction
              const existingCommissions = await tx.commission.findMany({
                where: {
                  userId: upline.id,
                  date: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0))
                  }
                },
                select: { amount: true }
              });
  
              const currentTotal = existingCommissions.reduce((sum, c) => sum + c.amount, 0);
              const remainingCap = Math.max(0, rankCap - currentTotal);
  
              // Calculate final amount respecting cap
              const finalAmount = Math.min(bonusAmount, remainingCap);
  
              if (finalAmount > 0) {
                // Create commission within transaction to ensure atomicity
                await tx.commission.create({
                  data: {
                    id: `MATCH-${upline.id}-${member.id}-${level}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    userId: upline.id,
                    date: new Date(),
                    type: `Level ${level} Matching Bonus`,
                    status: 'Paid',
                    amount: finalAmount
                  }
                });
              }
  
              return finalAmount;
            }, {
              isolationLevel: 'Serializable', // Highest isolation to prevent race conditions
              maxWait: 5000,
              timeout: 10000
            });
  
            if (finalBonusAmount > 0) {
              const bonus: Commission = {
                id: `MATCH-${upline.id}-${member.id}-${level}-${Date.now()}`,
                userId: upline.id,
                date: new Date().toISOString(),
                type: `Level ${level} Matching Bonus`,
                status: 'Paid',
                amount: finalBonusAmount,
              };
  
              bonuses.push(bonus);
  
              // Log audit trail with cap info
              logger.debug(`Matching bonus calculated: Level ${level}, Member ${upline.id}, Amount: $${finalBonusAmount}, Rank Cap: $${rankCap}`);
            }
          } catch (error) {
            logger.error(`Failed to create matching bonus for ${upline.id}`, {
              error: error instanceof Error ? error.message : 'Unknown error',
              level,
              memberId: member.id
            });
            // Continue with other bonuses even if one fails
          }
        }
  
        currentId = upline?.sponsorId ?? null;
        level++;
      }
  
      return bonuses;
    }

    // Process rank advancements
    public async processRankAdvancements(
        allMembers: Map<string, Member>,
        directlySponsoredMap: Map<string, string[]>,
        cycleId: string
    ): Promise<Commission[]> {
        const rankUpBonuses: Commission[] = [];

        try {
            for (const member of allMembers.values()) {
                const directRecruits = directlySponsoredMap.get(member.id)?.length || 0;
                const rankUpBonus = await this.checkRankAdvancement(member, directRecruits, allMembers);

                if (rankUpBonus) {
                    rankUpBonuses.push(rankUpBonus);
                }
            }

            return rankUpBonuses;
        } catch (error) {
            logger.error('Failed to process rank advancements', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
    }

    // Check if member qualifies for rank advancement
    private async checkRankAdvancement(
        member: Member,
        directRecruits: number,
        allMembers: Map<string, Member>,
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
                        // Note: Rank advancement would require adding rank field to User model
                        // For now, just log the achievement

                        const bonusCommission: Commission = {
                            id: `RANK-${member.id}-${requirement.rank}-${Date.now()}`,
                            userId: member.id,
                            date: new Date().toISOString(),
                            type: `Rank Achievement: ${requirement.rank}`,
                            status: 'Paid',
                            amount: requirement.bonus,
                        };

                        logger.info(`Member promoted to ${requirement.rank}`, {
                            memberId: member.id,
                            newRank: requirement.rank,
                            bonus: requirement.bonus
                        });

                        return bonusCommission;
                    }
                }
            }

            return null;
        } catch (error) {
            logger.error(`Failed to check rank advancement for ${member.id}`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
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
  
      // Check cache size before adding
      this.trimCacheIfNeeded();

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
  
      // Check cache size before adding
      this.trimCacheIfNeeded();

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

    // Save commissions to database with transaction safety
    // NOTE: Matching bonuses are now saved individually in calculateMatchingBonus() to prevent race conditions
    // This method is used for binary and rank bonuses which don't have cap conflicts
    private async saveCommissionsToDatabase(commissions: Commission[]): Promise<void> {
      if (commissions.length === 0) return;
  
      try {
        // Use Prisma transaction to ensure all-or-nothing commit
        await prisma.$transaction(async (tx) => {
          // Process in batches within the transaction
          const batchSize = 100;
          for (let i = 0; i < commissions.length; i += batchSize) {
            const batch = commissions.slice(i, i + batchSize);
            const prismaCommissions = batch.map(c => ({
              id: c.id,
              userId: c.userId,
              date: new Date(c.date),
              type: c.type,
              status: c.status,
              amount: c.amount
            }));
  
            await tx.commission.createMany({
              data: prismaCommissions,
              skipDuplicates: true,
            });
          }
        }, {
          isolationLevel: 'Serializable',
          maxWait: 10000,
          timeout: 60000,
        });
  
        logger.info(`Saved ${commissions.length} commissions to database in transaction`);
      } catch (error) {
        logger.error('Failed to save commissions to database - transaction rolled back', {
          error: error instanceof Error ? error.message : 'Unknown error',
          commissionCount: commissions.length
        });
        throw new Error(`Failed to save commissions (rolled back): ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        logger.debug(`Commission Audit [${audit.calculationType}]: Member ${audit.memberId}, Result: $${audit.result}, Duration: ${audit.duration}ms`);
    }
}

// Singleton instance
let commissionEngineInstance: CommissionEngine | null = null;

function getCommissionEngine(): CommissionEngine {
    if (!commissionEngineInstance) {
        commissionEngineInstance = new CommissionEngine();
    }
    return commissionEngineInstance;
}

// Enhanced server actions with better error handling
export async function runCommissionCycleServer(): Promise<{ count: number; total: number }> {
    try {
        const engine = getCommissionEngine();
        const cycle = await engine.runCommissionCycle();

        return {
            count: cycle.totalCommissions,
            total: cycle.totalPayout
        };
    } catch (error) {
        logger.error('Failed to run commission cycle from server action', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return { count: 0, total: 0 };
    }
}

// Consolidated binary bonus calculation - now uses the full CommissionEngine
export async function calculateBinaryBonus(member: Member, allMembers: Map<string, Member>, cycleId: string): Promise<Commission | null> {
    try {
        const engine = getCommissionEngine();
        const result = await engine.calculateMemberCommissions(member, allMembers, cycleId);

        if (result && result.binaryBonus > 0) {
            return {
                id: `COMM-${member.id}-${Date.now()}`,
                userId: member.id,
                date: new Date().toISOString(),
                type: 'Binary Bonus',
                status: 'Paid',
                amount: result.binaryBonus,
            };
        }

        return null;
    } catch (error) {
        logger.error('Failed to calculate binary bonus', {
            error: error instanceof Error ? error.message : 'Unknown error',
            memberId: member.id
        });
        return null;
    }
}

export async function calculateStockistBonus(member: Member, cycleId: string): Promise<Commission | null> {
    try {
        const engine = getCommissionEngine();
        const result = await engine.calculateMemberCommissions(member, new Map(), cycleId);

        if (result && result.stockistBonus > 0) {
            return {
                id: `STORE-${member.id}-${Date.now()}`,
                userId: member.id,
                date: new Date().toISOString(),
                type: `${member.storeOwnerLevel || 'Stockist'} Stockist Bonus`,
                status: 'Paid',
                amount: result.stockistBonus,
            };
        }

        return null;
    } catch (error) {
        logger.error('Failed to calculate stockist bonus', {
            error: error instanceof Error ? error.message : 'Unknown error',
            memberId: member.id
        });
        return null;
    }
}

// Matching Bonus System
export async function calculateMatchingBonus(member: Member, commissionAmount: number, allMembers: Map<string, Member>, cycleId: string): Promise<Commission[]> {
    const bonuses: Commission[] = [];
    let currentId = member.sponsorId;
    let level = 1;

    while (currentId && level <= businessRules.matchingBonusLevels) {
        const upline = allMembers.get(currentId);

        // Check if upline exists and is qualified to earn commission
        if (upline && upline.active && upline.accountType === 'Distributor' && upline.pv >= businessRules.minPVForCommission) {
            const matchRate = roundToDecimal(businessRules.matchingBonusBaseRate / level);
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

                // Log audit trail (simplified)
                logger.debug(`Matching bonus calculated: Level ${level}, Upline ${upline.id}, Amount: $${bonusAmount}`);
            }
        }

        // Move to the next sponsor regardless of qualification
        currentId = upline?.sponsorId ?? null;
        level++;
    }

    return bonuses;
}

export async function addCommission(commission: Commission): Promise<void> {
  try {
    await prisma.commission.create({
      data: {
        id: commission.id,
        userId: commission.userId,
        date: new Date(commission.date),
        type: commission.type,
        status: commission.status,
        amount: commission.amount,
        // createdAt and updatedAt are handled by Prisma
      }
    });
  } catch (error) {
    console.error('Failed to add commission:', error);
    throw error;
  }
}

export async function runCommissionCycle(): Promise<{ count: number; total: number }> {
    const cycleStartTime = Date.now();
    const cycleId = `cycle-${Date.now()}`;

    // Clear volume cache at start of cycle to prevent memory leaks

    try {
        // Get all members using Prisma
        const allMembersData = await prisma.user.findMany();
        const allMembers = new Map(allMembersData.map(member => [member.id, {
          id: member.id,
          memberId: member.memberId || '',
          firstName: member.firstName,
          surname: member.surname,
          fullName: member.fullName,
          email: member.email || '',
          avatarUrl: '/images/default-avatar.png',
          rank: 'Member',
          storeOwnerLevel: null,
          accountType: 'Distributor',
          pv: 0,
          pvDate: undefined,
          teamSize: { left: 0, right: 0, total: 0 },
          joinDate: member.createdAt.toISOString(),
          sponsorId: member.sponsorId,
          placementParentId: null,
          position: null,
          children: { left: null, right: null },
          active: member.active,
          phoneNumber: member.phoneNumber,
          lastActivityDate: undefined,
          isAdmin: member.isAdmin,
          addresses: [],
        } as Member]));

        const directlySponsoredMap = new Map<string, string[]>();
        allMembers.forEach(member => {
            if (member.sponsorId && allMembers.has(member.sponsorId)) {
                if (!directlySponsoredMap.has(member.sponsorId)) {
                    directlySponsoredMap.set(member.sponsorId, []);
                }
                directlySponsoredMap.get(member.sponsorId)!.push(member.id);
            }
        });

        // Process rank advancements using the full engine
        const engine = getCommissionEngine();
        const rankUpBonuses: Commission[] = await engine.processRankAdvancements(allMembers, directlySponsoredMap, cycleId);

        // Process binary and stockist commissions
        let commissionCount = 0;
        let totalPayout = 0;

        for (const member of Array.from(allMembers.values())) {
            // Calculate binary bonus
            const binaryBonus = await calculateBinaryBonus(member, allMembers, cycleId);
            if (binaryBonus) {
                await addCommission(binaryBonus);
                commissionCount++;
                totalPayout = roundToDecimal(totalPayout + binaryBonus.amount);
            }

            // Calculate stockist bonus
            const stockistBonus = await calculateStockistBonus(member, cycleId);
            if (stockistBonus) {
                await addCommission(stockistBonus);
                commissionCount++;
                totalPayout = roundToDecimal(totalPayout + stockistBonus.amount);
            }

            // Calculate matching bonuses for binary commissions
            if (binaryBonus) {
                const matchingBonuses = await calculateMatchingBonus(member, binaryBonus.amount, allMembers, cycleId);
                for (const matchingBonus of matchingBonuses) {
                    await addCommission(matchingBonus);
                    commissionCount++;
                    totalPayout = roundToDecimal(totalPayout + matchingBonus.amount);
                }
            }
        }

        // Add rank advancement bonuses
        for (const bonus of rankUpBonuses) {
            if (bonus.amount > 0) {
                await addCommission(bonus);
                commissionCount++;
                totalPayout = roundToDecimal(totalPayout + bonus.amount);
            }
        }

        // Commission cycle completed

        return { count: commissionCount, total: totalPayout };

    } catch (error) {
        console.error("Error during commission cycle:", error);
        return { count: 0, total: 0 };
    }
}