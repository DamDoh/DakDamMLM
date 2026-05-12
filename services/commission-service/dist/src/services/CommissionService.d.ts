interface CommissionQuery {
    page: number;
    limit: number;
    status?: string;
    type?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
}
interface CommissionAnalyticsQuery {
    period: string;
    startDate?: string;
    endDate?: string;
}
export declare class CommissionService {
    calculateCommissions(orderId: string): Promise<any[]>;
    getCommissions(query: CommissionQuery): Promise<{
        commissions: {
            id: string;
            userId: string;
            orderId: string | null;
            type: import(".prisma/client").$Enums.CommissionType;
            level: number;
            amount: number;
            percentage: number;
            status: import(".prisma/client").$Enums.CommissionStatus;
            paidAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
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
    getCommissionById(commissionId: string): Promise<any>;
    getUserCommissions(userId: string, page?: number, limit?: number, status?: string): Promise<{
        commissions: {
            id: string;
            userId: string;
            orderId: string | null;
            type: import(".prisma/client").$Enums.CommissionType;
            level: number;
            amount: number;
            percentage: number;
            status: import(".prisma/client").$Enums.CommissionStatus;
            paidAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
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
    getUserCommissionStats(userId: string, period: string): Promise<{
        userId: string;
        period: string;
        startDate: Date;
        endDate: Date;
        totalCommissions: number;
        totalAmount: number;
        commissionsByType: {
            type: import(".prisma/client").$Enums.CommissionType;
            count: number;
            amount: number;
        }[];
        averageCommission: number;
    }>;
    updateCommissionStatus(commissionId: string, status: string): Promise<{
        id: string;
        userId: string;
        orderId: string | null;
        type: import(".prisma/client").$Enums.CommissionType;
        level: number;
        amount: number;
        percentage: number;
        status: import(".prisma/client").$Enums.CommissionStatus;
        paidAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteCommission(commissionId: string): Promise<void>;
    getCommissionAnalytics(query: CommissionAnalyticsQuery): Promise<{
        period: string;
        startDate: Date;
        endDate: Date;
        totalCommissions: number;
        totalAmount: number;
        paidAmount: number;
        pendingAmount: number;
        averageCommission: number;
        commissionsByType: {
            type: import(".prisma/client").$Enums.CommissionType;
            count: number;
            amount: number;
        }[];
        commissionsByLevel: {
            level: number;
            count: number;
            amount: number;
        }[];
        commissionsByStatus: {
            status: import(".prisma/client").$Enums.CommissionStatus;
            count: number;
            amount: number;
        }[];
        topEarners: {
            userId: string;
            name: any;
            memberId: any;
            totalEarned: number;
            commissionCount: number;
        }[];
    }>;
    private calculateNetworkCommissions;
    private calculateBinaryCommissions;
    private calculateBinaryFromGenealogy;
    private calculateUnilevelCommissions;
    private getActiveCommissionRules;
    private saveCommissionCalculations;
    private queueCommissionNotifications;
    private getDateRange;
    healthCheck(): Promise<{
        status: string;
        timestamp: string;
    }>;
}
export {};
//# sourceMappingURL=CommissionService.d.ts.map