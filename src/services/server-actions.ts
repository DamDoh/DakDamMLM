'use server';

import type { Product, Rank, StockRequestItem, StockistLevel, Address, Member } from '@/lib/types';
import { prisma } from '@/lib/database';
import { CommissionService } from './commission-service';
import { CommissionDisputeService } from './commission-dispute-service';
import * as genealogyServiceOriginal from '@/../nextjs_original/src/services/genealogy-service';
import { hashPassword } from '@/lib/auth-service';
import { transformUserToMember } from '@/lib/shared-utils';
import { findFirstAvailablePosition as findFirstAvailablePositionUtil } from './user-service';
import { initializeMemberOnboarding as initializeMemberOnboardingUtil } from './onboarding-service';
import { createNotification } from './notification-service';
import { RBACService } from './rbac-service';
import { addProduct } from './product-service';
import { CommissionCalculationEngineEnhanced } from './commission-calculation-engine';

// Re-export commission functions
export const addCommission = async (commission: any) => {
  return CommissionService.createCommission(
    commission.userId,
    commission.amount,
    commission.type,
    commission.description,
    commission.companyId
  );
};

// Simple addOrder implementation
export const addOrder = async (userId: string, order: any) => {
  try {
    // Validate required order properties
    if (!order.orderId || !order.userId || !order.status || !order.amount) {
      throw new Error('Missing required order properties');
    }

    // Create order in database
    await prisma.order.create({
      data: {
        id: order.orderId,
        userId,
        orderId: order.orderId,
        totalAmount: order.amount,
        status: order.status,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });

    // Add order items if they exist
    if (order.items && order.items.length > 0) {
      const orderItemPromises = order.items.map(async (item: any) => {
        // Validate required item properties
        if (!item.productId || !item.quantity || !item.price) {
          throw new Error(`Invalid order item: missing required properties for product ${item.productId}`);
        }

        try {
          await prisma.orderItem.create({
            data: {
              id: `${order.orderId}-${item.productId}`,
              orderId: order.orderId,
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
            }
          });
        } catch (itemError: any) {
          // Handle duplicate key errors (same product ordered multiple times)
          if (itemError.code === 'P2002' || itemError.message?.includes('Unique constraint')) {
            console.warn(`Order item already exists for order ${order.orderId} and product ${item.productId}`);
          } else {
            throw itemError;
          }
        }
      });

      await Promise.all(orderItemPromises);
    }
  } catch (error) {
    console.error('Failed to add order:', error);
    throw error;
  }
};

// Placeholder exports for other services that may be needed
export const runCommissionCycle = async (): Promise<{ count: number; total: number }> => {
  try {
    const result = await CommissionService.runCommissionCycle();
    // Transform the response to match expected format
    return {
      count: result.processed,
      total: result.totalAmount
    };
  } catch (error) {
    console.error('Failed to run commission cycle:', error);
    return { count: 0, total: 0 };
  }
};
export const calculateBinaryBonus = CommissionService.calculateBinaryCommission;
export const calculateStockistBonus = CommissionService.calculateStockistBonus;
export const calculateMatchingBonus = CommissionCalculationEngineEnhanced.calculateMatchingBonus.bind(CommissionCalculationEngineEnhanced);

// Predict a member's future commission with actual calculations
export const predictMemberCommission = async (
  memberId: string,
  monthsAhead: number = 3
): Promise<{
  memberId: string;
  projectedTotal: number;
  monthlyBreakdown: { month: string; amount: number }[];
  breakdown: {
    binary: number;
    matching: number;
    stockist: number;
    rank: number;
    dailyMatch: number;
  };
}> => {
  if (!memberId) {
    return {
      memberId: '',
      projectedTotal: 0,
      monthlyBreakdown: [],
      breakdown: {
        binary: 0,
        matching: 0,
        stockist: 0,
        rank: 0,
        dailyMatch: 0,
      },
    };
  }

  // Get user data including PV and stockist level
  const user = await prisma.user.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      pv: true,
      rank: true,
      storeOwnerLevel: true,
      active: true,
    },
  });

  // Get recent commissions to calculate other bonuses
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(now.getMonth() - 3);
  
  // For Stockist Bonus: Only count commissions from last 30 days to ensure they're from recent transfers
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const recentCommissions = await prisma.commission.findMany({
    where: {
      userId: memberId,
      status: 'Paid',
      date: {
        gte: threeMonthsAgo,
        lte: now,
      },
    },
  });

  // Calculate breakdown by commission type from actual historical data
  let binaryTotal = 0;
  let dailyMatchTotal = 0;
  let matchingBonusTotal = 0;
  let stockistTotal = 0;
  let rankTotal = 0;

  recentCommissions.forEach(c => {
    const type = (c.type || '').toLowerCase();
    const amount = c.amount || 0;

    if (type === 'binary bonus') {
      binaryTotal += amount;
    } else if (type === 'daily match' || type.includes('daily match')) {
      dailyMatchTotal += amount;
    } else if (type.includes('matching bonus')) {
      matchingBonusTotal += amount;
    } else if (type.includes('stockist bonus')) {
      stockistTotal += amount;
    } else if (type.includes('rank bonus') || type.includes('rank advancement') || type.includes('rank achievement')) {
      rankTotal += amount;
    }
  });

  // Calculate monthly averages for each type
  const avgBinaryBonus = binaryTotal / 3;
  const avgDailyMatchBonus = dailyMatchTotal / 3;
  const avgMatchingBonus = matchingBonusTotal / 3;
  const avgStockistBonus = stockistTotal / 3;
  const avgRankBonus = rankTotal / 3;

  // E-Cash eligible total (excludes Binary Bonus and Daily Match)
  const eCashEligibleTotal = stockistTotal + rankTotal;
  const avgPerMonth = eCashEligibleTotal / 3 || 0;

  const monthlyBreakdown: { month: string; amount: number }[] = [];
  let projectedTotal = 0;

  for (let i = 1; i <= monthsAhead; i++) {
    const future = new Date(now);
    future.setMonth(now.getMonth() + i);
    const label = future.toLocaleString('default', { month: 'short', year: 'numeric' });
    // Monthly amount should only include E-Cash eligible commissions (excludes Binary Bonus and Daily Match)
    const monthlyAmount = avgStockistBonus + avgRankBonus;
    monthlyBreakdown.push({
      month: label,
      amount: Math.round(monthlyAmount * 100) / 100,
    });
    projectedTotal += monthlyAmount;
  }

  // Return breakdown with total amounts (not averages) for display
  // Monthly predictions still use averages for forecasting
  return {
    memberId,
    projectedTotal: Math.round(projectedTotal * 100) / 100,
    monthlyBreakdown,
    breakdown: {
      binary: Math.round(binaryTotal * 100) / 100, // Total amount, not average
      matching: Math.round(matchingBonusTotal * 100) / 100, // Total amount, not average
      stockist: Math.round(stockistTotal * 100) / 100, // Total amount, not average
      rank: Math.round(rankTotal * 100) / 100, // Total amount, not average
      dailyMatch: Math.round(dailyMatchTotal * 100) / 100, // Total amount, not average
    },
  };
};

// Notification type used by layout components
export type Notification = {
  id: string;
  memberId: string;
  title: string;
  body: string;
  isRead: boolean;
  createdDate: string;
  readDate?: string | null;
};


export const updateMemberAddress = async (
  memberId: string,
  address: Address
): Promise<Address> => {
  // Load current addresses (stored as JSON on user)
  const user = await prisma.user.findUnique({
    where: { id: memberId },
    select: { addresses: true },
  });

  const raw = user?.addresses as unknown;
  const current: Address[] = Array.isArray(raw) ? (raw as Address[]) : [];

  // If id exists, update existing; otherwise create new id
  const isUpdate = !!address.id && current.some((a) => a.id === address.id);
  const id = isUpdate ? address.id : `ADDR-${Date.now()}`;

  let next = current.map((a) => ({ ...a }));

  const newAddress: Address = {
    id,
    label: address.label,
    address: address.address,
    city: address.city,
    postalCode: address.postalCode,
    isDefault: address.isDefault ?? false,
  };

  if (isUpdate) {
    next = next.map((a) => (a.id === id ? newAddress : a));
  } else {
    next.push(newAddress);
  }

  // If this address is default, clear default on others
  if (newAddress.isDefault) {
    next = next.map((a) => ({ ...a, isDefault: a.id === newAddress.id }));
  }

  await prisma.user.update({
    where: { id: memberId },
    data: { addresses: next as any },
  });

  return newAddress;
};

