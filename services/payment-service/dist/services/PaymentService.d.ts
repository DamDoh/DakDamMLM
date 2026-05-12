interface ProcessPaymentData {
    userId: string;
    orderId?: string;
    commissionId?: string;
    amount: number;
    currency: string;
    method: string;
    provider: string;
    paymentData?: any;
}
interface TransactionQuery {
    page: number;
    limit: number;
    status?: string;
    type?: string;
    method?: string;
    startDate?: string;
    endDate?: string;
}
interface AnalyticsQuery {
    period: string;
    startDate?: string;
    endDate?: string;
}
export declare class PaymentService {
    processPayment(paymentData: ProcessPaymentData): Promise<any>;
    processRefund(transactionId: string, amount: number, reason: string): Promise<any>;
    getTransactions(query: TransactionQuery): Promise<{
        transactions: any;
        pagination: {
            page: number;
            limit: number;
            total: any;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    getTransactionById(transactionId: string): Promise<any>;
    getUserTransactions(userId: string, page?: number, limit?: number, type?: string): Promise<{
        transactions: any;
        pagination: {
            page: number;
            limit: number;
            total: any;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    getPaymentAnalytics(query: AnalyticsQuery): Promise<{
        period: string;
        startDate: Date;
        endDate: Date;
        totalTransactions: any;
        totalVolume: any;
        averageTransactionValue: number;
        successRate: number;
        statusDistribution: any;
        paymentMethodDistribution: any;
        revenueByProvider: any;
    }>;
    getRevenueAnalytics(query: AnalyticsQuery): Promise<{
        period: string;
        startDate: Date;
        endDate: Date;
        revenueByPeriod: any;
        topPayingUsers: any;
    }>;
    private generateTransactionId;
    private processWithProvider;
    private processRefundWithProvider;
    private getDateRange;
}
export {};
//# sourceMappingURL=PaymentService.d.ts.map