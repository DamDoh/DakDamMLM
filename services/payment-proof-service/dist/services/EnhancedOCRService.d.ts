export interface OCRResult {
    text: string;
    confidence: number;
    extractedData: PaymentData;
    regions: OCRRegion[];
    processingTime: number;
}
export interface PaymentData {
    primaryAmount: number | null;
    allAmounts: number[];
    primaryReference: string | null;
    allReferences: string[];
    transactionDate: string | null;
    bankName: string | null;
    confidence: number;
}
export interface OCRRegion {
    text: string;
    confidence: number;
    bbox: {
        x0: number;
        y0: number;
        x1: number;
        y1: number;
    };
}
export declare class EnhancedOCRService {
    private workerPool;
    private readonly poolSize;
    constructor();
    private initializeWorkerPool;
    processPaymentProof(buffer: Buffer, mimeType: string): Promise<OCRResult>;
    private preprocessImage;
    private extractPaymentData;
    private calculateConfidence;
    private processOCRRegions;
    private getAvailableWorker;
    private releaseWorker;
    cleanup(): Promise<void>;
    healthCheck(): Promise<boolean>;
}
export declare const enhancedOCRService: EnhancedOCRService;
//# sourceMappingURL=EnhancedOCRService.d.ts.map