// Update member fields from genealogy/profile flows
export const updateMemberOnServer = async (
  memberId: string,
  updatedData: Partial<Member>
) => {
  const data: any = {};

  // Basic user fields
  if (updatedData.firstName !== undefined) data.firstName = updatedData.firstName;
  if (updatedData.surname !== undefined) data.surname = updatedData.surname;
  if (updatedData.email !== undefined) data.email = updatedData.email;
  if (updatedData.phoneNumber !== undefined) data.phoneNumber = updatedData.phoneNumber;
  if (updatedData.active !== undefined) data.active = updatedData.active;
  
  // Update fullName if firstName or surname changed
  if (updatedData.firstName !== undefined || updatedData.surname !== undefined) {
    // Get current user data to compute fullName
    const currentUser = await prisma.user.findUnique({
      where: { id: memberId },
      select: { firstName: true, surname: true }
    });
    
    const newFirstName = updatedData.firstName ?? currentUser?.firstName ?? '';
    const newSurname = updatedData.surname ?? currentUser?.surname ?? '';
    data.fullName = `${newFirstName} ${newSurname}`.trim();
  }

  // Member-specific fields
  if (updatedData.accountType !== undefined) data.accountType = updatedData.accountType;
  if (updatedData.avatarUrl !== undefined) data.avatarUrl = updatedData.avatarUrl;
  if (updatedData.rank !== undefined) data.rank = updatedData.rank;
  if (updatedData.teamSize !== undefined) data.teamSize = updatedData.teamSize;
  if (updatedData.children !== undefined) data.children = updatedData.children;
  if (updatedData.storeOwnerLevel !== undefined) data.storeOwnerLevel = updatedData.storeOwnerLevel;
  if (updatedData.location !== undefined) data.location = updatedData.location;
  if (updatedData.addresses !== undefined) data.addresses = updatedData.addresses;

  if (Object.keys(data).length === 0) {
    return;
  }

  await prisma.user.update({
    where: { id: memberId },
    data,
  });
};

// ---------------------------------------------------------------------------
// Genealogy maintenance helpers
// ---------------------------------------------------------------------------

export const compressTree = async (): Promise<{
  compressedCount: number;
  errors: number;
}> => {
  try {
    // @ts-ignore - using original implementation from nextjs_original for now
    const result = await genealogyServiceOriginal.compressTree();
    return {
      compressedCount: result.compressedCount ?? 0,
      errors: result.errors ?? 0,
    };
  } catch (error) {
    console.error('Failed to compress genealogy tree:', error);
    return { compressedCount: 0, errors: 1 };
  }
};

// ---------------------------------------------------------------------------
// Commission Dispute server actions (used by admin dashboard + member UI)
// ---------------------------------------------------------------------------

export const createCommissionDispute = async (input: {
  commissionId: string;
  memberId: string;
  amount?: number;
  reason: string;
  description?: string;
  companyId?: string;
}): Promise<void> => {
  await CommissionDisputeService.createDispute(
    input.memberId,
    input.commissionId,
    input.reason,
    input.amount ?? 0
  );
};

export const resolveCommissionDispute = async (
  disputeId: string,
  resolutionNotes: string,
  resolvedBy: string,
  status: 'resolved' | 'rejected' | 'investigating' = 'resolved'
): Promise<void> => {
  // Map simple status to resolution type
  const resolutionType =
    status === 'rejected' ? 'denied' : status === 'investigating' ? 'escalated' : 'approved';

  // For now approve the full requested amount when resolving
  await CommissionDisputeService.resolveDispute(
    disputeId,
    resolutionType,
    0,
    resolvedBy,
    resolutionNotes
  );
};

export const getCommissionDisputes = async (
  memberId?: string,
  companyId?: string,
  status?: 'pending' | 'resolved' | 'rejected' | 'investigating'
): Promise<any[]> => {
  // Basic implementation using Prisma directly to avoid missing helpers
  const where: any = {};
  if (memberId) where.memberId = memberId;
  if (companyId) where.companyId = companyId;
  if (status) where.status = status;

  const disputes = await prisma.commissionDispute.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return disputes;
};

export const verifyCommissionCalculation = async (commissionId: string): Promise<boolean> => {
  const commission = await prisma.commission.findUnique({
    where: { id: commissionId },
  });
  if (!commission) return false;
  // Simple sanity check placeholder
  return commission.amount > 0 && !!commission.userId && !!commission.type;
};

// ---------------------------------------------------------------------------
// Profile helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// E‑cash top‑up admin actions
// ---------------------------------------------------------------------------

export const approveTopUp = async (
  requestId: string,
  memberId?: string,
  adjustedAmount?: number
): Promise<void> => {
  const request = await prisma.ecommTopupRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) {
    throw new Error('Top-up request not found');
  }

  const amount = adjustedAmount ?? request.amount;

  await prisma.$transaction(async (tx) => {
    await tx.ecommTopupRequest.update({
      where: { id: requestId },
      data: {
        status: 'approved',
        processedDate: new Date(),
        processedBy: memberId ?? request.processedBy ?? null,
        amount,
      },
    });

    // Credit commission as simple e‑cash bonus
    await tx.commission.create({
      data: {
        userId: request.memberId,
        date: new Date(),
        type: 'E-Cash Top-up',
        status: 'Paid',
        amount,
      },
    });
  });
};

export const rejectTopUp = async (requestId: string): Promise<void> => {
  await prisma.ecommTopupRequest.update({
    where: { id: requestId },
    data: {
      status: 'rejected',
      processedDate: new Date(),
    },
  });
};

// Request E-Cash top-up
export const requestEcashTopUp = async (request: {
  memberId: string;
  memberName: string;
  amount: number;
  remark?: string;
  proofUrl?: string;
}): Promise<{ success: boolean; message: string }> => {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      return { success: false, message: 'Authentication required' };
    }

    const response = await fetch('/api/ecash-topup-requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount: request.amount,
        remark: request.remark || '',
        proofUrl: request.proofUrl || '',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, message: data.error || 'Failed to create topup request' };
    }

    return { success: true, message: data.message || 'Topup request submitted successfully' };
  } catch (error) {
    console.error('Failed to request E-cash top-up:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to create topup request' 
    };
  }
};

// Request E-Cash withdrawal
export const requestEcashWithdrawal = async (request: {
  memberId: string;
  memberName: string;
  amount: number;
  remark?: string;
  bankAccount: string;
  bankName: string;
  accountName: string;
}): Promise<{ success: boolean; message: string }> => {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      return { success: false, message: 'Authentication required' };
    }

    const response = await fetch('/api/ecash-withdrawal-requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount: request.amount,
        remark: request.remark || '',
        bankAccount: request.bankAccount,
        bankName: request.bankName,
        accountName: request.accountName,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, message: data.error || 'Failed to create withdrawal request' };
    }

    return { success: true, message: data.message || 'Withdrawal request submitted successfully' };
  } catch (error) {
    console.error('Failed to request E-cash withdrawal:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to create withdrawal request' 
    };
  }
};

// Transfer E-Cash between members
export const transferECash = async (input: {
  senderId: string;
  recipientIdentifier: string;
  amount: number;
}): Promise<{ success: boolean; message: string }> => {
  const { senderId, recipientIdentifier, amount } = input;

  try {
    // Find recipient
    const recipient = await prisma.user.findFirst({
      where: {
        OR: [
          { memberId: recipientIdentifier },
          { email: recipientIdentifier.toLowerCase() },
          { phoneNumber: recipientIdentifier }
        ]
      }
    });

    if (!recipient) {
      return { success: false, message: 'Recipient not found' };
    }

    if (recipient.id === senderId) {
      return { success: false, message: 'Cannot transfer to yourself' };
    }

    if (amount <= 0) {
      return { success: false, message: 'Amount must be positive' };
    }

    // Calculate sender balance
    const senderCommissions = await prisma.commission.findMany({
      where: { userId: senderId }
    });
    const senderBalance = senderCommissions.reduce((acc, commission) => acc + commission.amount, 0);

    if (senderBalance < amount) {
      return { success: false, message: 'Insufficient funds' };
    }

    // Get sender details for notifications
    const sender = await prisma.user.findUnique({ 
      where: { id: senderId }, 
      select: { fullName: true, memberId: true } 
    });

    // Create transfer transactions
    await prisma.$transaction(async (tx) => {
      // Debit sender
      await tx.commission.create({
        data: {
          userId: senderId,
          date: new Date(),
          type: `Transfer to ${recipient.fullName}`,
          status: 'Paid',
          amount: -amount,
        },
      });

      // Credit recipient
      await tx.commission.create({
        data: {
          userId: recipient.id,
          date: new Date(),
          type: `Transfer from ${sender?.fullName || 'Member'}`,
          status: 'Paid',
          amount: amount,
        },
      });
    });

    // Notify recipient about the transfer
    try {
      await prisma.notification.create({
        data: {
          memberId: recipient.id,
          type: 'in_app',
          category: 'system',
          title: 'E-Cash Transfer Received',
          body: `You have received $${amount.toLocaleString()} from ${sender?.fullName || 'a member'}.`,
          data: {
            transferId: `TR-${Date.now()}`,
            senderId: senderId,
            senderName: sender?.fullName || 'Unknown',
            amount: amount,
            link: '/ecash',
          },
          priority: 'medium',
        },
      });
    } catch (notifyErr) {
      console.error('Failed to create transfer notification for recipient:', notifyErr);
    }

    // Notify sender about successful transfer
    try {
      await prisma.notification.create({
        data: {
          memberId: senderId,
          type: 'in_app',
          category: 'system',
          title: 'E-Cash Transfer Completed',
          body: `You have successfully transferred $${amount.toLocaleString()} to ${recipient.fullName}.`,
          data: {
            transferId: `TR-${Date.now()}`,
            recipientId: recipient.id,
            recipientName: recipient.fullName,
            amount: amount,
            link: '/ecash',
          },
          priority: 'medium',
        },
      });
    } catch (notifyErr) {
      console.error('Failed to create transfer notification for sender:', notifyErr);
    }

    // Notify admins if transfer is large (over $1000)
    if (amount > 1000) {
      try {
        const admins = await prisma.user.findMany({
          where: { isAdmin: true },
          select: { id: true },
        });

        if (admins.length > 0) {
          await prisma.notification.createMany({
            data: admins.map((admin) => ({
              memberId: admin.id,
              type: 'in_app',
              category: 'system',
              title: 'Large E-Cash Transfer',
              body: `${sender?.fullName || 'A member'} transferred $${amount.toLocaleString()} to ${recipient.fullName}. This transfer requires admin review.`,
              data: {
                transferId: `TR-${Date.now()}`,
                senderId: senderId,
                senderName: sender?.fullName || 'Unknown',
                recipientId: recipient.id,
                recipientName: recipient.fullName,
                amount: amount,
                link: '/admin/dashboard',
              },
              priority: 'high',
            })),
          });
        }
      } catch (notifyErr) {
        console.error('Failed to create admin notification for large transfer:', notifyErr);
      }
    }

    return { success: true, message: 'Transfer completed successfully' };
  } catch (error) {
    console.error('Failed to transfer E-Cash:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Transfer failed' };
  }
};

