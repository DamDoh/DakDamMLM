/**
 * FINANCIAL SERVICE
 * 
 * Handles financial controls, holds, and adjustments
 * 
 * Features:
 * - Fund holds and releases
 * - Financial adjustments
 * - Approval workflows
 * - Audit trail
 * 
 * Created: 2025-10-19 (Audit Fix)
 */

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export interface FinancialControl {
  id: string;
  type: 'hold' | 'release' | 'adjustment' | 'freeze';
  amount: number;
  memberId: string;
  reason: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  companyId?: string;
  createdAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  metadata?: Record<string, any>;
}

export interface CreateFinancialControlData {
  type: 'hold' | 'release' | 'adjustment' | 'freeze';
  amount: number;
  memberId: string;
  reason: string;
  description?: string;
  companyId?: string;
  metadata?: Record<string, any>;
}

/**
 * Create a financial control
 */
export async function createFinancialControl(
  data: CreateFinancialControlData
): Promise<FinancialControl> {
  try {
    // Validate member exists
    const member = await prisma.user.findUnique({
      where: { id: data.memberId },
      select: { id: true, fullName: true }
    });

    if (!member) {
      throw new Error(`Member ${data.memberId} not found`);
    }

    // Create financial control
    const control = await prisma.financialControl.create({
      data: {
        type: data.type,
        amount: data.amount,
        memberId: data.memberId,
        reason: data.reason,
        description: data.description,
        companyId: data.companyId,
        status: 'pending',
        metadata: data.metadata as any
      }
    });

    logger.info('Financial control created', {
      controlId: control.id,
      type: data.type,
      amount: data.amount,
      memberId: data.memberId
    });

    // TODO: Trigger admin notification for approval
    // await triggerFinancialControlNotification(control);

    return control as FinancialControl;
  } catch (error) {
    logger.error('Failed to create financial control', {
      error: error instanceof Error ? error.message : 'Unknown error',
      data
    });
    throw error;
  }
}

/**
 * Get pending financial controls
 */
export async function getPendingFinancialControls(companyId?: string): Promise<FinancialControl[]> {
  try {
    const where: any = { status: 'pending' };
    
    if (companyId) {
      where.companyId = companyId;
    }

    const controls = await prisma.financialControl.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return controls as FinancialControl[];
  } catch (error) {
    // Check if this is a Prisma browser error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isPrismaBrowserError = errorMessage.includes('PrismaClient is unable to run in this browser environment');
    
    if (isPrismaBrowserError) {
      logger.error('Failed to get pending financial controls', {
        error: 'Not found'
      });
    } else {
      logger.error('Failed to get pending financial controls', {
        error: errorMessage,
        companyId
      });
    }
    return [];
  }
}

/**
 * Approve a financial control
 */
export async function approveFinancialControl(
  controlId: string,
  approverId: string
): Promise<FinancialControl> {
  try {
    const control = await prisma.financialControl.update({
      where: { id: controlId },
      data: {
        status: 'approved',
        approvedBy: approverId,
        approvedAt: new Date()
      }
    });

    logger.info('Financial control approved', {
      controlId,
      approverId,
      type: control.type,
      amount: control.amount
    });

    // TODO: Execute the financial action based on type
    // - hold: Mark funds as held
    // - release: Release held funds
    // - adjustment: Adjust balance
    // - freeze: Freeze account

    // TODO: Trigger member notification
    // await triggerFinancialControlApprovalNotification(control);

    return control as FinancialControl;
  } catch (error) {
    logger.error('Failed to approve financial control', {
      error: error instanceof Error ? error.message : 'Unknown error',
      controlId
    });
    throw error;
  }
}

/**
 * Reject a financial control
 */
export async function rejectFinancialControl(
  controlId: string,
  rejecterId: string,
  rejectionReason: string
): Promise<FinancialControl> {
  try {
    const control = await prisma.financialControl.update({
      where: { id: controlId },
      data: {
        status: 'rejected',
        rejectedBy: rejecterId,
        rejectedAt: new Date(),
        description: rejectionReason
      }
    });

    logger.info('Financial control rejected', {
      controlId,
      rejecterId,
      reason: rejectionReason
    });

    // TODO: Trigger member notification
    // await triggerFinancialControlRejectionNotification(control);

    return control as FinancialControl;
  } catch (error) {
    logger.error('Failed to reject financial control', {
      error: error instanceof Error ? error.message : 'Unknown error',
      controlId
    });
    throw error;
  }
}

/**
 * Get financial control history for a member
 */
export async function getFinancialControlHistory(
  memberId: string,
  limit: number = 50
): Promise<FinancialControl[]> {
  try {
    const controls = await prisma.financialControl.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return controls as FinancialControl[];
  } catch (error) {
    logger.error('Failed to get financial control history', {
      error: error instanceof Error ? error.message : 'Unknown error',
      memberId
    });
    return [];
  }
}

/**
 * Hold member funds
 */
export async function holdMemberFunds(
  memberId: string,
  amount: number,
  reason: string,
  companyId?: string
): Promise<{ success: boolean; controlId?: string }> {
  try {
    const control = await createFinancialControl({
      type: 'hold',
      amount,
      memberId,
      reason,
      companyId
    });

    return {
      success: true,
      controlId: control.id
    };
  } catch (error) {
    logger.error('Failed to hold member funds', {
      error: error instanceof Error ? error.message : 'Unknown error',
      memberId,
      amount
    });
    return { success: false };
  }
}

/**
 * Release member funds
 */
export async function releaseMemberFunds(
  memberId: string,
  amount: number,
  reason: string,
  companyId?: string
): Promise<{ success: boolean; controlId?: string }> {
  try {
    const control = await createFinancialControl({
      type: 'release',
      amount,
      memberId,
      reason,
      companyId
    });

    return {
      success: true,
      controlId: control.id
    };
  } catch (error) {
    logger.error('Failed to release member funds', {
      error: error instanceof Error ? error.message : 'Unknown error',
      memberId,
      amount
    });
    return { success: false };
  }
}

/**
 * Get financial statistics
 */
export async function getFinancialStatistics(companyId?: string): Promise<{
  totalControls: number;
  pending: number;
  approved: number;
  rejected: number;
  totalHeldAmount: number;
  totalReleasedAmount: number;
}> {
  try {
    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }

    const [total, pending, approved, rejected, heldAgg, releasedAgg] = await Promise.all([
      prisma.financialControl.count({ where }),
      prisma.financialControl.count({ where: { ...where, status: 'pending' } }),
      prisma.financialControl.count({ where: { ...where, status: 'approved' } }),
      prisma.financialControl.count({ where: { ...where, status: 'rejected' } }),
      prisma.financialControl.aggregate({
        where: { ...where, type: 'hold', status: 'approved' },
        _sum: { amount: true }
      }),
      prisma.financialControl.aggregate({
        where: { ...where, type: 'release', status: 'approved' },
        _sum: { amount: true }
      })
    ]);

    return {
      totalControls: total,
      pending,
      approved,
      rejected,
      totalHeldAmount: heldAgg._sum.amount || 0,
      totalReleasedAmount: releasedAgg._sum.amount || 0
    };
  } catch (error) {
    logger.error('Failed to get financial statistics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      companyId
    });
    return {
      totalControls: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      totalHeldAmount: 0,
      totalReleasedAmount: 0
    };
  }
}