"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhancedQRService = exports.EnhancedQRService = void 0;
const qrcode_1 = __importDefault(require("qrcode"));
const crypto_1 = __importDefault(require("crypto"));
const index_1 = require("../index");
class EnhancedQRService {
    constructor() {
        this.defaultSizes = [150, 300, 600];
        this.encryptionAlgorithm = 'aes-256-cbc';
    }
    async generatePaymentQR(options) {
        try {
            const qrData = {
                version: '1.1',
                type: options.encryptionKey ? 'encrypted_payment_request' : 'payment_request',
                recipient: options.recipientId,
                amount: options.amount,
                currency: options.currency || 'USD',
                description: options.description || 'Payment Proof Request',
                timestamp: new Date().toISOString(),
                reference: crypto_1.default.randomUUID(),
                expiry: options.expiryHours
                    ? new Date(Date.now() + options.expiryHours * 60 * 60 * 1000).toISOString()
                    : undefined
            };
            let finalData;
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
            }
            else {
                // Add checksum for data integrity
                finalData = {
                    ...qrData,
                    checksum: this.generateChecksum(qrData)
                };
            }
            // Generate QR codes in multiple sizes
            const sizes = options.sizes || this.defaultSizes;
            const qrImages = await Promise.all(sizes.map(async (size) => ({
                size,
                buffer: await this.generateQRBuffer(finalData, size)
            })));
            const result = {
                data: finalData,
                images: qrImages,
                primaryImage: qrImages.find(img => img.size === 300)?.buffer || qrImages[0].buffer,
                reference: finalData.reference
            };
            index_1.logger.info('QR code generated successfully', {
                reference: finalData.reference,
                type: finalData.type,
                encrypted: !!options.encryptionKey
            });
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            index_1.logger.error('QR code generation failed', { error: errorMessage });
            throw new Error(`QR code generation failed: ${errorMessage}`);
        }
    }
    async generateQRBuffer(data, size = 300) {
        const qrString = JSON.stringify(data);
        const result = await qrcode_1.default.toBuffer(qrString, {
            width: size,
            margin: Math.max(2, Math.floor(size / 100)), // Responsive margin
            errorCorrectionLevel: this.getErrorCorrectionLevel(size),
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        return Buffer.isBuffer(result) ? result : Buffer.from(result);
    }
    getErrorCorrectionLevel(size) {
        // Use higher error correction for smaller codes
        if (size < 200)
            return 'H'; // 30% error correction
        if (size < 400)
            return 'Q'; // 25% error correction
        if (size < 600)
            return 'M'; // 15% error correction
        return 'L'; // 7% error correction
    }
    async validateQRData(qrString) {
        try {
            const qrData = JSON.parse(qrString);
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
        }
        catch (error) {
            return { valid: false, error: 'Invalid QR format' };
        }
    }
    async decryptQRData(encryptedPayload, encryptionKey) {
        try {
            const decryptedString = this.decryptQRDataInternal(encryptedPayload, encryptionKey);
            const qrData = JSON.parse(decryptedString);
            // Validate decrypted data
            if (!qrData.version || qrData.type !== 'encrypted_payment_request') {
                throw new Error('Invalid decrypted QR data');
            }
            return qrData;
        }
        catch (error) {
            index_1.logger.error('QR data decryption failed', { error: error instanceof Error ? error.message : String(error) });
            throw new Error('Failed to decrypt QR data');
        }
    }
    generateChecksum(data) {
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
        return crypto_1.default.createHash('sha256').update(dataString).digest('hex').substring(0, 8);
    }
    encryptQRData(data, key) {
        const dataString = JSON.stringify(data);
        const iv = crypto_1.default.randomBytes(16); // AES block size
        const cipher = crypto_1.default.createCipher(this.encryptionAlgorithm, key);
        let encrypted = cipher.update(dataString, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        // Combine IV and encrypted data
        return iv.toString('hex') + ':' + encrypted;
    }
    decryptQRDataInternal(encryptedPayload, key) {
        const [ivHex, encrypted] = encryptedPayload.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto_1.default.createDecipher(this.encryptionAlgorithm, key);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    // Generate QR with custom styling
    async generateStyledQR(options) {
        const baseResult = await this.generatePaymentQR(options);
        // Apply custom styling if requested
        if (options.logo || options.backgroundColor || options.foregroundColor) {
            // Note: This would require additional image processing libraries
            // For now, return base result
            index_1.logger.warn('Styled QR generation not fully implemented');
        }
        return baseResult;
    }
    // Batch QR generation for multiple payments
    async generateBatchQRs(options) {
        const results = await Promise.allSettled(options.map(option => this.generatePaymentQR(option)));
        const successful = [];
        const failed = [];
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                successful.push(result.value);
            }
            else {
                failed.push({
                    index,
                    error: result.reason.message,
                    options: options[index]
                });
            }
        });
        if (failed.length > 0) {
            index_1.logger.warn('Some QR codes failed to generate', { failedCount: failed.length, failures: failed });
        }
        index_1.logger.info('Batch QR generation completed', {
            requested: options.length,
            successful: successful.length,
            failed: failed.length
        });
        return successful;
    }
    // Health check
    async healthCheck() {
        try {
            const testData = {
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
        }
        catch {
            return false;
        }
    }
}
exports.EnhancedQRService = EnhancedQRService;
// Global QR service instance
exports.enhancedQRService = new EnhancedQRService();
//# sourceMappingURL=EnhancedQRService.js.map