export async function checkProfileConflicts(
  memberId: string,
  updates: { phoneNumber?: string; email?: string | null }
): Promise<{ phoneConflict?: boolean; emailConflict?: boolean }> {
  try {
    const conflicts: { phoneConflict?: boolean; emailConflict?: boolean } = {};

    // Check phone number conflicts
    if (updates.phoneNumber) {
      const phoneConflict = await prisma.user.findFirst({
        where: {
          phoneNumber: updates.phoneNumber,
          id: { not: memberId },
          deleted: false
        }
      });
      conflicts.phoneConflict = !!phoneConflict;
    }

    // Check email conflicts
    if (updates.email) {
      const emailConflict = await prisma.user.findFirst({
        where: {
          email: updates.email,
          id: { not: memberId },
          deleted: false
        }
      });
      conflicts.emailConflict = !!emailConflict;
    }

    return conflicts;
  } catch (error) {
    console.error('Failed to check profile conflicts:', error);
    throw error;
  }
}

export const changeUserPassword = async (
  userId: string,
  newPassword: string,
  currentIdCard?: string
): Promise<void> => {
  try {
    // Keep behaviour consistent with /api/profile/change-password:
    // - The "new password" value is stored as the full ID card number
    // - The actual login password is the last 4 digits of that value
    // - Minimum length is 4 characters
    if (!newPassword || newPassword.length < 4) {
      throw new Error('Password must be at least 4 characters long');
    }

    // If currentIdCard is provided, verify it matches the user's current ID card
    if (currentIdCard !== undefined) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { idCardNumber: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const currentIdCardNormalized = (user.idCardNumber || '').trim();
      const providedIdCardNormalized = (currentIdCard || '').trim();

      if (!currentIdCardNormalized) {
        throw new Error('No ID card number found for this account. Please contact support.');
      }

      if (currentIdCardNormalized !== providedIdCardNormalized) {
        throw new Error('Current ID card number does not match');
      }
    }

    // Derive the actual password that will be used for login (last 4 digits)
    const lastFourDigits =
      newPassword.length >= 4 ? newPassword.slice(-4) : newPassword;

    const hashedPassword = await hashPassword(lastFourDigits);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        idCardNumber: newPassword,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Failed to change user password:', error);
    throw error;
  }
};

