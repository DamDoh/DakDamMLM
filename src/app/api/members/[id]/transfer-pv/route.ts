import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireAdmin } from '@/lib/auth-middleware';
import { shouldUpdateRank } from '@/lib/rank';

/**
 * POST /api/members/[id]/transfer-pv
 * Admin Top-Up PV to a member - PV goes to member's PV/rank (not E-cash wallet)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params before passing to requireAdmin
  const { id } = await params;
  
  return requireAdmin(async (req) => {
    try {

      if (!id) {
        return NextResponse.json(
          { error: 'Member ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json().catch(() => ({}));
      const { amount } = body as { amount: number };

      if (!amount || amount <= 0) {
        return NextResponse.json(
          { error: 'Amount must be greater than 0' },
          { status: 400 }
        );
      }

      // Get admin user info
      const adminUser = req.user;
      const adminName = adminUser?.fullName || adminUser?.email || 'Admin';

      // Get current member data
      const member = await prisma.user.findUnique({
        where: { id, deleted: false },
        select: { id: true, pv: true, rank: true, fullName: true, email: true },
      });

      if (!member) {
        return NextResponse.json(
          { error: 'Member not found' },
          { status: 404 }
        );
      }

      const currentPV = member.pv || 0;
      const newPV = currentPV + amount;

      // Auto-update rank based on new PV
      const rankUpdateResult = shouldUpdateRank(member.rank as any, newPV);
      let rankUpdated = false;
      let newRank = member.rank;
      if (rankUpdateResult.shouldUpdate) {
        rankUpdated = true;
        newRank = rankUpdateResult.newRank;
      }

      // Update member's PV/rank - Top-Up PV goes to PV/rank only (not E-cash wallet)
      // rankOnlyNoPv = false so E-comm shows both PV and rank after top-up
      await prisma.user.update({
        where: { id },
        data: {
          pv: newPV,
          pvDate: new Date(),
          rankOnlyNoPv: false,
          ...(rankUpdateResult.shouldUpdate ? { rank: rankUpdateResult.newRank } : {}),
        },
      });

      console.log(`[POST /api/members/transfer-pv] Successfully topped up ${amount} PV to member ${id} (PV/rank)`);

      // Handle PV change for upline sponsors (Daily Match + Matching Bonus)
      if (amount > 0) {
        try {
          const { PVMatchingService } = await import('@/services/pv-matching-service');
          await PVMatchingService.handlePVChange(id, currentPV, newPV);
        } catch (pvError: any) {
          console.error('[POST /api/members/transfer-pv] Failed to handle PV change for upline sponsors:', pvError);
          // Don't fail the request if PV matching fails
        }
      }

      // G1 Binary Bonus for sponsor - paid on EVERY top-up (including renew) when both member and sponsor Bronze+
      if (amount > 0) {
        try {
          const recipientWithSponsor = await prisma.user.findUnique({
            where: { id },
            select: { sponsorId: true, placementParentId: true, fullName: true, memberId: true }
          });
          const sponsorId = recipientWithSponsor?.sponsorId || recipientWithSponsor?.placementParentId;
          if (sponsorId) {
            const { getCommissionRateByRank } = await import('@/lib/referral-tracking');
            const sponsorUser = await prisma.user.findUnique({
              where: { id: sponsorId },
              select: { rank: true, companyId: true, memberId: true }
            });
            const sponsorRank = sponsorUser?.rank || null;
            const validRanks = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Manager', 'Director', 'President', 'Double President'];
            const memberRank = (rankUpdateResult.shouldUpdate ? rankUpdateResult.newRank : member.rank) || member.rank;
            const isMemberEligible = memberRank && validRanks.includes((memberRank as string).trim());
            const isSponsorEligible = sponsorRank && validRanks.includes(sponsorRank.trim());
            if (isMemberEligible && isSponsorEligible) {
              const commissionRate = getCommissionRateByRank(sponsorRank!.trim());
              if (commissionRate > 0) {
                const commissionAmount = Math.round((amount * commissionRate) * 100) / 100;
                await prisma.commission.create({
                  data: {
                    userId: sponsorId,
                    amount: commissionAmount,
                    type: 'Binary Bonus',
                    status: 'Paid',
                    date: new Date(),
                    companyId: sponsorUser?.companyId ?? null,
                    description: `Binary Bonus: ${recipientWithSponsor?.fullName || recipientWithSponsor?.memberId} (+${amount} PV) via Admin Top-Up - ${amount} PV × ${(commissionRate * 100).toFixed(1)}%`
                  }
                });
                const { WalletServiceEnhanced } = await import('@/services/wallet-service-enhanced');
                await WalletServiceEnhanced.creditWallet(sponsorId, commissionAmount, 'Binary Bonus', `admin_topup:${id}:${Date.now()}`, 'commission');
                console.log(`[POST /api/members/transfer-pv] G1 Binary Bonus paid to sponsor ${sponsorUser?.memberId}: $${commissionAmount.toFixed(2)}`);
              }
            }
          }
        } catch (g1Error: any) {
          console.error('[POST /api/members/transfer-pv] Failed to create G1 Binary Bonus:', g1Error);
        }

        // G2 Binary Bonus for grandparent - paid on EVERY top-up (including renew) when recipient is G2 downline
        try {
          const { payG2BinaryBonusForPVTopUp } = await import('@/services/g2-binary-bonus-auto-calc');
          await payG2BinaryBonusForPVTopUp(id, amount);
          console.log(`[POST /api/members/transfer-pv] G2 Binary Bonus processed for admin top-up to ${id}`);
        } catch (g2Error: any) {
          console.error('[POST /api/members/transfer-pv] Failed to pay G2 Binary Bonus:', g2Error);
        }
      }

      // Send notification to member about PV top-up
      try {
        const notificationTitle = rankUpdated 
          ? `PV Top-Up & Rank Promotion: +${amount.toLocaleString()} PV`
          : `PV Top-Up Received: +${amount.toLocaleString()} PV`;
        
        const notificationBody = rankUpdated
          ? `Admin ${adminName} topped up ${amount.toLocaleString()} PV to your account. Your rank has been updated to ${newRank}. New PV: ${newPV.toLocaleString()}`
          : `Admin ${adminName} topped up ${amount.toLocaleString()} PV to your account. Your new PV balance is ${newPV.toLocaleString()}`;

        await prisma.notification.create({
          data: {
            memberId: id,
            type: 'in_app',
            category: 'system',
            title: notificationTitle,
            body: notificationBody,
            data: {
              transferId: `PV-TOPUP-${id}-${Date.now()}`,
              adminId: adminUser?.id,
              adminName: adminName,
              amount: amount,
              previousPV: currentPV,
              newPV: newPV,
              rankUpdated: rankUpdated,
              previousRank: member.rank,
              newRank: newRank,
              link: '/ecash',
            },
            priority: 'high',
          },
        });

        console.log(`[POST /api/members/transfer-pv] Notification sent to member ${id} about PV top-up`);
      } catch (notifyError: any) {
        // Log error but don't fail the PV top-up
        console.error('[POST /api/members/transfer-pv] Failed to send notification:', notifyError);
      }

      return NextResponse.json(
        {
          success: true,
          message: 'PV topped up successfully',
          data: {
            previousPV: currentPV,
            newPV,
            transferredAmount: amount,
            rankUpdated: rankUpdated,
            newRank: newRank,
          },
        },
        { status: 200 }
      );
    } catch (error: any) {
      console.error('[POST /api/members/transfer-pv] Failed to top-up PV:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to top-up PV' },
        { status: 500 }
      );
    }
  })(request);
}

