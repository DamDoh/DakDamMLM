"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FraudDetectionService = void 0;
const sharp_1 = __importDefault(require("sharp"));
const database_1 = require("../config/database");
const index_1 = require("../index");
class FraudDetectionService {
    // Calculate perceptual hash for image similarity detection
    async calculatePerceptualHash(buffer) {
        try {
            // Resize image to 8x8 for hashing
            const resizedBuffer = await (0, sharp_1.default)(buffer)
                .resize(8, 8, { withoutEnlargement: true })
                .grayscale()
                .raw()
                .toBuffer();
            // Convert to binary hash
            let hash = '';
            for (let i = 0; i < resizedBuffer.length; i++) {
                hash += (resizedBuffer[i] > 128 ? '1' : '0');
            }
            return hash;
        }
        catch (error) {
            index_1.logger.error('Error calculating perceptual hash', { error: error instanceof Error ? error.message : String(error) });
            return '';
        }
    }
    // Calculate Hamming distance between two hashes
    calculateHammingDistance(hash1, hash2) {
        let distance = 0;
        for (let i = 0; i < Math.min(hash1.length, hash2.length); i++) {
            if (hash1[i] !== hash2[i]) {
                distance++;
            }
        }
        return distance;
    }
    // Check for duplicate images using perceptual hashing
    async checkForDuplicateImages(buffer, userId) {
        try {
            const currentHash = await this.calculatePerceptualHash(buffer);
            if (!currentHash) {
                return false; // Skip if hash calculation failed
            }
            // Get recent proofs from the last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const recentProofs = await database_1.prisma.paymentProof.findMany({
                where: {
                    createdAt: {
                        gte: thirtyDaysAgo
                    },
                    fileType: {
                        startsWith: 'image/'
                    }
                },
                select: {
                    id: true,
                    perceptualHash: true,
                    userId: true
                }
            });
            // Check similarity with existing images
            for (const proof of recentProofs) {
                if (proof.perceptualHash && proof.userId !== userId) {
                    const distance = this.calculateHammingDistance(currentHash, proof.perceptualHash);
                    const similarity = 1 - (distance / 64); // 64 bits for 8x8 hash
                    if (similarity > 0.9) { // 90% similarity threshold
                        index_1.logger.warn('High similarity detected between images', {
                            currentProofId: 'new',
                            existingProofId: proof.id,
                            similarity,
                            userId
                        });
                        return true;
                    }
                }
            }
            return false;
        }
        catch (error) {
            index_1.logger.error('Error checking for duplicate images', { error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    }
    // Detect suspicious upload patterns
    async detectSuspiciousPatterns(userId, ipAddress) {
        const alerts = [];
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        try {
            // Check upload frequency in the last hour
            const recentUploads = await database_1.prisma.paymentProof.count({
                where: {
                    userId,
                    createdAt: {
                        gte: oneHourAgo
                    }
                }
            });
            if (recentUploads > 10) {
                alerts.push({
                    type: 'high_upload_frequency',
                    severity: 'medium',
                    description: `User uploaded ${recentUploads} proofs in the last hour`,
                    threshold: 10
                });
            }
            // Check for multiple IPs used by same user in short time
            const recentIPs = await database_1.prisma.paymentProof.findMany({
                where: {
                    userId,
                    createdAt: {
                        gte: oneDayAgo
                    }
                },
                select: {
                    ipAddress: true
                },
                distinct: ['ipAddress']
            });
            if (recentIPs.length > 3) {
                alerts.push({
                    type: 'multiple_ip_addresses',
                    severity: 'low',
                    description: `User used ${recentIPs.length} different IP addresses in the last 24 hours`,
                    threshold: 3
                });
            }
            // Check for rapid successive uploads
            const lastUploads = await database_1.prisma.paymentProof.findMany({
                where: {
                    userId,
                    createdAt: {
                        gte: oneHourAgo
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: 5,
                select: {
                    createdAt: true
                }
            });
            if (lastUploads.length >= 3) {
                const timeDiffs = [];
                for (let i = 1; i < lastUploads.length; i++) {
                    timeDiffs.push(lastUploads[i - 1].createdAt.getTime() - lastUploads[i].createdAt.getTime());
                }
                const avgTimeDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
                if (avgTimeDiff < 30000) { // Less than 30 seconds average
                    alerts.push({
                        type: 'rapid_successive_uploads',
                        severity: 'medium',
                        description: 'User uploading proofs at unusually rapid intervals',
                        avgInterval: avgTimeDiff
                    });
                }
            }
            return alerts;
        }
        catch (error) {
            index_1.logger.error('Error detecting suspicious patterns', { error: error instanceof Error ? error.message : String(error) });
            return [];
        }
    }
    // Validate payment amount consistency
    async validateAmountConsistency(proofId, extractedAmount) {
        try {
            const proof = await database_1.prisma.paymentProof.findUnique({
                where: { id: proofId },
                include: { order: true }
            });
            if (!proof || !extractedAmount || !proof.order.amount) {
                return true; // Skip validation if data is missing
            }
            const orderAmount = proof.order.amount.toNumber();
            const difference = Math.abs(orderAmount - extractedAmount);
            const tolerance = Math.max(orderAmount * 0.05, 1); // 5% tolerance or $1 minimum
            if (difference > tolerance) {
                index_1.logger.warn('Amount inconsistency detected', {
                    proofId,
                    orderAmount,
                    extractedAmount,
                    difference,
                    tolerance
                });
                return false;
            }
            return true;
        }
        catch (error) {
            index_1.logger.error('Error validating amount consistency', { error: error instanceof Error ? error.message : String(error) });
            return true; // Default to valid if validation fails
        }
    }
    // Create fraud alert
    async createAlert(alertData) {
        try {
            await database_1.prisma.fraudAlert.create({
                data: {
                    type: alertData.type,
                    severity: alertData.severity,
                    description: alertData.description,
                    proofId: alertData.proofId,
                    userId: alertData.userId,
                    indicators: alertData.indicators,
                    confidence: alertData.confidence || 0.5
                }
            });
            index_1.logger.warn('Fraud alert created', alertData);
            // TODO: Send notification to admins for high-severity alerts
            if (alertData.severity === 'high' || alertData.severity === 'critical') {
                // Trigger immediate notification
                await this.notifyAdminsOfFraudAlert(alertData);
            }
        }
        catch (error) {
            index_1.logger.error('Error creating fraud alert', { error: error instanceof Error ? error.message : String(error) });
        }
    }
    // Get fraud statistics
    async getFraudStats(timeRange = 'week') {
        try {
            const now = new Date();
            let startDate;
            switch (timeRange) {
                case 'day':
                    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
            }
            const alerts = await database_1.prisma.fraudAlert.findMany({
                where: {
                    createdAt: {
                        gte: startDate
                    }
                }
            });
            const stats = {
                total: alerts.length,
                byType: {},
                bySeverity: {},
                resolved: alerts.filter((a) => a.status === 'resolved').length,
                unresolved: alerts.filter((a) => a.status !== 'resolved').length
            };
            alerts.forEach((alert) => {
                stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
                stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;
            });
            return stats;
        }
        catch (error) {
            index_1.logger.error('Error getting fraud stats', { error: error instanceof Error ? error.message : String(error) });
            return {};
        }
    }
    // Machine learning-based anomaly detection (placeholder)
    async detectAnomalies(userId, metrics) {
        // Placeholder for ML-based anomaly detection
        // In a real implementation, this would use trained models
        const anomalies = [];
        // Simple rule-based anomaly detection
        if (metrics.uploadFrequency > 20) {
            anomalies.push({
                type: 'upload_frequency_anomaly',
                severity: 'medium',
                description: 'Unusually high upload frequency detected'
            });
        }
        if (metrics.averageFileSize > 50 * 1024 * 1024) { // 50MB
            anomalies.push({
                type: 'file_size_anomaly',
                severity: 'low',
                description: 'Unusually large files being uploaded'
            });
        }
        return anomalies;
    }
    async notifyAdminsOfFraudAlert(alertData) {
        // TODO: Implement admin notification
        index_1.logger.info('Admin notification triggered for fraud alert', alertData);
    }
}
exports.FraudDetectionService = FraudDetectionService;
//# sourceMappingURL=FraudDetectionService.js.map