export const deleteMember = async (memberId: string): Promise<void> => {
  try {
    console.log('[deleteMember] Starting deletion for memberId:', memberId);
    
    // Check if user exists - need to bypass soft delete filter to find user even if already deleted
    const user = await prisma.user.findUnique({
      where: { id: memberId },
      select: { id: true, isAdmin: true, deleted: true }
    });

    if (!user) {
      console.error('[deleteMember] User not found:', memberId);
      throw new Error('User not found');
    }

    if (user.isAdmin) {
      console.error('[deleteMember] Cannot delete admin user:', memberId);
      throw new Error('Cannot delete admin users');
    }

    if (user.deleted) {
      console.log('[deleteMember] User already deleted:', memberId);
      return; // Already deleted, nothing to do
    }

    console.log('[deleteMember] Cleaning up parent links...');
    // Clean up parent links so the genealogy tree shows add buttons again
    // Get all users and filter in memory (since Prisma JSON queries are limited)
    const allUsers = await prisma.user.findMany({
      where: { deleted: false },
      select: { id: true, children: true },
    });

    const parentsWithChild = allUsers.filter((user: any) => {
      const children = user.children as any;
      return children && (children.left === memberId || children.right === memberId);
    });

    console.log('[deleteMember] Found parents:', parentsWithChild.length);
    const parentIds: string[] = [];
    for (const parent of parentsWithChild) {
      const currentChildren: any = parent.children || {};
      const nextChildren = {
        left: currentChildren.left === memberId ? null : currentChildren.left ?? null,
        right: currentChildren.right === memberId ? null : currentChildren.right ?? null,
      };
      await prisma.user.update({
        where: { id: parent.id },
        data: { children: nextChildren },
      });
      parentIds.push(parent.id);
      console.log('[deleteMember] Updated parent:', parent.id);
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
          uplines.forEach(id => allUplineIds.add(id));
        }
        
        await Promise.all(
          Array.from(allUplineIds).map(uplineId => PVMatchingService.updateTeamSize(uplineId))
        );
      } catch (error) {
        console.error('Error updating team sizes after deletion:', error);
        // Continue - don't block deletion
      }
    }

    console.log('[deleteMember] Soft deleting user record...');
    // Soft delete the user record (set deleted flag)
    const result = await prisma.user.update({
      where: { id: memberId },
      data: {
        deleted: true,
        deletedDate: new Date(),
        active: false,
        updatedAt: new Date()
      }
    });
    console.log('[deleteMember] User soft deleted successfully:', result.id);
  } catch (error) {
    console.error('[deleteMember] Failed to delete member:', error);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Member management server actions (used by createMemberDocument)
// ---------------------------------------------------------------------------

/**
 * Server-side function to get all members using Prisma directly
 */
export async function getAllMembers(): Promise<Member[]> {
  try {
    const users = await prisma.user.findMany({
      where: {
        deleted: false, // Filter out soft-deleted users
      },
      orderBy: { createdAt: 'asc' },
    });
    return users.map(transformUserToMember);
  } catch (error) {
    console.error('Failed to get all members:', error);
    throw error;
  }
}

/**
 * Server-side function to add/update member in database
 * This updates an existing user with member data or creates if doesn't exist
 */
export async function addMemberToDb(memberData: any): Promise<string> {
  try {
    const updateData: any = {
      firstName: memberData.firstName,
      surname: memberData.surname,
      fullName: `${memberData.firstName} ${memberData.surname}`,
      phoneNumber: memberData.phoneNumber,
      accountType: memberData.accountType || 'Distributor',
      sponsorId: memberData.sponsorId || null,
      placementParentId: memberData.placementParentId || null,
      position: memberData.position || null,
      isAdmin: memberData.isAdmin ?? false,
      active: memberData.active ?? true,
      rank: memberData.rank || 'Member',
      storeOwnerLevel: memberData.storeOwnerLevel !== undefined ? memberData.storeOwnerLevel : null,
      teamSize: memberData.teamSize || { left: 0, right: 0, total: 0 },
      children: memberData.children || { left: null, right: null },
      addresses: memberData.addresses || [],
      updatedAt: new Date(),
    };

    // Only update email if provided (email is required in schema, so don't set to null)
    if (memberData.email && memberData.email.trim() !== '') {
      updateData.email = memberData.email;
    }

    // Only update idCardUrl if provided
    if (memberData.idCardUrl !== undefined) {
      updateData.idCardUrl = memberData.idCardUrl;
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: memberData.id },
      select: { id: true }
    });

    if (existingUser) {
      // Update existing user
      await prisma.user.update({
        where: { id: memberData.id },
        data: updateData,
      });
    } else {
      // User should have been created by createMemberDocument, but if not, throw error
      throw new Error(`User with id ${memberData.id} does not exist. User must be created first.`);
    }

    // Update parent's children if placement was made
    if (memberData.placementParentId && memberData.position) {
      const parent = await prisma.user.findUnique({
        where: { id: memberData.placementParentId },
        select: { children: true }
      });

      if (parent) {
        // Ensure children object exists and has proper structure
        const currentChildren = (parent.children as any) || { left: null, right: null };
        const updatedChildren = {
          left: currentChildren.left || null,
          right: currentChildren.right || null,
          [memberData.position]: memberData.id
        };

        console.log(`Updating parent ${memberData.placementParentId} children:`, {
          before: currentChildren,
          after: updatedChildren,
          newMemberId: memberData.id,
          position: memberData.position
        });

        await prisma.user.update({
          where: { id: memberData.placementParentId },
          data: { children: updatedChildren }
        });

        console.log(`Successfully updated parent ${memberData.placementParentId} children`);

        // Update teamSize for parent and all upline sponsors
        try {
          const { PVMatchingService } = await import('@/services/pv-matching-service');
          
          // Update direct parent's teamSize
          await PVMatchingService.updateTeamSize(memberData.placementParentId);
          
          // Update all upline sponsors' teamSize (cascade)
          await PVMatchingService.updateUplineTeamSizes(memberData.id);
        } catch (error) {
          console.error('Error updating team sizes:', error);
          // Continue - don't block member creation
        }

        // Auto-trigger Daily Match if parent now has both left and right downlines
        try {
          const { checkAndTriggerDailyMatch, triggerUplineCascade } = await import('@/services/daily-match-trigger');
          
          // 1. Check and trigger Daily Match for direct parent
          await checkAndTriggerDailyMatch(memberData.placementParentId);
          
          // 2. UPLINE CASCADE: Trigger recalculation for ALL upline sponsors
          // When a new member joins at ANY level, all sponsors above them should recalculate
          // because this member's PV adds to their leg totals
          await triggerUplineCascade(memberData.id);
        } catch (error) {
          console.error('Error auto-triggering Daily Match / Upline Cascade:', error);
          // Continue - don't block member creation
        }

        // Create and pay Binary Bonus commission for the parent when new member is added
        // Commission is calculated based on:
        // - PV Points: Based on new member's rank
        // - Commission Rate: Based on placement parent's rank
        // Same logic as referral link registration
        try {
          // Import commission calculation functions
          const { getPVPointsByRank, getCommissionRateByRank } = await import('@/lib/referral-tracking');
          
          // Get placement parent's rank (sponsor)
          const placementParent = await prisma.user.findUnique({
            where: { id: memberData.placementParentId },
            select: { rank: true, companyId: true }
          });
          
          const sponsorRank = placementParent?.rank || null;
          
          // Get new member's rank
          const newMember = await prisma.user.findUnique({
            where: { id: memberData.id },
            select: { rank: true, companyId: true, fullName: true }
          });
          
          const newMemberRank = newMember?.rank || 'Member';
          
          // Normalize ranks
          const normalizedSponsorRank = sponsorRank ? sponsorRank.trim() : null;
          const normalizedNewMemberRank = newMemberRank ? newMemberRank.trim() : null;
          
          // Valid ranks that have PV points (Bronze and above)
          const validRanks = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Manager', 'Director', 'President', 'Double President'];
          
          // Check if new member is Member rank - if so, no commission
          const isNewMemberMember = !normalizedNewMemberRank || 
                                    normalizedNewMemberRank === '' || 
                                    normalizedNewMemberRank.toLowerCase() === 'member' ||
                                    !validRanks.includes(normalizedNewMemberRank);
          
          // Check if sponsor has valid rank
          const isSponsorMember = !normalizedSponsorRank || 
                                  normalizedSponsorRank === '' || 
                                  normalizedSponsorRank.toLowerCase() === 'member';
          const isSponsorValidRank = normalizedSponsorRank && validRanks.includes(normalizedSponsorRank);
          
          // Skip commission if new member is Member rank
          if (isNewMemberMember) {
            console.log(`[Binary Bonus] Skipping - New member rank is Member or invalid: "${newMemberRank}"`);
          } else if (isSponsorMember || !isSponsorValidRank) {
            // Skip if sponsor is Member or invalid rank
            console.log(`[Binary Bonus] Skipping - Sponsor rank is Member or invalid: "${sponsorRank}"`);
          } else {
            // Calculate commission: PV Points (from new member's rank) × Commission Rate (from sponsor's rank)
            const pvPoints = getPVPointsByRank(normalizedNewMemberRank);
            const commissionRate = getCommissionRateByRank(normalizedSponsorRank);
            
            // Final safety check
            if (pvPoints <= 0 || commissionRate <= 0) {
              console.log(`[Binary Bonus] Skipping - Invalid values: PV=${pvPoints}, Rate=${commissionRate}`);
            } else {
              const commissionAmount = Math.round(pvPoints * commissionRate * 100) / 100;
              
              console.log(`[Binary Bonus] Calculation: ${pvPoints} PV (${normalizedNewMemberRank}) × ${(commissionRate * 100).toFixed(1)}% (${normalizedSponsorRank}) = ${commissionAmount}`);
              
              // Check if commission already exists for this new member to prevent duplicates
              const existingCommission = await prisma.commission.findFirst({
                where: {
                  userId: memberData.placementParentId,
                  type: 'Binary Bonus',
                  date: {
                    gte: new Date(Date.now() - 60000) // Last 60 seconds
                  }
                }
              });

              if (existingCommission) {
                console.log('Binary Bonus already exists for recent member addition, skipping duplicate');
              } else {
                console.log('Creating and paying Binary Bonus commission:', {
                  parentId: memberData.placementParentId,
                  newMemberId: memberData.id,
                  position: memberData.position,
                  newMemberRank: normalizedNewMemberRank,
                  sponsorRank: normalizedSponsorRank,
                  pvPoints,
                  commissionRate,
                  commissionAmount
                });
                
                const commission = await prisma.commission.create({
                  data: {
                    userId: memberData.placementParentId,
                    amount: commissionAmount,
                    type: 'Binary Bonus',
                    status: 'Pending',
                    companyId: newMember?.companyId || placementParent?.companyId || undefined,
                    date: new Date(),
                    description: `Binary Bonus: New member ${newMember?.fullName || `${memberData.firstName || ''} ${memberData.surname || ''}`} (${normalizedNewMemberRank}, ${pvPoints} PV) added to ${memberData.position} leg - ${pvPoints} PV × ${(commissionRate * 100).toFixed(1)}%`
                  }
                });

                // Credit the wallet immediately
                try {
                  const { WalletService } = await import('@/services/wallet-service');
                  await WalletService.creditWallet(
                    memberData.placementParentId,
                    commissionAmount,
                    `Binary Bonus: New member ${newMember?.fullName || `${memberData.firstName || ''} ${memberData.surname || ''}`} (${normalizedNewMemberRank}, ${pvPoints} PV) added to ${memberData.position} leg - ${pvPoints} PV × ${(commissionRate * 100).toFixed(1)}%`,
                    commission.id,
                    'commission'
                  );
                  
                  // Mark commission as paid
                  await prisma.commission.update({
                    where: { id: commission.id },
                    data: { status: 'Paid' }
                  });
                  
                  console.log('Binary Bonus commission paid and wallet credited:', commission.id);
                } catch (walletError) {
                  console.error('Failed to credit wallet for Binary Bonus:', walletError);
                  // Commission remains as Pending if wallet credit fails
                }
              }
            }
          }

          // AUTO-CALCULATE G2 Binary Bonus for grandparent (sponsor with Manager+ rank) when G1 has downlines
          // This happens when a new member (G2) is added under G1
          // Instead of manually calculating, trigger commission recalculation which includes G2 bonus
          try {
            // Get the placement parent (G1) to find their parent (grandparent/sponsor)
            const g1Parent = await prisma.user.findUnique({
              where: { id: memberData.placementParentId },
              select: { 
                id: true,
                placementParentId: true,
                position: true,
                rank: true
              }
            });

            // Check if G1 has a placement parent (grandparent/sponsor)
            if (g1Parent?.placementParentId) {
              // Get grandparent (sponsor) to check if they're Manager+ rank
              const grandparent = await prisma.user.findUnique({
                where: { id: g1Parent.placementParentId },
                select: { 
                  id: true,
                  rank: true,
                  memberId: true,
                  active: true,
                  deleted: true
                }
              });

              // G2 rates for Manager+ ranks
              const g2Rates: Record<string, number> = {
                'Manager': 0.01,   // 1% G2
                'Director': 0.03,  // 3% G2
                'President': 0.03, // 3% G2
                'Double President': 0.03 // 3% G2
              };

              const sponsorG2Rate = grandparent?.rank ? (g2Rates[grandparent.rank] || 0) : 0;

              // Trigger G2 Binary Bonus auto-calculation if grandparent is Manager+
              // NOTE: We always trigger calculation regardless of new member's rank
              // The calculation service will find all eligible G2 downlines and calculate properly
              if (sponsorG2Rate > 0 && grandparent && grandparent.active && !grandparent.deleted) {
                console.log(`🔄 Auto-calculating G2 Binary Bonus for grandparent ${grandparent.memberId} (${grandparent.rank}):`, {
                  grandparentId: grandparent.id,
                  grandparentMemberId: grandparent.memberId,
                  grandparentRank: grandparent.rank,
                  g1Id: g1Parent.id,
                  g2Id: memberData.id,
                  g2MemberId: memberData.memberId,
                  newMemberRank: normalizedNewMemberRank || 'Member'
                });

                // Trigger G2 Binary Bonus auto-calculation service
                // Use setTimeout to ensure user data is fully committed to database
                try {
                  const { autoCalculateG2BinaryBonus } = await import('@/services/g2-binary-bonus-auto-calc');
                  
                  // Run immediately first
                  await autoCalculateG2BinaryBonus(g1Parent.id, memberData.id);
                  
                  // Also schedule a delayed check in case the first one runs before data is committed
                  setTimeout(async () => {
                    try {
                      console.log(`🔄 [G2 Delayed] Running delayed G2 calculation for grandparent ${grandparent.memberId}`);
                      await autoCalculateG2BinaryBonus(g1Parent.id, memberData.id);
                    } catch (delayedError) {
                      console.error('Delayed G2 calculation failed:', delayedError);
                    }
                  }, 2000); // 2 second delay
                } catch (calcError) {
                  console.error('Failed to auto-calculate G2 Binary Bonus for grandparent:', calcError);
                  // Don't fail if commission calculation fails
                }
              } else {
                if (!sponsorG2Rate || !grandparent) {
                  console.log(`⏭️ G2 Binary Bonus not available: Grandparent ${g1Parent.placementParentId} rank is not Manager+ (${grandparent?.rank || 'not found'})`);
                }
              }
            }
          } catch (g2Error) {
            // Don't fail if G2 commission calculation fails
            console.warn('Failed to auto-calculate G2 Binary Bonus commission for grandparent:', g2Error);
          }
        } catch (commissionError) {
          // Don't fail if commission creation fails
          console.warn('Failed to create Binary Bonus commission for new member:', commissionError);
        }
      } else {
        console.error(`Parent ${memberData.placementParentId} not found when updating children`);
      }
    } else {
      console.warn('Cannot update parent children: missing placementParentId or position', {
        placementParentId: memberData.placementParentId,
        position: memberData.position
      });
    }

    return memberData.id;
  } catch (error) {
    console.error('Failed to add member to database:', error);
    throw error;
  }
}

