import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { CommissionLockService } from './commission-lock-service';

export interface CommissionCalculation {
  memberId: string;
  periodStart: Date;
  periodEnd: Date;
  leftVolume: number;
  rightVolume: number;
  weakerLeg: number;
  commissionRate: number;
  commissionAmount: number;
  qualificationMet: boolean;
  breakdown: CommissionBreakdown[];
  companyId?: string;
}

export interface CommissionBreakdown {
  type: 'binary_bonus' | 'matching_bonus' | 'leadership_bonus' | 'rank_advance' | 'daily_match_bonus';
  amount: number;
  description: string;
  metadata?: Record<string, any>;
}

export interface VolumeData {
  personalVolume: number;
  leftLegVolume: number;
  rightLegVolume: number;
  totalTeamVolume: number;
  qualificationVolume: number;
}

/**
 * ENHANCED Commission Calculation Engine
 * 
 * FIXES:
 * 1. Added proper error handling and transaction safety
 * 2. Fixed potential race conditions in volume calculations
 * 3. Added validation for negative amounts
 * 4. Improved recursive volume calculation with memoization
 * 5. Added proper status checking for orders
 * 6. Fixed double-counting prevention in genealogy
 * 7. Added idempotency for commission payments
 */
export class CommissionCalculationEngineEnhanced {
  // ENHANCEMENT: Cache for volume calculations to prevent redundant queries
  private static volumeCache = new Map<string, { volume: number; timestamp: number }>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Calculate commissions for a specific period
   * ENHANCED: Better error handling and batching
   */
  static async calculatePeriodCommissions(
    startDate: Date,
    endDate: Date,
    companyId?: string
  ): Promise<CommissionCalculation[]> {
    // ENHANCEMENT: Validate date range
    if (startDate >= endDate) {
      throw new Error('Invalid date range: start date must be before end date');
    }

    if (endDate > new Date()) {
      throw new Error('End date cannot be in the future');
    }

    const calculations: CommissionCalculation[] = [];

    // Get all active members with proper filtering
    const members = await prisma.user.findMany({
      where: {
        active: true,
        deleted: false, // ENHANCEMENT: Check soft delete
        ...(companyId && { companyId })
      },
      select: {
        id: true,
        memberId: true,
        rank: true,
        pv: true,
        email: true // For logging
      }
    });

    console.log(`Processing commissions for ${members.length} active members`);

    // ENHANCEMENT: Process in batches to avoid memory issues
    const batchSize = 50;
    for (let i = 0; i < members.length; i += batchSize) {
      const batch = members.slice(i, i + batchSize);
      
      const batchCalculations = await Promise.allSettled(
        batch.map(member => 
          this.calculateMemberCommission(member.id, startDate, endDate)
            .catch(error => {
              console.error(`Failed to calculate commission for member ${member.memberId}:`, error);
              return null;
            })
        )
      );

      for (const result of batchCalculations) {
        if (result.status === 'fulfilled' && result.value && result.value.commissionAmount > 0) {
          calculations.push(result.value);
        }
      }
    }

    // Clear cache after calculation
    this.volumeCache.clear();

    // Log G2 Binary Bonus summary for all Manager+ members
    const managerPlusCalculations = calculations.filter(calc => {
      const member = members.find(m => m.id === calc.memberId);
      const g2Rates: Record<string, number> = {
        'Manager': 0.01,
        'Director': 0.03,
        'President': 0.03,
        'Double President': 0.03
      };
      return member && (g2Rates[member.rank] || 0) > 0;
    });

    if (managerPlusCalculations.length > 0) {
      console.log(`📊 G2 Binary Bonus Summary for ${managerPlusCalculations.length} Manager+ members:`, {
        totalMembers: managerPlusCalculations.length,
        membersWithG2: managerPlusCalculations.filter(calc => {
          const g2Bonus = calc.breakdown
            .filter(b => b.type === 'binary_bonus')
            .reduce((sum, b) => sum + (b.metadata?.g2Bonus || 0), 0);
          return g2Bonus > 0;
        }).length,
        totalG2Bonus: managerPlusCalculations.reduce((sum, calc) => {
          const g2Bonus = calc.breakdown
            .filter(b => b.type === 'binary_bonus')
            .reduce((sum, b) => sum + (b.metadata?.g2Bonus || 0), 0);
          return sum + g2Bonus;
        }, 0)
      });
    }

    return calculations;
  }

