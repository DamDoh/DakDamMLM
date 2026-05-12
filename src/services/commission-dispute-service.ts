/**
 * MEDIUM PRIORITY FIX #15: Commission Dispute Workflow
 * 
 * Provides a complete workflow for handling commission disputes.
 * Ensures disputes are tracked, investigated, and resolved properly.
 */

import { prisma } from '@/lib/database';
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

    // Create dispute
    const dispute = await prisma.commissionDispute.create({
      data: {
        memberId: userId,
        commissionId,
        status: 'pending',
        reason,
        amount: requestedAmount,
        description: evidenceUrls ? JSON.stringify(evidenceUrls) : null
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
      status: 'pending' as DisputeStatus,
      reason,
      requestedAmount,
      originalAmount: commission.amount,
      evidenceUrls: evidenceUrls || [],
      workflowHistory: [
        {
          status: 'pending' as DisputeStatus,
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

    // Update dispute status
    await prisma.commissionDispute.update({
      where: { id: disputeId },
      data: {
        status: 'investigating'
      }
    });

    // Log assignment
    await EnhancedAuditService.log({
      userId: dispute.memberId,
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

    // Add notes to dispute description
    const existingNotes = dispute.description || '';
    const newNote = `[${new Date().toISOString()}] ${addedBy}: ${notes}`;
    const updatedDescription = existingNotes 
      ? `${existingNotes}\n${newNote}`
      : newNote;

    await prisma.commissionDispute.update({
      where: { id: disputeId },
      data: {
        description: updatedDescription
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

    const commission = await prisma.commission.findUnique({
      where: { id: dispute.commissionId }
    });

    if (!commission) {
      throw new Error('Commission not found');
    }

    if (dispute.status === 'resolved' || dispute.status === 'rejected') {
      throw new Error('Dispute has already been resolved');
    }

    // Update dispute in transaction
    await prisma.$transaction(async (tx) => {
      // Update dispute
      const newStatus = resolutionType === 'denied' ? 'rejected' : 'resolved';
      const resolutionData = JSON.stringify({
        type: resolutionType,
        approvedAmount,
        resolvedBy,
        resolvedAt: new Date().toISOString(),
        notes: resolutionNotes
      });
      
      await tx.commissionDispute.update({
        where: { id: disputeId },
        data: {
          status: newStatus,
          resolvedBy,
          resolvedAt: new Date(),
          resolution: resolutionData
        }
      });

      // If approved or partial, adjust commission
      if (resolutionType === 'approved' || resolutionType === 'partial') {
        if (approvedAmount !== commission.amount) {
          // Update commission amount
          await tx.commission.update({
            where: { id: dispute.commissionId },
            data: {
              amount: approvedAmount
            }
          });

          // If already paid, credit/debit the difference
          if (commission.status === 'paid') {
            const difference = approvedAmount - commission.amount;
            
            // Get wallet for user
            const wallet = await tx.wallet.findUnique({
              where: { userId: dispute.memberId }
            });

            if (wallet) {
              if (difference > 0) {
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
              } else if (difference < 0) {
                // Debit user wallet (clawback)
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
        userId: dispute.memberId,
        action: 'commission_adjusted',
        entity: 'commission_dispute',
        entityId: disputeId,
        changes: {
          action: 'resolved',
          resolutionType,
          approvedAmount,
          originalAmount: commission.amount,
          difference: approvedAmount - commission.amount,
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
    const escalationNote = `[ESCALATED ${new Date().toISOString()}] By: ${escalatedBy}${escalatedTo ? `, To: ${escalatedTo}` : ''}\nReason: ${escalationReason}`;
    const updatedDescription = dispute.description 
      ? `${dispute.description}\n${escalationNote}`
      : escalationNote;

    await prisma.commissionDispute.update({
      where: { id: disputeId },
      data: {
        description: updatedDescription
      }
    });

    // Log escalation
    await EnhancedAuditService.log({
      userId: dispute.memberId,
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

    const commission = await prisma.commission.findUnique({
      where: { id: dispute.commissionId },
      select: {
        amount: true,
        status: true,
        type: true
      }
    });

    let evidenceUrls: string[] = [];
    if (dispute.description) {
      try {
        evidenceUrls = JSON.parse(dispute.description) as string[];
      } catch {
        // If not JSON, treat as plain text description
      }
    }

    let resolution: any = undefined;
    if (dispute.resolution) {
      try {
        resolution = JSON.parse(dispute.resolution);
      } catch {
        // If not JSON, treat as plain text
        resolution = { notes: dispute.resolution };
      }
    }

    return {
      id: dispute.id,
      userId: dispute.memberId,
      commissionId: dispute.commissionId,
      status: dispute.status as DisputeStatus,
      reason: dispute.reason,
      requestedAmount: dispute.amount,
      originalAmount: commission?.amount || 0,
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
    const where: any = {
      status: { in: ['pending', 'investigating'] }
    };

    if (companyId) {
      // Filter by companyId on the dispute itself
      where.companyId = companyId;
    }

    const disputes = await prisma.commissionDispute.findMany({
      where,
      orderBy: { createdAt: 'asc' }
    });

    // Fetch commissions and users separately
    const commissionIds = disputes.map(d => d.commissionId);
    const commissions = await prisma.commission.findMany({
      where: { id: { in: commissionIds } }
    });
    const commissionMap = new Map(commissions.map(c => [c.id, c]));

    return disputes.map(d => {
      const commission = commissionMap.get(d.commissionId);
      let evidenceUrls: string[] = [];
      if (d.description) {
        try {
          evidenceUrls = JSON.parse(d.description) as string[];
        } catch {
          // If not JSON, treat as plain text
        }
      }
      let resolution: any = undefined;
      if (d.resolution) {
        try {
          resolution = JSON.parse(d.resolution);
        } catch {
          resolution = { notes: d.resolution };
        }
      }

      return {
        id: d.id,
        userId: d.memberId,
        commissionId: d.commissionId,
        status: d.status as DisputeStatus,
        reason: d.reason,
        requestedAmount: d.amount,
        originalAmount: commission?.amount || 0,
        evidenceUrls,
        workflowHistory: [],
        resolution
      };
    });
  }

  /**
   * Get disputes assigned to investigator
   */
  static async getAssignedDisputes(
    investigatorId: string
  ): Promise<DisputeDetails[]> {
    // Note: CommissionDispute model doesn't have assignedTo field
    // Filter by status and check description for assignment info
    const disputes = await prisma.commissionDispute.findMany({
      where: {
        status: 'investigating',
        description: { contains: investigatorId }
      },
      orderBy: { createdAt: 'asc' }
    });

    const commissionIds = disputes.map(d => d.commissionId);
    const commissions = await prisma.commission.findMany({
      where: { id: { in: commissionIds } }
    });
    const commissionMap = new Map(commissions.map(c => [c.id, c]));

    return disputes.map(d => {
      const commission = commissionMap.get(d.commissionId);
      let evidenceUrls: string[] = [];
      if (d.description) {
        try {
          evidenceUrls = JSON.parse(d.description) as string[];
        } catch {
          // If not JSON, treat as plain text
        }
      }
      let resolution: any = undefined;
      if (d.resolution) {
        try {
          resolution = JSON.parse(d.resolution);
        } catch {
          resolution = { notes: d.resolution };
        }
      }

      return {
        id: d.id,
        userId: d.memberId,
        commissionId: d.commissionId,
        status: d.status as DisputeStatus,
        reason: d.reason,
        requestedAmount: d.amount,
        originalAmount: commission?.amount || 0,
        evidenceUrls,
        workflowHistory: [],
        resolution
      };
    });
  }

  /**
   * Get user's dispute history
   */
  static async getUserDisputes(
    userId: string,
    limit: number = 20
  ): Promise<DisputeDetails[]> {
    const disputes = await prisma.commissionDispute.findMany({
      where: { memberId: userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    const commissionIds = disputes.map(d => d.commissionId);
    const commissions = await prisma.commission.findMany({
      where: { id: { in: commissionIds } }
    });
    const commissionMap = new Map(commissions.map(c => [c.id, c]));

    return disputes.map(d => {
      const commission = commissionMap.get(d.commissionId);
      let evidenceUrls: string[] = [];
      if (d.description) {
        try {
          evidenceUrls = JSON.parse(d.description) as string[];
        } catch {
          // If not JSON, treat as plain text
        }
      }
      let resolution: any = undefined;
      if (d.resolution) {
        try {
          resolution = JSON.parse(d.resolution);
        } catch {
          resolution = { notes: d.resolution };
        }
      }

      return {
        id: d.id,
        userId: d.memberId,
        commissionId: d.commissionId,
        status: d.status as DisputeStatus,
        reason: d.reason,
        requestedAmount: d.amount,
        originalAmount: commission?.amount || 0,
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
    const where: any = companyId
      ? { companyId }
      : {};

    const [total, allDisputes, resolved] = await Promise.all([
      prisma.commissionDispute.count({ where }),
      prisma.commissionDispute.findMany({
        where,
        select: { status: true }
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

    const stats = {
      pending: 0,
      investigating: 0,
      resolved: 0,
      rejected: 0
    };

    for (const item of allDisputes) {
      const status = item.status as keyof typeof stats;
      if (status in stats) {
        stats[status]++;
      }
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
