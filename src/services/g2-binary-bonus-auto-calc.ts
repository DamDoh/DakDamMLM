/**
 * G2 Binary Bonus Auto-Calculation Service
 * 
 * ONE-TIME BONUS: G2 Binary Bonus is paid ONCE when a G2 downline first qualifies.
 * 
 * Eligibility:
 * - Grandparent must be Manager+ rank (Manager, Director, President, Double President)
 * - G2 downline must have PV > 0
 * - G2 downline must NOT be "Member" rank
 * 
 * Calculation: G2's PV × Grandparent's G2 Rate
 * - Manager: 1%
 * - Director: 3%
 * - President: 3%
 * - Double President: 3%
 * 
 * CRITICAL: Uses sponsorId (sponsor relationship) NOT placementParentId (placement relationship)
 * Binary Bonus is based on sponsorship, not binary tree placement.
 */

import { prisma } from '@/lib/prisma';

// G2 Rates by Rank
const G2_RATES: Record<string, number> = {
  'Manager': 0.01,        // 1% G2
  'Director': 0.03,       // 3% G2
  'President': 0.03,      // 3% G2
  'Double President': 0.03 // 3% G2
};

/**
 * Pay G2 Binary Bonus for a PV top-up (renew top-ups) - creates a new commission per top-up
 * Called when a G2 member receives PV via My Stock or Binary Stock transfer
 * Uses placementParentId chain: recipient -> G1 -> grandparent
 */
export async function payG2BinaryBonusForPVTopUp(
  g2MemberId: string,
  pvIncrement: number
): Promise<void> {
  if (pvIncrement <= 0) return;
  try {
    const g2Member = await prisma.user.findUnique({
      where: { id: g2MemberId },
      select: {
        id: true,
        memberId: true,
        placementParentId: true,
        sponsorId: true,
        rank: true
      }
    });
    if (!g2Member) return;
    const member = g2Member;

    const g1Id = member.placementParentId || member.sponsorId;
    if (!g1Id) return;

    const g1 = await prisma.user.findUnique({
      where: { id: g1Id },
      select: { id: true, placementParentId: true, sponsorId: true }
    });
    if (!g1) return;

    const grandparentId = g1.placementParentId || g1.sponsorId;
    if (!grandparentId) return;

    const grandparent = await prisma.user.findUnique({
      where: { id: grandparentId },
      select: { id: true, rank: true, memberId: true, active: true, deleted: true, companyId: true }
    });
    if (!grandparent || !grandparent.active || grandparent.deleted) return;

    const grandparentRank = (grandparent.rank || '').trim();
    const g2Rate = G2_RATES[grandparentRank] || 0;
    if (g2Rate === 0) return;

    const g2Rank = (member.rank || '').trim();
    if (!g2Rank || g2Rank.toLowerCase() === 'member') return;

    const g2Bonus = Math.round(pvIncrement * g2Rate * 100) / 100;
    if (g2Bonus <= 0) return;

    const commission = await prisma.commission.create({
      data: {
        userId: grandparent.id,
        type: 'Binary Bonus',
        amount: g2Bonus,
        status: 'Paid',
        date: new Date(),
        description: `G2 Binary Bonus: ${member.memberId} (+${pvIncrement} PV × ${(g2Rate * 100).toFixed(0)}%) = $${g2Bonus.toFixed(2)}`,
        companyId: grandparent.companyId ?? undefined
      }
    });

    const { WalletServiceEnhanced } = await import('./wallet-service-enhanced');
    await WalletServiceEnhanced.creditWallet(
      grandparent.id,
      g2Bonus,
      'Binary Bonus',
      `g2_bonus_pv:${g2MemberId}:${Date.now()}`,
      'commission'
    );

    console.log(`✅ [G2 Bonus PV] ${grandparent.memberId}: +${pvIncrement} PV from ${member.memberId} × ${(g2Rate * 100).toFixed(0)}% = $${g2Bonus.toFixed(2)}`);
  } catch (error) {
    console.error('❌ [G2 Bonus PV] Failed:', error);
  }
}

