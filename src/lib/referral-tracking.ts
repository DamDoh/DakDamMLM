import { prisma } from '@/lib/database';

export interface ReferralLink {
  id: string;
  sponsorId: string;
  companyId: string;
  code: string;
  url: string;
  clicks: number;
  conversions: number;
  isActive: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  metadata: unknown;
}

/**
 * Generate a unique referral code
 */
export function generateReferralCode(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Create a referral link for a sponsor
 */
export async function createReferralLink(
  sponsorId: string,
  companyId: string,
  options: {
    expiresIn?: number; // days
    metadata?: Record<string, unknown>;
    baseUrl?: string; // Optional base URL from request
  } = {}
): Promise<ReferralLink> {
  const code = generateReferralCode();
  const expiresAt = options.expiresIn
    ? new Date(Date.now() + options.expiresIn * 24 * 60 * 60 * 1000)
    : undefined;

  const referralLink = await prisma.referralLink.create({
    data: {
      sponsorId,
      companyId,
      code,
      clicks: 0,
      conversions: 0,
      isActive: true,
      expiresAt,
      metadata: (options.metadata ?? {}) as any,
    }
  });

  // Use provided baseUrl, or environment variable, or default
  const baseUrl = options.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = `${baseUrl}/register?ref=${code}`;

  return {
    ...referralLink,
    url,
  };
}

/**
 * Track a referral link click
 */
export async function trackReferralClick(
  referralCode: string, 
  metadata?: Record<string, unknown>,
  baseUrl?: string
): Promise<ReferralLink | null> {
  try {
    const referralLink = await prisma.referralLink.findUnique({
      where: { code: referralCode }
    });

    if (!referralLink || !referralLink.isActive) {
      return null;
    }

    // Check if expired
    if (referralLink.expiresAt && referralLink.expiresAt < new Date()) {
      return null;
    }

    // Update click count
    const updatedLink = await prisma.referralLink.update({
      where: { id: referralLink.id },
      data: {
        clicks: { increment: 1 },
        metadata: {
          ...(referralLink.metadata && typeof referralLink.metadata === 'object'
            ? (referralLink.metadata as any)
            : {}),
          lastClickAt: new Date().toISOString(),
          clickMetadata: metadata,
        }
      }
    });

    // Use provided baseUrl, or environment variable, or default
    const urlBase = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    return {
      ...updatedLink,
      url: `${urlBase}/register?ref=${updatedLink.code}`,
    };
  } catch (error) {
    console.error('Error tracking referral click:', error);
    return null;
  }
}

/**
 * Track a referral conversion (successful registration)
 * Also calculates and processes commission for the sponsor based on their rank
 */
export async function trackReferralConversion(referralCode: string, newMemberId: string): Promise<boolean> {
  try {
    const referralLink = await prisma.referralLink.findUnique({
      where: { code: referralCode },
      include: {
        sponsor: {
          select: {
            id: true,
            rank: true,
            fullName: true,
            memberId: true,
          }
        }
      }
    });

    if (!referralLink) {
      return false;
    }

    // Check if link is active
    if (!referralLink.isActive) {
      return false;
    }

    // Check if expired
    if (referralLink.expiresAt && referralLink.expiresAt < new Date()) {
      return false;
    }

    // Update conversion count
    await prisma.referralLink.update({
      where: { id: referralLink.id },
      data: {
        conversions: { increment: 1 },
        metadata: {
          ...(referralLink.metadata && typeof referralLink.metadata === 'object'
            ? (referralLink.metadata as any)
            : {}),
          lastConversionAt: new Date().toISOString(),
          convertedMemberId: newMemberId,
        }
      }
    });

    // Create referral relationship record
    await prisma.referralRelationship.create({
      data: {
        referralLinkId: referralLink.id,
        sponsorId: referralLink.sponsorId,
        memberId: newMemberId,
        companyId: referralLink.companyId,
        status: 'active',
      }
    });

    // Calculate and process commission ONLY if:
    // 1. Sponsor rank is Bronze or above (not Member)
    // 2. Registered user rank is Bronze or above (not Member)
    const sponsorRank = referralLink.sponsor?.rank || null;
    
    // Get the registered user's rank
    const registeredUser = await prisma.user.findUnique({
      where: { id: newMemberId },
      select: { rank: true, fullName: true, memberId: true }
    });
    
    const registeredUserRank = registeredUser?.rank || null;
    
    // Log the ranks we received for debugging
    console.log(`[Referral Commission] Rank Check - Sponsor: "${sponsorRank}", Registered User: "${registeredUserRank}" (User: ${registeredUser?.fullName || newMemberId})`);
    
    // Normalize ranks: trim whitespace and handle case sensitivity
    const normalizedSponsorRank = sponsorRank ? sponsorRank.trim() : null;
    const normalizedRegisteredRank = registeredUserRank ? registeredUserRank.trim() : null;
    
    // Valid ranks that have PV points (Bronze and above)
    const validRanks = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Manager', 'Director', 'President', 'Double President'];
    
    // CRITICAL: Check sponsor rank - must be Bronze or above
    const isSponsorMember = !normalizedSponsorRank || 
                            normalizedSponsorRank === '' || 
                            normalizedSponsorRank.toLowerCase() === 'member';
    const isSponsorValidRank = normalizedSponsorRank && validRanks.includes(normalizedSponsorRank);
    
    // CRITICAL: Check registered user rank - must be Bronze or above
    // Check if registered user is Member (case-insensitive, with multiple checks)
    const isRegisteredMember = !normalizedRegisteredRank || 
                               normalizedRegisteredRank === '' || 
                               normalizedRegisteredRank.toLowerCase() === 'member' ||
                               normalizedRegisteredRank === 'Member' ||
                               !validRanks.includes(normalizedRegisteredRank);
    const isRegisteredValidRank = normalizedRegisteredRank && validRanks.includes(normalizedRegisteredRank);
    
    // Early return if sponsor is Member
    if (isSponsorMember || !isSponsorValidRank) {
      console.log(`[Referral Commission] Skipping - Sponsor rank is Member or invalid: "${sponsorRank}"`);
      return true; // Return success but skip commission calculation
    }
    
    // CRITICAL: Early return if registered user is Member - NO COMMISSION FOR MEMBER RANK
    // This check must happen BEFORE any commission calculation
    if (isRegisteredMember || !isRegisteredValidRank) {
      console.log(`[Referral Commission] SKIPPED - Registered user rank is Member or invalid: "${registeredUserRank}" (User: ${registeredUser?.fullName || newMemberId}). Commission will NOT be calculated.`);
      return true; // Return success but skip commission calculation
    }
    
    // Both sponsor and registered user must have valid ranks (Bronze or above)
    console.log(`[Referral Commission] Processing commission - Sponsor: "${normalizedSponsorRank}", Registered User: "${normalizedRegisteredRank}"`);
    
    try {
      // DOUBLE CHECK: Ensure registered user is NOT Member before calculating commission
      if (!normalizedRegisteredRank || 
          normalizedRegisteredRank.toLowerCase() === 'member' ||
          !validRanks.includes(normalizedRegisteredRank)) {
        console.log(`[Referral Commission] DOUBLE CHECK FAILED - Registered user rank is Member or invalid: "${registeredUserRank}". Commission calculation ABORTED.`);
        return true; // Return success but skip commission calculation
      }
      
      // COMMISSION CALCULATION LOGIC:
      // - PV Points: Based on registered user's rank (the person being referred)
      //   Example: Bronze = 60 PV, Silver = 100 PV, Gold = 500 PV, etc.
      // - Commission Rate: Based on sponsor's rank (the person who shared the referral link)
      //   Example: Silver = 10%, Gold = 14%, Diamond = 17%, etc.
      // - Formula: Commission Amount = Registered User's PV Points × Sponsor's Commission Rate
      //   Example: If sponsor is Silver (10%) and friend is Bronze (60 PV):
      //            Commission = 60 PV × 10% = 6.0 (displayed as $6.00)
      const pvPoints = getPVPointsByRank(normalizedRegisteredRank);
      const commissionRate = getCommissionRateByRank(normalizedSponsorRank);
      
      // Final safety check: ensure PV points and rate are valid
      if (pvPoints <= 0 || commissionRate <= 0) {
        console.log(`[Referral Commission] Skipping - Invalid values: PV=${pvPoints}, Rate=${commissionRate}`);
        return true; // Return success but skip commission
      }
      
      const commissionAmount = Math.round(pvPoints * commissionRate * 100) / 100;

      console.log(`[Referral Commission] Calculation: ${pvPoints} PV (${normalizedRegisteredRank}) × ${(commissionRate * 100).toFixed(1)}% (${normalizedSponsorRank}) = ${commissionAmount} (displayed as ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(commissionAmount)})`);

      // Final check: only proceed if commission amount is greater than 0
      if (commissionAmount > 0) {
          // Use transaction to ensure atomicity
          await prisma.$transaction(async (tx) => {
            // Check if commission already exists for this referral (idempotency)
            // Use a unique identifier in the type field to prevent duplicates
            const commissionType = `Referral Commission - ${newMemberId}`;
            const existingCommission = await tx.commission.findFirst({
              where: {
                userId: referralLink.sponsorId,
                type: commissionType,
                date: {
                  gte: new Date(new Date().setHours(0, 0, 0, 0)), // Today
                  lt: new Date(new Date().setHours(23, 59, 59, 999))
                }
              }
            });

            if (existingCommission) {
              console.log(`Commission already exists for referral ${newMemberId}, skipping`);
              return;
            }

            // Create commission record
            const commission = await tx.commission.create({
              data: {
                userId: referralLink.sponsorId,
                amount: commissionAmount,
                type: commissionType,
                status: 'Pending',
                date: new Date()
              }
            });

            // Get new member info for transaction description
            const newMember = await tx.user.findUnique({
              where: { id: newMemberId },
              select: { fullName: true, memberId: true }
            });

            // Get current wallet balance before credit
            const { WalletService } = await import('@/services/wallet-service');
            const balanceBefore = await WalletService.getBalance(referralLink.sponsorId);

            // Credit to wallet
            const updatedWallet = await WalletService.creditWallet(
              referralLink.sponsorId,
              commissionAmount,
              `Referral commission: ${pvPoints} PV × ${(commissionRate * 100).toFixed(1)}%`,
              commission.id,
              'commission'
            );

            // Mark commission as paid
            await tx.commission.update({
              where: { id: commission.id },
              data: { status: 'Paid' }
            });

            // Create E-Cash transaction record with correct balance
            await (tx as any).ecashTransaction.create({
              data: {
                memberId: referralLink.sponsorId,
                type: 'credit',
                amount: commissionAmount,
                balanceBefore: balanceBefore,
                balanceAfter: updatedWallet.balance,
                description: `Referral commission from ${newMember?.fullName || 'new member'} (${newMember?.memberId || newMemberId}) - ${pvPoints} PV × ${(commissionRate * 100).toFixed(1)}%`,
                status: 'completed',
                referenceId: commission.id,
                referenceType: 'commission'
              }
            });

            // Send notification to sponsor
            const { createNotification } = await import('@/services/notification-service');
            await createNotification(
              referralLink.sponsorId,
              'referral-commission',
              {
                memberName: referralLink.sponsor?.fullName || 'You',
                amount: commissionAmount.toFixed(2),
                pvPoints: pvPoints.toString(),
                newMemberName: newMember?.fullName || 'New Member',
                rate: (commissionRate * 100).toFixed(1)
              },
              'high',
              {
                type: 'referral_commission',
                commissionId: commission.id,
                referralMemberId: newMemberId,
                link: '/ecash'
              }
            );
          });
        } else {
          console.log(`[Referral Commission] Skipping - Commission amount is 0 or negative: ${commissionAmount}`);
        }
    } catch (commissionError) {
      // Log error but don't fail referral tracking
      console.error('Error processing referral commission:', commissionError);
    }

    return true;
  } catch (error) {
    console.error('Error tracking referral conversion:', error);
    return false;
  }
}

/**
 * Get PV points based on rank for referral commission calculation
 */
export function getPVPointsByRank(rank: string | null | undefined): number {
  const pvPoints: Record<string, number> = {
    'Member': 0,              // 0 PV
    'Bronze': 60,             // 60 PV
    'Silver': 100,            // 100 PV
    'Gold': 500,              // 500 PV
    'Diamond': 1000,          // 1000 PV
    'Manager': 1000,          // 1000 PV
    'Director': 1000,         // 1000 PV
    'President': 1000,         // 1000 PV
    'Double President': 1000, // 1000 PV
  };

  // If no rank or rank not found, default to Member (0 PV)
  if (!rank) {
    return 0;
  }

  return pvPoints[rank] || 0; // Default to Member (0 PV) if rank not in list
}

/**
 * Get commission rate based on rank
 */
export function getCommissionRateByRank(rank: string | null | undefined): number {
  const rates: Record<string, number> = {
    'Member': 0.0,           // 0.0%
    'Bronze': 0.08,          // 8.0%
    'Silver': 0.10,          // 10%
    'Gold': 0.14,            // 14%
    'Diamond': 0.17,        // 17%
    'Manager': 0.17,        // 17%
    'Director': 0.17,        // 17%
    'President': 0.17,       // 17%
    'Double President': 0.17, // 17%
  };

  // If no rank or rank not found, default to Member rate (0.0%)
  if (!rank) {
    return 0.0; // Default to Member rate (0.0%) if no rank
  }

  return rates[rank] || 0.0; // Default to Member rate (0.0%) if rank not in list
}

/**
 * Calculate Binary Bonus commission when a member's rank changes from Member to higher rank
 * This is called when PV is added and rank is updated
 * Also recalculates when member upgrades ranks (e.g., Silver to Gold) to use the new higher PV
 * 
 * IMPORTANT: Binary Bonus is always credited to the DIRECT SPONSOR (sponsorId), NOT the placement parent.
 * Sponsorship (referral) and placement (binary tree position) are two separate relationships.
 * 
 * @param memberId - The member whose rank changed
 * @param pvAdded - Optional: The actual PV amount that was added (e.g., 400 PV). 
 *                  If provided, calculates binary bonus on this actual amount instead of rank PV difference.
 */
export async function calculateBinaryBonusOnRankChange(memberId: string, pvAdded?: number): Promise<boolean> {
  try {
    const { getPVPointsByRank, getCommissionRateByRank } = await import('@/lib/referral-tracking');
    
    // CRITICAL FIX: Check if PV change came from a stock transfer
    // Stock transfers should NOT trigger binary bonus - only actual rank upgrades from PV topups/transfers should
    if (pvAdded !== undefined && pvAdded > 0) {
      try {
        // Check for recent wallet transactions with referenceType 'stock_transfer'
        // If found within last 5 minutes, this PV change came from stock transfer
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        const wallet = await prisma.wallet.findUnique({
          where: { userId: memberId }
        });
        
        if (wallet) {
          const recentStockTransfer = await prisma.walletTransaction.findFirst({
            where: {
              walletId: wallet.id,
              referenceType: 'stock_transfer',
              type: 'credit',
              createdAt: {
                gte: fiveMinutesAgo
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          });
          
          if (recentStockTransfer) {
            console.log(`[Binary Bonus Rank Change] Skipping binary bonus for ${memberId} - PV change came from stock transfer (transaction: ${recentStockTransfer.id})`);
            return false;
          }
        }
      } catch (checkError) {
        // If check fails, log but continue (don't block binary bonus calculation)
        console.warn(`[Binary Bonus Rank Change] Failed to check stock transfer source for ${memberId}:`, checkError);
      }
    }
    
    // Get member's current data
    const member = await prisma.user.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        rank: true,
        placementParentId: true,
        sponsorId: true,
        createdAt: true,
        pv: true
      }
    });

    if (!member) {
      console.log(`[Binary Bonus Rank Change] Member not found: ${memberId}`);
      return false;
    }

    // CRITICAL FIX: Binary Bonus must go to DIRECT SPONSOR, not placement parent
    // Check if member has a direct sponsor (referrer)
    if (!member.sponsorId) {
      console.log(`[Binary Bonus Rank Change] Member ${memberId} has no direct sponsor (sponsorId), skipping`);
      return false;
    }

    // Check if member was created recently (within last 90 days) - only calculate for recently placed members
    const daysSinceCreation = (Date.now() - member.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation > 90) {
      console.log(`[Binary Bonus Rank Change] Member ${memberId} was created ${daysSinceCreation.toFixed(1)} days ago, skipping`);
      return false;
    }

    // Get member's current rank
    const memberRank = member.rank || 'Member';
    const normalizedMemberRank = memberRank.trim();

    // Valid ranks that have PV points (Bronze and above)
    const validRanks = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Manager', 'Director', 'President', 'Double President'];

    // Check if member is Member rank - if so, no commission
    const isMemberRank = !normalizedMemberRank || 
                        normalizedMemberRank === '' || 
                        normalizedMemberRank.toLowerCase() === 'member' ||
                        !validRanks.includes(normalizedMemberRank);

    if (isMemberRank) {
      console.log(`[Binary Bonus Rank Change] Member ${memberId} is still Member rank, skipping`);
      return false;
    }

    // CRITICAL FIX: Use ONLY direct sponsorId for Binary Bonus
    // Do NOT use placementParentId as fallback - they are separate relationships
    const sponsorIdToUse = member.sponsorId;
    if (!sponsorIdToUse) {
      console.log(`[Binary Bonus Rank Change] No direct sponsor (sponsorId) found for member ${memberId}, skipping`);
      return false;
    }

    const sponsor = await prisma.user.findUnique({
      where: { id: sponsorIdToUse },
      select: { rank: true }
    });

    if (!sponsor) {
      console.log(`[Binary Bonus Rank Change] Sponsor ${sponsorIdToUse} not found, skipping`);
      return false;
    }

    const sponsorRank = sponsor.rank || null;
    const normalizedSponsorRank = sponsorRank ? sponsorRank.trim() : null;

    // Check if sponsor has valid rank
    const isSponsorMember = !normalizedSponsorRank || 
                            normalizedSponsorRank === '' || 
                            normalizedSponsorRank.toLowerCase() === 'member';
    const isSponsorValidRank = normalizedSponsorRank && validRanks.includes(normalizedSponsorRank);

    if (isSponsorMember || !isSponsorValidRank) {
      console.log(`[Binary Bonus Rank Change] Sponsor ${sponsorIdToUse} is Member or invalid rank: "${sponsorRank}", skipping`);
      return false;
    }

    // Additional check: Even if pvAdded is not provided, check if recent stock transfer exists
    // This handles cases where rank was updated but pvAdded wasn't passed
    if (pvAdded === undefined) {
      try {
        const wallet = await prisma.wallet.findUnique({
          where: { userId: memberId }
        });
        
        if (wallet) {
          // Check for stock transfers in the last 10 minutes (wider window for rank updates)
          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
          
          const recentStockTransfer = await prisma.walletTransaction.findFirst({
            where: {
              walletId: wallet.id,
              referenceType: 'stock_transfer',
              type: 'credit',
              createdAt: {
                gte: tenMinutesAgo
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          });
          
          if (recentStockTransfer) {
            console.log(`[Binary Bonus Rank Change] Skipping binary bonus for ${memberId} - rank change likely from stock transfer (transaction: ${recentStockTransfer.id})`);
            return false;
          }
        }
      } catch (checkError) {
        // If check fails, log but continue
        console.warn(`[Binary Bonus Rank Change] Failed to check stock transfer source for ${memberId}:`, checkError);
      }
    }

    // Get PV points for the member's current rank
    const pvPoints = getPVPointsByRank(normalizedMemberRank);
    const commissionRate = getCommissionRateByRank(normalizedSponsorRank);

    // If pvAdded is provided, use it directly for calculation (actual PV added, e.g., 400 PV)
    // Otherwise, use rank-based PV points (for first-time rank achievement)
    let pvToCalculate = pvPoints;
    let isRankUpgrade = false;
    
    if (pvAdded !== undefined && pvAdded > 0) {
      // CRITICAL FIX: Search for existing commissions for the DIRECT SPONSOR, not placement parent
      // Check if Binary Bonus already exists for this member (rank upgrade scenario)
      const existingCommissions = await prisma.commission.findMany({
        where: {
          userId: sponsorIdToUse, // Use direct sponsorId, not placementParentId
          type: 'Binary Bonus',
          date: {
            gte: member.createdAt
          }
        },
        orderBy: {
          date: 'desc'
        }
      });

      // Find the commission that matches this member
      let existingCommission = null;
      let existingPV = 0;
      
      for (const comm of existingCommissions) {
        // Check if description contains memberId or calculate PV from amount
        const calculatedPV = commissionRate > 0 ? comm.amount / commissionRate : 0;
        
        // If the calculated PV matches a rank PV that's less than current, it's likely for this member
        const rankPVs = [60, 100, 500, 1000]; // Bronze, Silver, Gold, Diamond/Manager+
        const matchesRankPV = rankPVs.some(rankPV => Math.abs(calculatedPV - rankPV) < 1);
        
        if (comm.description?.includes(memberId) || matchesRankPV) {
          existingCommission = comm;
          existingPV = calculatedPV;
          break;
        }
      }

      // If existing commission found, this is a rank upgrade - calculate on actual PV added
      if (existingCommission && existingPV > 0) {
        isRankUpgrade = true;
        pvToCalculate = pvAdded; // Use actual PV added (e.g., 400 PV)
        console.log(`[Binary Bonus Rank Change] Member ${memberId} rank upgrade detected. Existing commission: ${existingPV} PV. Calculating binary bonus on actual PV added: ${pvAdded} PV`);
      } else {
        // First time rank achievement - use rank PV points
        console.log(`[Binary Bonus Rank Change] First time rank achievement for member ${memberId}. Using rank PV points: ${pvPoints} PV`);
      }
    }

    // Final safety check
    if (pvToCalculate <= 0 || commissionRate <= 0) {
      console.log(`[Binary Bonus Rank Change] Invalid values: PV=${pvToCalculate}, Rate=${commissionRate}`);
      return false;
    }

    const commissionAmount = Math.round(pvToCalculate * commissionRate * 100) / 100;

    const pvSource = isRankUpgrade ? `actual PV added (${pvToCalculate} PV)` : `rank PV points (${pvToCalculate} PV)`;
    console.log(`[Binary Bonus Rank Change] Calculation for member ${memberId}: ${pvSource} × ${(commissionRate * 100).toFixed(1)}% (${normalizedSponsorRank}) = ${commissionAmount}`);

    // Get member info for description
    const memberInfo = await prisma.user.findUnique({
      where: { id: memberId },
      select: { fullName: true, memberId: true }
    });

    // Create commission record
    // CRITICAL FIX: Commission goes to DIRECT SPONSOR (sponsorId), not placement parent
    const description = isRankUpgrade
      ? `Binary Bonus: Member ${memberInfo?.fullName || memberId} (${memberId}) rank upgraded - ${pvToCalculate} PV added × ${(commissionRate * 100).toFixed(1)}%`
      : `Binary Bonus: Member ${memberInfo?.fullName || memberId} (${memberId}) (${normalizedMemberRank}, ${pvToCalculate} PV) rank achievement - ${pvToCalculate} PV × ${(commissionRate * 100).toFixed(1)}%`;
    
    const commission = await prisma.commission.create({
      data: {
        userId: sponsorIdToUse, // CRITICAL FIX: Use direct sponsorId, not placementParentId
        amount: commissionAmount,
        type: 'Binary Bonus',
        status: 'Paid',
        date: new Date(),
        description: description
      }
    });

    // Credit the wallet immediately
    try {
      const { WalletService } = await import('@/services/wallet-service');

      const walletDescription = isRankUpgrade
        ? `Binary Bonus: Member ${memberInfo?.fullName || memberId} rank upgraded - ${pvToCalculate} PV added × ${(commissionRate * 100).toFixed(1)}%`
        : `Binary Bonus: Member ${memberInfo?.fullName || memberId} (${normalizedMemberRank}, ${pvToCalculate} PV) rank achievement - ${pvToCalculate} PV × ${(commissionRate * 100).toFixed(1)}%`;

      // CRITICAL FIX: Credit wallet to DIRECT SPONSOR, not placement parent
      await WalletService.creditWallet(
        sponsorIdToUse, // Use direct sponsorId, not placementParentId
        commissionAmount,
        walletDescription,
        commission.id,
        'commission'
      );
      console.log(`[Binary Bonus Rank Change] Commission paid and wallet credited: ${commission.id}`);
      return true;
    } catch (walletError) {
      console.error('[Binary Bonus Rank Change] Failed to credit wallet:', walletError);
      // Update commission status back to Pending if wallet credit fails
      await prisma.commission.update({
        where: { id: commission.id },
        data: { status: 'Pending' }
      });
      return false;
    }
  } catch (error) {
    console.error(`[Binary Bonus Rank Change] Error calculating Binary Bonus for member ${memberId}:`, error);
    return false;
  }
}

/**
 * Get referral statistics for a sponsor
 */
export async function getReferralStats(sponsorId: string, companyId?: string, baseUrl?: string) {
  const whereClause = companyId
    ? { sponsorId, companyId }
    : { sponsorId };

  // Get sponsor's rank
  const sponsor = await prisma.user.findUnique({
    where: { id: sponsorId },
    select: { rank: true }
  });

  const sponsorRank = sponsor?.rank || null;
  const commissionRate = getCommissionRateByRank(sponsorRank);

  const links = await prisma.referralLink.findMany({
    where: whereClause,
    include: {
      _count: {
        select: {
          relationships: true,
        }
      }
    }
  });

  const totalClicks = links.reduce((sum, link) => sum + link.clicks, 0);
  const totalConversions = links.reduce((sum, link) => sum + link.conversions, 0);
  // Count active links: must be isActive=true AND not expired
  const activeLinks = links.filter(link => {
    if (!link.isActive) return false;
    if (link.expiresAt && link.expiresAt < new Date()) return false;
    return true;
  }).length;

  // Use provided baseUrl, or environment variable, or default
  const urlBase = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return {
    totalLinks: links.length,
    activeLinks,
    totalClicks,
    totalConversions,
    conversionRate: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
    commissionRate: commissionRate * 100, // Convert to percentage for display
    sponsorRank: sponsorRank,
    links: links.map(link => ({
      ...link,
      url: `${urlBase}/register?ref=${link.code}`,
      relationships: link._count.relationships,
    }))
  };
}

/**
 * Get sponsor information from referral code
 */
export async function getSponsorFromReferralCode(code: string) {
  const referralLink = await prisma.referralLink.findUnique({
    where: { code },
    include: {
      sponsor: {
        select: {
          id: true,
          firstName: true,
          surname: true,
          fullName: true,
          memberId: true,
          companyId: true,
        }
      },
      company: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
        }
      }
    }
  });

  if (!referralLink || !referralLink.isActive) {
    return null;
  }

  // Check if expired
  if (referralLink.expiresAt && referralLink.expiresAt < new Date()) {
    return null;
  }

  return {
    sponsor: referralLink.sponsor,
    company: referralLink.company,
    referralCode: code,
  };
}

/**
 * Deactivate a referral link
 */
export async function deactivateReferralLink(linkId: string, sponsorId: string): Promise<boolean> {
  try {
    await prisma.referralLink.updateMany({
      where: {
        id: linkId,
        sponsorId, // Ensure only the owner can deactivate
      },
      data: {
        isActive: false,
      }
    });
    return true;
  } catch (error) {
    console.error('Error deactivating referral link:', error);
    return false;
  }
}

/**
 * Activate a referral link
 */
export async function activateReferralLink(linkId: string, sponsorId: string): Promise<boolean> {
  try {
    await prisma.referralLink.updateMany({
      where: {
        id: linkId,
        sponsorId, // Ensure only the owner can activate
      },
      data: {
        isActive: true,
      }
    });
    return true;
  } catch (error) {
    console.error('Error activating referral link:', error);
    return false;
  }
}