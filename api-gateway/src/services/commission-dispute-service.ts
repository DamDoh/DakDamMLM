/**
 * MEDIUM PRIORITY FIX #15: Commission Dispute Workflow
 * 
 * Provides a complete workflow for handling commission disputes.
 * Ensures disputes are tracked, investigated, and resolved properly.
 */

import { prisma } from '@/lib/prisma';
import { EnhancedAuditService } from './enhanced-audit-service';

export type DisputeStatus = 'pending' | 'investigating' | 'resolved' | 'rejected';
export type DisputeResolution = 'approved' | 'denied' | 'partial' | 'escalated';

export interface DisputeWorkflowStep {
  status: DisputeStatus;
  assignedTo?: string;
  notes?: string;
  timestamp: Date;
}

export interface DisputeDetails {
  id: string;
  userId: string;
  commissionId: string;
  status: DisputeStatus;
  reason: string;
  requestedAmount: number;
  originalAmount: number;
  evidenceUrls?: string[];
  workflowHistory: DisputeWorkflowStep[];
  resolution?: {
    type: DisputeResolution;
    approvedAmount?: number;
    resolvedBy: string;
    resolvedAt: Date;
    notes: string;
  };
}

export class CommissionDisputeService {
  /**
   * Create a new commission dispute
   */
  static async createDispute(
    userId: string,
    commissionId: string,
    reason: string,
    requestedAmount: number,
    evidenceUrls?: string[]
  ): Promise<DisputeDetails> {
    // Get user to find memberId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, memberId: true }
    });

    if (!user || !user.memberId) {
      throw new Error('User or memberId not found');
    }

    // Validate commission exists
    const commission = await prisma.commission.findUnique({
      where: { id: commissionId },
      select: { 
        userId: true, 
        amount: true,
        status: true 
      }
    });

    if (!commission) {
      throw new Error('Commission not found');
    }

    if (commission.userId !== userId) {
      throw new Error('You can only dispute your own commissions');
    }

    // Check if dispute already exists
    const existingDispute = await prisma.commissionDispute.findFirst({
      where: {
        commissionId,
        status: { in: ['pending', 'investigating'] }
      }
    });

    if (existingDispute) {
      throw new Error('An active dispute already exists for this commission');
    }

    // Store additional data in description as JSON
    const description = JSON.stringify({
      requestedAmount,
      originalAmount: commission.amount,
      evidenceUrls: evidenceUrls || []
    });

    // Create dispute
    const dispute = await prisma.commissionDispute.create({
      data: {
        memberId: user.memberId,
        commissionId,
        status: 'pending',
        reason,
        amount: requestedAmount,
        description
      }
    });

    // Log dispute creation
    await EnhancedAuditService.log({
      userId,
      action: 'commission_adjusted',
      entity: 'commission_dispute',
      entityId: dispute.id,
      changes: {
        reason,
        requestedAmount,
        originalAmount: commission.amount,
        evidenceCount: evidenceUrls?.length || 0
      },
      ipAddress: 'user',
      userAgent: 'dispute-service'
    });

    return {
      id: dispute.id,
      userId,
      commissionId,
      status: 'pending',
      reason,
      requestedAmount,
      originalAmount: commission.amount,
      evidenceUrls,
      workflowHistory: [
        {
          status: 'pending',
          timestamp: new Date()
        }
      ]
    };
  }

  /**
   * Assign dispute to an investigator
   */
  static async assignDispute(
    disputeId: string,
    assignedTo: string,
    assignedBy: string
  ): Promise<void> {
    const dispute = await prisma.commissionDispute.findUnique({
      where: { id: disputeId }
    });

    if (!dispute) {
      throw new Error('Dispute not found');
    }

    if (dispute.status !== 'pending') {
      throw new Error('Can only assign pending disputes');
    }

    // Get user to get userId from memberId
    const user = await prisma.user.findFirst({
      where: { memberId: dispute.memberId },
      select: { id: true }
    });

    // Update dispute status - store assignedTo in description
    const descriptionData = dispute.description ? JSON.parse(dispute.description) : {};
    descriptionData.assignedTo = assignedTo;
    
    await prisma.commissionDispute.update({
      where: { id: disputeId },
      data: {
        status: 'investigating',
        description: JSON.stringify(descriptionData)
      }
    });

    // Log assignment
    await EnhancedAuditService.log({
      userId: user?.id || dispute.memberId,
      action: 'commission_adjusted',
      entity: 'commission_dispute',
      entityId: disputeId,
      changes: {
        action: 'assigned',
        assignedTo,
        assignedBy,
        previousStatus: 'pending',
        newStatus: 'investigating'
      },
      ipAddress: 'admin',
      userAgent: 'dispute-service'
    });

    console.log(`Dispute ${disputeId} assigned to ${assignedTo} by ${assignedBy}`);
  }

  /**
   * Add notes to dispute investigation
   */
  static async addInvestigationNotes(
    disputeId: string,
    notes: string,
    addedBy: string
  ): Promise<void> {
    const dispute = await prisma.commissionDispute.findUnique({
      where: { id: disputeId }
    });

    if (!dispute) {
      throw new Error('Dispute not found');
    }

    // Add notes to dispute - store in description
    const descriptionData = dispute.description ? JSON.parse(dispute.description) : {};
    if (!descriptionData.investigationNotes) {
      descriptionData.investigationNotes = [];
    }
    descriptionData.investigationNotes.push({
      addedBy,
      notes,
      timestamp: new Date().toISOString()
    });

    await prisma.commissionDispute.update({
      where: { id: disputeId },
      data: {
        description: JSON.stringify(descriptionData)
      }
    });

    console.log(`Investigation notes added to dispute ${disputeId} by ${addedBy}`);
  }

  /**
   * Resolve dispute - Approve
   */
  static async resolveDispute(
    disputeId: string,
    resolutionType: DisputeResolution,
    approvedAmount: number,
    resolvedBy: string,
    resolutionNotes: string
  ): Promise<DisputeDetails> {
    const dispute = await prisma.commissionDispute.findUnique({
      where: { id: disputeId }
    });

    if (!dispute) {
      throw new Error('Dispute not found');
    }

    // Get user and commission
    const user = await prisma.user.findFirst({
      where: { memberId: dispute.memberId },
      select: { id: true }
    });

    const commission = await prisma.commission.findUnique({
      where: { id: dispute.commissionId },
      select: { status: true, amount: true }
    });

    if (!commission) {
      throw new Error('Commission not found');
    }

    // Parse original amount from description
    const descriptionData = dispute.description ? JSON.parse(dispute.description) : {};
    const originalAmount = descriptionData.originalAmount || commission.amount;

    if (dispute.status === 'resolved' || dispute.status === 'rejected') {
      throw new Error('Dispute has already been resolved');
    }

    // Update dispute in transaction
    await prisma.$transaction(async (tx) => {
      // Update dispute
      const newStatus = resolutionType === 'denied' ? 'rejected' : 'resolved';
      
      const updatedDescription = {
        ...descriptionData,
        resolution: {
          type: resolutionType,
          approvedAmount,
          resolvedBy,
          resolvedAt: new Date().toISOString(),
          notes: resolutionNotes
        }
      };

      await tx.commissionDispute.update({
        where: { id: disputeId },
        data: {
          status: newStatus,
          resolvedBy,
          resolvedAt: new Date(),
          resolution: JSON.stringify({
            type: resolutionType,
            approvedAmount,
            resolvedBy,
            resolvedAt: new Date().toISOString(),
            notes: resolutionNotes
          }),
          description: JSON.stringify(updatedDescription)
        }
      });

      // If approved or partial, adjust commission
      if (resolutionType === 'approved' || resolutionType === 'partial') {
        if (approvedAmount !== originalAmount) {
          // Update commission amount
          await tx.commission.update({
            where: { id: dispute.commissionId },
            data: {
              amount: approvedAmount
            }
          });

          // If already paid, credit/debit the difference
          if (commission.status === 'paid') {
            const difference = approvedAmount - originalAmount;
            
            if (difference > 0 && user) {
              // Get wallet for user
              const wallet = await tx.wallet.findFirst({
                where: { userId: user.id }
              });

              if (wallet) {
                // Credit user wallet
                await tx.wallet.update({
                  where: { id: wallet.id },
                  data: {
                    balance: { increment: difference }
                  }
                });

                // Log transaction
                await tx.walletTransaction.create({
                  data: {
                    walletId: wallet.id,
                    type: 'credit',
                    amount: difference,
                    balanceBefore: wallet.balance,
                    balanceAfter: wallet.balance + difference,
                    description: `Commission dispute resolved - Additional payment`,
                    referenceId: disputeId,
                    status: 'completed'
                  }
                });
              }
            } else if (difference < 0 && user) {
              // Debit user wallet (clawback)
              const wallet = await tx.wallet.findFirst({
                where: { userId: user.id }
              });

              if (wallet) {
                await tx.wallet.update({
                  where: { id: wallet.id },
                  data: {
                    balance: { decrement: Math.abs(difference) }
                  }
                });

                // Log transaction
                await tx.walletTransaction.create({
                  data: {
                    walletId: wallet.id,
                    type: 'debit',
                    amount: Math.abs(difference),
                    balanceBefore: wallet.balance,
                    balanceAfter: wallet.balance - Math.abs(difference),
                    description: `Commission dispute resolved - Clawback`,
                    referenceId: disputeId,
                    status: 'completed'
                  }
                });
              }
            }
          }
        }
      }

      // Log resolution
      await EnhancedAuditService.log({
        userId: user?.id || dispute.memberId,
        action: 'commission_adjusted',
        entity: 'commission_dispute',
        entityId: disputeId,
        changes: {
          action: 'resolved',
          resolutionType,
          approvedAmount,
          originalAmount: originalAmount,
          difference: approvedAmount - originalAmount,
          resolvedBy,
          notes: resolutionNotes
        },
        previousState: { status: dispute.status },
        newState: { status: newStatus },
        ipAddress: 'admin',
        userAgent: 'dispute-service'
      });
    });

    console.log(`Dispute ${disputeId} resolved as ${resolutionType} by ${resolvedBy}`);

    return await this.getDisputeDetails(disputeId);
  }

  /**
   * Reject dispute
   */
  static async rejectDispute(
    disputeId: string,
    rejectedBy: string,
    rejectionReason: string
  ): Promise<void> {
    await this.resolveDispute(
      disputeId,
      'denied',
      0, // No approved amount
      rejectedBy,
      rejectionReason
    );
  }

  /**
   * Escalate dispute to higher authority
   */
  static async escalateDispute(
    disputeId: string,
    escalatedBy: string,
    escalationReason: string,
    escalatedTo?: string
  ): Promise<void> {
    const dispute = await prisma.commissionDispute.findUnique({
      where: { id: disputeId }
    });

    if (!dispute) {
      throw new Error('Dispute not found');
    }

    // Store escalation info in description
    const descriptionData = dispute.description ? JSON.parse(dispute.description) : {};
    descriptionData.escalated = true;
    descriptionData.escalatedBy = escalatedBy;
    descriptionData.escalationReason = escalationReason;
    if (escalatedTo) {
      descriptionData.escalatedTo = escalatedTo;
    }

    await prisma.commissionDispute.update({
      where: { id: disputeId },
      data: {
        status: 'investigating',
        description: JSON.stringify(descriptionData)
      }
    });

    // Get user
    const user = await prisma.user.findFirst({
      where: { memberId: dispute.memberId },
      select: { id: true }
    });

    // Log escalation
    await EnhancedAuditService.log({
      userId: user?.id || dispute.memberId,
      action: 'commission_adjusted',
      entity: 'commission_dispute',
      entityId: disputeId,
      changes: {
        action: 'escalated',
        escalatedBy,
        escalatedTo,
        reason: escalationReason
      },
      ipAddress: 'admin',
      userAgent: 'dispute-service'
    });

    console.log(`Dispute ${disputeId} escalated by ${escalatedBy}`);
  }

  /**
   * Get dispute details
   */
  static async getDisputeDetails(disputeId: string): Promise<DisputeDetails> {
    const dispute = await prisma.commissionDispute.findUnique({
      where: { id: disputeId }
    });

    if (!dispute) {
      throw new Error('Dispute not found');
    }

    // Get user from memberId
    const user = await prisma.user.findFirst({
      where: { memberId: dispute.memberId },
      select: { id: true }
    });

    // Parse description to get extra fields
    const descriptionData = dispute.description ? JSON.parse(dispute.description) : {};
    const requestedAmount = descriptionData.requestedAmount || dispute.amount;
    const originalAmount = descriptionData.originalAmount || dispute.amount;
    const evidenceUrls = descriptionData.evidenceUrls || [];
    const resolution = dispute.resolution ? JSON.parse(dispute.resolution) : undefined;

    return {
      id: dispute.id,
      userId: user?.id || dispute.memberId,
      commissionId: dispute.commissionId,
      status: dispute.status as DisputeStatus,
      reason: dispute.reason,
      requestedAmount,
      originalAmount,
      evidenceUrls,
      workflowHistory: [], // TODO: Build from audit logs
      resolution
    };
  }

  /**
   * Get all pending disputes
   */
  static async getPendingDisputes(
    companyId?: string
  ): Promise<DisputeDetails[]> {
    const disputes = await prisma.commissionDispute.findMany({
      where: {
        status: { in: ['pending', 'investigating'] },
        ...(companyId && { companyId })
      },
      orderBy: { createdAt: 'asc' }
    });

    // Get users for each dispute
    const disputesWithUsers = await Promise.all(disputes.map(async (d) => {
      const user = await prisma.user.findFirst({
        where: { memberId: d.memberId },
        select: { id: true }
      });
      const descriptionData = d.description ? JSON.parse(d.description) : {};
      return {
        ...d,
        userId: user?.id || d.memberId,
        requestedAmount: descriptionData.requestedAmount || d.amount,
        originalAmount: descriptionData.originalAmount || d.amount,
        evidenceUrls: descriptionData.evidenceUrls || [],
        resolution: d.resolution ? JSON.parse(d.resolution) : undefined
      };
    }));

    return disputesWithUsers.map(d => ({
      id: d.id,
      userId: d.userId,
      commissionId: d.commissionId,
      status: d.status as DisputeStatus,
      reason: d.reason,
      requestedAmount: d.requestedAmount,
      originalAmount: d.originalAmount,
      evidenceUrls: d.evidenceUrls,
      workflowHistory: [],
      resolution: d.resolution
    }));
  }

  /**
   * Get disputes assigned to investigator
   */
  static async getAssignedDisputes(
    investigatorId: string
  ): Promise<DisputeDetails[]> {
    const disputes = await prisma.commissionDispute.findMany({
      where: {
        status: 'investigating'
      },
      orderBy: { createdAt: 'asc' }
    });

    // Filter by investigatorId using description JSON
    const filtered = await Promise.all(disputes.map(async (d) => {
      const descriptionData = d.description ? JSON.parse(d.description) : {};
      if (descriptionData.assignedTo !== investigatorId) {
        return null;
      }

      const user = await prisma.user.findFirst({
        where: { memberId: d.memberId },
        select: { id: true }
      });

      return {
        dispute: d,
        userId: user?.id || d.memberId,
        requestedAmount: descriptionData.requestedAmount || d.amount,
        originalAmount: descriptionData.originalAmount || d.amount,
        evidenceUrls: descriptionData.evidenceUrls || [],
        resolution: d.resolution ? JSON.parse(d.resolution) : undefined
      };
    }));

    return filtered
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .map(item => ({
        id: item.dispute.id,
        userId: item.userId,
        commissionId: item.dispute.commissionId,
        status: item.dispute.status as DisputeStatus,
        reason: item.dispute.reason,
        requestedAmount: item.requestedAmount,
        originalAmount: item.originalAmount,
        evidenceUrls: item.evidenceUrls,
        workflowHistory: [],
        resolution: item.resolution
      }));
  }

  /**
   * Get user's dispute history
   */
  static async getUserDisputes(
    userId: string,
    limit: number = 20
  ): Promise<DisputeDetails[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { memberId: true }
    });

    if (!user || !user.memberId) {
      return [];
    }

    const disputes = await prisma.commissionDispute.findMany({
      where: { memberId: user.memberId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return disputes.map(d => {
      const descriptionData = d.description ? JSON.parse(d.description) : {};
      const requestedAmount = descriptionData.requestedAmount || d.amount;
      const originalAmount = descriptionData.originalAmount || d.amount;
      const evidenceUrls = descriptionData.evidenceUrls || [];
      const resolution = d.resolution ? JSON.parse(d.resolution) : undefined;

      return {
        id: d.id,
        userId,
        commissionId: d.commissionId,
        status: d.status as DisputeStatus,
        reason: d.reason,
        requestedAmount,
        originalAmount,
        evidenceUrls,
        workflowHistory: [],
        resolution
      };
    });
  }

  /**
   * Get dispute statistics
   */
  static async getDisputeStatistics(
    companyId?: string
  ): Promise<{
    total: number;
    pending: number;
    investigating: number;
    resolved: number;
    rejected: number;
    averageResolutionTime: number; // in hours
    approvalRate: number; // percentage
  }> {
    const where = companyId ? { companyId } : {};

    const [total, byStatusRaw, resolved] = await Promise.all([
      prisma.commissionDispute.count({ where }),
      prisma.commissionDispute.groupBy({
        by: ['status'],
        where,
        _count: { status: true }
      }),
      prisma.commissionDispute.findMany({
        where: {
          ...where,
          status: { in: ['resolved', 'rejected'] },
          resolvedAt: { not: null }
        },
        select: {
          createdAt: true,
          resolvedAt: true,
          resolution: true
        }
      })
    ]);

    type StatusStats = {
      pending: number;
      investigating: number;
      resolved: number;
      rejected: number;
    };

    const stats: StatusStats = {
      pending: 0,
      investigating: 0,
      resolved: 0,
      rejected: 0
    };

    const byStatus = byStatusRaw as Array<{ status: keyof StatusStats; _count: { status: number } }>;

    for (const item of byStatus) {
      stats[item.status] = item._count.status;
    }

    // Calculate average resolution time
    const resolutionTimes = resolved
      .filter(d => d.resolvedAt)
      .map(d => {
        const created = new Date(d.createdAt).getTime();
        const resolvedTime = new Date(d.resolvedAt!).getTime();
        return (resolvedTime - created) / (1000 * 60 * 60); // hours
      });

    const averageResolutionTime = resolutionTimes.length > 0
      ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length
      : 0;

    // Calculate approval rate
    const approvedCount = resolved.filter(d => {
      const res = d.resolution as any;
      return res?.type === 'approved' || res?.type === 'partial';
    }).length;

    const approvalRate = resolved.length > 0
      ? (approvedCount / resolved.length) * 100
      : 0;

    return {
      total,
      ...stats,
      averageResolutionTime,
      approvalRate
    };
  }
}
