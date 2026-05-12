interface WalletTransactionData {
    amount: number;
    description: string;
    referenceId?: string;
    referenceType?: string;
}
export declare class WalletService {
    getWallet(userId: string): Promise<any>;
    creditWallet(userId: string, transactionData: WalletTransactionData): Promise<{
        wallet: any;
        transaction: {
            type: string;
            amount: number;
            balanceBefore: any;
            balanceAfter: any;
            description: string;
        };
    }>;
    debitWallet(userId: string, transactionData: WalletTransactionData): Promise<{
        wallet: any;
        transaction: {
            type: string;
            amount: number;
            balanceBefore: any;
            balanceAfter: number;
            description: string;
        };
    }>;
    getWalletTransactions(userId: string, page?: number, limit?: number, type?: string): Promise<{
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
    getWalletBalance(userId: string): Promise<number>;
    holdAmount(userId: string, amount: number, description: string, referenceId?: string): Promise<any>;
    releaseHold(userId: string, amount: number, description: string, referenceId?: string): Promise<any>;
    getWalletAnalytics(): Promise<{
        totalWallets: any;
        totalBalance: any;
        averageBalance: number;
        transactionSummary: any;
        topEarners: any;
    }>;
    transferBetweenWallets(fromUserId: string, toUserId: string, amount: number, description: string): Promise<{
        fromWallet: any;
        toWallet: any;
    }>;
}
export {};
//# sourceMappingURL=WalletService.d.ts.map