/**
 * Auto-calculate G2 Binary Bonus for a grandparent when G1 gets a new downline
 * This processes ALL G2 downlines of the grandparent, not just the new one
 * 
 * ONE-TIME: Only pays if specific G2 hasn't already earned bonus for grandparent
 */
export async function autoCalculateG2BinaryBonus(
  g1ParentId: string,
  g2ChildId: string
): Promise<void> {
  try {
    console.log(`🔄 [G2 Bonus] Starting auto-calculation:`, { g1ParentId, g2ChildId });

    // Get G1 parent to find grandparent (sponsor)
    // CRITICAL FIX: Use sponsorId for binary bonus, not placementParentId
    const g1Parent = await prisma.user.findUnique({
      where: { id: g1ParentId },
      select: {
        id: true,
        sponsorId: true, // FIXED: Use sponsorId instead of placementParentId
        memberId: true
      }
    });

    if (!g1Parent?.sponsorId) {
      console.log(`⏭️ [G2 Bonus] G1 parent has no sponsor (grandparent), skipping`);
      return;
    }

    // Get grandparent (sponsor of G1)
    const grandparent = await prisma.user.findUnique({
      where: { id: g1Parent.sponsorId },
      select: {
        id: true,
        rank: true,
        memberId: true,
        active: true,
        deleted: true,
        companyId: true
      }
    });

    if (!grandparent || !grandparent.active || grandparent.deleted) {
      console.log(`⏭️ [G2 Bonus] Grandparent not found or inactive`);
      return;
    }

    // Check if grandparent is Manager+ rank
    const g2Rate = G2_RATES[grandparent.rank] || 0;
    if (g2Rate === 0) {
      console.log(`⏭️ [G2 Bonus] Grandparent ${grandparent.memberId} is ${grandparent.rank}, not eligible for G2 bonus`);
      return;
    }

    console.log(`✅ [G2 Bonus] Processing ALL G2 downlines for grandparent ${grandparent.memberId} (${grandparent.rank})`);

    // Get ALL G1 downlines of grandparent (based on sponsor relationship)
    // CRITICAL FIX: Use sponsorId instead of placementParentId
    const allG1Downlines = await prisma.user.findMany({
      where: {
        sponsorId: grandparent.id, // FIXED: Use sponsorId for binary bonus
        active: true,
        deleted: false
      },
      select: { id: true, memberId: true, position: true }
    });

    console.log(`   Found ${allG1Downlines.length} G1 downlines`);

    let totalNewBonus = 0;
    let newBonusCount = 0;

    // Process ALL G2 downlines from ALL G1s
    // CRITICAL FIX: Use sponsorId to find G2 downlines (who did G1 sponsor?)
    for (const g1 of allG1Downlines) {
      const g2Downlines = await prisma.user.findMany({
        where: {
          sponsorId: g1.id, // FIXED: Use sponsorId for binary bonus
          active: true,
          deleted: false
        },
        select: {
          id: true,
          memberId: true,
          rank: true,
          pv: true
        }
      });

      for (const g2 of g2Downlines) {
        const g2Rank = (g2.rank || '').trim();
        const g2PV = Number(g2.pv) || 0;
        const isEligible = g2Rank !== '' && g2Rank.toLowerCase() !== 'member' && g2PV > 0;

        if (!isEligible) {
          continue;
        }

        // Check if G2 bonus was already paid for this specific G2 child
        const existingBonus = await prisma.commission.findFirst({
          where: {
            userId: grandparent.id,
            type: 'Binary Bonus',
            description: { contains: g2.memberId }
          }
        });

        if (existingBonus) {
          continue; // Already paid
        }

        // Calculate G2 bonus: G2's PV × G2 Rate
        const g2Bonus = Math.round(g2PV * g2Rate * 100) / 100;

        // Create G2 Binary Bonus commission
        const newCommission = await prisma.commission.create({
          data: {
            userId: grandparent.id,
            type: 'Binary Bonus',
            amount: g2Bonus,
            status: 'Paid',
            date: new Date(),
            description: `G2 Binary Bonus: ${g2.memberId} (${g2PV} PV × ${(g2Rate * 100).toFixed(0)}%) = $${g2Bonus.toFixed(2)}`,
            companyId: grandparent.companyId ?? undefined
          }
        });

        // Update wallet
        let wallet = await prisma.wallet.findUnique({
          where: { userId: grandparent.id }
        });

        if (!wallet) {
          wallet = await prisma.wallet.create({
            data: {
              userId: grandparent.id,
              balance: 0,
              companyId: grandparent.companyId ?? undefined
            }
          });
        }

        const balanceBefore = wallet.balance;
        const balanceAfter = balanceBefore + g2Bonus;

        await prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: balanceAfter }
        });

        // Create wallet transaction
        await prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'Commission',
            amount: g2Bonus,
            balanceBefore,
            balanceAfter,
            description: `G2 Binary Bonus from ${g2.memberId}`,
            referenceId: newCommission.id,
            referenceType: 'commission',
            companyId: grandparent.companyId ?? undefined
          }
        });

        totalNewBonus += g2Bonus;
        newBonusCount++;

        console.log(`   ✅ ${g2.memberId}: ${g2PV} PV × ${(g2Rate * 100).toFixed(0)}% = $${g2Bonus.toFixed(2)}`);
      }
    }

    if (newBonusCount > 0) {
      console.log(`✅ [G2 Bonus] Created ${newBonusCount} new G2 bonuses totaling $${totalNewBonus.toFixed(2)} for ${grandparent.memberId}`);
    } else {
      console.log(`ℹ️ [G2 Bonus] No new G2 bonuses needed for ${grandparent.memberId}`);
    }

  } catch (error) {
    console.error('❌ [G2 Bonus] Failed:', error);
    // Don't throw - this is a background calculation
  }
}

