import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/authMiddleware';
import { logger } from '../index';
import { NotificationService } from '../services/NotificationService';

import { prisma } from '../config/database';

export class DisputeController {
  private notificationService = new NotificationService();

  async createDispute(req: AuthRequest, res: Response) {
    try {
      const user = (req as any).user!;
      const { proofId, type, reason, description } = (req as any).body;

      // Validate proof exists and belongs to user
      const proof = await (prisma as any).paymentProof.findFirst({
        where: {
          id: proofId,
          userId: user.id,
          status: { in: ['rejected', 'approved'] } // Can only dispute reviewed proofs
        }
      });

      if (!proof) {
        return (res as any).status(404).json({ error: 'Proof not found or not eligible for dispute' });
      }

      // Check if dispute already exists
      const existingDispute = await (prisma as any).dispute.findFirst({
        where: { proofId, userId: user.id }
      });

      if (existingDispute) {
        return (res as any).status(400).json({ error: 'A dispute already exists for this proof' });
      }

      // Create dispute
      const dispute = await (prisma as any).dispute.create({
        data: {
          proofId,
          userId: user.id,
          type,
          reason,
          description,
          evidence: (req as any).body.evidence || null
        }
      });

      // Log audit event
      await (prisma as any).auditLog.create({
        data: {
          userId: user.id,
          action: 'create_dispute',
          entity: 'dispute',
          entityId: dispute.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          ...({ metadata: { proofId, type } } as any)
        }
      });

      // Notify relevant parties
      if (proof.reviewedById) {
        await this.notificationService.createInAppNotification(
          proof.reviewedById,
          'New Dispute Filed',
          `A dispute has been filed for proof ${proofId}`,
          {
            type: 'dispute_created',
            disputeId: dispute.id,
            proofId
          }
        );
      }

      // Record metric
      await this.recordMetric('dispute_created', 1, { type });

      logger.info('Dispute created successfully', {
        disputeId: dispute.id,
        proofId,
        userId: user.id
      });

      (res as any).status(201).json({
        success: true,
        data: dispute
      });

    } catch (error) {
      logger.error('Error creating dispute', { error: error instanceof Error ? error.message : String(error) });
      (res as any).status(500).json({ error: 'Failed to create dispute' });
    }
  }

