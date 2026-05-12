import QRCode from 'qrcode';
import crypto from 'crypto';
import { logger } from '../index';

export interface QRResult {
  data: QRData;
  images: Array<{ size: number; buffer: Buffer }>;
  primaryImage: Buffer;
  reference: string;
}

export interface QRData {
  version: string;
  type: 'payment_request' | 'encrypted_payment_request';
  recipient: string;
  amount?: number;
  currency?: string;
  description?: string;
  timestamp: string;
  expiry?: string;
  reference: string;
  checksum?: string;
  encryptedPayload?: string;
}

export interface QROptions {
  amount: number;
  currency?: string;
  recipientId: string;
  description?: string;
  expiryHours?: number;
  encryptionKey?: string;
  sizes?: number[];
}

export class EnhancedQRService {
  private readonly defaultSizes = [150, 300, 600];
  private readonly encryptionAlgorithm = 'aes-256-cbc';

  async generatePaymentQR(options: QROptions): Promise<QRResult> {
    try {
      const qrData: QRData = {
        version: '1.1',
        type: options.encryptionKey ? 'encrypted_payment_request' : 'payment_request',
        recipient: options.recipientId,
        amount: options.amount,
        currency: options.currency || 'USD',
        description: options.description || 'Payment Proof Request',
        timestamp: new Date().toISOString(),
        reference: crypto.randomUUID(),
        expiry: options.expiryHours
          ? new Date(Date.now() + options.expiryHours * 60 * 60 * 1000).toISOString()
          : undefined
      };

      let finalData: QRData;

      if (options.encryptionKey) {
        // Encrypt sensitive data
        const encryptedPayload = this.encryptQRData(qrData, options.encryptionKey);
        finalData = {
          version: qrData.version,
          type: 'encrypted_payment_request',
          recipient: qrData.recipient,
          timestamp: qrData.timestamp,
          reference: qrData.reference,
          encryptedPayload
        };
      } else {
        // Add checksum for data integrity
        finalData = {
          ...qrData,
          checksum: this.generateChecksum(qrData)
        };
      }

      // Generate QR codes in multiple sizes
      const sizes = options.sizes || this.defaultSizes;
      const qrImages = await Promise.all(
        sizes.map(async size => ({
          size,
          buffer: await this.generateQRBuffer(finalData, size)
        }))
      );

      const result: QRResult = {
        data: finalData,
        images: qrImages,
        primaryImage: qrImages.find(img => img.size === 300)?.buffer || qrImages[0].buffer,
        reference: finalData.reference
      };

      logger.info('QR code generated successfully', {
        reference: finalData.reference,
        type: finalData.type,
        encrypted: !!options.encryptionKey
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('QR code generation failed', { error: errorMessage });
      throw new Error(`QR code generation failed: ${errorMessage}`);
    }
  }

  async generateQRBuffer(data: QRData, size: number = 300): Promise<Buffer> {
    const qrString = JSON.stringify(data);

    const result: any = await QRCode.toBuffer(qrString, {
      width: size,
      margin: Math.max(2, Math.floor(size / 100)), // Responsive margin
      errorCorrectionLevel: this.getErrorCorrectionLevel(size),
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    } as any);
    
    return Buffer.isBuffer(result) ? result : Buffer.from(result);
  }

  private getErrorCorrectionLevel(size: number): 'L' | 'M' | 'Q' | 'H' {
    // Use higher error correction for smaller codes
    if (size < 200) return 'H'; // 30% error correction
    if (size < 400) return 'Q'; // 25% error correction
    if (size < 600) return 'M'; // 15% error correction
    return 'L'; // 7% error correction
  }

  async validateQRData(qrString: string): Promise<{ valid: boolean; data?: QRData; error?: string }> {
    try {
      const qrData: QRData = JSON.parse(qrString);

      // Basic structure validation
      if (!qrData.version || !qrData.type || !qrData.recipient || !qrData.timestamp) {
        return { valid: false, error: 'Invalid QR structure' };
      }

      // Version compatibility check
      if (qrData.version !== '1.0' && qrData.version !== '1.1') {
        return { valid: false, error: 'Unsupported QR version' };
      }

      // Expiry check
      if (qrData.expiry && new Date(qrData.expiry) < new Date()) {
        return { valid: false, error: 'QR code has expired' };
      }

      if (qrData.type === 'payment_request' && qrData.checksum) {
        // Validate checksum
        const expectedChecksum = this.generateChecksum(qrData);
        if (expectedChecksum !== qrData.checksum) {
          return { valid: false, error: 'Invalid checksum' };
        }
      }

      return { valid: true, data: qrData };

    } catch (error) {
      return { valid: false, error: 'Invalid QR format' };
    }
  }

  async decryptQRData(encryptedPayload: string, encryptionKey: string): Promise<QRData> {
    try {
      const decryptedString = this.decryptQRDataInternal(encryptedPayload, encryptionKey);
      const qrData: QRData = JSON.parse(decryptedString);

      // Validate decrypted data
      if (!qrData.version || qrData.type !== 'encrypted_payment_request') {
        throw new Error('Invalid decrypted QR data');
      }

      return qrData;

    } catch (error) {
      logger.error('QR data decryption failed', { error: error instanceof Error ? error.message : String(error) });
      throw new Error('Failed to decrypt QR data');
    }
  }

  private generateChecksum(data: QRData): string {
    // Create a string representation excluding the checksum field
    const dataString = JSON.stringify({
      version: data.version,
      type: data.type,
      recipient: data.recipient,
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      timestamp: data.timestamp,
      expiry: data.expiry,
      reference: data.reference
    });

    // Generate SHA-256 hash and return first 8 characters
    return crypto.createHash('sha256').update(dataString).digest('hex').substring(0, 8);
  }

  private encryptQRData(data: QRData, key: string): string {
    const dataString = JSON.stringify(data);
    const iv = crypto.randomBytes(16); // AES block size

    const cipher = crypto.createCipher(this.encryptionAlgorithm, key);
    let encrypted = cipher.update(dataString, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Combine IV and encrypted data
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptQRDataInternal(encryptedPayload: string, key: string): string {
    const [ivHex, encrypted] = encryptedPayload.split(':');
    const iv = Buffer.from(ivHex, 'hex');

    const decipher = crypto.createDecipher(this.encryptionAlgorithm, key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Generate QR with custom styling
  async generateStyledQR(options: QROptions & {
    logo?: Buffer;
    logoSize?: number;
    backgroundColor?: string;
    foregroundColor?: string;
  }): Promise<QRResult> {
    const baseResult = await this.generatePaymentQR(options);

    // Apply custom styling if requested
    if (options.logo || options.backgroundColor || options.foregroundColor) {
      // Note: This would require additional image processing libraries
      // For now, return base result
      logger.warn('Styled QR generation not fully implemented');
    }

    return baseResult;
  }

  // Batch QR generation for multiple payments
  async generateBatchQRs(options: QROptions[]): Promise<QRResult[]> {
    const results = await Promise.allSettled(
      options.map(option => this.generatePaymentQR(option))
    );

    const successful: QRResult[] = [];
    const failed: any[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successful.push(result.value);
      } else {
        failed.push({
          index,
          error: result.reason.message,
          options: options[index]
        });
      }
    });

    if (failed.length > 0) {
      logger.warn('Some QR codes failed to generate', { failedCount: failed.length, failures: failed });
    }

    logger.info('Batch QR generation completed', {
      requested: options.length,
      successful: successful.length,
      failed: failed.length
    });

    return successful;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const testData: QRData = {
        version: '1.0',
        type: 'payment_request',
        recipient: 'test-user',
        amount: 100,
        currency: 'USD',
        timestamp: new Date().toISOString(),
        reference: 'test-ref'
      };

      await this.generateQRBuffer(testData, 100);
      return true;
    } catch {
      return false;
    }
  }
}

// Global QR service instance
export const enhancedQRService = new EnhancedQRService();