/**
 * Recalculate G2 Binary Bonus for a specific grandparent
 * This finds ALL G2 downlines and ensures bonuses are paid for each
 */
export async function recalculateG2BinaryBonus(grandparentId: string): Promise<{
  processed: number;
  created: number;
  skipped: number;
  totalAmount: number;
}> {
  const result = { processed: 0, created: 0, skipped: 0, totalAmount: 0 };

  try {
    const grandparent = await prisma.user.findUnique({
      where: { id: grandparentId },
      select: {
        id: true,
        rank: true,
        memberId: true,
        active: true,
        deleted: true,
        companyId: true
      }
    });

    if (!grandparent || !grandparent.active || grandparent.deleted) {
      console.log(`⏭️ [G2 Recalc] Grandparent ${grandparentId} not found or inactive`);
      return result;
    }

    const g2Rate = G2_RATES[grandparent.rank] || 0;
    if (g2Rate === 0) {
      console.log(`⏭️ [G2 Recalc] ${grandparent.memberId} is ${grandparent.rank}, not eligible`);
      return result;
    }

    console.log(`🔄 [G2 Recalc] Processing ${grandparent.memberId} (${grandparent.rank})`);

    // Get all G1 downlines (based on sponsor relationship)
    // CRITICAL FIX: Use sponsorId instead of placementParentId
    const g1Downlines = await prisma.user.findMany({
      where: {
        sponsorId: grandparent.id, // FIXED: Use sponsorId for binary bonus
        active: true,
        deleted: false
      },
      select: { id: true, memberId: true }
    });

    // Get all G2 downlines from each G1 (based on sponsor relationship)
    // CRITICAL FIX: Use sponsorId to find G2 downlines
    for (const g1 of g1Downlines) {
      const g2Downlines = await prisma.user.findMany({
        where: {
          sponsorId: g1.id, // FIXED: Use sponsorId for binary bonus
          active: true,
          deleted: false
        },
        select: {
          id: true,
          memberId: true,
          rank: true,
          pv: true
        }
      });

      for (const g2 of g2Downlines) {
        result.processed++;

        const g2Rank = (g2.rank || '').trim();
        const g2PV = Number(g2.pv) || 0;
        const isEligible = g2Rank !== '' && g2Rank.toLowerCase() !== 'member' && g2PV > 0;

        if (!isEligible) {
          result.skipped++;
          continue;
        }

        // Check if already paid
        const existing = await prisma.commission.findFirst({
          where: {
            userId: grandparent.id,
            type: 'Binary Bonus',
            description: { contains: g2.memberId }
          }
        });

        if (existing) {
          result.skipped++;
          continue;
        }

        // Calculate and create bonus
        const g2Bonus = Math.round(g2PV * g2Rate * 100) / 100;

        const newCommission = await prisma.commission.create({
          data: {
            userId: grandparent.id,
            type: 'Binary Bonus',
            amount: g2Bonus,
            status: 'Paid',
            date: new Date(),
            description: `G2 Binary Bonus: ${g2.memberId} (${g2PV} PV × ${(g2Rate * 100).toFixed(0)}%) = $${g2Bonus.toFixed(2)}`,
            companyId: grandparent.companyId ?? undefined
          }
        });

        // Update wallet
        let wallet = await prisma.wallet.findUnique({ where: { userId: grandparent.id } });
        if (!wallet) {
          wallet = await prisma.wallet.create({
            data: {
              userId: grandparent.id,
              balance: 0,
              companyId: grandparent.companyId ?? undefined
            }
          });
        }

        await prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: g2Bonus } }
        });

        // Create wallet transaction
        await prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'Commission',
            amount: g2Bonus,
            balanceBefore: wallet.balance,
            balanceAfter: wallet.balance + g2Bonus,
            description: `G2 Binary Bonus from ${g2.memberId}`,
            referenceId: newCommission.id,
            referenceType: 'commission',
            companyId: grandparent.companyId ?? undefined
          }
        });

        result.created++;
        result.totalAmount += g2Bonus;
        console.log(`   ✅ ${g2.memberId}: $${g2Bonus.toFixed(2)}`);
      }
    }

    console.log(`✅ [G2 Recalc] Complete for ${grandparent.memberId}:`, result);
    return result;

  } catch (error) {
    console.error(`❌ [G2 Recalc] Failed for ${grandparentId}:`, error);
    throw error;
  }
}