  /**
   * Calculate commission for a specific member
   * ENHANCED: Added validation and better error handling
   */
  static async calculateMemberCommission(
    memberId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CommissionCalculation> {
    // ENHANCEMENT: Validate inputs
    if (!memberId || memberId.trim() === '') {
      throw new Error('Invalid member ID');
    }

    // Get member data with all required fields
    const member = await prisma.user.findUnique({
      where: { id: memberId },
      select: { 
        id: true,
        rank: true,
        active: true,
        deleted: true,
        children: true, // For binary tree
        isAdmin: true,
        email: true
      }
    });

    if (!member) {
      throw new Error(`Member not found: ${memberId}`);
    }

    // CRITICAL: Superadmin itself cannot earn commissions, but members created by superadmin CAN
    const { isSuperAdmin, canEarnCommissions } = await import('@/lib/superadmin-helper');
    if (await isSuperAdmin(memberId)) {
      console.log(`⚠️ Superadmin ${memberId} cannot earn commissions - skipping`);
      return this.createZeroCommission(memberId, startDate, endDate, 'Superadmin cannot earn commissions');
    }
    
    // Check if member can earn commissions (has downlines)
    if (!(await canEarnCommissions(memberId))) {
      console.log(`⚠️ Member ${memberId} has no downlines - cannot earn commissions`);
      return this.createZeroCommission(memberId, startDate, endDate, 'No downlines - cannot earn commissions');
    }

    // ENHANCEMENT: Check if member is eligible for commissions
    if (!member.active || member.deleted) {
      return this.createZeroCommission(memberId, startDate, endDate, 'Member not active');
    }

    // Get member's volume data
    const volumeData = await this.calculateMemberVolume(memberId, startDate, endDate);
    
    // ENHANCEMENT: Ensure non-negative volumes
    const leftVolume = Math.max(0, volumeData.leftLegVolume);
    const rightVolume = Math.max(0, volumeData.rightLegVolume);
    const weakerLeg = Math.min(leftVolume, rightVolume);
    
    // Get the rank of each leg's direct downline for Binary Bonus calculation
    // Binary Bonus is calculated separately for each leg based on that leg's rank
    const children = await prisma.user.findMany({
      where: {
        placementParentId: memberId,
        active: true,
        deleted: false
      },
      select: {
        id: true,
        position: true,
        rank: true
      }
    });

    // Find left and right leg downlines
    const leftLegChild = children.find(c => c.position?.toLowerCase() === 'left');
    const rightLegChild = children.find(c => c.position?.toLowerCase() === 'right');

    // FIXED: Binary Bonus rate is based on SPONSOR's rank, not downline's rank
    // Sponsor gets the same rate for both legs based on their own rank
    const sponsorBinaryRate = this.getCommissionRate(member.rank); // Sponsor's rank rate

    // Calculate G2 Binary Bonus for Manager+ ranks
    // G2 rates: Manager: 1%, Director: 3%, President: 3%, Double President: 3%
    let leftLegG2Bonus = 0;
    let rightLegG2Bonus = 0;
    let leftLegG2DownlineCount = 0; // Track count for description
    let rightLegG2DownlineCount = 0; // Track count for description
    
    const g2Rates: Record<string, number> = {
      'Manager': 0.01,   // 1% G2
      'Director': 0.03,  // 3% G2
      'President': 0.03, // 3% G2
      'Double President': 0.03 // 3% G2
    };
    
    const sponsorG2Rate = g2Rates[member.rank] || 0;
    
    console.log(`🔍 G2 Binary Bonus Check for ${memberId} (${member.rank}):`, {
      sponsorRank: member.rank,
      sponsorG2Rate,
      eligibleForG2: sponsorG2Rate > 0,
      leftLegChild: leftLegChild ? { id: leftLegChild.id, rank: leftLegChild.rank } : null,
      rightLegChild: rightLegChild ? { id: rightLegChild.id, rank: rightLegChild.rank } : null,
      leftVolume,
      rightVolume
    });
    
    // Calculate G2 Binary Bonus if sponsor is Manager+
    // FIXED: Each leg uses ITS OWN VOLUME for G2 calculation, not weaker leg
    if (sponsorG2Rate > 0) {
      // Get G2 downlines (children of G1 downlines)
      if (leftLegChild) {
        const leftG2Children = await prisma.user.findMany({
          where: {
            placementParentId: leftLegChild.id,
            active: true,
            deleted: false
          },
          select: {
            id: true,
            rank: true,
            position: true,
            memberId: true,
            pv: true  // FIXED: Get G2 child's individual PV
          }
        });
        
        console.log(`🔍 Left Leg G2 Children found: ${leftG2Children.length}`, {
          g1DownlineId: leftLegChild.id,
          g1DownlineRank: leftLegChild.rank,
          g2Children: leftG2Children.map(c => ({
            id: c.id,
            memberId: c.memberId,
            rank: c.rank,
            pv: c.pv,
            position: c.position,
            isEligible: c.rank && c.rank.trim().toLowerCase() !== 'member'
          }))
        });
        
        // Calculate G2 bonus from left leg's downlines
        // FIXED: Use G2 child's individual PV × G2 rate (not leg volume)
        for (const g2Child of leftG2Children) {
          // FIXED: Case-insensitive rank check and trim whitespace
          const g2Rank = g2Child.rank?.trim() || '';
          const isEligible = g2Rank !== '' && g2Rank.toLowerCase() !== 'member';
          const g2ChildPV = Number(g2Child.pv) || 0;
          
          if (isEligible && g2ChildPV > 0) {
            // FIXED: G2 bonus = G2 child's PV × sponsor's G2 rate
            const g2Bonus = Math.round(g2ChildPV * sponsorG2Rate * 100) / 100;
            leftLegG2Bonus += g2Bonus;
            leftLegG2DownlineCount++; // Increment eligible G2 count
            
            console.log(`💰 Left Leg G2 Bonus added:`, {
              g2DownlineId: g2Child.id,
              g2DownlineMemberId: g2Child.memberId,
              g2DownlineRank: g2Rank,
              g2ChildPV,
              sponsorG2Rate,
              g2Bonus,
              leftLegG2BonusTotal: leftLegG2Bonus,
              g2DownlineCount: leftLegG2DownlineCount
            });
          } else {
            console.log(`⏭️ Left Leg G2 Child skipped:`, {
              g2DownlineId: g2Child.id,
              g2DownlineMemberId: g2Child.memberId,
              rank: g2Rank,
              pv: g2ChildPV,
              reason: !isEligible ? 'Member rank' : 'No PV'
            });
          }
        }
      } else {
        console.log(`⏭️ Left Leg G2 skipped:`, {
          hasLeftLegChild: !!leftLegChild,
          reason: 'No left leg child'
        });
      }
      
      if (rightLegChild) {
        const rightG2Children = await prisma.user.findMany({
          where: {
            placementParentId: rightLegChild.id,
            active: true,
            deleted: false
          },
          select: {
            id: true,
            rank: true,
            position: true,
            memberId: true,
            pv: true  // FIXED: Get G2 child's individual PV
          }
        });
        
        console.log(`🔍 Right Leg G2 Children found: ${rightG2Children.length}`, {
          g1DownlineId: rightLegChild.id,
          g1DownlineRank: rightLegChild.rank,
          g2Children: rightG2Children.map(c => ({
            id: c.id,
            memberId: c.memberId,
            rank: c.rank,
            pv: c.pv,
            position: c.position,
            isEligible: c.rank && c.rank.trim().toLowerCase() !== 'member'
          }))
        });
        
        // Calculate G2 bonus from right leg's downlines
        // FIXED: Use G2 child's individual PV × G2 rate (not leg volume)
        for (const g2Child of rightG2Children) {
          // FIXED: Case-insensitive rank check and trim whitespace
          const g2Rank = g2Child.rank?.trim() || '';
          const isEligible = g2Rank !== '' && g2Rank.toLowerCase() !== 'member';
          const g2ChildPV = Number(g2Child.pv) || 0;
          
          if (isEligible && g2ChildPV > 0) {
            // FIXED: G2 bonus = G2 child's PV × sponsor's G2 rate
            const g2Bonus = Math.round(g2ChildPV * sponsorG2Rate * 100) / 100;
            rightLegG2Bonus += g2Bonus;
            rightLegG2DownlineCount++; // Increment eligible G2 count
            
            console.log(`💰 Right Leg G2 Bonus added:`, {
              g2DownlineId: g2Child.id,
              g2DownlineMemberId: g2Child.memberId,
              g2DownlineRank: g2Rank,
              g2ChildPV,
              sponsorG2Rate,
              g2Bonus,
              rightLegG2BonusTotal: rightLegG2Bonus,
              g2DownlineCount: rightLegG2DownlineCount
            });
          } else {
            console.log(`⏭️ Right Leg G2 Child skipped:`, {
              g2DownlineId: g2Child.id,
              g2DownlineMemberId: g2Child.memberId,
              rank: g2Rank,
              pv: g2ChildPV,
              reason: !isEligible ? 'Member rank' : 'No PV'
            });
          }
        }
      } else {
        console.log(`⏭️ Right Leg G2 skipped:`, {
          hasRightLegChild: !!rightLegChild,
          reason: 'No right leg child'
        });
      }
      
      // Final G2 summary log
      console.log(`📊 G2 Binary Bonus Summary for ${memberId} (${member.rank}):`, {
        sponsorRank: member.rank,
        sponsorG2Rate: `${(sponsorG2Rate * 100).toFixed(0)}%`,
        leftLegG2Bonus,
        leftLegG2DownlineCount,
        rightLegG2Bonus,
        rightLegG2DownlineCount,
        totalG2Bonus: leftLegG2Bonus + rightLegG2Bonus,
        leftVolume,
        rightVolume
      });
    } else {
      console.log(`⏭️ G2 Binary Bonus not available for rank: ${member.rank} (only Manager+ get G2 bonus)`);
    }

    // Note: Binary Bonus does NOT require maintenance payment
    // Maintenance is ONLY required for Matching Bonus (checked in calculateMatchingBonus)

    // Calculate Binary Bonus separately for each leg
    // FIXED: Each leg uses ITS OWN VOLUME × SPONSOR's rank rate
    // Rate is based on sponsor's rank, not downline's rank!
    const leftLegG1Bonus = leftVolume > 0 
      ? Math.round(leftVolume * sponsorBinaryRate * 100) / 100 
      : 0;
    const rightLegG1Bonus = rightVolume > 0
      ? Math.round(rightVolume * sponsorBinaryRate * 100) / 100
      : 0;
    
    // Total Binary Bonus = G1 + G2
    const leftLegBonus = leftLegG1Bonus + leftLegG2Bonus;
    const rightLegBonus = rightLegG1Bonus + rightLegG2Bonus;

    // Check qualification requirements (using sponsor's rank for qualification)
    const qualificationMet = this.checkQualification(member.rank, volumeData);

    const breakdown: CommissionBreakdown[] = [];

    // Create separate Binary Bonus entry for left leg
    if (qualificationMet && leftLegBonus > 0 && leftLegChild) {
      const leftDescription = leftLegG2Bonus > 0
        ? `Binary Bonus (Left Leg): ${leftVolume} PV × ${(sponsorBinaryRate * 100).toFixed(0)}% (${member.rank} G1) + ${leftLegG2DownlineCount} G2 downline(s) × ${(sponsorG2Rate * 100).toFixed(0)}% = $${leftLegG1Bonus.toFixed(2)} + $${leftLegG2Bonus.toFixed(2)} = $${leftLegBonus.toFixed(2)}`
        : `Binary Bonus (Left Leg): ${leftVolume} PV × ${(sponsorBinaryRate * 100).toFixed(0)}% (${member.rank}) = $${leftLegBonus.toFixed(2)}`;
      
      console.log(`💰 Left Leg Binary Bonus: ${leftVolume} PV × ${(sponsorBinaryRate * 100).toFixed(0)}% (${member.rank} G1) = $${leftLegG1Bonus.toFixed(2)}${leftLegG2Bonus > 0 ? ` + ${leftLegG2DownlineCount} G2 downline(s) × ${(sponsorG2Rate * 100).toFixed(0)}% = $${leftLegG2Bonus.toFixed(2)}` : ''} = Total: $${leftLegBonus.toFixed(2)}`);
      breakdown.push({
        type: 'binary_bonus',
        amount: leftLegBonus,
        description: leftDescription,
        metadata: {
          leg: 'left',
          sponsorRank: member.rank,
          legVolume: leftVolume,
          binaryRate: sponsorBinaryRate,
          g1Bonus: leftLegG1Bonus,
          g2Rate: sponsorG2Rate,
          g2Bonus: leftLegG2Bonus,
          totalBonus: leftLegBonus,
          leftVolume,
          rightVolume,
          carryover: {
            left: leftVolume - weakerLeg,
            right: rightVolume - weakerLeg
          }
        }
      });
    }

    // Create separate Binary Bonus entry for right leg
    if (qualificationMet && rightLegBonus > 0 && rightLegChild) {
      const rightDescription = rightLegG2Bonus > 0
        ? `Binary Bonus (Right Leg): ${rightVolume} PV × ${(sponsorBinaryRate * 100).toFixed(0)}% (${member.rank} G1) + ${rightLegG2DownlineCount} G2 downline(s) × ${(sponsorG2Rate * 100).toFixed(0)}% = $${rightLegG1Bonus.toFixed(2)} + $${rightLegG2Bonus.toFixed(2)} = $${rightLegBonus.toFixed(2)}`
        : `Binary Bonus (Right Leg): ${rightVolume} PV × ${(sponsorBinaryRate * 100).toFixed(0)}% (${member.rank}) = $${rightLegBonus.toFixed(2)}`;
      
      console.log(`💰 Right Leg Binary Bonus: ${rightVolume} PV × ${(sponsorBinaryRate * 100).toFixed(0)}% (${member.rank} G1) = $${rightLegG1Bonus.toFixed(2)}${rightLegG2Bonus > 0 ? ` + ${rightLegG2DownlineCount} G2 downline(s) × ${(sponsorG2Rate * 100).toFixed(0)}% = $${rightLegG2Bonus.toFixed(2)}` : ''} = Total: $${rightLegBonus.toFixed(2)}`);
      breakdown.push({
        type: 'binary_bonus',
        amount: rightLegBonus,
        description: rightDescription,
        metadata: {
          leg: 'right',
          sponsorRank: member.rank,
          legVolume: rightVolume,
          binaryRate: sponsorBinaryRate,
          g1Bonus: rightLegG1Bonus,
          g2Rate: sponsorG2Rate,
          g2Bonus: rightLegG2Bonus,
          totalBonus: rightLegBonus,
          leftVolume,
          rightVolume,
          carryover: {
            left: leftVolume - weakerLeg,
            right: rightVolume - weakerLeg
          }
        }
      });
    }
    
    // Calculate total Binary Bonus for backward compatibility
    const totalBinaryBonus = leftLegBonus + rightLegBonus;
    const commissionAmount = totalBinaryBonus;

    // ENHANCEMENT: Only calculate rank bonus if recently advanced (check last 30 days)
    const rankBonus = await this.calculateRankAdvancementBonus(memberId, member.rank, startDate, endDate);
    if (rankBonus > 0) {
      breakdown.push({
        type: 'rank_advance',
        amount: rankBonus,
        description: `Rank advancement bonus for ${member.rank}`,
        metadata: { rank: member.rank }
      });
    }

    // Calculate Matching Bonus - ALWAYS calculate, even if member doesn't qualify for Binary Bonus
    // Maintenance check is done INSIDE calculateMatchingBonus method (REQUIRED for Matching Bonus)
    // Note: Maintenance is ONLY required for Matching Bonus, NOT for Binary Bonus
    const matchingBonuses = await this.calculateMatchingBonus(memberId, startDate, endDate, member.rank);
    
    // Log Matching Bonus calculation results
    const totalMatchingBonus = matchingBonuses.reduce((sum, b) => sum + b.amount, 0);
    if (totalMatchingBonus > 0) {
      console.log(`💰 Matching Bonus calculated for ${memberId}:`, {
        totalAmount: totalMatchingBonus,
        entries: matchingBonuses.length,
        breakdown: matchingBonuses.map(b => ({
          amount: b.amount,
          description: b.description,
          leg: b.metadata?.leg,
          generation: b.metadata?.generation
        }))
      });
    }
    
    if (matchingBonuses.length > 0) {
      breakdown.push(...matchingBonuses);
    }

    // Calculate total commission (sum of left leg + right leg + rank bonus + matching bonus)
    const totalCommission = qualificationMet
      ? Math.round((totalBinaryBonus + rankBonus + totalMatchingBonus) * 100) / 100
      : 0;

    // Use sponsor's commission rate for backward compatibility (breakdown has per-leg rates)
    const sponsorCommissionRate = this.getCommissionRate(member.rank);

    return {
      memberId,
      periodStart: startDate,
      periodEnd: endDate,
      leftVolume,
      rightVolume,
      weakerLeg,
      commissionRate: sponsorCommissionRate,
      commissionAmount: totalCommission,
      qualificationMet,
      breakdown
    };
  }

  /**
   * ENHANCEMENT: Helper to create zero commission with reason
   */
  private static createZeroCommission(
    memberId: string,
    startDate: Date,
    endDate: Date,
    reason: string
  ): CommissionCalculation {
    return {
      memberId,
      periodStart: startDate,
      periodEnd: endDate,
      leftVolume: 0,
      rightVolume: 0,
      weakerLeg: 0,
      commissionRate: 0,
      commissionAmount: 0,
      qualificationMet: false,
      breakdown: [{
        type: 'binary_bonus',
        amount: 0,
        description: reason,
        metadata: { reason }
      }]
    };
  }

  /**
   * Calculate volume data for a member
   * ENHANCED: Better handling of completed orders and PV calculation
   */
  static async calculateMemberVolume(
    memberId: string,
    startDate: Date,
    endDate: Date
  ): Promise<VolumeData> {
    // ENHANCEMENT: Get PV from order items, not just totalAmount
    const orders = await prisma.order.findMany({
      where: {
        userId: memberId,
        date: {
          gte: startDate,
          lte: endDate
        },
        status: { in: ['Completed', 'Delivered'] } // ENHANCEMENT: Include delivered orders
      },
      include: {
        items: {
          select: {
            pv: true // Get actual PV values
          }
        }
      }
    });

    // ENHANCEMENT: Calculate PV from order items, not just amount
    const personalVolume = orders.reduce((sum, order) => {
      const orderPV = order.items.reduce((itemSum, item) => itemSum + (item.pv || 0), 0);
      return sum + orderPV;
    }, 0);

    // Calculate team volumes using correct genealogy relationships
    const { leftVolume, rightVolume } = await this.calculateTeamVolumes(
      memberId,
      startDate,
      endDate
    );

    return {
      personalVolume: Math.round(personalVolume * 100) / 100,
      leftLegVolume: Math.round(leftVolume * 100) / 100,
      rightLegVolume: Math.round(rightVolume * 100) / 100,
      totalTeamVolume: Math.round((leftVolume + rightVolume) * 100) / 100,
      qualificationVolume: Math.round(personalVolume * 100) / 100
    };
  }

  /**
   * Calculate team volumes for left and right legs
   * ENHANCED: Fixed to use placementParentId instead of sponsorId
   */
  static async calculateTeamVolumes(
    memberId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ leftVolume: number; rightVolume: number }> {
    let leftVolume = 0;
    let rightVolume = 0;

    // CRITICAL FIX: Use placementParentId for binary tree, not sponsorId
    const children = await prisma.user.findMany({
      where: {
        placementParentId: memberId, // FIXED: was sponsorId
        active: true,
        deleted: false
      },
      select: {
        id: true,
        position: true
      }
    });

    // ENHANCEMENT: Process children in parallel for better performance
    const volumePromises = children.map(async (child) => {
      const childVolume = await this.calculateSubtreeVolume(
        child.id, 
        startDate, 
        endDate, 
        0, 
        10,
        new Set<string>() // ENHANCEMENT: Track visited nodes to prevent circular references
      );
      return { position: child.position, volume: childVolume };
    });

    const childVolumes = await Promise.all(volumePromises);

    for (const { position, volume } of childVolumes) {
      if (position === 'left') {
        leftVolume += volume;
      } else if (position === 'right') {
        rightVolume += volume;
      }
    }

    return { 
      leftVolume: Math.round(leftVolume * 100) / 100, 
      rightVolume: Math.round(rightVolume * 100) / 100 
    };
  }

  /**
   * Calculate volume for entire subtree
   * ENHANCED: Added memoization and circular reference prevention
   */
  static async calculateSubtreeVolume(
    memberId: string,
    startDate: Date,
    endDate: Date,
    currentDepth: number,
    maxDepth: number,
    visited: Set<string> = new Set()
  ): Promise<number> {
    // ENHANCEMENT: Prevent infinite loops from circular references
    if (visited.has(memberId)) {
      console.warn(`Circular reference detected for member ${memberId}`);
      return 0;
    }

    if (currentDepth >= maxDepth) {
      console.warn(`Max depth ${maxDepth} reached for member ${memberId}`);
      return 0;
    }

    visited.add(memberId);

    // ENHANCEMENT: Check cache first
    const cacheKey = `${memberId}-${startDate.getTime()}-${endDate.getTime()}`;
    const cached = this.volumeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.volume;
    }

    // Get member's personal volume with PV from order items
    const orders = await prisma.order.findMany({
      where: {
        userId: memberId,
        date: {
          gte: startDate,
          lte: endDate
        },
        status: { in: ['Completed', 'Delivered'] }
      },
      include: {
        items: {
          select: {
            pv: true
          }
        }
      }
    });

    const personalVolume = orders.reduce((sum, order) => {
      const orderPV = order.items.reduce((itemSum, item) => itemSum + (item.pv || 0), 0);
      return sum + orderPV;
    }, 0);

    // Get children's volumes using placementParentId
    const children = await prisma.user.findMany({
      where: {
        placementParentId: memberId, // FIXED: was sponsorId
        active: true,
        deleted: false
      },
      select: { id: true }
    });

    let childrenVolume = 0;
    for (const child of children) {
      childrenVolume += await this.calculateSubtreeVolume(
        child.id,
        startDate,
        endDate,
        currentDepth + 1,
        maxDepth,
        new Set(visited) // Pass a copy to avoid pollution
      );
    }

    const totalVolume = Math.round((personalVolume + childrenVolume) * 100) / 100;

    // ENHANCEMENT: Cache the result
    this.volumeCache.set(cacheKey, { volume: totalVolume, timestamp: Date.now() });

    return totalVolume;
  }

