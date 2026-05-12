import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { ApiResponseUtil } from '@/lib/api-response';
import { PVMatchingService } from '@/services/pv-matching-service';

/**
 * GET /api/members/[id]/details
 * Get detailed member information including bonuses, PV data, and team stats
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params;
  return requireAuth(async (req: AuthenticatedRequest) => {
    try {
      const authUser = req.user!;

      // Get member basic info
      const member = await prisma.user.findUnique({
        where: { id: memberId },
        select: {
          id: true,
          memberId: true,
          fullName: true,
          firstName: true,
          surname: true,
          rank: true,
          sponsorId: true,
          placementParentId: true,
          createdAt: true,
          avatarUrl: true,
          children: true,
          pv: true,
          pvDate: true,
          accountType: true,
          storeOwnerLevel: true,
          phoneNumber: true,
          email: true,
        }
      });

      if (!member) {
        return ApiResponseUtil.error('Member not found', 404);
      }

      // Check permissions - user can view their own details, admin can view anyone, parent/sponsor can view downlines, Admin Stock can view anyone (for maintenance top-up etc.)
      const isOwnProfile = memberId === authUser.id;
      const isAdmin = authUser.isAdmin;
      const isDirectParent = member.placementParentId === authUser.id;
      const isDirectSponsor = member.sponsorId === authUser.id;
      const dbAuth = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: { storeOwnerLevel: true },
      });
      const isAdminStock = !!dbAuth?.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(dbAuth.storeOwnerLevel);

      // Check if the member is in the user's downline chain (indirect downline via binary tree)
      // This allows viewing G2, G3, etc. downlines
      let isInDownlineChain = false;
      if (!isOwnProfile && !isAdmin && !isDirectParent && !isDirectSponsor && !isAdminStock) {
        // Walk up the placement tree from the target member to see if we reach the auth user
        let currentParentId = member.placementParentId;
        const visited = new Set<string>();
        while (currentParentId && !visited.has(currentParentId)) {
          visited.add(currentParentId);
          if (currentParentId === authUser.id) {
            isInDownlineChain = true;
            break;
          }
          const parentUser = await prisma.user.findUnique({
            where: { id: currentParentId },
            select: { placementParentId: true }
          });
          currentParentId = parentUser?.placementParentId || null;
        }
        
        // Also check sponsor chain if not found in placement chain
        if (!isInDownlineChain) {
          let currentSponsorId = member.sponsorId;
          const visitedSponsors = new Set<string>();
          while (currentSponsorId && !visitedSponsors.has(currentSponsorId)) {
            visitedSponsors.add(currentSponsorId);
            if (currentSponsorId === authUser.id) {
              isInDownlineChain = true;
              break;
            }
            const sponsorUser = await prisma.user.findUnique({
              where: { id: currentSponsorId },
              select: { sponsorId: true }
            });
            currentSponsorId = sponsorUser?.sponsorId || null;
          }
        }
      }

      if (!isOwnProfile && !isAdmin && !isDirectParent && !isDirectSponsor && !isAdminStock && !isInDownlineChain) {
        return ApiResponseUtil.forbidden('You can only view your own details or your downlines');
      }

      // Get PV data from orders
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      const children = member.children as any;

      // Get monthly orders to calculate PV (include Pending, Processing, and Fulfilled orders)
      const monthlyOrders = await prisma.order.findMany({
        where: {
          userId: memberId,
          status: {
            in: ['Pending', 'Processing', 'Fulfilled', 'COMPLETED']
          },
          createdAt: {
            gte: currentMonth
          }
        },
        include: {
          items: {
            select: {
              pv: true,
              quantity: true
            }
          }
        }
      });

      // Calculate PV from order items
      let monthlyPV = 0;
      for (const order of monthlyOrders) {
        for (const item of order.items) {
          monthlyPV += (Number(item.pv) || 0) * item.quantity;
        }
      }

      // Use stored total PV from user record (updated when orders are created)
      const totalPV = Number(member.pv) || 0;

      // Calculate left and right PV from binary legs
      let leftPV = 0;
      let rightPV = 0;

      // Get left leg PV
      if (children?.left) {
        const leftOrders = await prisma.order.findMany({
          where: {
            userId: children.left,
            status: {
              in: ['Pending', 'Processing', 'Fulfilled', 'COMPLETED']
            },
            createdAt: { gte: currentMonth }
          },
          include: {
            items: {
              select: {
                pv: true,
                quantity: true
              }
            }
          }
        });
        for (const order of leftOrders) {
          for (const item of order.items) {
            leftPV += (Number(item.pv) || 0) * item.quantity;
          }
        }
      }

      // Get right leg PV
      if (children?.right) {
        const rightOrders = await prisma.order.findMany({
          where: {
            userId: children.right,
            status: {
              in: ['Pending', 'Processing', 'Fulfilled', 'COMPLETED']
            },
            createdAt: { gte: currentMonth }
          },
          include: {
            items: {
              select: {
                pv: true,
                quantity: true
              }
            }
          }
        });
        for (const order of rightOrders) {
          for (const item of order.items) {
            rightPV += (Number(item.pv) || 0) * item.quantity;
          }
        }
      }

      // Get commissions for bonus calculation
      const commissions = await prisma.commission.findMany({
        where: {
          userId: memberId,
          date: {
            gte: currentMonth
          }
        }
      });

      // Calculate bonuses from commissions by type
      let stockBonus = 0;
      let dailyMatchBonus = 0;
      let binaryBonus = 0;
      let matchingBonus = 0;

      for (const commission of commissions) {
        const amount = Number(commission.amount) || 0;
        const type = commission.type || '';

        // Only count "Stockist Bonus (S)", "Stockist Bonus (M)", etc. (from actual stock transfers)
        // Exclude generic "Stockist Bonus" without level indicator (old auto-created commissions)
        if (type.includes('Stockist Bonus')) {
          if (/Stockist Bonus\s*\([SMDC]\)/i.test(type)) {
            stockBonus += amount;
          }
        } else if (type.toLowerCase().includes('daily match')) {
          dailyMatchBonus += amount;
        } else if (type.toLowerCase().includes('binary')) {
          binaryBonus += amount;
        } else if (type.toLowerCase().includes('matching')) {
          matchingBonus += amount;
        }
      }

      const totalBonus = stockBonus + dailyMatchBonus + binaryBonus + matchingBonus;

      // Get team statistics
      const directRecruits = [children?.left, children?.right].filter(Boolean).length;

      // Count total downline recursively with circular reference protection
      const countDownline = async (userId: string, visited = new Set<string>()): Promise<number> => {
        // Prevent circular references
        if (visited.has(userId)) return 0;
        visited.add(userId);
        
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { children: true }
        });
        
        if (!user) return 0;
        
        const userChildren = user.children as any;
        let count = 0;
        
        if (userChildren?.left && !visited.has(userChildren.left)) {
          count += 1 + await countDownline(userChildren.left, visited);
        }
        if (userChildren?.right && !visited.has(userChildren.right)) {
          count += 1 + await countDownline(userChildren.right, visited);
        }
        
        return count;
      };

      const totalDownline = await countDownline(memberId);

      // Get monthly team count (members who joined this month in downline)
      const monthlyTeamCount = await prisma.user.count({
        where: {
          OR: [
            { sponsorId: memberId },
            { placementParentId: memberId }
          ],
          createdAt: {
            gte: currentMonth
          }
        }
      });

      // Determine maintain status based on approved maintenance topup
      // Check for any approved maintenance topup (not just current month)
      const approvedMaintenance = await (prisma as any).maintenanceTopupRequest.findFirst({
        where: {
          memberId: memberId,
          status: { in: ['approved', 'completed'] },
        },
        orderBy: {
          processedDate: 'desc' // Get the most recent approved maintenance
        },
      });

      // Calculate days remaining from expiry date (full-month cycle: same date next month)
      let maintainStatus = 'Not Maintain';
      let daysRemaining = 0;
      let isMaintained = false;
      
      if (approvedMaintenance && approvedMaintenance.processedDate) {
        const approvalDate = new Date(approvedMaintenance.processedDate);
        approvalDate.setHours(0, 0, 0, 0);

        // Full-month cycle: maintenance starts on approval date, ends same calendar date next month.
        // E.g. start 23 Jan → expiry 23 Feb 23:59:59. Edge case: Jan 31 → Feb 28/29.
        const year = approvalDate.getFullYear();
        const month = approvalDate.getMonth();
        const day = approvalDate.getDate();
        const nextMonth = month + 1;
        const lastDayNextMonth = new Date(year, nextMonth + 1, 0).getDate();
        const expiryDay = Math.min(day, lastDayNextMonth);
        const expiryDate = new Date(year, nextMonth, expiryDay);
        expiryDate.setHours(23, 59, 59, 999);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffTime = expiryDate.getTime() - today.getTime();
        daysRemaining = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

        if (daysRemaining > 0) {
          isMaintained = true;
          maintainStatus = `MAINTAINED_${daysRemaining}`;
        } else {
          maintainStatus = 'NOT_MAINTAINED';
        }
      } else {
        maintainStatus = 'NOT_MAINTAINED';
      }
      
      const pvBalance = Math.abs(leftPV - rightPV);
      const weakPV = Math.min(leftPV, rightPV);
      const strongPV = Math.max(leftPV, rightPV);

      // Get last topup date from orders
      const lastOrder = await prisma.order.findFirst({
        where: {
          userId: memberId,
          status: 'COMPLETED'
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          createdAt: true
        }
      });

      // Get wallet balance
      const wallet = await prisma.wallet.findUnique({
        where: {
          userId: memberId
        },
        select: {
          balance: true
        }
      });

      // Get waiting PV (left/right) for daily match
      const waitingPV = await PVMatchingService.getWaitingPV(memberId);

      // Get sponsor and placement parent information in parallel for better performance
      const [sponsorResult, placementParentResult] = await Promise.allSettled([
        member.sponsorId ? prisma.user.findFirst({
          where: { 
            id: member.sponsorId,
            deleted: false,
            active: true
          },
          select: {
            id: true,
            memberId: true,
            fullName: true,
            firstName: true,
            surname: true
          }
        }) : Promise.resolve(null),
        member.placementParentId ? prisma.user.findFirst({
          where: { 
            id: member.placementParentId,
            deleted: false,
            active: true
          },
          select: {
            id: true,
            memberId: true,
            fullName: true,
            firstName: true,
            surname: true
          }
        }) : Promise.resolve(null)
      ]);

      // Process sponsor info
      let sponsorInfo = null;
      if (sponsorResult.status === 'fulfilled' && sponsorResult.value && sponsorResult.value.memberId) {
        const sponsor = sponsorResult.value;
        sponsorInfo = {
          id: sponsor.id,
          memberId: sponsor.memberId,
          fullName: sponsor.fullName || `${sponsor.firstName || ''} ${sponsor.surname || ''}`.trim() || sponsor.memberId
        };
      } else if (sponsorResult.status === 'rejected') {
        console.error('Error fetching sponsor info:', sponsorResult.reason);
      }

      // Process placement parent info
      let placementParentInfo = null;
      if (placementParentResult.status === 'fulfilled' && placementParentResult.value && placementParentResult.value.memberId) {
        const placementParent = placementParentResult.value;
        placementParentInfo = {
          id: placementParent.id,
          memberId: placementParent.memberId,
          fullName: placementParent.fullName || `${placementParent.firstName || ''} ${placementParent.surname || ''}`.trim() || placementParent.memberId
        };
      } else if (placementParentResult.status === 'rejected') {
        console.error('Error fetching placement parent info:', placementParentResult.reason);
      }

      // Determine if user can view bonus/commission data
      // Only the member themselves or admin can see bonus details
      // Sponsors (even AdminStock) cannot see their downline's bonus information
      const canViewBonuses = isOwnProfile || isAdmin;

      const response = {
        member: {
          ...member,
          lastTopupDate: lastOrder?.createdAt || null
        },
        sponsorInfo,
        placementParentInfo,
        pvData: {
          oldPV: 0, // Previous month PV (would need historical tracking)
          newPV: canViewBonuses ? monthlyPV : 0,
          totalPV: canViewBonuses ? totalPV : 0,
          walletBalance: canViewBonuses ? (wallet?.balance || 0) : 0,
          weakPV: canViewBonuses ? weakPV : 0,
          strongPV: canViewBonuses ? strongPV : 0,
          leftPV: canViewBonuses ? leftPV : 0,
          rightPV: canViewBonuses ? rightPV : 0,
          leftWaitingPV: waitingPV.leftWaitingPV,
          rightWaitingPV: waitingPV.rightWaitingPV
        },
        bonuses: canViewBonuses ? {
          stockBonus: stockBonus,
          dailyMatchBonus: dailyMatchBonus,
          binaryBonus: binaryBonus,
          matchingBonus: matchingBonus,
          totalBonus: totalBonus
        } : null, // Hide bonus data for sponsors viewing downlines
        team: {
          directRecruits: directRecruits,
          totalDownline: totalDownline,
          monthlyTeam: monthlyTeamCount
        },
        maintainStatus: maintainStatus,
        maintenanceDaysRemaining: daysRemaining,
        isMaintained: isMaintained,
        canViewBonuses: canViewBonuses // Flag for frontend to know if bonuses are visible
      };

      return NextResponse.json(response);

    } catch (error) {
      console.error('Failed to fetch member details:', error);
      return ApiResponseUtil.error('Failed to fetch member details');
    }
  })(request);
}