/**
 * Re-export findFirstAvailablePosition from user-service
 */
export const findFirstAvailablePosition = findFirstAvailablePositionUtil;

/**
 * Re-export initializeMemberOnboarding from onboarding-service
 */
export const initializeMemberOnboarding = initializeMemberOnboardingUtil;

/**
 * Delete a member address
 */
export async function deleteMemberAddress(memberId: string, addressId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: memberId },
      select: { addresses: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const currentAddresses: Address[] = (user.addresses as any) || [];
    const updatedAddresses = currentAddresses.filter((addr: Address) => addr.id !== addressId);

    await prisma.user.update({
      where: { id: memberId },
      data: {
        addresses: updatedAddresses as any,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to delete member address:', error);
    throw error;
  }
}

/**
 * Set default member address
 */
export async function setDefaultMemberAddress(memberId: string, addressId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: memberId },
      select: { addresses: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const currentAddresses: Address[] = (user.addresses as any) || [];
    const updatedAddresses = currentAddresses.map((addr: Address) => ({
      ...addr,
      isDefault: addr.id === addressId
    }));

    await prisma.user.update({
      where: { id: memberId },
      data: {
        addresses: updatedAddresses as any,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to set default member address:', error);
    throw error;
  }
}

/**
 * Approve stock request and transfer stock to member
 */
export async function approveStockRequest(requestId: string, processedBy?: string): Promise<void> {
  try {
    // Check if StockRequest model is available
    if (!(prisma as any).stockRequest) {
      throw new Error('Stock request functionality is not yet available');
    }

    const stockRequest = await (prisma as any).stockRequest.findUnique({
      where: { id: requestId },
      include: { items: true }
    });

    if (!stockRequest) {
      throw new Error('Stock request not found');
    }

    if (stockRequest.status !== 'pending') {
      throw new Error('Stock request has already been processed');
    }

    // CRITICAL: Determine the actual recipient
    // - requesterId: The person who made the request (should receive the stock)
    // - stockistId: The target stockist (usually the approver/upline)
    let recipientUserId = stockRequest.requesterId;
    
    // If requesterId is not set (older requests), check if stockistId is an AdminStock
    if (!recipientUserId) {
      const stockistUser = await prisma.user.findUnique({
        where: { id: stockRequest.stockistId },
        select: { storeOwnerLevel: true }
      });
      const isStockistAdminStock = stockistUser?.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(stockistUser.storeOwnerLevel);
      
      if (isStockistAdminStock) {
        // If stockistId is AdminStock and requesterId is null, use stockistId as recipient
        recipientUserId = stockRequest.stockistId;
        console.log('🔄 Recipient is AdminStock (stockistId used as requester)', {
          stockistId: stockRequest.stockistId
        });
      } else if (stockRequest.stockistName) {
        // Fallback to name lookup
        let requesterName = stockRequest.stockistName;
        if (requesterName.startsWith('ADMIN_TRANSFER:')) {
          requesterName = requesterName.replace('ADMIN_TRANSFER:', '');
        }
        const requesterUser = await prisma.user.findFirst({
          where: {
            fullName: requesterName,
            id: { not: stockRequest.stockistId },
            active: true,
            deleted: false
          },
          select: { id: true }
        });
        if (requesterUser) {
          recipientUserId = requesterUser.id;
          console.log('🔄 Found requester by name lookup', { requesterName, recipientUserId });
        }
      }
    }
    
    // Final fallback: use stockistId if still no recipient
    if (!recipientUserId) {
      recipientUserId = stockRequest.stockistId;
      console.log('🔄 Using stockistId as final fallback recipient', { recipientUserId });
    }
    
    // Validation: Ensure recipient is valid
    if (!recipientUserId) {
      throw new Error('Cannot determine recipient for this stock request');
    }
    
    console.log('🎯 STOCK APPROVAL - Recipient determined:', {
      requestId,
      recipientUserId,
      requesterId: stockRequest.requesterId,
      stockistId: stockRequest.stockistId,
      stockistName: stockRequest.stockistName
    });

    // Use transaction to ensure atomicity
    const pvChangeData = await prisma.$transaction(async (tx) => {
      let totalPV = 0;
      let totalAmount = 0;
      
      // Process each item
      for (const item of stockRequest.items) {
        const quantity = item.requestedQuantity;
        
        // Get product details
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { pv: true, price: true, qty: true }
        });
        
        if (product) {
          totalPV += (product.pv || 0) * quantity;
          totalAmount += (product.price || item.unitPrice) * quantity;
          
          // Deduct from product inventory
          await tx.product.update({
            where: { id: item.productId },
            data: {
              qty: {
                decrement: quantity
              }
            }
          });
        }
      }
      
      // Check if recipient is AdminStock - if so, PV should go to PV/Stock only, not PV/Rank
      const recipientUser = await tx.user.findUnique({
        where: { id: recipientUserId },
        select: { storeOwnerLevel: true }
      });
      const isRecipientAdminStock = recipientUser?.storeOwnerLevel && ['S', 'M', 'C', 'D'].includes(recipientUser.storeOwnerLevel);
      
      // Update recipient's PV/Rank ONLY if they are NOT AdminStock
      // AdminStock users receive PV via wallet transaction (PV/Stock) only
      if (!isRecipientAdminStock) {
        // Get old PV and rank before updating
        const recipientBeforeUpdate = await tx.user.findUnique({
          where: { id: recipientUserId },
          select: { pv: true, rank: true }
        });
        const oldPV = recipientBeforeUpdate?.pv || 0;
        const newPV = oldPV + totalPV;
        
        console.log('📊 Updating user PV/Rank (non-AdminStock):', { recipientUserId, totalPV, oldPV });
        
        // CRITICAL: Update rank BEFORE handlePVChange (called after transaction)
        // checkAndTriggerDailyMatch requires sponsor's G1 children to have rank !== 'Member' (Bronze+)
        // Same fix as inventory-service transferStock for Matching Bonus to trigger
        const { shouldUpdateRank } = await import('@/lib/rank');
        const rankUpdateResult = shouldUpdateRank((recipientBeforeUpdate?.rank as any) || 'Member', newPV);
        const updateData: { pv?: { increment: number }; pvDate?: Date; rankOnlyNoPv?: boolean; rank?: string } = {
          pv: { increment: totalPV },
          pvDate: new Date(),
          rankOnlyNoPv: false
        };
        if (rankUpdateResult.shouldUpdate && rankUpdateResult.newRank) {
          updateData.rank = rankUpdateResult.newRank;
          console.log('📊 Rank will be upgraded:', { from: recipientBeforeUpdate?.rank, to: rankUpdateResult.newRank });
        }
        
        await tx.user.update({
          where: { id: recipientUserId },
          data: updateData
        });
        console.log('✅ User PV/Rank updated successfully');
        
        // CRITICAL: Add PV to sponsor's waiting PV for binary bonus calculations
        // This ensures that when admin approves stock request for a member, the sponsor receives binary bonus
        // Note: We need to call this AFTER the transaction completes, so we'll do it outside the transaction
        // Store the values to use after transaction
        (tx as any)._pvChangeData = {
          memberId: recipientUserId,
          oldPV,
          newPV
        };
      } else {
        console.log('⏭️ Skipping PV/Rank update - recipient is AdminStock, PV will go to PV/Stock only');
      }
      
      // Create inventory transactions for the RECIPIENT (this is what makes stock appear in My Stock)
      // Check if InventoryTransaction model exists
      if ((tx as any).inventoryTransaction) {
        for (const item of stockRequest.items) {
          const quantity = item.requestedQuantity;
          
          try {
            // Get recipient's current inventory for this product to calculate previousQty and newQty
            const existingTransactions = await (tx as any).inventoryTransaction.findMany({
              where: { 
                userId: recipientUserId,  // Use RECIPIENT, not stockistId!
                productId: item.productId
              },
              orderBy: { createdAt: 'asc' }
            });

            // Calculate current stock from existing transactions
            let currentStock = 0;
            for (const transaction of existingTransactions) {
              const qty = Number(transaction.quantity) || 0;
              if (transaction.type === 'purchase' || transaction.type === 'transfer' || transaction.type === 'return') {
                currentStock += qty;
              } else if (transaction.type === 'sale' || transaction.type === 'adjustment') {
                currentStock -= qty;
              }
            }
            currentStock = Math.max(0, currentStock);

            // Create inventory transaction for the RECIPIENT
            console.log('📦 Creating inventory transaction:', {
              userId: recipientUserId,
              productId: item.productId,
              productName: item.productName,
              quantity,
              currentStock,
              newStock: currentStock + quantity
            });
            
            const invTx = await (tx as any).inventoryTransaction.create({
              data: {
                userId: recipientUserId,  // Use RECIPIENT, not stockistId!
                productId: item.productId,
                type: 'transfer',
                quantity: quantity,
                previousQty: currentStock,
                newQty: currentStock + quantity,
                reference: `Stock request approved: ${requestId}`,
                reason: `Stock request approved - ${quantity} units of ${item.productName}`,
                createdBy: processedBy || 'system'
              }
            });
            
            console.log(`✅ Inventory transaction created:`, {
              id: invTx.id,
              userId: recipientUserId,
              productName: item.productName,
              quantity,
              newStock: currentStock + quantity
            });
          } catch (inventoryError: any) {
            console.error('❌ Failed to create inventory transaction', {
              error: inventoryError.message,
              recipientUserId,
              productId: item.productId,
              quantity
            });
            // Continue processing other items even if one fails
          }
        }
      } else {
        console.warn('⚠️ InventoryTransaction model not available - stock will not appear in My Stock');
      }
      
      // Get or create wallet for RECIPIENT
      console.log('💰 Looking for wallet for user:', recipientUserId);
      let wallet = await tx.wallet.findUnique({
        where: { userId: recipientUserId }  // Use RECIPIENT, not stockistId!
      });
      
      if (!wallet) {
        console.log('💰 Creating new wallet for user:', recipientUserId);
        wallet = await tx.wallet.create({
          data: {
            userId: recipientUserId,  // Use RECIPIENT, not stockistId!
            balance: 0
          }
        });
      }
      console.log('💰 Wallet found/created:', { walletId: wallet.id, userId: recipientUserId });
      
      // Create wallet transaction record for PV/Stock
      console.log('💵 Creating wallet transaction:', {
        walletId: wallet.id,
        recipientUserId,
        totalPV,
        referenceType: 'stock_transfer'
      });
      
      const walletTx = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'credit',  // Credit transaction (PV coming in)
          amount: totalPV,  // Use PV amount for PV/Stock tracking
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance,
          description: `Stock request #${requestId.substring(0, 8)} approved - ${stockRequest.items.length} item(s) (+${totalPV} PV)`,
          status: 'completed',
          referenceType: 'stock_transfer',  // This makes it show in PV/Stock
          referenceId: requestId,
        }
      });
      
      console.log('✅ Wallet transaction created:', {
        id: walletTx.id,
        walletId: walletTx.walletId,
        amount: walletTx.amount,
        referenceType: walletTx.referenceType
      });
      
      // Update stock request status
      await (tx as any).stockRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          processedDate: new Date(),
          processedBy
        }
      });

      console.log(`✅ Stock request ${requestId} approved successfully`, {
        recipientUserId,
        stockistId: stockRequest.stockistId,
        requesterId: stockRequest.requesterId,
        totalPV,
        totalAmount
      });
      
      // Return PV change data if available (for non-AdminStock recipients)
      return (tx as any)._pvChangeData || null;
    });

    // CRITICAL: After transaction completes, add PV to sponsor's waiting PV for binary bonus
    // This ensures that when admin approves stock request for a member, the sponsor receives binary bonus
    if (pvChangeData) {
      try {
        const { PVMatchingService } = await import('./pv-matching-service');
        await PVMatchingService.handlePVChange(
          pvChangeData.memberId,
          pvChangeData.oldPV,
          pvChangeData.newPV
        );
        console.log('✅ PV added to sponsor\'s waiting PV for binary bonus', {
          memberId: pvChangeData.memberId,
          oldPV: pvChangeData.oldPV,
          newPV: pvChangeData.newPV,
          pvDifference: pvChangeData.newPV - pvChangeData.oldPV
        });
      } catch (pvMatchingError: any) {
        // Log but don't fail the approval if PV matching update fails
        console.error('❌ Failed to update sponsor waiting PV for binary bonus', {
          error: pvMatchingError.message,
          memberId: pvChangeData.memberId,
          pvDifference: pvChangeData.newPV - pvChangeData.oldPV
        });
      }
    }

    // Send notification to RECIPIENT about approval
    try {
      const itemCount = stockRequest.items.reduce((sum: number, item: any) => {
        return sum + (item.requestedQuantity || 0);
      }, 0);

      await createNotification(
        recipientUserId,  // Send to recipient, not stockistId!
        'stock-request-approved',
        {
          requestId: requestId.substring(0, 8), // Short ID for display
          itemCount: itemCount.toString()
        },
        'high',
        {
          requestId,
          type: 'stock_request_approved',
          stockRequestId: requestId,
          link: '/my-stock' // Navigate to my-stock page when clicked
        }
      );
      
      console.log(`Approval notification sent to stockist ${stockRequest.stockistId}`);
    } catch (notifError) {
      // Log but don't fail the approval if notification fails
      console.error('Failed to send approval notification:', notifError);
    }

  } catch (error) {
    console.error('Failed to approve stock request:', error);
    throw error;
  }
}