  async getDisputes(req: AuthRequest, res: Response) {
    try {
      const user = (req as any).user!;
      const { page = 1, limit = 10, status, type } = req.query;

      let whereCondition: any = {};

      // Role-based filtering
      if (user.role === 'buyer') {
        whereCondition.userId = user.id;
      } else if (user.role === 'upline') {
        // Get disputes from downlines' proofs
        const downlineUsers = await prisma.user.findMany({
          where: { ...({ sponsorId: user.id } as any) },
          select: { id: true }
        });
        whereCondition.userId = { in: downlineUsers.map((u: { id: string }) => u.id) };
      }
      // Admins and auditors can see all disputes

      if (status) {
        whereCondition.status = status;
      }

      if (type) {
        whereCondition.type = type;
      }

      const disputes = await (prisma as any).dispute.findMany({
        where: whereCondition,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, surname: true }
          },
          proof: {
            include: {
              order: true,
              reviewedBy: {
                select: { id: true, email: true, firstName: true, surname: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string)
      });

      const total = await (prisma as any).dispute.count({ where: whereCondition });

      (res as any).json({
        success: true,
        data: disputes,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });

    } catch (error) {
      logger.error('Error fetching disputes', { error: error instanceof Error ? error.message : String(error) });
      (res as any).status(500).json({ error: 'Failed to fetch disputes' });
    }
  }

  async getDispute(req: AuthRequest, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user!;

      const dispute = await (prisma as any).dispute.findUnique({
        where: { id },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, surname: true }
          },
          proof: {
            include: {
              order: true,
              reviewedBy: {
                select: { id: true, email: true, firstName: true, surname: true }
              }
            }
          },
          resolvedBy: {
            select: { id: true, email: true, firstName: true, surname: true }
          }
        }
      });

      if (!dispute) {
        return (res as any).status(404).json({ error: 'Dispute not found' });
      }

      // Check permissions
      if (user.role === 'buyer' && dispute.userId !== user.id) {
        return (res as any).status(403).json({ error: 'Access denied' });
      }

      if (user.role === 'upline') {
        const isDownline = await this.checkIfUserIsDownline(dispute.userId, user.id);
        if (!isDownline) {
          return (res as any).status(403).json({ error: 'Access denied' });
        }
      }

      (res as any).json({ success: true, data: dispute });

    } catch (error) {
      logger.error('Error fetching dispute', { error: error instanceof Error ? error.message : String(error) });
      (res as any).status(500).json({ error: 'Failed to fetch dispute' });
    }
  }

  async resolveDispute(req: AuthRequest, res: Response) {
    try {
      const user = (req as any).user!;
      const { id } = (req as any).params;
      const { resolution, status } = (req as any).body;

      const dispute = await (prisma as any).dispute.findUnique({
        where: { id },
        include: { proof: true }
      });

      if (!dispute) {
        return (res as any).status(404).json({ error: 'Dispute not found' });
      }

      if (dispute.status !== 'pending') {
        return (res as any).status(400).json({ error: 'Dispute is not in pending status' });
      }

      // Check permissions
      if (user.role === 'upline') {
        const isDownline = await this.checkIfUserIsDownline(dispute.userId, user.id);
        if (!isDownline) {
          return (res as any).status(403).json({ error: 'You can only resolve disputes from your downlines' });
        }
      }

      // Update dispute
      const updatedDispute = await (prisma as any).dispute.update({
        where: { id },
        data: {
          status,
          resolution,
          resolvedById: user.id,
          resolvedAt: new Date()
        }
      });

      // If resolved in favor of buyer, update proof status
      if (status === 'resolved' && resolution.toLowerCase().includes('approve')) {
        await (prisma as any).paymentProof.update({
          where: { id: dispute.proofId },
          data: { status: 'approved' }
        });

        // Update order status
        await prisma.order.update({
          where: { id: dispute.proof.id },
          data: { status: 'paid' }
        });
      }

      // Log audit event
      await (prisma as any).auditLog.create({
        data: {
          userId: user.id,
          action: 'resolve_dispute',
          entity: 'dispute',
          entityId: id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          ...({ metadata: { status, resolution } } as any)
        }
      });

      // Notify buyer
      await this.notificationService.createInAppNotification(
        dispute.userId,
        'Dispute Resolved',
        `Your dispute has been ${status}`,
        {
          type: 'dispute_resolved',
          disputeId: id,
          status,
          resolution
        }
      );

      // Record metric
      await this.recordMetric('dispute_resolved', 1, { status });

      logger.info('Dispute resolved', {
        disputeId: id,
        resolvedBy: user.id,
        status
      });

      (res as any).json({
        success: true,
        data: updatedDispute
      });

    } catch (error) {
      logger.error('Error resolving dispute', { error: error instanceof Error ? error.message : String(error) });
      (res as any).status(500).json({ error: 'Failed to resolve dispute' });
    }
  }

  async escalateDispute(req: AuthRequest, res: Response) {
    try {
      const user = (req as any).user!;
      const { id } = (req as any).params;

      const dispute = await (prisma as any).dispute.findUnique({
        where: { id },
        include: { proof: true }
      });

      if (!dispute) {
        return (res as any).status(404).json({ error: 'Dispute not found' });
      }

      if (dispute.status !== 'pending') {
        return (res as any).status(400).json({ error: 'Dispute is not in pending status' });
      }

      // Check permissions (only uplines can escalate)
      if (user.role !== 'upline') {
        return (res as any).status(403).json({ error: 'Only uplines can escalate disputes' });
      }

      const isDownline = await this.checkIfUserIsDownline(dispute.userId, user.id);
      if (!isDownline) {
        return (res as any).status(403).json({ error: 'You can only escalate disputes from your downlines' });
      }

      // Update dispute
      await (prisma as any).dispute.update({
        where: { id },
        data: {
          escalatedToAdmin: true,
          status: 'escalated'
        }
      });

      // Log audit event
      await (prisma as any).auditLog.create({
        data: {
          userId: user.id,
          action: 'escalate_dispute',
          entity: 'dispute',
          entityId: id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      // Notify admins
      await this.notificationService.notifyAdminsOfEscalation(
        dispute.proofId,
        'Dispute escalation'
      );

      logger.info('Dispute escalated to admin', {
        disputeId: id,
        escalatedBy: user.id
      });

      (res as any).json({ success: true, message: 'Dispute escalated to admin review' });

    } catch (error) {
      logger.error('Error escalating dispute', { error: error instanceof Error ? error.message : String(error) });
      (res as any).status(500).json({ error: 'Failed to escalate dispute' });
    }
  }

  async getDisputeMessages(req: AuthRequest, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user!;

      // Verify access to dispute
      const dispute = await (prisma as any).dispute.findUnique({
        where: { id },
        select: { userId: true }
      });

      if (!dispute) {
        return (res as any).status(404).json({ error: 'Dispute not found' });
      }

      // Check permissions
      if (user.role === 'buyer' && dispute.userId !== user.id) {
        return (res as any).status(403).json({ error: 'Access denied' });
      }

      // For now, return empty array as we don't have a messages table
      // In a full implementation, you'd have a DisputeMessage model
      (res as any).json({
        success: true,
        data: []
      });

    } catch (error) {
      logger.error('Error fetching dispute messages', { error: error instanceof Error ? error.message : String(error) });
      (res as any).status(500).json({ error: 'Failed to fetch dispute messages' });
    }
  }

  async addDisputeMessage(req: AuthRequest, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user!;
      const { message } = (req as any).body;

      const dispute = await (prisma as any).dispute.findUnique({
        where: { id },
        select: { userId: true, status: true }
      });

      if (!dispute) {
        return (res as any).status(404).json({ error: 'Dispute not found' });
      }

      if (dispute.status !== 'pending') {
        return (res as any).status(400).json({ error: 'Cannot add messages to resolved disputes' });
      }

      // Check permissions
      if (user.role === 'buyer' && dispute.userId !== user.id) {
        return (res as any).status(403).json({ error: 'Access denied' });
      }

      // For now, just log the message
      // In a full implementation, you'd save to a DisputeMessage table
      logger.info('Dispute message added', {
        disputeId: id,
        userId: user.id,
        message: message.substring(0, 100) + '...'
      });

      // Update dispute with admin notes if from admin/upline
      if (user.role !== 'buyer') {
        await (prisma as any).dispute.update({
          where: { id },
          data: {
            adminNotes: message
          }
        });
      }

      (res as any).json({ success: true, message: 'Message added successfully' });

    } catch (error) {
      logger.error('Error adding dispute message', { error: error instanceof Error ? error.message : String(error) });
      (res as any).status(500).json({ error: 'Failed to add message' });
    }
  }

  async getDisputeStats(req: AuthRequest, res: Response) {
    try {
      const user = (req as any).user!;

      let whereCondition: any = {};

      // Role-based filtering
      if (user.role === 'upline') {
        const downlineUsers = await prisma.user.findMany({
          where: { ...({ sponsorId: user.id } as any) },
          select: { id: true }
        });
        whereCondition.userId = { in: downlineUsers.map((u: { id: string }) => u.id) };
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const stats = await (prisma as any).dispute.groupBy({
        by: ['status', 'type'],
        where: {
          ...whereCondition,
          createdAt: { gte: thirtyDaysAgo }
        },
        _count: { id: true }
      });

      const total = stats.reduce((sum: number, stat: any) => sum + stat._count.id, 0);
      const resolved = stats.filter((s: any) => s.status === 'resolved').reduce((sum: number, s: any) => sum + s._count.id, 0);
      const resolutionRate = total > 0 ? (resolved / total) * 100 : 0;

      // Group by type and status
      const breakdown = stats.reduce((acc: Record<string, Record<string, number>>, stat: any) => {
        if (!acc[stat.type]) acc[stat.type] = {};
        acc[stat.type][stat.status] = stat._count.id;
        return acc;
      }, {} as Record<string, Record<string, number>>);

      (res as any).json({
        success: true,
        data: {
          total,
          resolved,
          resolutionRate: Math.round(resolutionRate * 100) / 100,
          breakdown
        }
      });

    } catch (error) {
      logger.error('Error fetching dispute stats', { error: error instanceof Error ? error.message : String(error) });
      (res as any).status(500).json({ error: 'Failed to fetch dispute stats' });
    }
  }

  private async checkIfUserIsDownline(userId: string, uplineId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { sponsorId: true }
    });
    return (user as any)?.sponsorId === uplineId;
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