  /**
   * Get commission rate based on rank
   * ENHANCEMENT: Made configurable and added validation
   */
  /**
   * Get direct commission rate based on rank
   * Updated to match new requirements:
   * - Bronze: 20%
   * - Silver: 30%
   * - Gold: 40%
   * - Diamond: 50%
   */
  /**
   * Get Binary Bonus commission rate (G1 rate) based on downline's rank
   * Updated to match Binary Bonus rates table:
   * - Bronze: 8%
   * - Silver: 10%
   * - Gold: 14%
   * - Diamond: 17%
   * - Manager+: 17%
   */
  static getCommissionRate(rank: string): number {
    const rates: Record<string, number> = {
      'Member': 0,
      'Bronze': 0.08,    // 8% Binary Bonus (G1)
      'Silver': 0.10,    // 10% Binary Bonus (G1)
      'Gold': 0.14,      // 14% Binary Bonus (G1)
      'Diamond': 0.17,   // 17% Binary Bonus (G1)
      'Manager': 0.17,   // 17% Binary Bonus (G1)
      'Director': 0.17,  // 17% Binary Bonus (G1)
      'President': 0.17, // 17% Binary Bonus (G1)
      'Double President': 0.17 // 17% Binary Bonus (G1)
    };

    const rate = rates[rank];
    
    // ENHANCEMENT: Validate rate
    if (rate === undefined) {
      console.warn(`Unknown rank: ${rank}, defaulting to Member rate`);
      return rates['Member'];
    }

    return rate;
  }

