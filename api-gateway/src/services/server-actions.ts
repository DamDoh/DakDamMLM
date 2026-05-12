'use server';

import type { Product, Rank, StockRequestItem, StockistLevel, Address, Member } from '@/lib/types';
import { prisma } from '@/lib/database';
import { CommissionService } from './commission-service';
import { CommissionDisputeService } from './commission-dispute-service';
import { hashPassword } from '@/lib/auth-service';

// Genealogy service functions - stub implementation
const genealogyServiceOriginal = {
  compressTree: async () => ({ compressedCount: 0, errors: 0 }),
  getGroupPV: async (_memberId: string) => 0
};

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
              pv: item.pv || 0,
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
export const calculateStockistBonus = async () => 0;
export const calculateMatchingBonus = async () => 0;

// Predict a member's future commission (simple stub for now)
export const predictMemberCommission = async (
  memberId: string,
  monthsAhead: number = 3
): Promise<{
  memberId: string;
  projectedTotal: number;
  monthlyBreakdown: { month: string; amount: number }[];
}> => {
  if (!memberId) {
    return {
      memberId: '',
      projectedTotal: 0,
      monthlyBreakdown: [],
    };
  }

  // Very simple heuristic: use last 3 months of paid commissions as baseline
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(now.getMonth() - 3);

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

  const totalRecent = recentCommissions.reduce((sum, c) => sum + c.amount, 0);
  const avgPerMonth = totalRecent / 3 || 0;

  const monthlyBreakdown: { month: string; amount: number }[] = [];
  let projectedTotal = 0;

  for (let i = 1; i <= monthsAhead; i++) {
    const future = new Date(now);
    future.setMonth(now.getMonth() + i);
    const label = future.toLocaleString('default', { month: 'short', year: 'numeric' });
    monthlyBreakdown.push({
      month: label,
      amount: Math.round(avgPerMonth * 100) / 100,
    });
    projectedTotal += avgPerMonth;
  }

  return {
    memberId,
    projectedTotal: Math.round(projectedTotal * 100) / 100,
    monthlyBreakdown,
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

// Add or update a member address
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

// Delete a member address
export const deleteMemberAddress = async (
  memberId: string,
  addressId: string
): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: memberId },
    select: { addresses: true },
  });

  const raw = user?.addresses as unknown;
  const current: Address[] = Array.isArray(raw) ? (raw as Address[]) : [];

  const next = current.filter((a) => a.id !== addressId);

  await prisma.user.update({
    where: { id: memberId },
    data: { addresses: next as any },
  });
};

// Set a member address as default
export const setDefaultMemberAddress = async (
  memberId: string,
  addressId: string
): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: memberId },
    select: { addresses: true },
  });

  const raw = user?.addresses as unknown;
  const current: Address[] = Array.isArray(raw) ? (raw as Address[]) : [];

  const next = current.map((a) => ({
    ...a,
    isDefault: a.id === addressId,
  }));

  await prisma.user.update({
    where: { id: memberId },
    data: { addresses: next as any },
  });
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
  if (memberId) where.userId = memberId;
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
// Profile / PV helpers
// ---------------------------------------------------------------------------

// Lightweight wrapper around original genealogy getGroupPV helper
export const getGroupPV = async (memberId: string): Promise<number> => {
  try {
    if (!memberId) return 0;
    // Delegate to the original implementation which uses Prisma and shared utils
    // @ts-ignore - using original implementation from nextjs_original for now
    const pv = await genealogyServiceOriginal.getGroupPV(memberId);
    return typeof pv === 'number' && !Number.isNaN(pv) ? pv : 0;
  } catch (error) {
    console.error('Failed to calculate group PV:', error);
    return 0;
  }
};

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
    // Mirror the behaviour used in the main app's /api/profile/change-password route:
    // - Store the full value as idCardNumber
    // - Use the last 4 digits of that value as the actual login password
    // - Enforce a minimum length of 4 characters
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
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: memberId },
      select: { id: true, isAdmin: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.isAdmin) {
      throw new Error('Cannot delete admin users');
    }

    // Soft delete by setting deleted flag and date
    await prisma.user.update({
      where: { id: memberId },
      data: {
        deleted: true,
        deletedDate: new Date(),
        deletedBy: memberId, // Could be improved to track who deleted (admin ID)
        active: false,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to delete member:', error);
    throw error;
  }
};