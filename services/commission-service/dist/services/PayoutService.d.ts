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
    createPayout(payoutData: any): Promise<{
        id: string;
        userId: string;
        amount: number;
        status: import(".prisma/client").$Enums.PayoutStatus;
        paidAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        method: import(".prisma/client").$Enums.PayoutMethod;
        reference: string | null;
        processedAt: Date | null;
        fees: number;
        netAmount: number;
    }>;
    getPayouts(query: PayoutQuery): Promise<{
        payouts: ({
            user: {
                id: string;
                memberId: string | null;
                fullName: string;
                email: string | null;
            };
        } & {
            id: string;
            userId: string;
            amount: number;
            status: import(".prisma/client").$Enums.PayoutStatus;
            paidAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
            method: import(".prisma/client").$Enums.PayoutMethod;
            reference: string | null;
            processedAt: Date | null;
            fees: number;
            netAmount: number;
        })[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    getPayoutById(payoutId: string): Promise<({
        user: {
            id: string;
            memberId: string | null;
            fullName: string;
            email: string | null;
        };
    } & {
        id: string;
        userId: string;
        amount: number;
        status: import(".prisma/client").$Enums.PayoutStatus;
        paidAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        method: import(".prisma/client").$Enums.PayoutMethod;
        reference: string | null;
        processedAt: Date | null;
        fees: number;
        netAmount: number;
    }) | null>;
    getUserPayouts(userId: string, page?: number, limit?: number, status?: string): Promise<{
        payouts: {
            id: string;
            userId: string;
            amount: number;
            status: import(".prisma/client").$Enums.PayoutStatus;
            paidAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
            method: import(".prisma/client").$Enums.PayoutMethod;
            reference: string | null;
            processedAt: Date | null;
            fees: number;
            netAmount: number;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    updatePayoutStatus(payoutId: string, status: string): Promise<{
        id: string;
        userId: string;
        amount: number;
        status: import(".prisma/client").$Enums.PayoutStatus;
        paidAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        method: import(".prisma/client").$Enums.PayoutMethod;
        reference: string | null;
        processedAt: Date | null;
        fees: number;
        netAmount: number;
    }>;
    processPayout(payoutId: string): Promise<{
        success: boolean;
        reference: string | null;
        error: string | null;
    }>;
    getPayoutAnalytics(query: PayoutAnalyticsQuery): Promise<{
        period: string;
        startDate: Date;
        endDate: Date;
        totalPayouts: number;
        totalAmount: number;
        totalFees: number;
        totalNetAmount: number;
        successfulPayouts: number;
        failedPayouts: number;
        successRate: number;
        averageProcessingTime: number;
        payoutsByMethod: {
            method: import(".prisma/client").$Enums.PayoutMethod;
            count: number;
            amount: number;
            fees: number;
        }[];
        payoutsByStatus: {
            status: import(".prisma/client").$Enums.PayoutStatus;
            count: number;
            amount: number;
        }[];
        monthlyTrends: {
            month: string;
            payoutCount: number;
            payoutAmount: number;
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