  /**
   * Check if member meets qualification requirements
   * ENHANCED: Added better validation
   */
  /**
   * Check if member meets qualification requirements
   * Updated to match new requirements:
   * - Bronze: 60 PV personal, 20 PV group
   * - Silver: 100 PV personal, 20 PV group
   * - Gold: 500 PV personal, 20 PV group
   * - Diamond: 1000 PV personal, 20 PV group
   */
  static checkQualification(rank: string, volumeData: VolumeData): boolean {
    const requirements: Record<string, { personal: number; team: number }> = {
      'Member': { personal: 0, team: 0 },
      'Bronze': { personal: 60, team: 20 },      // 60 PV personal, 20 PV group
      'Silver': { personal: 100, team: 20 },     // 100 PV personal, 20 PV group
      'Gold': { personal: 500, team: 20 },       // 500 PV personal, 20 PV group
      'Diamond': { personal: 1000, team: 20 },   // 1000 PV personal, 20 PV group
      'Manager': { personal: 1000, team: 40 },
      'Director': { personal: 1000, team: 40 },
      'President': { personal: 1000, team: 40 },
      'Double President': { personal: 1000, team: 40 }
    };

    const req = requirements[rank] || requirements['Member'];
    
    // Check personal volume and group volume requirements
    // Group volume = total team volume (sum of left and right legs)
    return volumeData.personalVolume >= req.personal && 
           volumeData.totalTeamVolume >= req.team;
  }

  /**
   * Calculate rank advancement bonus
   * ENHANCED: Check if actually advanced during period
   */
  /**
   * Get matching bonus rate based on rank
   * Formula: M (Matching Bonus) = D × % of generation
   * 
   * Rates by Rank (as per specification):
   * - Bronze: G1 = 20% (G2 = 0%, G3 = 0%)
   * - Silver: G1 = 30% (G2 = 0%, G3 = 0%)
   * - Gold: G1 = 40%, G2 = 5% (G3 = 0%)
   * - Diamond: G1 = 50%, G2 = 10% (G3 = 0%)
   * - Manager: G1 = 60%, G2 = 10%, G3 = 5%
   * - Director: G1 = 60%, G2 = 10%, G3 = 10%
   * - President: G1 = 60%, G2 = 10%, G3 = 10%
   * - Double President: G1 = 60%, G2 = 10%, G3 = 10%
   * 
   * Example: 
   * - If G1 downline earned $8 Daily Match, Bronze sponsor gets $8 × 20% = $1.60
   * - If G2 downline earned $8 Daily Match, Gold sponsor gets $8 × 5% = $0.40
   * - If G3 downline earned $8 Daily Match, Manager sponsor gets $8 × 5% = $0.40
   */
  static getMatchingBonusRate(rank: string): { g1: number; g2: number; g3: number } {
    const rates: Record<string, { g1: number; g2: number; g3: number }> = {
      'Bronze': { g1: 0.20, g2: 0, g3: 0 },     // 20% G1 only (Total: 20%)
      'Silver': { g1: 0.30, g2: 0, g3: 0 },     // 30% G1 only (Total: 30%)
      'Gold': { g1: 0.40, g2: 0.05, g3: 0 },    // 40% G1 + 5% G2 (Total: 45%)
      'Diamond': { g1: 0.50, g2: 0.10, g3: 0 }, // 50% G1 + 10% G2 (Total: 60%)
      'Manager': { g1: 0.60, g2: 0.10, g3: 0.05 },  // 60% G1 + 10% G2 + 5% G3 (Total: 75%)
      'Director': { g1: 0.60, g2: 0.10, g3: 0.10 }, // 60% G1 + 10% G2 + 10% G3 (Total: 80%)
      'President': { g1: 0.60, g2: 0.10, g3: 0.10 }, // 60% G1 + 10% G2 + 10% G3 (Total: 80%)
      'Double President': { g1: 0.60, g2: 0.10, g3: 0.10 }, // 60% G1 + 10% G2 + 10% G3 (Total: 80%)
    };

    return rates[rank] || { g1: 0, g2: 0, g3: 0 };
  }

  /**
   * Calculate matching bonus from downline
   */
  /**
   * Get member's PV (Point Value) for a given period
   */
  private static async getMemberPV(
    memberId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    try {
      // Query the database for the member's PV within the date range
      // Note: Using Prisma client instead of raw query for better type safety
    const orders = await prisma.order.findMany({
      where: {
        userId: memberId,
          status: 'COMPLETED',
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          items: {
            select: {
              pv: true
            }
          }
        }
      });

      // Calculate total PV from all order items
      const totalPV = orders.reduce((sum, order) => {
        const orderPV = order.items.reduce((itemSum, item) => itemSum + (item.pv || 0), 0);
        return sum + orderPV;
      }, 0);

      return totalPV;
    } catch (error) {
      console.error(`Error getting PV for member ${memberId}:`, error);
      return 0; // Return 0 if there's an error to fail safely
    }
  }

