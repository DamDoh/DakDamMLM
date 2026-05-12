import crypto from 'crypto';
import sharp from 'sharp';
import { prisma } from '../config/database';
import { logger } from '../index';

export class FraudDetectionService {
  // Calculate perceptual hash for image similarity detection
  async calculatePerceptualHash(buffer: Buffer): Promise<string> {
    try {
      // Resize image to 8x8 for hashing
      const resizedBuffer = await sharp(buffer)
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
    } catch (error) {
      logger.error('Error calculating perceptual hash', { error: error instanceof Error ? error.message : String(error) });
      return '';
    }
  }

  // Calculate Hamming distance between two hashes
  calculateHammingDistance(hash1: string, hash2: string): number {
    let distance = 0;
    for (let i = 0; i < Math.min(hash1.length, hash2.length); i++) {
      if (hash1[i] !== hash2[i]) {
        distance++;
      }
    }
    return distance;
  }

  // Check for duplicate images using perceptual hashing
  async checkForDuplicateImages(buffer: Buffer, userId: string): Promise<boolean> {
    try {
      const currentHash = await this.calculatePerceptualHash(buffer);

      if (!currentHash) {
        return false; // Skip if hash calculation failed
      }

      // Get recent proofs from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentProofs = await (prisma as any).paymentProof.findMany({
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
            logger.warn('High similarity detected between images', {
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
    } catch (error) {
      logger.error('Error checking for duplicate images', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  // Detect suspicious upload patterns
  async detectSuspiciousPatterns(userId: string, ipAddress: string): Promise<any[]> {
    const alerts = [];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    try {
      // Check upload frequency in the last hour
      const recentUploads = await (prisma as any).paymentProof.count({
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
      const recentIPs = await (prisma as any).paymentProof.findMany({
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
      const lastUploads = await (prisma as any).paymentProof.findMany({
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
    } catch (error) {
      logger.error('Error detecting suspicious patterns', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  // Validate payment amount consistency
  async validateAmountConsistency(proofId: string, extractedAmount: number | null): Promise<boolean> {
    try {
      const proof = await (prisma as any).paymentProof.findUnique({
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
        logger.warn('Amount inconsistency detected', {
          proofId,
          orderAmount,
          extractedAmount,
          difference,
          tolerance
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error validating amount consistency', { error: error instanceof Error ? error.message : String(error) });
      return true; // Default to valid if validation fails
    }
  }

  // Create fraud alert
  async createAlert(alertData: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    proofId?: string;
    userId?: string;
    indicators: Record<string, any>;
    confidence?: number;
  }): Promise<void> {
    try {
      await (prisma as any).fraudAlert.create({
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

      logger.warn('Fraud alert created', alertData);

      // TODO: Send notification to admins for high-severity alerts
      if (alertData.severity === 'high' || alertData.severity === 'critical') {
        // Trigger immediate notification
        await this.notifyAdminsOfFraudAlert(alertData);
      }
    } catch (error) {
      logger.error('Error creating fraud alert', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Get fraud statistics
  async getFraudStats(timeRange: 'day' | 'week' | 'month' = 'week'): Promise<any> {
    try {
      const now = new Date();
      let startDate: Date;

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

      const alerts = await (prisma as any).fraudAlert.findMany({
        where: {
          createdAt: {
            gte: startDate
          }
        }
      });

      const stats = {
        total: alerts.length,
        byType: {} as Record<string, number>,
        bySeverity: {} as Record<string, number>,
        resolved: alerts.filter((a: any) => a.status === 'resolved').length,
        unresolved: alerts.filter((a: any) => a.status !== 'resolved').length
      };

      alerts.forEach((alert: any) => {
        stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
        stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;
      });

      return stats;
    } catch (error) {
      logger.error('Error getting fraud stats', { error: error instanceof Error ? error.message : String(error) });
      return {};
    }
  }

  // Machine learning-based anomaly detection (placeholder)
  async detectAnomalies(userId: string, metrics: Record<string, number>): Promise<any[]> {
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

  private async notifyAdminsOfFraudAlert(alertData: any): Promise<void> {
    // TODO: Implement admin notification
    logger.info('Admin notification triggered for fraud alert', alertData);
  }
}