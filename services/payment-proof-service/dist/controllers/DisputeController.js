"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisputeController = void 0;
const index_1 = require("../index");
const NotificationService_1 = require("../services/NotificationService");
const database_1 = require("../config/database");
class DisputeController {
    constructor() {
        this.notificationService = new NotificationService_1.NotificationService();
    }
    async createDispute(req, res) {
        try {
            const user = req.user;
            const { proofId, type, reason, description } = req.body;
            // Validate proof exists and belongs to user
            const proof = await database_1.prisma.paymentProof.findFirst({
                where: {
                    id: proofId,
                    userId: user.id,
                    status: { in: ['rejected', 'approved'] } // Can only dispute reviewed proofs
                }
            });
            if (!proof) {
                return res.status(404).json({ error: 'Proof not found or not eligible for dispute' });
            }
            // Check if dispute already exists
            const existingDispute = await database_1.prisma.dispute.findFirst({
                where: { proofId, userId: user.id }
            });
            if (existingDispute) {
                return res.status(400).json({ error: 'A dispute already exists for this proof' });
            }
            // Create dispute
            const dispute = await database_1.prisma.dispute.create({
                data: {
                    proofId,
                    userId: user.id,
                    type,
                    reason,
                    description,
                    evidence: req.body.evidence || null
                }
            });
            // Log audit event
            await database_1.prisma.auditLog.create({
                data: {
                    userId: user.id,
                    action: 'create_dispute',
                    entity: 'dispute',
                    entityId: dispute.id,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    ...{ metadata: { proofId, type } }
                }
            });
            // Notify relevant parties
            if (proof.reviewedById) {
                await this.notificationService.createInAppNotification(proof.reviewedById, 'New Dispute Filed', `A dispute has been filed for proof ${proofId}`, {
                    type: 'dispute_created',
                    disputeId: dispute.id,
                    proofId
                });
            }
            // Record metric
            await this.recordMetric('dispute_created', 1, { type });
            index_1.logger.info('Dispute created successfully', {
                disputeId: dispute.id,
                proofId,
                userId: user.id
            });
            res.status(201).json({
                success: true,
                data: dispute
            });
        }
        catch (error) {
            index_1.logger.error('Error creating dispute', { error: error instanceof Error ? error.message : String(error) });
            res.status(500).json({ error: 'Failed to create dispute' });
        }
    }
    async getDisputes(req, res) {
        try {
            const user = req.user;
            const { page = 1, limit = 10, status, type } = req.query;
            let whereCondition = {};
            // Role-based filtering
            if (user.role === 'buyer') {
                whereCondition.userId = user.id;
            }
            else if (user.role === 'upline') {
                // Get disputes from downlines' proofs
                const downlineUsers = await database_1.prisma.user.findMany({
                    where: { ...{ sponsorId: user.id } },
                    select: { id: true }
                });
                whereCondition.userId = { in: downlineUsers.map((u) => u.id) };
            }
            // Admins and auditors can see all disputes
            if (status) {
                whereCondition.status = status;
            }
            if (type) {
                whereCondition.type = type;
            }
            const disputes = await database_1.prisma.dispute.findMany({
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
                skip: (parseInt(page) - 1) * parseInt(limit),
                take: parseInt(limit)
            });
            const total = await database_1.prisma.dispute.count({ where: whereCondition });
            res.json({
                success: true,
                data: disputes,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });
        }
        catch (error) {
            index_1.logger.error('Error fetching disputes', { error: error instanceof Error ? error.message : String(error) });
            res.status(500).json({ error: 'Failed to fetch disputes' });
        }
    }
    async getDispute(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            const dispute = await database_1.prisma.dispute.findUnique({
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
                return res.status(404).json({ error: 'Dispute not found' });
            }
            // Check permissions
            if (user.role === 'buyer' && dispute.userId !== user.id) {
                return res.status(403).json({ error: 'Access denied' });
            }
            if (user.role === 'upline') {
                const isDownline = await this.checkIfUserIsDownline(dispute.userId, user.id);
                if (!isDownline) {
                    return res.status(403).json({ error: 'Access denied' });
                }
            }
            res.json({ success: true, data: dispute });
        }
        catch (error) {
            index_1.logger.error('Error fetching dispute', { error: error instanceof Error ? error.message : String(error) });
            res.status(500).json({ error: 'Failed to fetch dispute' });
        }
    }
    async resolveDispute(req, res) {
        try {
            const user = req.user;
            const { id } = req.params;
            const { resolution, status } = req.body;
            const dispute = await database_1.prisma.dispute.findUnique({
                where: { id },
                include: { proof: true }
            });
            if (!dispute) {
                return res.status(404).json({ error: 'Dispute not found' });
            }
            if (dispute.status !== 'pending') {
                return res.status(400).json({ error: 'Dispute is not in pending status' });
            }
            // Check permissions
            if (user.role === 'upline') {
                const isDownline = await this.checkIfUserIsDownline(dispute.userId, user.id);
                if (!isDownline) {
                    return res.status(403).json({ error: 'You can only resolve disputes from your downlines' });
                }
            }
            // Update dispute
            const updatedDispute = await database_1.prisma.dispute.update({
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
                await database_1.prisma.paymentProof.update({
                    where: { id: dispute.proofId },
                    data: { status: 'approved' }
                });
                // Update order status
                await database_1.prisma.order.update({
                    where: { id: dispute.proof.id },
                    data: { status: 'paid' }
                });
            }
            // Log audit event
            await database_1.prisma.auditLog.create({
                data: {
                    userId: user.id,
                    action: 'resolve_dispute',
                    entity: 'dispute',
                    entityId: id,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    ...{ metadata: { status, resolution } }
                }
            });
            // Notify buyer
            await this.notificationService.createInAppNotification(dispute.userId, 'Dispute Resolved', `Your dispute has been ${status}`, {
                type: 'dispute_resolved',
                disputeId: id,
                status,
                resolution
            });
            // Record metric
            await this.recordMetric('dispute_resolved', 1, { status });
            index_1.logger.info('Dispute resolved', {
                disputeId: id,
                resolvedBy: user.id,
                status
            });
            res.json({
                success: true,
                data: updatedDispute
            });
        }
        catch (error) {
            index_1.logger.error('Error resolving dispute', { error: error instanceof Error ? error.message : String(error) });
            res.status(500).json({ error: 'Failed to resolve dispute' });
        }
    }
    async escalateDispute(req, res) {
        try {
            const user = req.user;
            const { id } = req.params;
            const dispute = await database_1.prisma.dispute.findUnique({
                where: { id },
                include: { proof: true }
            });
            if (!dispute) {
                return res.status(404).json({ error: 'Dispute not found' });
            }
            if (dispute.status !== 'pending') {
                return res.status(400).json({ error: 'Dispute is not in pending status' });
            }
            // Check permissions (only uplines can escalate)
            if (user.role !== 'upline') {
                return res.status(403).json({ error: 'Only uplines can escalate disputes' });
            }
            const isDownline = await this.checkIfUserIsDownline(dispute.userId, user.id);
            if (!isDownline) {
                return res.status(403).json({ error: 'You can only escalate disputes from your downlines' });
            }
            // Update dispute
            await database_1.prisma.dispute.update({
                where: { id },
                data: {
                    escalatedToAdmin: true,
                    status: 'escalated'
                }
            });
            // Log audit event
            await database_1.prisma.auditLog.create({
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
            await this.notificationService.notifyAdminsOfEscalation(dispute.proofId, 'Dispute escalation');
            index_1.logger.info('Dispute escalated to admin', {
                disputeId: id,
                escalatedBy: user.id
            });
            res.json({ success: true, message: 'Dispute escalated to admin review' });
        }
        catch (error) {
            index_1.logger.error('Error escalating dispute', { error: error instanceof Error ? error.message : String(error) });
            res.status(500).json({ error: 'Failed to escalate dispute' });
        }
    }
    async getDisputeMessages(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            // Verify access to dispute
            const dispute = await database_1.prisma.dispute.findUnique({
                where: { id },
                select: { userId: true }
            });
            if (!dispute) {
                return res.status(404).json({ error: 'Dispute not found' });
            }
            // Check permissions
            if (user.role === 'buyer' && dispute.userId !== user.id) {
                return res.status(403).json({ error: 'Access denied' });
            }
            // For now, return empty array as we don't have a messages table
            // In a full implementation, you'd have a DisputeMessage model
            res.json({
                success: true,
                data: []
            });
        }
        catch (error) {
            index_1.logger.error('Error fetching dispute messages', { error: error instanceof Error ? error.message : String(error) });
            res.status(500).json({ error: 'Failed to fetch dispute messages' });
        }
    }
    async addDisputeMessage(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            const { message } = req.body;
            const dispute = await database_1.prisma.dispute.findUnique({
                where: { id },
                select: { userId: true, status: true }
            });
            if (!dispute) {
                return res.status(404).json({ error: 'Dispute not found' });
            }
            if (dispute.status !== 'pending') {
                return res.status(400).json({ error: 'Cannot add messages to resolved disputes' });
            }
            // Check permissions
            if (user.role === 'buyer' && dispute.userId !== user.id) {
                return res.status(403).json({ error: 'Access denied' });
            }
            // For now, just log the message
            // In a full implementation, you'd save to a DisputeMessage table
            index_1.logger.info('Dispute message added', {
                disputeId: id,
                userId: user.id,
                message: message.substring(0, 100) + '...'
            });
            // Update dispute with admin notes if from admin/upline
            if (user.role !== 'buyer') {
                await database_1.prisma.dispute.update({
                    where: { id },
                    data: {
                        adminNotes: message
                    }
                });
            }
            res.json({ success: true, message: 'Message added successfully' });
        }
        catch (error) {
            index_1.logger.error('Error adding dispute message', { error: error instanceof Error ? error.message : String(error) });
            res.status(500).json({ error: 'Failed to add message' });
        }
    }
    async getDisputeStats(req, res) {
        try {
            const user = req.user;
            let whereCondition = {};
            // Role-based filtering
            if (user.role === 'upline') {
                const downlineUsers = await database_1.prisma.user.findMany({
                    where: { ...{ sponsorId: user.id } },
                    select: { id: true }
                });
                whereCondition.userId = { in: downlineUsers.map((u) => u.id) };
            }
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const stats = await database_1.prisma.dispute.groupBy({
                by: ['status', 'type'],
                where: {
                    ...whereCondition,
                    createdAt: { gte: thirtyDaysAgo }
                },
                _count: { id: true }
            });
            const total = stats.reduce((sum, stat) => sum + stat._count.id, 0);
            const resolved = stats.filter((s) => s.status === 'resolved').reduce((sum, s) => sum + s._count.id, 0);
            const resolutionRate = total > 0 ? (resolved / total) * 100 : 0;
            // Group by type and status
            const breakdown = stats.reduce((acc, stat) => {
                if (!acc[stat.type])
                    acc[stat.type] = {};
                acc[stat.type][stat.status] = stat._count.id;
                return acc;
            }, {});
            res.json({
                success: true,
                data: {
                    total,
                    resolved,
                    resolutionRate: Math.round(resolutionRate * 100) / 100,
                    breakdown
                }
            });
        }
        catch (error) {
            index_1.logger.error('Error fetching dispute stats', { error: error instanceof Error ? error.message : String(error) });
            res.status(500).json({ error: 'Failed to fetch dispute stats' });
        }
    }
    async checkIfUserIsDownline(userId, uplineId) {
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            select: { sponsorId: true }
        });
        return user?.sponsorId === uplineId;
    }
    async recordMetric(metric, value, dimensions = {}) {
        try {
            await database_1.prisma.systemMetric.create({
                data: {
                    metric,
                    value,
                    dimensions: dimensions || {},
                    timestamp: new Date()
                }
            });
        }
        catch (error) {
            index_1.logger.error('Error recording metric', { error: error instanceof Error ? error.message : String(error) });
        }
    }
}
exports.DisputeController = DisputeController;
//# sourceMappingURL=DisputeController.js.map