/**
 * Process G2 Binary Bonus for ALL eligible Manager+ members
 * Useful for backfilling existing structures
 */
export async function processAllG2BinaryBonuses(): Promise<{
  processed: number;
  successful: number;
  failed: number;
  totalAmount: number;
}> {
  console.log(`🔄 [G2 Batch] Starting batch processing for all Manager+ members...`);

  const overallResult = { processed: 0, successful: 0, failed: 0, totalAmount: 0 };

  // Find all active Manager+ members
  const managerPlusMembers = await prisma.user.findMany({
    where: {
      active: true,
      deleted: false,
      rank: { in: ['Manager', 'Director', 'President', 'Double President'] }
    },
    select: { id: true, memberId: true, rank: true }
  });

  console.log(`📋 [G2 Batch] Found ${managerPlusMembers.length} Manager+ members`);

  for (const member of managerPlusMembers) {
    try {
      const result = await recalculateG2BinaryBonus(member.id);
      overallResult.processed++;
      if (result.created > 0) {
        overallResult.successful++;
        overallResult.totalAmount += result.totalAmount;
      }
    } catch (error) {
      overallResult.failed++;
      console.error(`❌ [G2 Batch] Failed for ${member.memberId}:`, error);
    }
  }

  console.log(`✅ [G2 Batch] Complete:`, overallResult);
  return overallResult;
}
