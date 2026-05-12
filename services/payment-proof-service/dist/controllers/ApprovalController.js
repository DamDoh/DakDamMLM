"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalController = void 0;
const index_1 = require("../index");
const NotificationService_1 = require("../services/NotificationService");
const database_1 = require("../config/database");
class ApprovalController {
    constructor() {
        this.notificationService = new NotificationService_1.NotificationService();
    }
    async getPendingApprovals(req, res) {
        try {
            const user = req.user;
            const { page = 1, limit = 10, status = 'uploaded' } = req.query;
            let whereCondition = {
                status: {
                    in: status === 'uploaded' ? ['uploaded', 'escalated'] : [status]
                }
            };
            // Filter based on user role
            if (user.role === 'upline') {
                // Get proofs from downlines
                const downlineUsers = await database_1.prisma.user.findMany({
                    where: { ...{ sponsorId: user.id } },
                    select: { id: true }
                });
                whereCondition.userId = { in: downlineUsers.map((u) => u.id) };
            }
            else if (user.role === 'admin') {
                // Admins can see all escalated proofs
                whereCondition.status = 'escalated';
            }
            const proofs = await database_1.prisma.paymentProof.findMany({
                where: whereCondition,
                include: {
                    user: {
                        select: { id: true, email: true, firstName: true, surname: true }
                    },
                    order: true
                },
                orderBy: { createdAt: 'asc' }, // Oldest first for FIFO processing
                skip: (parseInt(page) - 1) * parseInt(limit),
                take: parseInt(limit)
            });
            const total = await database_1.prisma.paymentProof.count({ where: whereCondition });
            res.json({
                success: true,
                data: proofs,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });
        }
        catch (error) {
            index_1.logger.error('Error fetching pending approvals', { error: error instanceof Error ? error.message : String(error) });
            res.status(500).json({ error: 'Failed to fetch pending approvals' });
        }
    }
    async reviewProof(req, res) {
        try {
            const user = req.user;
            const { proofId, action, notes } = req.body;
            // Validate proof exists and is in correct status
            const proof = await database_1.prisma.paymentProof.findUnique({
                where: { id: proofId },
                include: { user: true, order: true }
            });
            if (!proof) {
                return res.status(404).json({ error: 'Proof not found' });
            }
            if (!['uploaded', 'escalated'].includes(proof.status)) {
                return res.status(400).json({ error: 'Proof is not in a reviewable state' });
            }
            // Check permissions
            if (user.role === 'upline') {
                const isDownline = await this.checkIfUserIsDownline(proof.userId, user.id);
                if (!isDownline) {
                    return res.status(403).json({ error: 'You can only review proofs from your downlines' });
                }
            }
            const newStatus = action === 'approve' ? 'approved' : 'rejected';
            // Update proof status
            const updatedProof = await database_1.prisma.paymentProof.update({
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
            await database_1.prisma.transaction.create({
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
            await database_1.prisma.auditLog.create({
                data: {
                    userId: user.id,
                    action: `${action}_proof`,
                    entity: 'payment_proof',
                    entityId: proofId,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    ...{ metadata: { newStatus, notes } }
                }
            });
            // Update order status if approved
            if (action === 'approve') {
                await database_1.prisma.order.update({
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
            index_1.logger.info('Proof review completed', {
                proofId,
                action,
                reviewerId: user.id,
                newStatus
            });
            res.json({
                success: true,
                data: updatedProof
            });
        }
        catch (error) {
            index_1.logger.error('Error reviewing proof', { error: error instanceof Error ? error.message : String(error) });
            res.status(500).json({ error: 'Failed to review proof' });
        }
    }
    async bulkReviewProofs(req, res) {
        try {
            const user = req.user;
            const { proofIds, action, notes } = req.body;
            if (user.role !== 'admin') {
                return res.status(403).json({ error: 'Bulk operations are restricted to admins' });
            }
            const newStatus = action === 'approve' ? 'approved' : 'rejected';
            // Update all proofs in transaction
            const result = await database_1.prisma.$transaction(async (tx) => {
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
                            ...{ metadata: { notes, bulkOperation: true } }
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
            await database_1.prisma.auditLog.create({
                data: {
                    userId: user.id,
                    action: `bulk_${action}_proofs`,
                    entity: 'payment_proof',
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    ...{ metadata: { proofIds, newStatus, notes, count: result.length } }
                }
            });
            // Send notifications for each proof
            for (const proof of result) {
                await this.notificationService.notifyBuyerOfApproval(proof.id, action === 'approve', notes);
            }
            // Record metrics
            await this.recordMetric(`bulk_${action}_count`, result.length, { reviewer_role: user.role });
            index_1.logger.info('Bulk proof review completed', {
                count: result.length,
                action,
                reviewerId: user.id
            });
            res.json({
                success: true,
                data: result,
                count: result.length
            });
        }
        catch (error) {
            index_1.logger.error('Error performing bulk review', { error: error instanceof Error ? error.message : String(error) });
            res.status(500).json({ error: 'Failed to perform bulk review' });
        }
    }
    async getApprovalHistory(req, res) {
        try {
            const user = req.user;
            const { page = 1, limit = 10, startDate, endDate, status } = req.query;
            let whereCondition = {};
            // Filter by date range
            if (startDate || endDate) {
                whereCondition.reviewedAt = {};
                if (startDate)
                    whereCondition.reviewedAt.gte = new Date(startDate);
                if (endDate)
                    whereCondition.reviewedAt.lte = new Date(endDate);
            }
            // Filter by status
            if (status) {
                whereCondition.status = status;
            }
            // Role-based filtering
            if (user.role === 'upline') {
                const downlineUsers = await database_1.prisma.user.findMany({
                    where: { ...{ sponsorId: user.id } },
                    select: { id: true }
                });
                whereCondition.userId = { in: downlineUsers.map((u) => u.id) };
            }
            const proofs = await database_1.prisma.paymentProof.findMany({
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
                skip: (parseInt(page) - 1) * parseInt(limit),
                take: parseInt(limit)
            });
            const total = await database_1.prisma.paymentProof.count({
                where: {
                    ...whereCondition,
                    status: { in: ['approved', 'rejected'] }
                }
            });
            res.json({
                success: true,
                data: proofs,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });
        }
        catch (error) {
            index_1.logger.error('Error fetching approval history', { error: error instanceof Error ? error.message : String(error) });
            res.status(500).json({ error: 'Failed to fetch approval history' });
        }
    }
    async getApprovalStats(req, res) {
        try {
            const user = req.user;
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            let whereCondition = {
                reviewedAt: { gte: thirtyDaysAgo }
            };
            // Role-based filtering for stats
            if (user.role === 'upline') {
                const downlineUsers = await database_1.prisma.user.findMany({
                    where: { ...{ sponsorId: user.id } },
                    select: { id: true }
                });
                whereCondition.userId = { in: downlineUsers.map((u) => u.id) };
            }
            const stats = await database_1.prisma.paymentProof.groupBy({
                by: ['status'],
                where: whereCondition,
                _count: { id: true }
            });
            const totalReviewed = stats.reduce((sum, stat) => sum + stat._count.id, 0);
            const approvalRate = totalReviewed > 0 ?
                (stats.find((s) => s.status === 'approved')?._count.id || 0) / totalReviewed * 100 : 0;
            // Average review time
            const avgReviewTime = await database_1.prisma.$queryRaw `
        SELECT AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at))/3600) as avg_hours
        FROM payment_proofs
        WHERE reviewed_at IS NOT NULL AND created_at >= $1
      `;
            res.json({
                success: true,
                data: {
                    totalReviewed,
                    approvalRate: Math.round(approvalRate * 100) / 100,
                    averageReviewTimeHours: avgReviewTime[0]?.avg_hours ? Math.round(avgReviewTime[0].avg_hours * 100) / 100 : null,
                    breakdown: stats.reduce((acc, stat) => {
                        acc[stat.status] = stat._count.id;
                        return acc;
                    }, {})
                }
            });
        }
        catch (error) {
            index_1.logger.error('Error fetching approval stats', { error: error instanceof Error ? error.message : String(error) });
            res.status(500).json({ error: 'Failed to fetch approval stats' });
        }
    }
    async escalateProof(req, res) {
        try {
            const user = req.user;
            const { proofId } = req.params;
            const proof = await database_1.prisma.paymentProof.findUnique({
                where: { id: proofId }
            });
            if (!proof) {
                return res.status(404).json({ error: 'Proof not found' });
            }
            if (proof.status !== 'uploaded') {
                return res.status(400).json({ error: 'Only uploaded proofs can be escalated' });
            }
            // Check if user can escalate this proof
            if (user.role === 'upline') {
                const isDownline = await this.checkIfUserIsDownline(proof.userId, user.id);
                if (!isDownline) {
                    return res.status(403).json({ error: 'You can only escalate proofs from your downlines' });
                }
            }
            // Update proof status to escalated
            await database_1.prisma.paymentProof.update({
                where: { id: proofId },
                data: { status: 'escalated' }
            });
            // Log escalation
            await database_1.prisma.auditLog.create({
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
            index_1.logger.info('Proof escalated to admin', { proofId, escalatedBy: user.id });
            res.json({ success: true, message: 'Proof escalated to admin review' });
        }
        catch (error) {
            index_1.logger.error('Error escalating proof', { error: error instanceof Error ? error.message : String(error) });
            res.status(500).json({ error: 'Failed to escalate proof' });
        }
    }
    async checkIfUserIsDownline(userId, uplineId) {
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            select: { sponsorId: true }
        });
        return user?.sponsorId === uplineId;
    }
    async triggerInventoryRelease(orderId) {
        // TODO: Implement API call to inventory service
        index_1.logger.info('Inventory release triggered', { orderId });
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
exports.ApprovalController = ApprovalController;
//# sourceMappingURL=ApprovalController.js.map