/**
 * Reject stock request
 */
export async function rejectStockRequest(requestId: string): Promise<void> {
  try {
    // Check if StockRequest model is available
    if (!(prisma as any).stockRequest) {
      throw new Error('Stock request functionality is not yet available');
    }

    // Get stock request details before updating
    const stockRequest = await (prisma as any).stockRequest.findUnique({
      where: { id: requestId },
      select: {
        stockistId: true,
        stockistName: true
      }
    });

    if (!stockRequest) {
      throw new Error('Stock request not found');
    }

    await (prisma as any).stockRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        processedDate: new Date()
      }
    });

    console.log(`Stock request ${requestId} rejected successfully`);

    // Send notification to stockist about rejection
    try {
      await createNotification(
        stockRequest.stockistId,
        'stock-request-rejected',
        {
          requestId: requestId.substring(0, 8) // Short ID for display
        },
        'high',
        {
          requestId,
          type: 'stock_request_rejected',
          stockRequestId: requestId,
          link: '/my-stock' // Navigate to my-stock page when clicked
        }
      );
      
      console.log(`Rejection notification sent to stockist ${stockRequest.stockistId}`);
    } catch (notifError) {
      // Log but don't fail the rejection if notification fails
      console.error('Failed to send rejection notification:', notifError);
    }

  } catch (error) {
    console.error('Failed to reject stock request:', error);
    throw error;
  }
}

/**
 * Transfer stock between users (wrapper for inventory service)
 */
export async function transferStock(
  fromUserId: string,
  toUserId: string,
  items: Array<{ productId: string; productName: string; quantity: number; unitPrice: number }>,
  options?: { pvDestination?: 'rank' | 'product' }
): Promise<{ success: boolean; message?: string; transferId?: string }> {
  try {
    const { transferStock: transferStockService } = await import('./inventory-service');
    // My Stock Page: Transfer to downline uses BASE commission rates (0.8%, 1.7%, 2.6%, 3.0%)
    const result = await transferStockService(
      fromUserId, 
      toUserId, 
      items,
      undefined, // companyId
      'base', // My Stock Page: Use base commission rates
      options?.pvDestination ?? 'rank' // Default: PV goes to PV/Rank
    );
    
    if (!result.success) {
      return {
        success: false,
        message: result.message || 'Stock transfer failed'
      };
    }
    
    // Create a StockRequest record to show in Stock Transfer Requests
    // Only create for user-to-user transfers (not system transfers)
    if (fromUserId !== 'system') {
      try {
        // Get seller (fromUserId) details including memberId
        const seller = await prisma.user.findUnique({
          where: { id: fromUserId },
          select: { 
            id: true, 
            firstName: true, 
            surname: true,
            fullName: true,
            memberId: true,
            storeOwnerLevel: true
          }
        });

        // Get buyer (toUserId) details to ensure they exist
        const buyer = await prisma.user.findUnique({
          where: { id: toUserId },
          select: { 
            id: true, 
            firstName: true,
            surname: true,
            fullName: true,
            memberId: true,
            storeOwnerLevel: true 
          }
        });

        // Use seller directly since it now includes memberId
        const sellerWithMemberId = seller;

        if (sellerWithMemberId && buyer && (prisma as any).stockRequest) {
          const sellerName = sellerWithMemberId.fullName || `${sellerWithMemberId.firstName} ${sellerWithMemberId.surname}`;
          const buyerName = buyer.fullName || `${buyer.firstName} ${buyer.surname}`;
          const totalValue = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
          const itemCount = items.length;

          // Create stock request record for RECIPIENT (buyer) - shows "Transfer from [Seller]"
          await (prisma as any).stockRequest.create({
            data: {
              stockistId: toUserId, // Buyer (recipient) - they will see this in their requests
              stockistName: `Transfer from ${sellerName}`, // Clear indication this is a direct transfer
              stockistLevel: sellerWithMemberId.storeOwnerLevel || buyer.storeOwnerLevel || 'S',
              fromUserId: fromUserId, // Sender
              toUserId: toUserId, // Recipient
              requesterId: toUserId, // Recipient is the requester
              requesterName: buyerName, // Recipient's name
              requesterMemberId: buyer.memberId || null, // Recipient's member ID
              status: 'approved', // Already completed transfer
              processedDate: new Date(),
              processedBy: fromUserId, // Seller who transferred
              totalValue,
              itemCount,
              items: {
                create: items.map((item) => ({
                  productId: item.productId,
                  productName: item.productName,
                  requestedQuantity: item.quantity,
                  approvedQuantity: item.quantity, // All items approved since transfer completed
                  unitPrice: item.unitPrice
                }))
              }
            },
            include: {
              items: true
            }
          });

          // Create stock request record for SENDER (seller) - shows "Transfer to [Buyer]"
          await (prisma as any).stockRequest.create({
            data: {
              stockistId: fromUserId, // Seller (sender) - they will see this in their requests
              stockistName: `Transfer to ${buyerName}`, // Clear indication this is a direct transfer
              stockistLevel: sellerWithMemberId.storeOwnerLevel || buyer.storeOwnerLevel || 'S',
              fromUserId: fromUserId, // Sender
              toUserId: toUserId, // Recipient
              requesterId: toUserId, // Recipient is the requester
              requesterName: buyerName, // Recipient's name
              requesterMemberId: buyer.memberId || null, // Recipient's member ID
              status: 'approved', // Already completed transfer
              processedDate: new Date(),
              processedBy: fromUserId, // Seller who transferred
              totalValue,
              itemCount,
              items: {
                create: items.map((item) => ({
                  productId: item.productId,
                  productName: item.productName,
                  requestedQuantity: item.quantity,
                  approvedQuantity: item.quantity, // All items approved since transfer completed
                  unitPrice: item.unitPrice
                }))
              }
            },
            include: {
              items: true
            }
          });

          console.log('Stock request records created for transfer (both sender and recipient)', {
            transferId: result.transferId,
            fromUserId,
            toUserId,
            itemCount,
            totalValue
          });
        }
      } catch (stockRequestError: any) {
        // Log but don't fail the transfer if stock request creation fails
        console.error('Failed to create stock request record for transfer', {
          error: stockRequestError.message,
          transferId: result.transferId,
          fromUserId,
          toUserId
        });
      }
    }
    
    return {
      success: true,
      transferId: result.transferId,
      message: 'Stock transferred successfully'
    };
  } catch (error: any) {
    console.error('Failed to transfer stock:', error);
    return {
      success: false,
      message: error.message || 'Stock transfer failed'
    };
  }
}

