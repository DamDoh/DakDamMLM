interface PayoutRequestData {
    userId: string;
    amount: number;
    method: string;
    accountDetails: any;
}
interface PayoutQuery {
    page: number;
    limit: number;
    status?: string;
    userId?: string;
}
interface AnalyticsQuery {
    period: string;
    startDate?: string;
    endDate?: string;
}
export declare class PayoutService {
    private walletService;
    constructor();
    requestPayout(payoutData: PayoutRequestData): Promise<any>;
    getPayoutRequests(query: PayoutQuery): Promise<{
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
    getPayoutRequestById(payoutId: string): Promise<any>;
    approvePayout(payoutId: string, notes?: string): Promise<any>;
    rejectPayout(payoutId: string, reason: string): Promise<any>;
    processPayout(payoutId: string): Promise<any>;
    processCommissionPayout(commissionId: string, userId: string, amount: number): Promise<{
        wallet: any;
        transaction: {
            type: string;
            amount: number;
            balanceBefore: any;
            balanceAfter: any;
            description: string;
        };
    }>;
    getPayoutAnalytics(query: AnalyticsQuery): Promise<{
        period: string;
        startDate: Date;
        endDate: Date;
        totalPayouts: any;
        totalVolume: any;
        totalFees: any;
        netVolume: number;
        pendingPayouts: any;
        statusDistribution: any;
        methodDistribution: any;
    }>;
    private processPayoutWithProvider;
    private getDateRange;
}
export {};
//# sourceMappingURL=PayoutService.d.ts.map