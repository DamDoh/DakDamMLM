export declare class FraudDetectionService {
    calculatePerceptualHash(buffer: Buffer): Promise<string>;
    calculateHammingDistance(hash1: string, hash2: string): number;
    checkForDuplicateImages(buffer: Buffer, userId: string): Promise<boolean>;
    detectSuspiciousPatterns(userId: string, ipAddress: string): Promise<any[]>;
    validateAmountConsistency(proofId: string, extractedAmount: number | null): Promise<boolean>;
    createAlert(alertData: {
        type: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        description: string;
        proofId?: string;
        userId?: string;
        indicators: Record<string, any>;
        confidence?: number;
    }): Promise<void>;
    getFraudStats(timeRange?: 'day' | 'week' | 'month'): Promise<any>;
    detectAnomalies(userId: string, metrics: Record<string, number>): Promise<any[]>;
    private notifyAdminsOfFraudAlert;
}
//# sourceMappingURL=FraudDetectionService.d.ts.map