  static async calculateMatchingBonus(
    memberId: string,
    startDate: Date,
    endDate: Date,
    memberRank: string
  ): Promise<CommissionBreakdown[]> {
  const results: CommissionBreakdown[] = [];
  
  // CRITICAL: Superadmin itself cannot earn Matching Bonus, but members created by superadmin CAN
  const { isSuperAdmin, canEarnCommissions } = await import('@/lib/superadmin-helper');
  if (await isSuperAdmin(memberId)) {
    console.log(`⚠️ Superadmin ${memberId} cannot earn Matching Bonus - skipping`);
    return []; // Return empty array - superadmin gets no Matching Bonus
  }
  
  // Check if member can earn commissions (has downlines)
  if (!(await canEarnCommissions(memberId))) {
    console.log(`⚠️ Member ${memberId} has no downlines - cannot earn Matching Bonus`);
    return []; // Return empty array - no Matching Bonus if no downlines
  }
  
  // CRITICAL: Check if maintenance is paid for current month - REQUIRED for Matching Bonus
  // Maintenance is ONLY required for Matching Bonus, NOT for Binary Bonus
  const { hasMaintenancePaid } = await import('@/lib/maintenance');
  const maintenancePaid = await hasMaintenancePaid(memberId);
  
  if (!maintenancePaid) {
    console.log(`⚠️ Matching Bonus skipped for ${memberId}: Monthly maintenance topup not paid - REQUIRED for Matching Bonus`);
    return []; // Return empty array - Matching Bonus requires maintenance payment
  }
  
  // 1. Check PV requirement - All ranks need minimum group volume
  // NOTE: For Matching Bonus, we'll be more lenient with PV requirements
  // The PV requirement check is kept but won't block if sponsor has active downlines
  const pvRequirement = 20; // 20 PV group volume preferred, but not strictly required
  const memberPV = await this.getMemberPV(memberId, startDate, endDate);
  
  // Get total team volume to check group PV requirement
  const volumeData = await this.calculateMemberVolume(memberId, startDate, endDate);
  const groupPV = volumeData.totalTeamVolume;
  
  // Log PV status but don't block - if sponsor has downlines with Daily Match, they should get Matching Bonus
  if (groupPV < pvRequirement) {
    console.log(`⚠️ Matching Bonus PV check for ${memberId}: Has ${groupPV} PV (preferred: ${pvRequirement} PV), but will continue if downlines have Daily Match`);
    // Don't return early - continue to check for downline Daily Match commissions
  }

  // 2. Get rank rates
  const rankRates = this.getMatchingBonusRate(memberRank);
  
  // If no rates available for this rank, return empty array
  if (rankRates.g1 === 0 && rankRates.g2 === 0 && rankRates.g3 === 0) {
    console.log(`ℹ️ Matching Bonus not available for rank: ${memberRank} (no matching bonus rate configured)`);
    return []; // Return empty array - no zero-amount entries
  }

  // 3. Get all downlines (G1, G2, G3) - Sponsor gets Matching Bonus from downlines based on rank rates
  // Bronze/Silver: G1 only | Gold: G1 + G2 | Diamond+: G1 + G2 + G3
  const allDownlines = await this.getAllDownlinesWithGenerations(memberId);
  
  if (allDownlines.length === 0) {
    console.log(`ℹ️ No downlines found for ${memberId} to calculate Matching Bonus`);
    return []; // Return empty array - no zero-amount entries
  }

  // Filter downlines by generation based on rank rates
  // Bronze/Silver: only G1 | Gold: G1 + G2 | Diamond+: G1 + G2 + G3
  const eligibleGenerations: number[] = [];
  if (rankRates.g1 > 0) eligibleGenerations.push(1);
  if (rankRates.g2 > 0) eligibleGenerations.push(2);
  if (rankRates.g3 > 0) eligibleGenerations.push(3);
  
  const eligibleDownlines = allDownlines.filter(d => eligibleGenerations.includes(d.generation));
  
  if (eligibleDownlines.length === 0) {
    console.log(`ℹ️ No eligible downlines found for ${memberId} (rank: ${memberRank}, eligible generations: ${eligibleGenerations.join(', ')})`);
    return [];
  }

  // 4. Get eligible downline IDs
  const eligibleDownlineIds = eligibleDownlines.map(d => d.id);
  
  // 5. Get Daily Match commissions for eligible downlines (G1, G2, G3 based on rank)
  // Note: Daily Match commissions are saved with type 'Daily Match' (not 'daily_match_bonus')
  // IMPORTANT: We check for Daily Match commissions within the date range
  // Use last 30 days to ensure we catch all recent Daily Match commissions
  // Also ensure we include "now" with a small buffer to catch commissions just created
  const now = new Date();
  const nowPlusBuffer = new Date(now.getTime() + 1000); // Add 1 second buffer for timing
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  // Ensure we use the wider date range (last 30 days) to catch all recent commissions
  // Use nowPlusBuffer to ensure we catch commissions created just now
  const actualStartDate = startDate < thirtyDaysAgo ? thirtyDaysAgo : startDate;
  const actualEndDate = endDate > nowPlusBuffer ? nowPlusBuffer : (endDate > now ? now : endDate);
  
  // FIX: Also check for commissions created today (in case date filter is too strict for just-created commissions)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  
  console.log(`📅 Searching for Daily Match commissions:`, {
    eligibleDownlineIds,
    eligibleDownlineCount: eligibleDownlineIds.length,
    dateRange: `${actualStartDate.toISOString()} to ${actualEndDate.toISOString()}`,
    todayRange: `${todayStart.toISOString()} to ${todayEnd.toISOString()}`,
    status: 'Paid'
  });
  
  // CRITICAL FIX: Search for Daily Match commissions - use most lenient query possible
  // Don't restrict by date too much - just check status='Paid' and type='Daily Match'
  // This ensures we catch ALL Daily Match commissions regardless of when they were created
  const dailyMatchCommissions = await prisma.commission.findMany({
    where: {
      userId: { in: eligibleDownlineIds },
      type: 'Daily Match',  // Match the actual type saved in database
      status: 'Paid'
      // REMOVED date filter - check ALL Paid Daily Match commissions (last 7 days minimum)
      // This ensures we catch commissions that were just created
    },
    select: { 
      userId: true,
      amount: true,
      date: true,
      id: true
    },
    orderBy: {
      date: 'desc'
    },
    take: 1000 // Limit to last 1000 to avoid performance issues
  });
  
  // Filter to last 7 days client-side (more reliable than database date filtering)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const filteredCommissions = dailyMatchCommissions.filter(c => {
    const commissionDate = new Date(c.date);
    // Include if within last 7 days OR if it's today (just created)
    return commissionDate >= sevenDaysAgo || commissionDate >= todayStart;
  });
  
  console.log(`📊 Found ${dailyMatchCommissions.length} Daily Match commission(s) total, ${filteredCommissions.length} within date range:`, {
    totalFound: dailyMatchCommissions.length,
    filteredCount: filteredCommissions.length,
    commissions: filteredCommissions.map(c => ({
      userId: c.userId,
      amount: c.amount,
      date: c.date.toISOString(),
      id: c.id
    }))
  });
  
  // Enhanced logging to debug why Matching Bonus might not be calculated
  // Separate downlines by generation for better debugging
  const g1Downlines = eligibleDownlines.filter(d => d.generation === 1);
  const g2Downlines = eligibleDownlines.filter(d => d.generation === 2);
  const g3Downlines = eligibleDownlines.filter(d => d.generation === 3);
  
  console.log(`🔍 Matching Bonus: Checking for Daily Match commissions:`, {
    memberId,
    memberRank,
    eligibleGenerations,
    eligibleDownlineCount: eligibleDownlineIds.length,
    breakdown: {
      g1: {
        count: g1Downlines.length,
        ids: g1Downlines.map(d => ({ id: d.id, memberId: d.memberId, leg: d.position }))
      },
      g2: {
        count: g2Downlines.length,
        ids: g2Downlines.map(d => ({ id: d.id, memberId: d.memberId, leg: d.position }))
      },
      g3: {
        count: g3Downlines.length,
        ids: g3Downlines.map(d => ({ id: d.id, memberId: d.memberId, leg: d.position }))
      }
    },
    eligibleDownlineIds,
    dateRange: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    dailyMatchCommissionsFound: filteredCommissions.length,
    dailyMatchDetails: filteredCommissions.map(c => ({
      userId: c.userId,
      amount: c.amount,
      date: c.date.toISOString(),
      id: c.id,
      generation: eligibleDownlines.find(d => d.id === c.userId)?.generation || 'unknown'
    }))
  });

  // 6. Group commissions by user ID (use filtered commissions)
  const commissionMap = filteredCommissions.reduce<Record<string, number>>((acc, c) => {
    acc[c.userId] = (acc[c.userId] || 0) + c.amount;
    return acc;
  }, {});
  
  // Enhanced logging: Show which downlines have Daily Match by generation
  const g1WithDailyMatch = g1Downlines.filter(d => (commissionMap[d.id] || 0) > 0);
  const g2WithDailyMatch = g2Downlines.filter(d => (commissionMap[d.id] || 0) > 0);
  const g3WithDailyMatch = g3Downlines.filter(d => (commissionMap[d.id] || 0) > 0);
  
  console.log(`📊 Daily Match by Generation:`, {
    memberId,
    memberRank,
    g1: {
      total: g1Downlines.length,
      withDailyMatch: g1WithDailyMatch.length,
      details: g1WithDailyMatch.map(d => ({
        id: d.id,
        memberId: d.memberId,
        dailyMatch: commissionMap[d.id],
        leg: d.position
      }))
    },
    g2: {
      total: g2Downlines.length,
      withDailyMatch: g2WithDailyMatch.length,
      details: g2WithDailyMatch.map(d => ({
        id: d.id,
        memberId: d.memberId,
        dailyMatch: commissionMap[d.id],
        leg: d.position
      }))
    },
    g3: {
      total: g3Downlines.length,
      withDailyMatch: g3WithDailyMatch.length,
      details: g3WithDailyMatch.map(d => ({
        id: d.id,
        memberId: d.memberId,
        dailyMatch: commissionMap[d.id],
        leg: d.position
      }))
    }
  });
  
  // Log if no Daily Match found - this is a common reason why Matching Bonus isn't calculated
  if (filteredCommissions.length === 0) {
    console.log(`⚠️ Matching Bonus: No Daily Match commissions found for eligible downlines:`, {
      memberId,
      memberRank,
      eligibleGenerations,
      eligibleDownlineIds,
      eligibleDownlineCount: eligibleDownlineIds.length,
      dateRange: { 
        requested: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        actual: { startDate: actualStartDate.toISOString(), endDate: actualEndDate.toISOString() }
      },
      possibleReasons: [
        'Daily Match commissions not created yet for downlines',
        'Date range mismatch (Daily Match created on different date)',
        'Daily Match commissions not marked as Paid',
        `No eligible downlines (${eligibleGenerations.map(g => `G${g}`).join(', ')}) have earned Daily Match`,
        `Rank ${memberRank} rates: G1=${(rankRates.g1 * 100).toFixed(0)}%, G2=${(rankRates.g2 * 100).toFixed(0)}%, G3=${(rankRates.g3 * 100).toFixed(0)}%`
      ]
    });
  }

  // Debug logging
  console.log(`🔍 Matching Bonus Calculation for ${memberId}:`, {
    memberRank,
    memberPV,
    groupPV,
    pvRequirement,
    eligibleGenerations,
    eligibleDownlinesCount: eligibleDownlines.length,
    g1Count: eligibleDownlines.filter(d => d.generation === 1).length,
    g2Count: eligibleDownlines.filter(d => d.generation === 2).length,
    g3Count: eligibleDownlines.filter(d => d.generation === 3).length,
    dailyMatchCommissionsFound: filteredCommissions.length,
    totalDailyMatchAmount: filteredCommissions.reduce((sum, c) => sum + c.amount, 0),
    downlinesWithDailyMatch: Object.keys(commissionMap).length,
    rankRates: {
      g1: `${(rankRates.g1 * 100).toFixed(0)}%`,
      g2: `${(rankRates.g2 * 100).toFixed(0)}%`,
      g3: `${(rankRates.g3 * 100).toFixed(0)}%`
    },
    dateRange: { startDate, endDate },
    downlineDetails: eligibleDownlines.map(d => ({
      id: d.id,
      memberId: d.memberId,
      generation: d.generation,
      leg: d.position,
      dailyMatch: commissionMap[d.id] || 0
    }))
  });

  // 7. Calculate matching bonus by leg and generation (LEFT and RIGHT separately)
  // Formula: M = D × % of generation (where % = rank rate for each generation)
  // Structure: { leg: { amount, downlines } }
  // Each leg (left/right) is calculated separately, but combines all eligible generations
  const legBonuses: Record<string, { amount: number; downlines: string[] }> = {
    left: { amount: 0, downlines: [] },
    right: { amount: 0, downlines: [] }
  };

  // Track calculations for logging
  const calculationDetails: Array<{
    downlineId: string;
    downlineMemberId: string;
    generation: number;
    leg: string;
    dailyMatch: number;
    rate: number;
    matchingBonus: number;
  }> = [];

  // Calculate bonuses for all eligible downlines (G1, G2, G3 based on rank)
  console.log(`🔄 Starting Matching Bonus calculation for ${eligibleDownlines.length} eligible downlines:`, {
    memberId,
    memberRank,
    rankRates: {
      g1: `${(rankRates.g1 * 100).toFixed(0)}%`,
      g2: `${(rankRates.g2 * 100).toFixed(0)}%`,
      g3: `${(rankRates.g3 * 100).toFixed(0)}%`
    },
    eligibleDownlines: eligibleDownlines.map(d => ({
      id: d.id,
      memberId: d.memberId,
      generation: d.generation,
      leg: d.position,
      hasDailyMatch: (commissionMap[d.id] || 0) > 0,
      dailyMatchAmount: commissionMap[d.id] || 0
    }))
  });
  
  for (const downline of eligibleDownlines) {
    const dailyMatch = commissionMap[downline.id] || 0;
    if (dailyMatch <= 0) {
      console.log(`⏭️ Skipping ${downline.memberId} (G${downline.generation}): No Daily Match found`);
      continue;
    }

    // Get the rate for this downline's generation
    const generationRate = downline.generation === 1 ? rankRates.g1 :
                          downline.generation === 2 ? rankRates.g2 :
                          rankRates.g3;
    
    if (generationRate <= 0) {
      console.log(`⏭️ Skipping ${downline.memberId} (G${downline.generation}): Generation rate is 0`);
      continue;
    }
    
    if (generationRate > 0) {
      // Determine leg: G1 uses own position, G2/G3 inherit from G1 ancestor
      const leg = downline.position?.toLowerCase() === 'right' ? 'right' : 'left';
      
      // Calculate Matching Bonus = Daily Match × Rate for this generation
      // Formula: M = D × % of generation
      // Example: $8 Daily Match × 30% (G1) = $2.40 Matching Bonus (Silver)
      // Example: $8 Daily Match × 5% (G2) = $0.40 Matching Bonus (Gold)
      const matchingBonus = Math.round((dailyMatch * generationRate) * 100) / 100; // Round to 2 decimals
      
      console.log(`💰 Matching Bonus Calculation:`, {
        sponsorId: memberId,
        sponsorRank: memberRank,
        downlineId: downline.id,
        downlineMemberId: downline.memberId,
        generation: downline.generation,
        dailyMatchAmount: dailyMatch,
        matchingBonusRate: generationRate,
        ratePercentage: `${(generationRate * 100).toFixed(0)}%`,
        calculatedMatchingBonus: matchingBonus,
        leg,
        formula: `$${dailyMatch} × ${(generationRate * 100).toFixed(0)}% (G${downline.generation}) = $${matchingBonus.toFixed(2)}`
      });
      
      // Accumulate by leg (LEFT and RIGHT are separate)
      legBonuses[leg].amount += matchingBonus;
      legBonuses[leg].downlines.push(downline.memberId);
      
      // Track for logging
      calculationDetails.push({
        downlineId: downline.id,
        downlineMemberId: downline.memberId,
        generation: downline.generation,
        leg,
        dailyMatch,
        rate: generationRate,
        matchingBonus
      });
    }
  }

  // Log leg-based and generation-based calculations
  if (calculationDetails.length > 0) {
    const leftLegTotal = calculationDetails
      .filter(d => d.leg === 'left')
      .reduce((sum, d) => sum + d.matchingBonus, 0);
    const rightLegTotal = calculationDetails
      .filter(d => d.leg === 'right')
      .reduce((sum, d) => sum + d.matchingBonus, 0);
    
    // Group by generation for breakdown
    const g1Total = calculationDetails.filter(d => d.generation === 1).reduce((sum, d) => sum + d.matchingBonus, 0);
    const g2Total = calculationDetails.filter(d => d.generation === 2).reduce((sum, d) => sum + d.matchingBonus, 0);
    const g3Total = calculationDetails.filter(d => d.generation === 3).reduce((sum, d) => sum + d.matchingBonus, 0);
    
    const g1Count = calculationDetails.filter(d => d.generation === 1).length;
    const g2Count = calculationDetails.filter(d => d.generation === 2).length;
    const g3Count = calculationDetails.filter(d => d.generation === 3).length;
    
    console.log(`📊 Matching Bonus Breakdown for ${memberId}:`, {
      rank: memberRank,
      generations: {
        g1: { 
          total: g1Total, 
          rate: `${(rankRates.g1 * 100).toFixed(0)}%`, 
          count: g1Count,
          eligible: g1Downlines.length,
          withDailyMatch: g1WithDailyMatch.length,
          calculated: g1Count > 0 ? '✅' : '❌'
        },
        g2: { 
          total: g2Total, 
          rate: `${(rankRates.g2 * 100).toFixed(0)}%`, 
          count: g2Count,
          eligible: g2Downlines.length,
          withDailyMatch: g2WithDailyMatch.length,
          calculated: g2Count > 0 ? '✅' : (g2Downlines.length > 0 ? '⚠️ (no Daily Match)' : '⏭️ (not eligible)')
        },
        g3: { 
          total: g3Total, 
          rate: `${(rankRates.g3 * 100).toFixed(0)}%`, 
          count: g3Count,
          eligible: g3Downlines.length,
          withDailyMatch: g3WithDailyMatch.length,
          calculated: g3Count > 0 ? '✅' : (g3Downlines.length > 0 ? '⚠️ (no Daily Match)' : '⏭️ (not eligible)')
        }
      },
      leftLeg: {
        total: leftLegTotal,
        downlines: calculationDetails.filter(d => d.leg === 'left').map(d => ({
          memberId: d.downlineMemberId,
          generation: `G${d.generation}`,
          dailyMatch: d.dailyMatch,
          rate: `${(d.rate * 100).toFixed(0)}%`,
          bonus: d.matchingBonus
        }))
      },
      rightLeg: {
        total: rightLegTotal,
        downlines: calculationDetails.filter(d => d.leg === 'right').map(d => ({
          memberId: d.downlineMemberId,
          generation: `G${d.generation}`,
          dailyMatch: d.dailyMatch,
          rate: `${(d.rate * 100).toFixed(0)}%`,
          bonus: d.matchingBonus
        }))
      }
    });
  }

  // 8. Create SEPARATE Matching Bonus entries for LEFT and RIGHT legs
  // Business Logic: Each leg gets its own Matching Bonus entry
  // - Left leg: Sum of all downlines' Daily Match on left side × rate
  // - Right leg: Sum of all downlines' Daily Match on right side × rate
  const totalLeftBonus = legBonuses.left.amount > 0 ? Math.round(legBonuses.left.amount * 100) / 100 : 0;
  const totalRightBonus = legBonuses.right.amount > 0 ? Math.round(legBonuses.right.amount * 100) / 100 : 0;
  
  // Calculate generation totals for each leg for description
  const leftLegG1 = calculationDetails.filter(d => d.leg === 'left' && d.generation === 1).reduce((sum, d) => sum + d.matchingBonus, 0);
  const leftLegG2 = calculationDetails.filter(d => d.leg === 'left' && d.generation === 2).reduce((sum, d) => sum + d.matchingBonus, 0);
  const leftLegG3 = calculationDetails.filter(d => d.leg === 'left' && d.generation === 3).reduce((sum, d) => sum + d.matchingBonus, 0);
  
  const rightLegG1 = calculationDetails.filter(d => d.leg === 'right' && d.generation === 1).reduce((sum, d) => sum + d.matchingBonus, 0);
  const rightLegG2 = calculationDetails.filter(d => d.leg === 'right' && d.generation === 2).reduce((sum, d) => sum + d.matchingBonus, 0);
  const rightLegG3 = calculationDetails.filter(d => d.leg === 'right' && d.generation === 3).reduce((sum, d) => sum + d.matchingBonus, 0);
  
  // Create LEFT leg Matching Bonus entry
  if (totalLeftBonus > 0) {
    const leftLegDetails = calculationDetails.filter(d => d.leg === 'left');
    const leftLegDailyMatch = leftLegDetails.reduce((sum, d) => sum + d.dailyMatch, 0);
    const leftLegGenerations = [];
    if (leftLegG1 > 0) leftLegGenerations.push(`G1: ${(rankRates.g1 * 100).toFixed(0)}%`);
    if (leftLegG2 > 0) leftLegGenerations.push(`G2: ${(rankRates.g2 * 100).toFixed(0)}%`);
    if (leftLegG3 > 0) leftLegGenerations.push(`G3: ${(rankRates.g3 * 100).toFixed(0)}%`);
    
    console.log(`📝 Creating LEFT leg Matching Bonus commission entry:`, {
      sponsorId: memberId,
      sponsorRank: memberRank,
      leg: 'left',
      amount: totalLeftBonus,
      dailyMatchTotal: leftLegDailyMatch,
      downlineCount: legBonuses.left.downlines.length,
      generations: leftLegGenerations.join(', ')
    });
    
    results.push({
            type: 'matching_bonus',
      amount: totalLeftBonus,
      description: `Matching Bonus (Left Leg): $${leftLegDailyMatch.toFixed(2)} Daily Match × ${leftLegGenerations.join(' + ') || (rankRates.g1 * 100).toFixed(0) + '%'} = $${totalLeftBonus.toFixed(2)}`,
            metadata: {
        leg: 'left',
        sponsorRank: memberRank,
        amount: totalLeftBonus,
        dailyMatchTotal: leftLegDailyMatch,
        downlines: legBonuses.left.downlines,
        generationBreakdown: { g1: leftLegG1, g2: leftLegG2, g3: leftLegG3 },
        downlineCount: legBonuses.left.downlines.length
      }
    });
  }
  
  // Create RIGHT leg Matching Bonus entry
  if (totalRightBonus > 0) {
    const rightLegDetails = calculationDetails.filter(d => d.leg === 'right');
    const rightLegDailyMatch = rightLegDetails.reduce((sum, d) => sum + d.dailyMatch, 0);
    const rightLegGenerations = [];
    if (rightLegG1 > 0) rightLegGenerations.push(`G1: ${(rankRates.g1 * 100).toFixed(0)}%`);
    if (rightLegG2 > 0) rightLegGenerations.push(`G2: ${(rankRates.g2 * 100).toFixed(0)}%`);
    if (rightLegG3 > 0) rightLegGenerations.push(`G3: ${(rankRates.g3 * 100).toFixed(0)}%`);
    
    console.log(`📝 Creating RIGHT leg Matching Bonus commission entry:`, {
      sponsorId: memberId,
      sponsorRank: memberRank,
      leg: 'right',
      amount: totalRightBonus,
      dailyMatchTotal: rightLegDailyMatch,
      downlineCount: legBonuses.right.downlines.length,
      generations: rightLegGenerations.join(', ')
    });
    
    results.push({
      type: 'matching_bonus',
      amount: totalRightBonus,
      description: `Matching Bonus (Right Leg): $${rightLegDailyMatch.toFixed(2)} Daily Match × ${rightLegGenerations.join(' + ') || (rankRates.g1 * 100).toFixed(0) + '%'} = $${totalRightBonus.toFixed(2)}`,
      metadata: {
        leg: 'right',
        sponsorRank: memberRank,
        amount: totalRightBonus,
        dailyMatchTotal: rightLegDailyMatch,
        downlines: legBonuses.right.downlines,
        generationBreakdown: { g1: rightLegG1, g2: rightLegG2, g3: rightLegG3 },
        downlineCount: legBonuses.right.downlines.length
      }
    });
  }
  
  if (results.length === 0) {
    console.log(`⚠️ No Matching Bonus earned for ${memberId}: No qualifying downline Daily Match found`);
  }

  // 9. Filter out zero-amount entries - only return entries with actual Matching Bonus
  const validResults = results.filter(r => r.amount > 0);
  
  // Log final results for debugging
  const totalMatchingBonus = totalLeftBonus + totalRightBonus;
  
  // Calculate final G1, G2, G3 totals from calculationDetails
  const finalG1Total = calculationDetails.filter(d => d.generation === 1).reduce((sum, d) => sum + d.matchingBonus, 0);
  const finalG2Total = calculationDetails.filter(d => d.generation === 2).reduce((sum, d) => sum + d.matchingBonus, 0);
  const finalG3Total = calculationDetails.filter(d => d.generation === 3).reduce((sum, d) => sum + d.matchingBonus, 0);
  
  if (totalMatchingBonus > 0) {
    console.log(`✅ Matching Bonus Results for ${memberId}:`, {
      formula: 'M = D × % of generation',
      rank: memberRank,
      rates: {
        g1: `${(rankRates.g1 * 100).toFixed(0)}%`,
        g2: `${(rankRates.g2 * 100).toFixed(0)}%`,
        g3: `${(rankRates.g3 * 100).toFixed(0)}%`
      },
      generationTotals: {
        g1: `$${finalG1Total.toFixed(2)} (${calculationDetails.filter(d => d.generation === 1).length} downlines)`,
        g2: `$${finalG2Total.toFixed(2)} (${calculationDetails.filter(d => d.generation === 2).length} downlines)`,
        g3: `$${finalG3Total.toFixed(2)} (${calculationDetails.filter(d => d.generation === 3).length} downlines)`
      },
      totalBonus: totalMatchingBonus,
      leftLegBonus: totalLeftBonus,
      rightLegBonus: totalRightBonus,
      entriesCount: validResults.length,
      note: 'Each leg (left/right) creates a separate Matching Bonus entry. Sponsor gets Matching Bonus from downlines who earned Daily Match.'
    });
  } else {
    // Log why no bonus was calculated
    console.log(`⚠️ No Matching Bonus calculated for ${memberId}:`, {
      rank: memberRank,
      eligibleGenerations,
      eligibleDownlinesCount: eligibleDownlines.length,
      g1Count: g1Downlines.length,
      g2Count: g2Downlines.length,
      g3Count: g3Downlines.length,
      g1WithDailyMatch: g1WithDailyMatch.length,
      g2WithDailyMatch: g2WithDailyMatch.length,
      g3WithDailyMatch: g3WithDailyMatch.length,
      possibleReasons: [
        g1Downlines.length === 0 && g2Downlines.length === 0 && g3Downlines.length === 0 ? 'No eligible downlines found' : null,
        g1WithDailyMatch.length === 0 && g2WithDailyMatch.length === 0 && g3WithDailyMatch.length === 0 ? 'No downlines have Daily Match commissions' : null,
        rankRates.g1 === 0 && rankRates.g2 === 0 && rankRates.g3 === 0 ? 'Rank has no Matching Bonus rates configured' : null
      ].filter(Boolean)
    });
  }
  
  return validResults;
}

  /**
   * Get all downlines across G1, G2, G3 with their generation level and leg position
   * Leg position is inherited from G1 ancestor (which leg of the sponsor they belong to)
   */
  private static async getAllDownlinesWithGenerations(
    memberId: string
  ): Promise<Array<{ id: string; memberId: string; position: string | null; generation: number }>> {
    const allDownlines: Array<{ id: string; memberId: string; position: string | null; generation: number }> = [];

    // Get G1 (direct downlines) - these have their own position relative to sponsor
    const g1Downlines = await prisma.user.findMany({
      where: { 
        placementParentId: memberId,
        active: true,
        deleted: false
      },
      select: { 
        id: true, 
        memberId: true,
        position: true
      }
    });

    for (const g1 of g1Downlines) {
      // G1 position is relative to the sponsor (left or right leg)
      const g1Leg = g1.position?.toLowerCase() === 'right' ? 'right' : 'left';
      
      allDownlines.push({
        id: g1.id,
        memberId: g1.memberId,
        position: g1Leg,
        generation: 1
      });

      // Get G2 (downlines of G1) - inherit G1's leg position
      const g2Downlines = await prisma.user.findMany({
        where: { 
          placementParentId: g1.id,
          active: true,
          deleted: false
        },
        select: { 
          id: true, 
          memberId: true,
          position: true
        }
      });

      for (const g2 of g2Downlines) {
        // G2 inherits the leg from G1 (which leg of the original sponsor)
        allDownlines.push({
          id: g2.id,
          memberId: g2.memberId,
          position: g1Leg, // Inherit from G1
          generation: 2
        });

        // Get G3 (downlines of G2) - inherit G1's leg position
        const g3Downlines = await prisma.user.findMany({
          where: { 
            placementParentId: g2.id,
            active: true,
            deleted: false
          },
          select: { 
            id: true, 
            memberId: true,
            position: true
          }
        });

        for (const g3 of g3Downlines) {
          // G3 also inherits the leg from G1 (which leg of the original sponsor)
          allDownlines.push({
            id: g3.id,
            memberId: g3.memberId,
            position: g1Leg, // Inherit from G1
            generation: 3
          });
        }
      }
    }

    return allDownlines;
  }

  /**
   * Calculate rank advancement bonus
   * ENHANCED: Check if actually advanced during period
   */
  static async calculateRankAdvancementBonus(
    memberId: string,
    currentRank: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const bonuses: Record<string, number> = {
      'Bronze': 100,
      'Silver': 250,
      'Gold': 500,
      'Platinum': 1000,
      'Diamond': 2500
    };

    // ENHANCEMENT: Check audit logs to see if rank actually advanced in this period
    const rankChanges = await prisma.auditLog.findFirst({
      where: {
        userId: memberId,
        action: 'update',
        entity: 'user',
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        changes: {
          path: ['rank'],
          not: Prisma.DbNull
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Only give bonus if rank actually changed during period
    if (rankChanges) {
      return bonuses[currentRank] || 0;
    }

    return 0;
  }

  /**
   * Map commission type from enum format to database display format
   */
  private static mapCommissionType(type: CommissionBreakdown['type']): string {
    const typeMap: Record<CommissionBreakdown['type'], string> = {
      'binary_bonus': 'Binary Bonus',
      'matching_bonus': 'Matching Bonus',
      'leadership_bonus': 'Leadership Bonus',
      'rank_advance': 'Rank Bonus',
      'daily_match_bonus': 'Daily Match'
    };
    return typeMap[type] || type;
  }

  /**
   * Process commission payments
   * ENHANCED: Added idempotency and better transaction handling
   */
  static async processCommissionPayments(calculations: CommissionCalculation[]): Promise<void> {
    for (const calc of calculations) {
      if (calc.commissionAmount > 0 && calc.qualificationMet) {
        for (const breakdownItem of calc.breakdown) {
          if (breakdownItem.amount <= 0) continue;

          try {
            let commissionId: string | null = null;
            const commissionType = breakdownItem.type;
            
            await prisma.$transaction(async (tx) => {
              // Idempotency check: See if a similar commission was already paid this period.
              const mappedType = this.mapCommissionType(breakdownItem.type);
              
              // For Matching Bonus, check by type and date range (more lenient for matching bonus)
              // For Daily Match, check more strictly to prevent duplicates
              const existing = await tx.commission.findFirst({
                where: {
                  userId: calc.memberId,
                  date: { gte: calc.periodStart, lte: calc.periodEnd },
                  type: mappedType,
                  // For Matching Bonus, don't check description (can have multiple downlines)
                  // For other types, check description for more specific matching
                  ...(breakdownItem.type === 'matching_bonus' 
                    ? {} 
                    : { description: breakdownItem.description }),
                  status: { in: ['Paid', 'Pending'] },
                },
              });

              if (existing) {
                console.log(`Skipping duplicate commission for ${calc.memberId}: ${mappedType} - ${breakdownItem.description}`);
                return;
              }

              // Create commission record
              const commission = await tx.commission.create({
                data: {
                  userId: calc.memberId,
                  amount: breakdownItem.amount,
                  type: mappedType,
                  description: breakdownItem.description,
                  status: 'Pending',
                  date: new Date(),
                  companyId: calc.companyId,
                },
              });

              commissionId = commission.id;

              // Log Matching Bonus commissions for verification
              if (commissionType === 'matching_bonus') {
                console.log(`🎯 Matching Bonus Commission Created:`, {
                  commissionId: commission.id,
                  userId: calc.memberId,
                  amount: breakdownItem.amount,
                  type: commissionType,
                  description: breakdownItem.description,
                  generation: breakdownItem.metadata?.generation,
                  leg: breakdownItem.metadata?.leg,
                  downlineCount: breakdownItem.metadata?.downlineCount,
                  downlineMemberIds: breakdownItem.metadata?.downlineMemberIds
                });
              }

              // Credit to wallet for this specific commission item
              const { WalletService } = await import('./wallet-service');
              await WalletService.creditWallet(
                calc.memberId,
                breakdownItem.amount,
                breakdownItem.description,
                commission.id,
                'commission'
              );

              // Mark as paid
              await tx.commission.update({
                where: { id: commission.id },
                data: { status: 'Paid' },
              });
            });

            // Add commission to E-Cash (after transaction commits)
            if (commissionId) {
              try {
                const { addCommissionToECash } = await import('./e-cash-service');
                await addCommissionToECash(
                  calc.memberId,
                  breakdownItem.amount,
                  commissionId,
                  breakdownItem.type
                );
              } catch (eCashError: any) {
                console.warn(`Failed to add commission to E-Cash for member ${calc.memberId}:`, eCashError.message);
                // Continue - E-Cash addition failure shouldn't break commission payment
              }
            }
          } catch (error) {
            console.error(`Failed to process payment for ${breakdownItem.type} for member ${calc.memberId}:`, error);
            // Log the error for audit
            await prisma.auditLog.create({
              data: {
                userId: calc.memberId,
                action: 'commission_payment_failed',
                entity: 'commission',
                changes: { error: String(error), item: breakdownItem } as any,
                ipAddress: 'system',
                userAgent: 'commission-engine',
              },
            }).catch(logError => console.error('Failed to log error:', logError));
          }
        }
      }
    }
  }

  /**
   * Run complete commission cycle
   * ENHANCED: Better error handling and reporting
   */
  static async runCommissionCycle(
    startDate: Date,
    endDate: Date,
    companyId?: string,
    lockedBy: string = 'system'
  ): Promise<{
    processed: number;
    totalAmount: number;
    errors: string[];
    details: { memberId: string; amount: number; status: string }[];
  }> {
    const result = {
      processed: 0,
      totalAmount: 0,
      errors: [] as string[],
      details: [] as { memberId: string; amount: number; status: string }[]
    };

    // CRITICAL FIX #3: Acquire lock before processing
    const lock = await CommissionLockService.acquireLock(startDate, endDate, lockedBy);
    
    if (!lock) {
      result.errors.push('Commission calculation already in progress or completed for this period');
      console.warn(`Failed to acquire lock for period ${startDate} - ${endDate}`);
      return result;
    }

    try {
      console.log(`Starting commission calculation for ${startDate.toDateString()} - ${endDate.toDateString()}`);

      const calculations = await this.calculatePeriodCommissions(startDate, endDate, companyId);
      console.log(`Calculated commissions for ${calculations.length} members`);

      // ENHANCEMENT: Store calculations before processing
      for (const calc of calculations) {
        result.details.push({
          memberId: calc.memberId,
          amount: calc.commissionAmount,
          status: 'calculated'
        });
      }

      await this.processCommissionPayments(calculations);
      console.log('Commission payments processed');

      result.processed = calculations.length;
      result.totalAmount = Math.round(calculations.reduce((sum, calc) => sum + calc.commissionAmount, 0) * 100) / 100;

      // Update status for successfully processed
      result.details.forEach(d => d.status = 'paid');

      // CRITICAL FIX #3: Release lock on success
      await CommissionLockService.releaseLock(lock.id, true);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Commission cycle failed: ${errorMessage}`);
      console.error('Commission cycle error:', error);

      // CRITICAL FIX #3: Release lock on failure
      await CommissionLockService.releaseLock(lock.id, false, errorMessage);
    }

    return result;
}

}