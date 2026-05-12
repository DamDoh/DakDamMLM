import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { transformUserToMember } from '@/lib/shared-utils';
import { WalletServiceEnhanced } from '@/services/wallet-service';
import type { StockistLevel } from '@/lib/types';

/**
 * GET /api/members/[id]
 * Get detailed user information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Member ID is required' },
        { status: 400 }
      );
    }

    // Fetch user with related data
    const user = await prisma.user.findUnique({
      where: { id, deleted: false },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        firstName: true,
        surname: true,
        fullName: true,
        memberId: true,
        accountType: true,
        rank: true,
        pv: true,
        pvDate: true,
        rankOnlyNoPv: true,
        teamSize: true,
        children: true,
        placementParentId: true,
        position: true,
        storeOwnerLevel: true,
        avatarUrl: true,
        addresses: true,
        lastActivityDate: true,
        createdAt: true,
        updatedAt: true,
        idCardNumber: true,
        sponsor: {
          select: {
            id: true,
            fullName: true,
            memberId: true,
            email: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        wallet: {
          select: {
            balance: true,
            currency: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Transform user to member format
    const member = transformUserToMember(user);

    // Calculate E-Cash balance (same logic as /api/e-cash)
    let ecashBalance = 0;
    try {
      // Get all commissions (paid) for the user
      const allCommissions = await prisma.commission.findMany({
        where: {
          userId: id,
          status: 'Paid',
          NOT: {
            type: {
              in: ['PV Top-up Request', 'E-Cash Topup', 'E-Comm Topup', 'PV Topup']
            }
          }
        },
        select: {
          id: true,
          type: true,
          amount: true,
          date: true,
        },
      });

      // Filter commissions - include earnings AND purchases
      const allowedCommissionTypes = [
        'Binary Bonus',
        'Matching Bonus',
        'Daily Match',
        'E-Cash Purchase',
      ];

      const commissions = allCommissions.filter(c => {
        // Always include E-Cash Purchase (negative amounts for purchases)
        if (c.type === 'E-Cash Purchase') {
          return true;
        }
        
        // Include E-Cash from Order commissions
        if (c.type && c.type.includes('E-Cash from Order')) {
          return true;
        }
        
        // Reject generic "Stockist Bonus" without level indicator
        if (c.type === 'Stockist Bonus') {
          return false;
        }
        
        // Accept "Stockist Bonus (S)", "Stockist Bonus (M)", etc.
        if (c.type && c.type.includes('Stockist Bonus')) {
          return /Stockist Bonus\s*\([SMDC]\)/i.test(c.type);
        }
        
        // Accept other allowed commission types
        return allowedCommissionTypes.includes(c.type) || 
               (c.type && c.type.startsWith('Matching Bonus'));
      });

      // Calculate balance from filtered commissions
      const commissionBalance = commissions.reduce((sum, c) => sum + c.amount, 0);
      
      // Get E-Cash transactions (transfers from E-Comm, withdrawals)
      const eCashTransactions = await (prisma as any).eCashTransaction.findMany({
        where: { 
          userId: id,
          type: {
            not: 'commission'
          }
        }
      });
      
      // Calculate transfer balance (transfers - withdrawals)
      const transferBalance = eCashTransactions.reduce((sum: number, tx: any) => {
        if (tx.type === 'transfer' && tx.amountUsd > 0) {
          return sum + tx.amountUsd;
        }
        if (tx.type === 'withdrawal') {
          return sum - Math.abs(tx.amountUsd);
        }
        return sum;
      }, 0);
      
      // Total balance = commissions earned + transfers from E-Comm - withdrawals
      ecashBalance = commissionBalance + transferBalance;
    } catch (error) {
      console.error('Error calculating E-Cash balance:', error);
      // Continue with ecashBalance = 0 if calculation fails
    }

    // Calculate activity statistics
    const now = new Date();
    const createdAt = new Date(user.createdAt);
    const totalDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    const lastActivityDate = user.lastActivityDate ? new Date(user.lastActivityDate) : null;
    const daysSinceLastActivity = lastActivityDate
      ? Math.floor((now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Calculate active/inactive days (simplified - assumes active if lastActivityDate exists and is recent)
    const activeDays = lastActivityDate && daysSinceLastActivity !== null && daysSinceLastActivity <= 30
      ? Math.min(totalDays, 30)
      : 0;
    const inactiveDays = totalDays - activeDays;

    // Fetch recent activities (orders, commissions, etc.)
    const [recentOrders, recentCommissions] = await Promise.all([
      prisma.order.findMany({
        where: { userId: id },
        select: {
          id: true,
          orderId: true,
          createdAt: true,
          status: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.commission.findMany({
        where: { userId: id },
        select: {
          id: true,
          type: true,
          amount: true,
          date: true,
          status: true,
        },
        orderBy: { date: 'desc' },
        take: 10,
      }),
    ]);

    // Transform activities
    const recentActivities = [
      ...recentOrders.map((order: any) => ({
        id: order.id,
        action: 'order_created',
        entity: 'order',
        createdAt: order.createdAt.toISOString(),
        changes: { orderId: order.orderId, status: order.status },
      })),
      ...recentCommissions.map((commission: any) => ({
        id: commission.id,
        action: 'commission_earned',
        entity: 'commission',
        createdAt: commission.date.toISOString(),
        changes: { type: commission.type, amount: commission.amount, status: commission.status },
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);

    const response = {
      user: {
        ...member,
        sponsor: user.sponsor
          ? {
              id: user.sponsor.id,
              fullName: user.sponsor.fullName,
              memberId: user.sponsor.memberId,
              email: user.sponsor.email,
            }
          : null,
        company: user.company
          ? {
              id: user.company.id,
              name: user.company.name,
            }
          : null,
        wallet: user.wallet
          ? {
              balance: user.wallet.balance,
              currency: user.wallet.currency || 'USD',
            }
          : null,
        ecashBalance: ecashBalance,
        lastActivityDate: user.lastActivityDate?.toISOString() || null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      activity: {
        activeDays,
        inactiveDays,
        totalDays,
        daysSinceLastActivity,
        lastActivityDate: user.lastActivityDate?.toISOString() || null,
        recentActivities,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[GET /api/members] Failed to fetch user details:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user details' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/members/[id]
 * Update member fields (e.g. suspend user by setting active=false)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Member ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const updatedData = body as Partial<{
      firstName: string;
      surname: string;
      email: string | null;
      phoneNumber: string;
      active: boolean;
      accountType: string;
      avatarUrl: string | null;
      rank: string;
      pv: number;
      rankOnlyNoPv: boolean; // when true: rank-only edit; do not update PV; E-comm shows rank only
      teamSize: any;
      children: any;
      storeOwnerLevel: string | null;
      placementParentId: string | null;
      position: string | null;
      location: string | null;
      addresses: any[];
    }>;

    const data: any = {};

    // CRITICAL: If placementParentId is being updated, validate it's not superadmin
    if (updatedData.placementParentId !== undefined && updatedData.placementParentId !== null) {
      const { isSuperAdmin } = await import('@/lib/superadmin-helper');
      const isSuperadminParent = await isSuperAdmin(updatedData.placementParentId);
      if (isSuperadminParent) {
        return NextResponse.json(
          { error: 'Cannot set superadmin as placement parent. Superadmin cannot be a sponsor.' },
          { status: 400 }
        );
      }
    }

    // Basic user fields
    if (updatedData.firstName !== undefined) data.firstName = updatedData.firstName;
    if (updatedData.surname !== undefined) data.surname = updatedData.surname;
    if (updatedData.email !== undefined) data.email = updatedData.email;
    if (updatedData.phoneNumber !== undefined) data.phoneNumber = updatedData.phoneNumber;
    if (updatedData.active !== undefined) data.active = updatedData.active;
    
    // Handle placementParentId update (if provided)
    if (updatedData.placementParentId !== undefined) {
      data.placementParentId = updatedData.placementParentId;
    }
    if (updatedData.position !== undefined) {
      data.position = updatedData.position;
    }

    // Update fullName if firstName or surname changed
    if (updatedData.firstName !== undefined || updatedData.surname !== undefined) {
      const currentUser = await prisma.user.findUnique({
        where: { id },
        select: { firstName: true, surname: true },
      });

      const newFirstName = updatedData.firstName ?? currentUser?.firstName ?? '';
      const newSurname = updatedData.surname ?? currentUser?.surname ?? '';
      data.fullName = `${newFirstName} ${newSurname}`.trim();
    }

    // Member-specific fields
    if (updatedData.accountType !== undefined) data.accountType = updatedData.accountType;
    if (updatedData.avatarUrl !== undefined) data.avatarUrl = updatedData.avatarUrl;
    if (updatedData.teamSize !== undefined) data.teamSize = updatedData.teamSize;
    if (updatedData.children !== undefined) data.children = updatedData.children;
    
    // Handle Stockist Level change - just update the level (no automatic PV transfer)
    // Stock transfers should be done through Binary Stock, not automatically when setting level
    if (updatedData.storeOwnerLevel !== undefined) {
      data.storeOwnerLevel = updatedData.storeOwnerLevel;
      console.log(`[PATCH /api/members] Stockist level updated to: ${updatedData.storeOwnerLevel || 'None'}`);
    }
    
    if (updatedData.location !== undefined) data.location = updatedData.location;
    if (updatedData.addresses !== undefined) data.addresses = updatedData.addresses;

    // Rank-only edit (Edit Member without Top-Up): show rank on E-comm but not PV until Top-Up
    if (updatedData.rankOnlyNoPv === true) {
      data.rankOnlyNoPv = true;
    }
    
    // Handle PV and auto-update rank if PV is being updated (skip when rank-only edit)
    let pvDifference = 0;
    let oldRank: string | null = null;
    
    // Get current user data before update for rank change tracking
    const currentUserBeforeUpdate = await prisma.user.findUnique({
        where: { id },
        select: { pv: true, rank: true },
      });
    oldRank = currentUserBeforeUpdate?.rank || null;
      
    if (updatedData.pv !== undefined && updatedData.rankOnlyNoPv !== true) {
      const currentPV = currentUserBeforeUpdate?.pv || 0;
      const newPV = updatedData.pv;
      pvDifference = newPV - currentPV;
      
      data.pv = updatedData.pv;
      data.rankOnlyNoPv = false; // PV was set (e.g. via Top-Up), so show PV on E-comm
      
      // Auto-update rank based on PV if rank is not explicitly provided
      if (updatedData.rank === undefined && currentUserBeforeUpdate) {
        const { shouldUpdateRank: shouldUpdateRankFn } = await import('@/lib/rank');
        const rankUpdateResult = shouldUpdateRankFn(currentUserBeforeUpdate.rank as any, updatedData.pv);
        if (rankUpdateResult.shouldUpdate) {
          data.rank = rankUpdateResult.newRank;
        }
      }
    }
    
    // Set rank if explicitly provided (allows manual override)
    if (updatedData.rank !== undefined) {
      data.rank = updatedData.rank;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: true, message: 'No changes to apply' },
        { status: 200 }
      );
    }

    // Update user data
    const updatedUser = await prisma.user.update({
      where: { id },
      data,
      select: { rank: true, placementParentId: true }
    });

    // Rank-only edit: skip ALL commission calculations for upline.
    // When admin only sets rank (no PV), there is no real PV so upline should not receive commissions.
    // Commissions are only triggered when PV is actually added (Top-Up PV, stock transfer, etc.).
    const isRankOnlyEdit = updatedData.rankOnlyNoPv === true;

    if (!isRankOnlyEdit && data.rank && data.rank !== 'Member' && updatedUser.placementParentId) {
      // Binary Bonus for sponsor
      try {
        const { calculateBinaryBonusOnRankChange } = await import('@/lib/referral-tracking');
        await calculateBinaryBonusOnRankChange(id);
      } catch (error) {
        console.error('Failed to calculate Binary Bonus on rank change:', error);
      }

      // G2 Binary Bonus for grandparent
      try {
        const { autoCalculateG2BinaryBonus } = await import('@/services/g2-binary-bonus-auto-calc');
        await autoCalculateG2BinaryBonus(updatedUser.placementParentId, id);
        console.log(`[PATCH /api/members] Auto-calculated G2 Binary Bonus after rank change for ${id}`);
      } catch (g2Error) {
        console.error('Failed to auto-calculate G2 Binary Bonus:', g2Error);
      }
    } else if (isRankOnlyEdit && data.rank) {
      console.log(`[PATCH /api/members] Rank-only edit for ${id} — skipping all upline commissions (no PV)`);
    }

    // PV matching for upline sponsors' waiting legs — also skip for rank-only edits
    if (!isRankOnlyEdit && data.rank && data.rank !== oldRank && updatedUser.placementParentId) {
      try {
        const { PVMatchingService } = await import('@/services/pv-matching-service');
        await PVMatchingService.handleRankChange(id, oldRank, data.rank);
      } catch (error) {
        console.error('Failed to handle rank change for PV matching:', error);
      }
    }

    // If PV was increased, credit the wallet and create transaction
    // Do this after the user update to avoid nested transactions
    if (pvDifference > 0) {
      try {
        // Credit the wallet with the PV difference (1 PV = 1 E-cash)
        await WalletServiceEnhanced.creditWallet(
          id,
          pvDifference,
          `PV Added by Admin: +${pvDifference} PV`,
          `pv-update-${id}-${Date.now()}`,
          'pv_topup'
        );
        
        console.log(`[PATCH /api/members] Credited ${pvDifference} E-cash to wallet for PV addition`);
      } catch (walletError: any) {
        // Log error but don't fail the PV update
        console.error('[PATCH /api/members] Failed to credit wallet for PV addition:', walletError);
        // Continue with the update even if wallet credit fails
        // The PV was already updated, so we just log the wallet error
      }
    } else if (pvDifference < 0) {
      // If PV was decreased, we might want to debit the wallet
      // For now, we'll just log it - you can add debit logic if needed
      console.log(`[PATCH /api/members] PV decreased by ${Math.abs(pvDifference)}, wallet not debited`);
    }

    // NOTE: Automatic PV transfer when setting stockist level has been REMOVED
    // Stock transfers should be done through Binary Stock, not automatically when setting level
    // The member will show as adminstock/stockist after the level is assigned, but no PV is transferred
    if (data.storeOwnerLevel !== undefined) {
      const levelName = data.storeOwnerLevel === 'S' ? 'Small Mobile' : 
                       data.storeOwnerLevel === 'M' ? 'Mobile' :
                       data.storeOwnerLevel === 'C' ? 'Center' : 
                       data.storeOwnerLevel === 'D' ? 'Dealer' : 'None';
      console.log(`[PATCH /api/members] Stockist level updated for user ${id}: ${data.storeOwnerLevel} (${levelName})`);
      console.log(`[PATCH /api/members] ℹ️ Stock transfers should be done through Binary Stock, not automatically.`);
    }

    return NextResponse.json(
      { success: true, message: 'Member updated successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[PATCH /api/members] Failed to update member:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update member' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/members/[id]
 * Delete a member (hard delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Member ID is required' },
        { status: 400 }
      );
    }

    console.log('[DELETE /api/members] Starting deletion for memberId:', id);

    // Check if user exists - need to bypass soft delete filter to check status
    // Use raw query to find user regardless of deleted status
    const userResult = await prisma.$queryRaw<any[]>`
      SELECT id, "isAdmin", deleted
      FROM users
      WHERE id = ${id}
      LIMIT 1
    `;
    const user = userResult[0];

    if (!user) {
      console.error('[DELETE /api/members] User not found:', id);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.isAdmin) {
      console.error('[DELETE /api/members] Cannot delete admin user:', id);
      return NextResponse.json(
        { error: 'Cannot delete admin users' },
        { status: 403 }
      );
    }

    if (user.deleted) {
      console.log('[DELETE /api/members] User already deleted:', id);
      return NextResponse.json(
        { message: 'User already deleted' },
        { status: 200 }
      );
    }

    console.log('[DELETE /api/members] Cleaning up parent links...');
    // Clean up parent links so the genealogy tree shows add buttons again
    const allUsers = await prisma.user.findMany({
      where: { deleted: false },
      select: { id: true, children: true },
    });

    const parentsWithChild = allUsers.filter((user: any) => {
      const children = user.children as any;
      return children && (children.left === id || children.right === id);
    });

    console.log('[DELETE /api/members] Found parents:', parentsWithChild.length);
    const parentIds: string[] = [];
    for (const parent of parentsWithChild) {
      const currentChildren: any = parent.children || {};
      const nextChildren = {
        left: currentChildren.left === id ? null : currentChildren.left ?? null,
        right: currentChildren.right === id ? null : currentChildren.right ?? null,
      };
      await prisma.user.update({
        where: { id: parent.id },
        data: { children: nextChildren },
      });
      parentIds.push(parent.id);
      console.log('[DELETE /api/members] Updated parent:', parent.id);
    }

    // Update teamSize for parents and all upline sponsors
    if (parentIds.length > 0) {
      try {
        const { PVMatchingService } = await import('@/services/pv-matching-service');
        
        // Update direct parents' teamSize
        await Promise.all(
          parentIds.map(parentId => PVMatchingService.updateTeamSize(parentId))
        );
        
        // Update all upline sponsors' teamSize (cascade)
        // Get all unique upline sponsors from all parents
        const allUplineIds = new Set<string>();
        for (const parentId of parentIds) {
          const uplines = await PVMatchingService.getAllUplineSponsors(parentId);
          uplines.forEach(uplineId => allUplineIds.add(uplineId));
        }
        
        await Promise.all(
          Array.from(allUplineIds).map(uplineId => PVMatchingService.updateTeamSize(uplineId))
        );
      } catch (error) {
        console.error('Error updating team sizes after deletion:', error);
        // Continue - don't block deletion
      }
    }

    console.log('[DELETE /api/members] Hard deleting user record from database...');
    // HARD DELETE: physically remove the user row from the database
    // We use a raw query to bypass any soft‑delete extensions/middleware
    await prisma.$executeRawUnsafe(
      `DELETE FROM "users" WHERE "id" = '${id}'`
    );

    console.log('[DELETE /api/members] User hard deleted successfully:', id);

    return NextResponse.json(
      { success: true, message: 'User deleted successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[DELETE /api/members] Failed to delete member:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete user' },
      { status: 500 }
    );
  }
}