/**
 * Request stock transfer
 */
export async function requestStockTransfer(data: {
  stockistId: string; // Target stockist (upline) who will receive the request
  stockistName: string;
  stockistLevel: string;
  requestedById?: string; // Optional: ID of member making the request (if different from stockistId)
  requestedByName?: string; // Optional: Name of member making the request
  requests: Array<{ productId: string; productName: string; requestedQuantity: number; unitPrice?: number }>;
  shippingMethod?: 'ship_to_address' | 'pickup_from_stockist'; // Optional: Shipping method
}): Promise<{ success: boolean; message: string }> {
  try {
    // Check if StockRequest model is available
    if (!(prisma as any).stockRequest) {
      return { success: false, message: 'Stock request functionality is not yet available' };
    }

    // Fetch products to get prices for calculating total value
    const products = await prisma.product.findMany({
      where: {
        id: { in: data.requests.map(r => r.productId) }
      },
      select: { id: true, name: true, price: true }
    });

    // Transform requests to items format and calculate totals
    const items = data.requests.map(req => {
      const product = products.find(p => p.id === req.productId);
      return {
        productId: req.productId,
        productName: req.productName || product?.name || 'Unknown Product',
        requestedQuantity: req.requestedQuantity,
        unitPrice: product?.price || 0
      };
    });

    // Calculate total value and item count
    const totalValue = items.reduce((sum, item) => sum + (item.unitPrice * item.requestedQuantity), 0);
    const itemCount = items.reduce((sum, item) => sum + item.requestedQuantity, 0);

    // Determine the requester name (use requestedByName if provided, otherwise use stockistName)
    const requesterName = data.requestedByName || data.stockistName;
    
    // Create stock request matching the API structure
    // stockistId = target stockist (upline) who will handle the request
    // stockistName = name of the requester (downline member)
    // requesterId = ID of the member making the request (will receive the stock)
    const stockRequest = await (prisma as any).stockRequest.create({
      data: {
        stockistId: data.stockistId, // Target stockist (upline) - this determines who sees the request
        stockistName: requesterName, // Name of the member making the request
        stockistLevel: data.stockistLevel,
        requesterId: data.requestedById || null, // ID of member making request - will receive stock on approval
        status: 'pending',
        totalValue,
        itemCount,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            productName: item.productName,
            requestedQuantity: item.requestedQuantity,
            unitPrice: item.unitPrice
          }))
        }
      }
    });

    // Send notification to the target stockist (upline) if they have stockist level
    // Otherwise, send to admins
    try {
      const targetStockist = await prisma.user.findUnique({
        where: { id: data.stockistId },
        select: { id: true, storeOwnerLevel: true, isAdmin: true }
      });

      if (targetStockist) {
        const hasStockistLevel = targetStockist.storeOwnerLevel && 
          ['S', 'M', 'C', 'D'].includes(targetStockist.storeOwnerLevel);
        
        if (hasStockistLevel && !targetStockist.isAdmin) {
          // Send notification to the upline stockist
          await createNotification(
            targetStockist.id,
            'stock-request',
            {
              stockistName: requesterName,
              stockistLevel: data.stockistLevel
            },
            'high',
            {
              requestId: stockRequest.id,
              type: 'stock_request',
              stockRequestId: stockRequest.id,
              link: '/my-stock' // Navigate to my-stock page when clicked
            }
          );
        } else {
          // Send notification to all admins
          const admins = await prisma.user.findMany({
            where: { 
              isAdmin: true,
              active: true,
              deleted: false
            },
            select: { id: true }
          });

          for (const admin of admins) {
            await createNotification(
              admin.id,
              'stock-request',
              {
                stockistName: requesterName,
                stockistLevel: data.stockistLevel
              },
              'high',
              {
                requestId: stockRequest.id,
                type: 'stock_request',
                stockRequestId: stockRequest.id,
                link: '/admin/binary-stock'
              }
            );
          }
        }
      }
    } catch (notifError) {
      // Log but don't fail the request if notification fails
      console.error('Failed to send notification for stock request:', notifError);
    }

    return { success: true, message: 'Stock request submitted successfully' };
  } catch (error: any) {
    console.error('Failed to request stock transfer:', error);
    return { success: false, message: error.message || 'Failed to submit stock request' };
  }
}

/**
 * Sell stock to downline
 */
export async function sellStockToDownline(data: {
  stockistId: string;
  buyerId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
}): Promise<{ success: boolean; message: string }> {
  try {
    const { transferStock: transferStockService } = await import('./inventory-service');
    // My Stock Page uses BASE commission rates (selling to regular users - Photo 2)
    const result = await transferStockService(
      data.stockistId,
      data.buyerId,
      [{
        productId: data.productId,
        productName: 'Product', // Could fetch from DB if needed
        quantity: data.quantity,
        unitPrice: data.unitPrice
      }],
      undefined, // companyId
      'base', // My Stock Page: Use base commission rates (Photo 2)
      'rank' // PV should contribute to PV/Rank by default
    );

    return {
      success: result.success,
      message: result.success ? 'Stock sold successfully' : 'Stock sale failed'
    };
  } catch (error: any) {
    console.error('Failed to sell stock to downline:', error);
    return { success: false, message: error.message || 'Failed to sell stock' };
  }
}

/**
 * Set user as admin
 */
export async function setUserAsAdmin(userId: string): Promise<{ success: boolean; message: string }> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { isAdmin: true }
    });

    return { success: true, message: 'User has been set as admin successfully.' };
  } catch (error: any) {
    console.error('Failed to set user as admin:', error);
    return { success: false, message: error.message || 'Failed to set user as admin.' };
  }
}

// ==================== ADMIN MANAGEMENT FUNCTIONS ====================

/**
 * Create organizational entities (Dealer, Center, Mobile, SmallMobile)
 */
export async function createOrganizationalEntity(
  type: 'D' | 'C' | 'M' | 'S',
  data: {
    name: string;
    code: string;
    description?: string;
    companyId?: string;
    parentId?: string; // dealerId for Center, centerId for Mobile, mobileId for SmallMobile
  }
): Promise<{ success: boolean; message: string; entityId?: string }> {
  try {
    let entity;
    
    switch (type) {
      case 'D':
        entity = await (prisma as any).dealer.create({
          data: {
            name: data.name,
            code: data.code,
            description: data.description,
            companyId: data.companyId || null,
          }
        });
        break;
      case 'C':
        if (!data.parentId) {
          return { success: false, message: 'Center requires a Dealer ID' };
        }
        entity = await (prisma as any).center.create({
          data: {
            name: data.name,
            code: data.code,
            description: data.description,
            dealerId: data.parentId,
            companyId: data.companyId || null,
          }
        });
        break;
      case 'M':
        if (!data.parentId) {
          return { success: false, message: 'Mobile requires a Center ID' };
        }
        entity = await (prisma as any).mobile.create({
          data: {
            name: data.name,
            code: data.code,
            description: data.description,
            centerId: data.parentId,
            companyId: data.companyId || null,
          }
        });
        break;
      case 'S':
        if (!data.parentId) {
          return { success: false, message: 'Small Mobile requires a Mobile ID' };
        }
        entity = await (prisma as any).smallMobile.create({
          data: {
            name: data.name,
            code: data.code,
            description: data.description,
            mobileId: data.parentId,
            companyId: data.companyId || null,
          }
        });
        break;
    }

    return {
      success: true,
      message: `${type === 'D' ? 'Dealer' : type === 'C' ? 'Center' : type === 'M' ? 'Mobile' : 'Small Mobile'} created successfully`,
      entityId: entity.id
    };
  } catch (error: any) {
    console.error(`Failed to create ${type} entity:`, error);
    return {
      success: false,
      message: error.message || `Failed to create ${type} entity`
    };
  }
}

