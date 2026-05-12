import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/authMiddleware';
import { logger } from '../index';
import { NotificationService } from '../services/NotificationService';

import { prisma } from '../config/database';

export class ApprovalController {
  private notificationService = new NotificationService();

  async getPendingApprovals(req: AuthRequest, res: Response) {
    try {
      const user = (req as any).user!;
      const { page = 1, limit = 10, status = 'uploaded' } = req.query;

      let whereCondition: any = {
        status: {
          in: status === 'uploaded' ? ['uploaded', 'escalated'] : [status]
        }
      };

      // Filter based on user role
      if (user.role === 'upline') {
        // Get proofs from downlines
        const downlineUsers = await prisma.user.findMany({
          where: { ...({ sponsorId: user.id } as any) },
          select: { id: true }
        });
        whereCondition.userId = { in: downlineUsers.map((u: { id: string }) => u.id) };
      } else if (user.role === 'admin') {
        // Admins can see all escalated proofs
        whereCondition.status = 'escalated';
      }

      const proofs = await (prisma as any).paymentProof.findMany({
        where: whereCondition,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, surname: true }
          },
          order: true
        },
        orderBy: { createdAt: 'asc' }, // Oldest first for FIFO processing
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string)
      });

      const total = await (prisma as any).paymentProof.count({ where: whereCondition });

      (res as any).json({
        success: true,
        data: proofs,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });

    } catch (error) {
      logger.error('Error fetching pending approvals', { error: error instanceof Error ? error.message : String(error) });
      (res as any).status(500).json({ error: 'Failed to fetch pending approvals' });
    }
  }

  async reviewProof(req: AuthRequest, res: Response) {
    try {
      const user = (req as any).user!;
      const { proofId, action, notes } = (req as any).body;

      // Validate proof exists and is in correct status
      const proof = await (prisma as any).paymentProof.findUnique({
        where: { id: proofId },
        include: { user: true, order: true }
      });

      if (!proof) {
        return (res as any).status(404).json({ error: 'Proof not found' });
      }

      if (!['uploaded', 'escalated'].includes(proof.status)) {
        return (res as any).status(400).json({ error: 'Proof is not in a reviewable state' });
      }

      // Check permissions
      if (user.role === 'upline') {
        const isDownline = await this.checkIfUserIsDownline(proof.userId, user.id);
        if (!isDownline) {
          return (res as any).status(403).json({ error: 'You can only review proofs from your downlines' });
        }
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      // Update proof status
      const updatedProof = await (prisma as any).paymentProof.update({
        where: { id: proofId },
        data: {
          status: newStatus,
          reviewedById: user.id,
          reviewedAt: new Date(),
          rejectionReason: action === 'reject' ? notes : null,
          approvalNotes: action === 'approve' ? notes : null
        }
      });

      // Create transaction log
      await (prisma as any).transaction.create({
        data: {
          proofId,
          action: action === 'approve' ? 'approve' : 'reject',
          userId: user.id,
          amount: proof.amount,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: { notes }
        }
      });

      // Log audit event
      await (prisma as any).auditLog.create({
        data: {
          userId: user.id,
          action: `${action}_proof`,
          entity: 'payment_proof',
          entityId: proofId,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          ...({ metadata: { newStatus, notes } } as any)
        }
      });

      // Update order status if approved
      if (action === 'approve') {
        await prisma.order.update({
          where: { id: proof.orderId },
          data: { status: 'paid' }
        });

        // TODO: Trigger inventory release via API call to inventory service
        await this.triggerInventoryRelease(proof.orderId);
      }

      // Send notifications
      await this.notificationService.notifyBuyerOfApproval(proofId, action === 'approve', notes);

      // Record metrics
      await this.recordMetric(`${action}_count`, 1, { reviewer_role: user.role });

      logger.info('Proof review completed', {
        proofId,
        action,
        reviewerId: user.id,
        newStatus
      });

      (res as any).json({
        success: true,
        data: updatedProof
      });

    } catch (error) {
      logger.error('Error reviewing proof', { error: error instanceof Error ? error.message : String(error) });
      (res as any).status(500).json({ error: 'Failed to review proof' });
    }
  }

  async bulkReviewProofs(req: AuthRequest, res: Response) {
    try {
      const user = (req as any).user!;
      const { proofIds, action, notes } = (req as any).body;

      if (user.role !== 'admin') {
        return (res as any).status(403).json({ error: 'Bulk operations are restricted to admins' });
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      // Update all proofs in transaction
      const result = await prisma.$transaction(async (tx: any) => {
        const updatedProofs = [];

        for (const proofId of proofIds) {
          const proof = await tx.paymentProof.findUnique({
            where: { id: proofId },
            include: { order: true }
          });

          if (!proof || !['uploaded', 'escalated'].includes(proof.status)) {
            continue; // Skip invalid proofs
          }

          const updatedProof = await tx.paymentProof.update({
            where: { id: proofId },
            data: {
              status: newStatus,
              reviewedById: user.id,
              reviewedAt: new Date(),
              rejectionReason: action === 'reject' ? notes : null,
              approvalNotes: action === 'approve' ? notes : null
            }
          });

          updatedProofs.push(updatedProof);

          // Create transaction log
          await tx.transaction.create({
            data: {
              proofId,
              action: action === 'approve' ? 'approve' : 'reject',
              userId: user.id,
              amount: proof.amount,
              ipAddress: req.ip,
              userAgent: req.get('User-Agent'),
              ...({ metadata: { notes, bulkOperation: true } } as any)
            }
          });

          // Update order status if approved
          if (action === 'approve') {
            await tx.order.update({
              where: { id: proof.orderId },
              data: { status: 'paid' }
            });
          }
        }

        return updatedProofs;
      });

      // Log bulk audit event
      await (prisma as any).auditLog.create({
        data: {
          userId: user.id,
          action: `bulk_${action}_proofs`,
          entity: 'payment_proof',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          ...({ metadata: { proofIds, newStatus, notes, count: result.length } } as any)
        }
      });

      // Send notifications for each proof
      for (const proof of result) {
        await this.notificationService.notifyBuyerOfApproval(proof.id, action === 'approve', notes);
      }

      // Record metrics
      await this.recordMetric(`bulk_${action}_count`, result.length, { reviewer_role: user.role });

      logger.info('Bulk proof review completed', {
        count: result.length,
        action,
        reviewerId: user.id
      });

      (res as any).json({
        success: true,
        data: result,
        count: result.length
      });

    } catch (error) {
      logger.error('Error performing bulk review', { error: error instanceof Error ? error.message : String(error) });
      (res as any).status(500).json({ error: 'Failed to perform bulk review' });
    }
  }

  async getApprovalHistory(req: AuthRequest, res: Response) {
    try {
      const user = (req as any).user!;
      const { page = 1, limit = 10, startDate, endDate, status } = req.query;

      let whereCondition: any = {};

      // Filter by date range
      if (startDate || endDate) {
        whereCondition.reviewedAt = {};
        if (startDate) whereCondition.reviewedAt.gte = new Date(startDate as string);
        if (endDate) whereCondition.reviewedAt.lte = new Date(endDate as string);
      }

      // Filter by status
      if (status) {
        whereCondition.status = status;
      }

      // Role-based filtering
      if (user.role === 'upline') {
        const downlineUsers = await prisma.user.findMany({
          where: { ...({ sponsorId: user.id } as any) },
          select: { id: true }
        });
        whereCondition.userId = { in: downlineUsers.map((u: { id: string }) => u.id) };
      }

      const proofs = await (prisma as any).paymentProof.findMany({
        where: {
          ...whereCondition,
          status: { in: ['approved', 'rejected'] }
        },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, surname: true }
          },
          order: true,
          reviewedBy: {
            select: { id: true, email: true, firstName: true, surname: true }
          }
        },
        orderBy: { reviewedAt: 'desc' },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string)
      });

      const total = await (prisma as any).paymentProof.count({
        where: {
          ...whereCondition,
          status: { in: ['approved', 'rejected'] }
        }
      });

      (res as any).json({
        success: true,
        data: proofs,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });

    } catch (error) {
      logger.error('Error fetching approval history', { error: error instanceof Error ? error.message : String(error) });
      (res as any).status(500).json({ error: 'Failed to fetch approval history' });
    }
  }

  async getApprovalStats(req: AuthRequest, res: Response) {
    try {
      const user = (req as any).user!;
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let whereCondition: any = {
        reviewedAt: { gte: thirtyDaysAgo }
      };

      // Role-based filtering for stats
      if (user.role === 'upline') {
        const downlineUsers = await prisma.user.findMany({
          where: { ...({ sponsorId: user.id } as any) },
          select: { id: true }
        });
        whereCondition.userId = { in: downlineUsers.map((u: { id: string }) => u.id) };
      }

      const stats = await (prisma as any).paymentProof.groupBy({
        by: ['status'],
        where: whereCondition,
        _count: { id: true }
      });

      const totalReviewed = stats.reduce((sum: number, stat: any) => sum + stat._count.id, 0);
      const approvalRate = totalReviewed > 0 ?
        (stats.find((s: any) => s.status === 'approved')?._count.id || 0) / totalReviewed * 100 : 0;

      // Average review time
      const avgReviewTime = await prisma.$queryRaw`
        SELECT AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at))/3600) as avg_hours
        FROM payment_proofs
        WHERE reviewed_at IS NOT NULL AND created_at >= $1
      ` as any;

      (res as any).json({
        success: true,
        data: {
          totalReviewed,
          approvalRate: Math.round(approvalRate * 100) / 100,
          averageReviewTimeHours: avgReviewTime[0]?.avg_hours ? Math.round(avgReviewTime[0].avg_hours * 100) / 100 : null,
          breakdown: stats.reduce((acc: Record<string, number>, stat: any) => {
            acc[stat.status] = stat._count.id;
            return acc;
          }, {} as Record<string, number>)
        }
      });

    } catch (error) {
      logger.error('Error fetching approval stats', { error: error instanceof Error ? error.message : String(error) });
      (res as any).status(500).json({ error: 'Failed to fetch approval stats' });
    }
  }

  async escalateProof(req: AuthRequest, res: Response) {
    try {
      const user = (req as any).user!;
      const { proofId } = (req as any).params;

      const proof = await (prisma as any).paymentProof.findUnique({
        where: { id: proofId }
      });

      if (!proof) {
        return (res as any).status(404).json({ error: 'Proof not found' });
      }

      if (proof.status !== 'uploaded') {
        return (res as any).status(400).json({ error: 'Only uploaded proofs can be escalated' });
      }

      // Check if user can escalate this proof
      if (user.role === 'upline') {
        const isDownline = await this.checkIfUserIsDownline(proof.userId, user.id);
        if (!isDownline) {
          return (res as any).status(403).json({ error: 'You can only escalate proofs from your downlines' });
        }
      }

      // Update proof status to escalated
      await (prisma as any).paymentProof.update({
        where: { id: proofId },
        data: { status: 'escalated' }
      });

      // Log escalation
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'escalate_proof',
          entity: 'payment_proof',
          entityId: proofId,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      // Notify admins
      await this.notificationService.notifyAdminsOfEscalation(proofId, 'Upline escalation');

      logger.info('Proof escalated to admin', { proofId, escalatedBy: user.id });

      (res as any).json({ success: true, message: 'Proof escalated to admin review' });

    } catch (error) {
      logger.error('Error escalating proof', { error: error instanceof Error ? error.message : String(error) });
      (res as any).status(500).json({ error: 'Failed to escalate proof' });
    }
  }

  private async checkIfUserIsDownline(userId: string, uplineId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { sponsorId: true }
    });
    return (user as any)?.sponsorId === uplineId;
  }

  private async triggerInventoryRelease(orderId: string): Promise<void> {
    // TODO: Implement API call to inventory service
    logger.info('Inventory release triggered', { orderId });
  }

  private async recordMetric(metric: string, value: number, dimensions: Record<string, any> = {}) {
    try {
      await (prisma as any).systemMetric.create({
        data: {
          metric,
          value,
          dimensions: dimensions || {},
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Error recording metric', { error: error instanceof Error ? error.message : String(error) });
    }
  }
}