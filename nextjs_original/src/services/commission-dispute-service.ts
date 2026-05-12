/**
 * COMMISSION DISPUTE SERVICE
 * 
 * Handles commission disputes and resolutions
 * Replaces the temporary notification table workaround
 * 
 * Created: 2025-10-19 (Audit Fix)
 */

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export interface CommissionDispute {
  id: string;
  commissionId: string;
  memberId: string;
  amount: number;
  reason: string;
  description?: string;
  status: 'pending' | 'resolved' | 'rejected';
  resolution?: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  companyId?: string;
}

export interface CreateDisputeData {
  commissionId: string;
  memberId: string;
  amount?: number;
  reason: string;
  description?: string;
  companyId?: string;
}

export interface ResolveDisputeData {
  disputeId: string;
  resolution: string;
  resolvedBy: string;
}

/**
 * Create a new commission dispute
 */
export async function createCommissionDispute(data: CreateDisputeData): Promise<CommissionDispute> {
  try {
    // Validate commission exists
    const commission = await prisma.commission.findUnique({
      where: { id: data.commissionId }
    });

    if (!commission) {
      throw new Error(`Commission ${data.commissionId} not found`);
    }

    // Create dispute
    const dispute = await prisma.commissionDispute.create({
      data: {
        commissionId: data.commissionId,
        memberId: data.memberId,
        amount: data.amount || commission.amount,
        reason: data.reason,
        description: data.description,
        status: 'pending',
        companyId: data.companyId || commission.companyId
      }
    });

    logger.info(`Commission dispute created`, {
      disputeId: dispute.id,
      commissionId: data.commissionId,
      memberId: data.memberId
    });

    // TODO: Trigger admin notification
    // await triggerDisputeNotification(dispute);

    return dispute as CommissionDispute;
  } catch (error) {
    logger.error('Failed to create commission dispute', {
      error: error instanceof Error ? error.message : 'Unknown error',
      data
    });
    throw error;
  }
}

/**
 * Resolve a commission dispute
 */
export async function resolveCommissionDispute(data: ResolveDisputeData): Promise<CommissionDispute> {
  try {
    const dispute = await prisma.commissionDispute.update({
      where: { id: data.disputeId },
      data: {
        status: 'resolved',
        resolution: data.resolution,
        resolvedBy: data.resolvedBy,
        resolvedAt: new Date()
      }
    });

    logger.info(`Commission dispute resolved`, {
      disputeId: data.disputeId,
      resolvedBy: data.resolvedBy
    });

    // TODO: Trigger member notification
    // await triggerDisputeResolutionNotification(dispute);

    return dispute as CommissionDispute;
  } catch (error) {
    logger.error('Failed to resolve commission dispute', {
      error: error instanceof Error ? error.message : 'Unknown error',
      disputeId: data.disputeId
    });
    throw error;
  }
}

/**
 * Reject a commission dispute
 */
export async function rejectCommissionDispute(
  disputeId: string,
  reason: string,
  rejectedBy: string
): Promise<CommissionDispute> {
  try {
    const dispute = await prisma.commissionDispute.update({
      where: { id: disputeId },
      data: {
        status: 'rejected',
        resolution: reason,
        resolvedBy: rejectedBy,
        resolvedAt: new Date()
      }
    });

    logger.info(`Commission dispute rejected`, {
      disputeId,
      rejectedBy
    });

    // TODO: Trigger member notification
    // await triggerDisputeRejectionNotification(dispute);

    return dispute as CommissionDispute;
  } catch (error) {
    logger.error('Failed to reject commission dispute', {
      error: error instanceof Error ? error.message : 'Unknown error',
      disputeId
    });
    throw error;
  }
}

/**
 * Get commission disputes
 */
export async function getCommissionDisputes(
  memberId?: string,
  companyId?: string,
  status?: 'pending' | 'resolved' | 'rejected'
): Promise<CommissionDispute[]> {
  try {
    const where: any = {};

    if (memberId) {
      where.memberId = memberId;
    }

    if (companyId) {
      where.companyId = companyId;
    }

    if (status) {
      where.status = status;
    }

    const disputes = await prisma.commissionDispute.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return disputes as CommissionDispute[];
  } catch (error) {
    logger.error('Failed to get commission disputes', {
      error: error instanceof Error ? error.message : 'Unknown error',
      memberId,
      companyId,
      status
    });
    return [];
  }
}

/**
 * Get a specific dispute by ID
 */
export async function getDisputeById(disputeId: string): Promise<CommissionDispute | null> {
  try {
    const dispute = await prisma.commissionDispute.findUnique({
      where: { id: disputeId }
    });

    return dispute as CommissionDispute | null;
  } catch (error) {
    logger.error('Failed to get dispute by ID', {
      error: error instanceof Error ? error.message : 'Unknown error',
      disputeId
    });
    return null;
  }
}

/**
 * Get dispute statistics
 */
export async function getDisputeStatistics(companyId?: string): Promise<{
  total: number;
  pending: number;
  resolved: number;
  rejected: number;
  totalAmount: number;
}> {
  try {
    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }

    const [total, pending, resolved, rejected, amountAgg] = await Promise.all([
      prisma.commissionDispute.count({ where }),
      prisma.commissionDispute.count({ where: { ...where, status: 'pending' } }),
      prisma.commissionDispute.count({ where: { ...where, status: 'resolved' } }),
      prisma.commissionDispute.count({ where: { ...where, status: 'rejected' } }),
      prisma.commissionDispute.aggregate({
        where,
        _sum: { amount: true }
      })
    ]);

    return {
      total,
      pending,
      resolved,
      rejected,
      totalAmount: amountAgg._sum.amount || 0
    };
  } catch (error) {
    logger.error('Failed to get dispute statistics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      companyId
    });
    return {
      total: 0,
      pending: 0,
      resolved: 0,
      rejected: 0,
      totalAmount: 0
    };
  }
}