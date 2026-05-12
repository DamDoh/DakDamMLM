interface PayoutQuery {
    page: number;
    limit: number;
    status?: string;
    method?: string;
    startDate?: string;
    endDate?: string;
}
interface PayoutAnalyticsQuery {
    period: string;
    startDate?: string;
    endDate?: string;
}
export declare class PayoutService {
    createPayout(payoutData: any): Promise<any>;
    getPayouts(query: PayoutQuery): Promise<{
        payouts: any;
        pagination: {
            page: number;
            limit: number;
            total: any;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    getPayoutById(payoutId: string): Promise<any>;
    getUserPayouts(userId: string, page?: number, limit?: number, status?: string): Promise<{
        payouts: any;
        pagination: {
            page: number;
            limit: number;
            total: any;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    updatePayoutStatus(payoutId: string, status: string): Promise<any>;
    processPayout(payoutId: string): Promise<{
        success: boolean;
        reference: string | null;
        error: string | null;
    }>;
    getPayoutAnalytics(query: PayoutAnalyticsQuery): Promise<{
        period: string;
        startDate: Date;
        endDate: Date;
        totalPayouts: any;
        totalAmount: any;
        totalFees: any;
        totalNetAmount: any;
        successfulPayouts: any;
        failedPayouts: any;
        successRate: number;
        averageProcessingTime: number;
        payoutsByMethod: any;
        payoutsByStatus: any;
        monthlyTrends: {
            month: string;
            payoutCount: any;
            payoutAmount: any;
        }[];
    }>;
    private calculateFees;
    private processPayoutByMethod;
    private processBankTransfer;
    private processPayPal;
    private processWireTransfer;
    private processCrypto;
    private processGiftCard;
    private queuePayoutProcessing;
    private getMonthlyPayoutTrends;
    private calculateAverageProcessingTime;
    private getDateRange;
}
export {};
//# sourceMappingURL=PayoutService.d.ts.map