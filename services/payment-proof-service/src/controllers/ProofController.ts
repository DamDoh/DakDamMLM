import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import QRCode from 'qrcode';
import { AuthRequest } from '../middleware/authMiddleware';
import { logger } from '../index';
import { FileEncryptionService } from '../services/FileEncryptionService';
import { FraudDetectionService } from '../services/FraudDetectionService';
import { NotificationService } from '../services/NotificationService';

import { prisma } from '../config/database';

export class ProofController {
  private fileEncryptionService = new FileEncryptionService();
  private fraudDetectionService = new FraudDetectionService();
  private notificationService = new NotificationService();

  async uploadProof(req: AuthRequest, res: Response) {
    try {
      const user = (req as any).user!;
      const { orderId, amount } = (req as any).body;
      const file = (req as any).file;

      if (!file) {
        return (res as any).status(400).json({ error: 'No file uploaded' });
      }

      // Validate order exists and belongs to user
      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          userId: user.id,
          status: 'pending'
        }
      });

      if (!order) {
        return (res as any).status(404).json({ error: 'Order not found or not eligible for payment proof' });
      }

      // Check for duplicate file hash
      const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
      const existingProof = await (prisma as any).paymentProof.findFirst({
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
        return (res as any).status(400).json({ error: 'This file has already been uploaded' });
      }

      // Perform OCR if it's an image
      let ocrData = null;
      if (file.mimetype.startsWith('image/')) {
        try {
          const worker = await createWorker('eng');
          const { data: { text } } = await worker.recognize(file.buffer);
          await worker.terminate();

          // Extract potential payment information
          ocrData = this.extractPaymentInfo(text);
        } catch (error) {
          logger.warn('OCR processing failed', { error: error instanceof Error ? error.message : String(error) });
        }
      }

      // Encrypt and store file
      const encryptedPath = await this.fileEncryptionService.encryptAndStoreFile(
        file.buffer,
        file.originalname,
        user.id
      );

      // Create payment proof record
      const proof = await (prisma as any).paymentProof.create({
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
      await (prisma as any).transaction.create({
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
      await (prisma as any).auditLog.create({
        data: {
          userId: user.id,
          action: 'upload_proof',
          entity: 'payment_proof',
          entityId: proof.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          ...({ metadata: { orderId, fileSize: file.size } } as any)
        }
      });

      // Send notification to upline
      await this.notificationService.notifyUplineOfNewProof(proof.id);

      // Record metric
      await this.recordMetric('upload_count', 1, { user_role: user.role });

      logger.info('Payment proof uploaded successfully', { proofId: proof.id, userId: user.id });

      (res as any).status(201).json({
        success: true,
        data: {
          id: proof.id,
          status: proof.status,
          uploadedAt: proof.createdAt
        }
      });

    } catch (error) {
      logger.error('Error uploading payment proof', { error: error instanceof Error ? error.message : String(error) });
      (res as any).status(500).json({ error: 'Failed to upload payment proof' });
    }
  }

  async getProofs(req: AuthRequest, res: Response) {
    try {
      const user = (req as any).user!;
      const { page = 1, limit = 10, status } = req.query;

      const where: any = {};

      if (user.role === 'buyer') {
        where.userId = user.id;
      } else if (user.role === 'upline') {
        // Get proofs from downlines
        const downlineUsers = await prisma.user.findMany({
          where: { ...({ sponsorId: user.id } as any) },
          select: { id: true }
        });
        where.userId = { in: downlineUsers.map((u: { id: string }) => u.id) };
      }

      if (status) {
        where.status = status;
      }

      const proofs = await (prisma as any).paymentProof.findMany({
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
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string)
      });

      const total = await (prisma as any).paymentProof.count({ where });

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
      logger.error('Error fetching proofs', { error: error instanceof Error ? error.message : String(error) });
      (res as any).status(500).json({ error: 'Failed to fetch proofs' });
    }
  }

  async getProof(req: AuthRequest, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user!;

      const proof = await (prisma as any).paymentProof.findUnique({
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
        return (res as any).status(404).json({ error: 'Proof not found' });
      }

      // Check permissions
      if (user.role === 'buyer' && proof.userId !== user.id) {
        return (res as any).status(403).json({ error: 'Access denied' });
      }

      if (user.role === 'upline' && proof.userId !== user.id && proof.order.userId !== user.uplineId) {
        return (res as any).status(403).json({ error: 'Access denied' });
      }

      (res as any).json({ success: true, data: proof });

    } catch (error) {
      logger.error('Error fetching proof', { error: error instanceof Error ? error.message : String(error) });
      (res as any).status(500).json({ error: 'Failed to fetch proof' });
    }
  }

  async downloadProof(req: AuthRequest, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user!;

      const proof = await (prisma as any).paymentProof.findUnique({
        where: { id }
      });

      if (!proof) {
        return (res as any).status(404).json({ error: 'Proof not found' });
      }

      // Check permissions
      if (user.role === 'buyer' && proof.userId !== user.id) {
        return (res as any).status(403).json({ error: 'Access denied' });
      }

      // Decrypt and serve file
      const decryptedBuffer = await this.fileEncryptionService.decryptFile(proof.encryptedPath);

      (res as any).setHeader('Content-Type', proof.fileType);
      (res as any).setHeader('Content-Disposition', `attachment; filename="${proof.fileName}"`);
      (res as any).send(decryptedBuffer);

    } catch (error) {
      logger.error('Error downloading proof', { error: error instanceof Error ? error.message : String(error) });
      (res as any).status(500).json({ error: 'Failed to download proof' });
    }
  }

  async deleteProof(req: AuthRequest, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user!;

      const proof = await (prisma as any).paymentProof.findUnique({
        where: { id }
      });

      if (!proof) {
        return (res as any).status(404).json({ error: 'Proof not found' });
      }

      // Only admins can delete proofs
      if (user.role !== 'admin') {
        return (res as any).status(403).json({ error: 'Access denied' });
      }

      // Delete encrypted file
      await this.fileEncryptionService.deleteFile(proof.encryptedPath);

      // Delete from database
      await (prisma as any).paymentProof.delete({
        where: { id }
      });

      // Log audit event
      await (prisma as any).auditLog.create({
        data: {
          userId: user.id,
          action: 'delete_proof',
          entity: 'payment_proof',
          entityId: id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      (res as any).json({ success: true, message: 'Proof deleted successfully' });

    } catch (error) {
      logger.error('Error deleting proof', { error: error instanceof Error ? error.message : String(error) });
      (res as any).status(500).json({ error: 'Failed to delete proof' });
    }
  }

  async createQRCode(req: AuthRequest, res: Response) {
    try {
      const user = (req as any).user!;
      const { amount, currency = 'USD' } = (req as any).body;

      // Generate QR code data
      const qrData = {
        type: 'payment',
        recipient: user.id,
        amount,
        currency,
        timestamp: new Date().toISOString(),
        reference: crypto.randomUUID()
      };

      // Generate QR code image
      const qrImageBuffer = await QRCode.toBuffer(JSON.stringify(qrData), {
        type: 'png',
        width: 256,
        margin: 2
      });

      // Store QR code image
      const qrImagePath = `qr-codes/${user.id}/${Date.now()}.png`;
      await fs.ensureDir(path.dirname(`uploads/${qrImagePath}`));
      await fs.writeFile(`uploads/${qrImagePath}`, qrImageBuffer);

      // Create QR code record
      const qrCode = await (prisma as any).qRCode.create({
        data: {
          userId: user.id,
          qrData: JSON.stringify(qrData),
          qrImage: qrImagePath,
          amount: parseFloat(amount),
          currency
        }
      });

      // Log audit event
      await (prisma as any).auditLog.create({
        data: {
          userId: user.id,
          action: 'create_qr_code',
          entity: 'qr_code',
          entityId: qrCode.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          ...({ metadata: { amount, currency } } as any)
        }
      });

      (res as any).status(201).json({
        success: true,
        data: {
          id: qrCode.id,
          qrImage: qrImagePath,
          qrData,
          expiresAt: qrCode.expiresAt
        }
      });

    } catch (error) {
      logger.error('Error creating QR code', { error: error instanceof Error ? error.message : String(error) });
      (res as any).status(500).json({ error: 'Failed to create QR code' });
    }
  }

  async getQRCodes(req: AuthRequest, res: Response) {
    try {
      const user = (req as any).user!;

      const qrCodes = await (prisma as any).qRCode.findMany({
        where: {
          userId: user.id,
          isActive: true
        },
        orderBy: { createdAt: 'desc' }
      });

      (res as any).json({ success: true, data: qrCodes });

    } catch (error) {
      logger.error('Error fetching QR codes', { error: error instanceof Error ? error.message : String(error) });
      (res as any).status(500).json({ error: 'Failed to fetch QR codes' });
    }
  }

  async deleteQRCode(req: AuthRequest, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user!;

      const qrCode = await (prisma as any).qRCode.findFirst({
        where: {
          id,
          userId: user.id
        }
      });

      if (!qrCode) {
        return (res as any).status(404).json({ error: 'QR code not found' });
      }

      // Delete QR image file
      if (qrCode.qrImage) {
        await fs.remove(`uploads/${qrCode.qrImage}`);
      }

      // Delete from database
      await (prisma as any).qRCode.delete({
        where: { id }
      });

      (res as any).json({ success: true, message: 'QR code deleted successfully' });

    } catch (error) {
      logger.error('Error deleting QR code', { error: error instanceof Error ? error.message : String(error) });
      (res as any).status(500).json({ error: 'Failed to delete QR code' });
    }
  }

  private extractPaymentInfo(text: string): any {
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