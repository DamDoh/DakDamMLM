export interface QRResult {
    data: QRData;
    images: Array<{
        size: number;
        buffer: Buffer;
    }>;
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
export declare class EnhancedQRService {
    private readonly defaultSizes;
    private readonly encryptionAlgorithm;
    generatePaymentQR(options: QROptions): Promise<QRResult>;
    generateQRBuffer(data: QRData, size?: number): Promise<Buffer>;
    private getErrorCorrectionLevel;
    validateQRData(qrString: string): Promise<{
        valid: boolean;
        data?: QRData;
        error?: string;
    }>;
    decryptQRData(encryptedPayload: string, encryptionKey: string): Promise<QRData>;
    private generateChecksum;
    private encryptQRData;
    private decryptQRDataInternal;
    generateStyledQR(options: QROptions & {
        logo?: Buffer;
        logoSize?: number;
        backgroundColor?: string;
        foregroundColor?: string;
    }): Promise<QRResult>;
    generateBatchQRs(options: QROptions[]): Promise<QRResult[]>;
    healthCheck(): Promise<boolean>;
}
export declare const enhancedQRService: EnhancedQRService;
//# sourceMappingURL=EnhancedQRService.d.ts.map