/**
 * Assign admin role and entity scope to a user
 */
export async function assignAdminRole(
  userId: string,
  roleName: 'admin_s' | 'admin_m' | 'admin_c' | 'admin_d',
  entityType: 'S' | 'M' | 'C' | 'D',
  entityId: string,
  companyId?: string,
  assignedBy?: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // Assign role
    await RBACService.assignRole(userId, roleName, assignedBy);

    // Assign entity scope
    await RBACService.assignEntityScope(userId, entityType, entityId, companyId || null, assignedBy);

    return {
      success: true,
      message: `Admin role ${roleName} assigned successfully with ${entityType} scope`
    };
  } catch (error: any) {
    console.error('Failed to assign admin role:', error);
    return {
      success: false,
      message: error.message || 'Failed to assign admin role'
    };
  }
}

/**
 * Get admin scopes for a user
 */
export async function getAdminScopes(userId: string): Promise<{
  success: boolean;
  scopes?: Array<{
    id: string;
    entityType: 'S' | 'M' | 'C' | 'D';
    entityId: string;
    entityName?: string;
  }>;
  message?: string;
}> {
  try {
    const scopes = await RBACService.getAdminScopes(userId);
    return {
      success: true,
      scopes
    };
  } catch (error: any) {
    console.error('Failed to get admin scopes:', error);
    return {
      success: false,
      message: error.message || 'Failed to get admin scopes'
    };
  }
}

/**
 * Remove admin entity scope
 */
export async function removeAdminScope(
  adminId: string,
  entityType: 'S' | 'M' | 'C' | 'D',
  entityId: string
): Promise<{ success: boolean; message: string }> {
  try {
    await RBACService.removeEntityScope(adminId, entityType, entityId);
    return {
      success: true,
      message: 'Admin scope removed successfully'
    };
  } catch (error: any) {
    console.error('Failed to remove admin scope:', error);
    return {
      success: false,
      message: error.message || 'Failed to remove admin scope'
    };
  }
}

/**
 * Get all organizational entities
 */
export async function getOrganizationalEntities(
  type: 'D' | 'C' | 'M' | 'S',
  companyId?: string,
  parentId?: string
): Promise<{
  success: boolean;
  entities?: any[];
  message?: string;
}> {
  try {
    let entities;
    const where: any = { isActive: true };
    
    if (companyId) {
      where.companyId = companyId;
    }

    switch (type) {
      case 'D':
        entities = await (prisma as any).dealer.findMany({ where });
        break;
      case 'C':
        if (parentId) where.dealerId = parentId;
        entities = await (prisma as any).center.findMany({ where });
        break;
      case 'M':
        if (parentId) where.centerId = parentId;
        entities = await (prisma as any).mobile.findMany({ where });
        break;
      case 'S':
        if (parentId) where.mobileId = parentId;
        entities = await (prisma as any).smallMobile.findMany({ where });
        break;
    }

    return {
      success: true,
      entities: entities || []
    };
  } catch (error: any) {
    console.error(`Failed to get ${type} entities:`, error);
    return {
      success: false,
      message: error.message || `Failed to get ${type} entities`
    };
  }
}

/**
 * Get users with admin roles
 */
export async function getAdminUsers(
  roleName?: 'admin_s' | 'admin_m' | 'admin_c' | 'admin_d',
  companyId?: string
): Promise<{
  success: boolean;
  admins?: Array<{
    id: string;
    email: string;
    fullName: string;
    roles: string[];
    scopes: Array<{
      entityType: 'S' | 'M' | 'C' | 'D';
      entityId: string;
      entityName?: string;
    }>;
  }>;
  message?: string;
}> {
  try {
    const roleFilter = roleName 
      ? { role: { name: roleName } }
      : { role: { name: { in: ['admin_s', 'admin_m', 'admin_c', 'admin_d'] } } };

    const userRoles = await prisma.userRole.findMany({
      where: roleFilter,
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: true
              }
            },
            company: true
          }
        },
        role: true
      }
    });

    if (companyId) {
      userRoles.filter(ur => ur.user.companyId === companyId);
    }

    const adminMap = new Map<string, any>();

    for (const userRole of userRoles) {
      const userId = userRole.userId;
      if (!adminMap.has(userId)) {
        const scopes = await RBACService.getAdminScopes(userId);
        adminMap.set(userId, {
          id: userRole.user.id,
          email: userRole.user.email,
          fullName: userRole.user.fullName,
          roles: [userRole.role.name],
          scopes
        });
      } else {
        const admin = adminMap.get(userId);
        if (!admin.roles.includes(userRole.role.name)) {
          admin.roles.push(userRole.role.name);
        }
      }
    }

    return {
      success: true,
      admins: Array.from(adminMap.values())
    };
  } catch (error: any) {
    console.error('Failed to get admin users:', error);
    return {
      success: false,
      message: error.message || 'Failed to get admin users'
    };
  }
}

/**
 * Check if user has access to entity (for data filtering)
 */
export async function checkEntityAccess(
  userId: string,
  entityType: 'S' | 'M' | 'C' | 'D',
  entityId: string
): Promise<{ success: boolean; hasAccess: boolean; message?: string }> {
  try {
    const hasAccess = await RBACService.hasEntityAccess(userId, entityType, entityId);
    return {
      success: true,
      hasAccess
    };
  } catch (error: any) {
    console.error('Failed to check entity access:', error);
    return {
      success: false,
      hasAccess: false,
      message: error.message || 'Failed to check entity access'
    };
  }
}

/**
 * Create the 4 stockist level products (S, M, C, D)
 */
export async function createStockistLevelProducts(): Promise<{
  success: boolean;
  message: string;
  created?: number;
}> {
  try {
    const products = [
      {
        name: 'Small Mobile (S)',
        description: 'Small Mobile level product - $3,000',
        price: 3000,
        pv: 3000, // PV equals price
        qty: 100,
        category: 'Stockist Level',
        isActive: true,
        type: 'single' as const,
        unitType: 'package',
        imageUrl: ''
      },
      {
        name: 'Mobile (M)',
        description: 'Mobile level product - $15,000',
        price: 15000,
        pv: 15000, // PV equals price
        qty: 100,
        category: 'Stockist Level',
        isActive: true,
        type: 'single' as const,
        unitType: 'package',
        imageUrl: ''
      },
      {
        name: 'Center (C)',
        description: 'Center level product - $30,000',
        price: 30000,
        pv: 30000, // PV equals price
        qty: 100,
        category: 'Stockist Level',
        isActive: true,
        type: 'single' as const,
        unitType: 'package',
        imageUrl: ''
      },
      {
        name: 'Dealer (D)',
        description: 'Dealer level product - $150,000',
        price: 150000,
        pv: 150000, // PV equals price
        qty: 100,
        category: 'Stockist Level',
        isActive: true,
        type: 'single' as const,
        unitType: 'package',
        imageUrl: ''
      }
    ];

    let createdCount = 0;
    const errors: string[] = [];

    for (const productData of products) {
      try {
        // Check if product already exists
        const existing = await prisma.product.findFirst({
          where: { name: productData.name }
        });

        if (!existing) {
          await addProduct(productData);
          createdCount++;
        } else {
          console.log(`Product "${productData.name}" already exists, skipping`);
        }
      } catch (error: any) {
        errors.push(`Failed to create ${productData.name}: ${error.message}`);
        console.error(`Error creating product ${productData.name}:`, error);
      }
    }

    if (errors.length > 0) {
      return {
        success: createdCount > 0,
        message: `Created ${createdCount} product(s). Errors: ${errors.join('; ')}`,
        created: createdCount
      };
    }

    return {
      success: true,
      message: `Successfully created ${createdCount} stockist level product(s)`,
      created: createdCount
    };
  } catch (error: any) {
    console.error('Failed to create stockist level products:', error);
    return {
      success: false,
      message: error.message || 'Failed to create stockist level products'
    };
  }
}

/**
 * Create the Dealer (D) product if it doesn't exist
 */
export async function createDealerProduct(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Check if Dealer product already exists
    const existing = await prisma.product.findFirst({
      where: { name: 'Dealer (D)' }
    });

    if (existing) {
      return {
        success: true,
        message: 'Dealer (D) product already exists'
      };
    }

    // Create Dealer product
    const dealerProduct = {
      name: 'Dealer (D)',
      description: 'Dealer level product - $150,000',
      price: 150000,
      pv: 150000, // PV equals price
      qty: 100,
      category: 'Stockist Level',
      isActive: true,
      type: 'single' as const,
      unitType: 'package',
      imageUrl: ''
    };

    await addProduct(dealerProduct);

    return {
      success: true,
      message: 'Dealer (D) product created successfully'
    };
  } catch (error: any) {
    console.error('Failed to create Dealer product:', error);
    return {
      success: false,
      message: error.message || 'Failed to create Dealer product'
    };
  }
}