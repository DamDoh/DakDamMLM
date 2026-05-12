"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProofController = void 0;
const crypto_1 = __importDefault(require("crypto"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const tesseract_js_1 = require("tesseract.js");
const qrcode_1 = __importDefault(require("qrcode"));
const index_1 = require("../index");
const FileEncryptionService_1 = require("../services/FileEncryptionService");
const FraudDetectionService_1 = require("../services/FraudDetectionService");
const NotificationService_1 = require("../services/NotificationService");
const database_1 = require("../config/database");
class ProofController {
    constructor() {
        this.fileEncryptionService = new FileEncryptionService_1.FileEncryptionService();
        this.fraudDetectionService = new FraudDetectionService_1.FraudDetectionService();
        this.notificationService = new NotificationService_1.NotificationService();
    }
    async uploadProof(req, res) {
        try {
            const user = req.user;
            const { orderId, amount } = req.body;
            const file = req.file;
            if (!file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }
            // Validate order exists and belongs to user
            const order = await database_1.prisma.order.findFirst({
                where: {
                    id: orderId,
                    userId: user.id,
                    status: 'pending'
                }
            });
            if (!order) {
                return res.status(404).json({ error: 'Order not found or not eligible for payment proof' });
            }
            // Check for duplicate file hash
            const fileHash = crypto_1.default.createHash('sha256').update(file.buffer).digest('hex');
            const existingProof = await database_1.prisma.paymentProof.findFirst({
                where: { fileHash }
            });
            if (existingProof) {
                await this.fraudDetectionService.createAlert({
                    type: 'duplicate_hash',
                    severity: 'high',
                    description: 'Duplicate file hash detected',
                    proofId: existingProof.id,
                    userId: user.id,
                    indicators: { fileHash }
                });
                return res.status(400).json({ error: 'This file has already been uploaded' });
            }
            // Perform OCR if it's an image
            let ocrData = null;
            if (file.mimetype.startsWith('image/')) {
                try {
                    const worker = await (0, tesseract_js_1.createWorker)('eng');
                    const { data: { text } } = await worker.recognize(file.buffer);
                    await worker.terminate();
                    // Extract potential payment information
                    ocrData = this.extractPaymentInfo(text);
                }
                catch (error) {
                    index_1.logger.warn('OCR processing failed', { error: error instanceof Error ? error.message : String(error) });
                }
            }
            // Encrypt and store file
            const encryptedPath = await this.fileEncryptionService.encryptAndStoreFile(file.buffer, file.originalname, user.id);
            // Create payment proof record
            const proof = await database_1.prisma.paymentProof.create({
                data: {
                    orderId,
                    userId: user.id,
                    fileName: file.originalname,
                    fileSize: file.size,
                    fileType: file.mimetype,
                    fileHash,
                    encryptedPath,
                    ocrData,
                    amount: amount ? parseFloat(amount) : null,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    uploadSource: req.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'web'
                }
            });
            // Create transaction log
            await database_1.prisma.transaction.create({
                data: {
                    proofId: proof.id,
                    action: 'upload',
                    userId: user.id,
                    amount: proof.amount,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                }
            });
            // Log audit event
            await database_1.prisma.auditLog.create({
                data: {
                    userId: user.id,
                    action: 'upload_proof',
                    entity: 'payment_proof',
                    entityId: proof.id,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    ...{ metadata: { orderId, fileSize: file.size } }
                }
            });
            // Send notification to upline
            await this.notificationService.notifyUplineOfNewProof(proof.id);
            // Record metric
            await this.recordMetric('upload_count', 1, { user_role: user.role });
            index_1.logger.info('Payment proof uploaded successfully', { proofId: proof.id, userId: user.id });
            res.status(201).json({
                success: true,
                data: {
                    id: proof.id,
                    status: proof.status,
                    uploadedAt: proof.createdAt
                }
            });
        }
        catch (error) {
            index_1.logger.error('Error uploading payment proof', { error: error instanceof Error ? error.message : String(error) });
            res.status(500).json({ error: 'Failed to upload payment proof' });
        }
    }
    async getProofs(req, res) {
        try {
            const user = req.user;
            const { page = 1, limit = 10, status } = req.query;
            const where = {};
            if (user.role === 'buyer') {
                where.userId = user.id;
            }
            else if (user.role === 'upline') {
                // Get proofs from downlines
                const downlineUsers = await database_1.prisma.user.findMany({
                    where: { ...{ sponsorId: user.id } },
                    select: { id: true }
                });
                where.userId = { in: downlineUsers.map((u) => u.id) };
            }
            if (status) {
                where.status = status;
            }
            const proofs = await database_1.prisma.paymentProof.findMany({
                where,
                include: {
                    user: {
                        select: { id: true, email: true, firstName: true, surname: true }
                    },
                    order: true,
                    reviewedBy: {
                        select: { id: true, email: true, firstName: true, surname: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: (parseInt(page) - 1) * parseInt(limit),
                take: parseInt(limit)
            });
            const total = await database_1.prisma.paymentProof.count({ where });
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
            index_1.logger.error('Error fetching proofs', { error: error instanceof Error ? error.message : String(error) });
            res.status(500).json({ error: 'Failed to fetch proofs' });
        }
    }
    async getProof(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            const proof = await database_1.prisma.paymentProof.findUnique({
                where: { id },
                include: {
                    user: {
                        select: { id: true, email: true, firstName: true, surname: true }
                    },
                    order: true,
                    reviewedBy: {
                        select: { id: true, email: true, firstName: true, surname: true }
                    },
                    transactions: true,
                    disputes: true
                }
            });
            if (!proof) {
                return res.status(404).json({ error: 'Proof not found' });
            }
            // Check permissions
            if (user.role === 'buyer' && proof.userId !== user.id) {
                return res.status(403).json({ error: 'Access denied' });
            }
            if (user.role === 'upline' && proof.userId !== user.id && proof.order.userId !== user.uplineId) {
                return res.status(403).json({ error: 'Access denied' });
            }
            res.json({ success: true, data: proof });
        }
        catch (error) {
            index_1.logger.error('Error fetching proof', { error: error instanceof Error ? error.message : String(error) });
            res.status(500).json({ error: 'Failed to fetch proof' });
        }
    }
    async downloadProof(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            const proof = await database_1.prisma.paymentProof.findUnique({
                where: { id }
            });
            if (!proof) {
                return res.status(404).json({ error: 'Proof not found' });
            }
            // Check permissions
            if (user.role === 'buyer' && proof.userId !== user.id) {
                return res.status(403).json({ error: 'Access denied' });
            }
            // Decrypt and serve file
            const decryptedBuffer = await this.fileEncryptionService.decryptFile(proof.encryptedPath);
            res.setHeader('Content-Type', proof.fileType);
            res.setHeader('Content-Disposition', `attachment; filename="${proof.fileName}"`);
            res.send(decryptedBuffer);
        }
        catch (error) {
            index_1.logger.error('Error downloading proof', { error: error instanceof Error ? error.message : String(error) });
            res.status(500).json({ error: 'Failed to download proof' });
        }
    }
    async deleteProof(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            const proof = await database_1.prisma.paymentProof.findUnique({
                where: { id }
            });
            if (!proof) {
                return res.status(404).json({ error: 'Proof not found' });
            }
            // Only admins can delete proofs
            if (user.role !== 'admin') {
                return res.status(403).json({ error: 'Access denied' });
            }
            // Delete encrypted file
            await this.fileEncryptionService.deleteFile(proof.encryptedPath);
            // Delete from database
            await database_1.prisma.paymentProof.delete({
                where: { id }
            });
            // Log audit event
            await database_1.prisma.auditLog.create({
                data: {
                    userId: user.id,
                    action: 'delete_proof',
                    entity: 'payment_proof',
                    entityId: id,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                }
            });
            res.json({ success: true, message: 'Proof deleted successfully' });
        }
        catch (error) {
            index_1.logger.error('Error deleting proof', { error: error instanceof Error ? error.message : String(error) });
            res.status(500).json({ error: 'Failed to delete proof' });
        }
    }
    async createQRCode(req, res) {
        try {
            const user = req.user;
            const { amount, currency = 'USD' } = req.body;
            // Generate QR code data
            const qrData = {
                type: 'payment',
                recipient: user.id,
                amount,
                currency,
                timestamp: new Date().toISOString(),
                reference: crypto_1.default.randomUUID()
            };
            // Generate QR code image
            const qrImageBuffer = await qrcode_1.default.toBuffer(JSON.stringify(qrData), {
                type: 'png',
                width: 256,
                margin: 2
            });
            // Store QR code image
            const qrImagePath = `qr-codes/${user.id}/${Date.now()}.png`;
            await fs_extra_1.default.ensureDir(path_1.default.dirname(`uploads/${qrImagePath}`));
            await fs_extra_1.default.writeFile(`uploads/${qrImagePath}`, qrImageBuffer);
            // Create QR code record
            const qrCode = await database_1.prisma.qRCode.create({
                data: {
                    userId: user.id,
                    qrData: JSON.stringify(qrData),
                    qrImage: qrImagePath,
                    amount: parseFloat(amount),
                    currency
                }
            });
            // Log audit event
            await database_1.prisma.auditLog.create({
                data: {
                    userId: user.id,
                    action: 'create_qr_code',
                    entity: 'qr_code',
                    entityId: qrCode.id,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    ...{ metadata: { amount, currency } }
                }
            });
            res.status(201).json({
                success: true,
                data: {
                    id: qrCode.id,
                    qrImage: qrImagePath,
                    qrData,
                    expiresAt: qrCode.expiresAt
                }
            });
        }
        catch (error) {
            index_1.logger.error('Error creating QR code', { error: error instanceof Error ? error.message : String(error) });
            res.status(500).json({ error: 'Failed to create QR code' });
        }
    }
    async getQRCodes(req, res) {
        try {
            const user = req.user;
            const qrCodes = await database_1.prisma.qRCode.findMany({
                where: {
                    userId: user.id,
                    isActive: true
                },
                orderBy: { createdAt: 'desc' }
            });
            res.json({ success: true, data: qrCodes });
        }
        catch (error) {
            index_1.logger.error('Error fetching QR codes', { error: error instanceof Error ? error.message : String(error) });
            res.status(500).json({ error: 'Failed to fetch QR codes' });
        }
    }
    async deleteQRCode(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            const qrCode = await database_1.prisma.qRCode.findFirst({
                where: {
                    id,
                    userId: user.id
                }
            });
            if (!qrCode) {
                return res.status(404).json({ error: 'QR code not found' });
            }
            // Delete QR image file
            if (qrCode.qrImage) {
                await fs_extra_1.default.remove(`uploads/${qrCode.qrImage}`);
            }
            // Delete from database
            await database_1.prisma.qRCode.delete({
                where: { id }
            });
            res.json({ success: true, message: 'QR code deleted successfully' });
        }
        catch (error) {
            index_1.logger.error('Error deleting QR code', { error: error instanceof Error ? error.message : String(error) });
            res.status(500).json({ error: 'Failed to delete QR code' });
        }
    }
    extractPaymentInfo(text) {
        // Simple regex patterns to extract payment information
        const amountPattern = /(?:amount|total|sum)[\s:]*\$?(\d+(?:\.\d{2})?)/i;
        const referencePattern = /(?:reference|ref|transaction)[\s:]*([A-Za-z0-9]+)/i;
        const amountMatch = text.match(amountPattern);
        const referenceMatch = text.match(referencePattern);
        return {
            extractedText: text.substring(0, 1000), // Limit text length
            amount: amountMatch ? parseFloat(amountMatch[1]) : null,
            reference: referenceMatch ? referenceMatch[1] : null,
            confidence: 0.5 // Placeholder confidence score
        };
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
exports.ProofController = ProofController;
//# sourceMappingURL=ProofController.js.map