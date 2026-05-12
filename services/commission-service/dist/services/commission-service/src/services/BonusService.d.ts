interface BonusQuery {
    page: number;
    limit: number;
    type?: string;
    period?: string;
    startDate?: string;
    endDate?: string;
}
interface BonusAnalyticsQuery {
    period: string;
    startDate?: string;
    endDate?: string;
}
export declare class BonusService {
    calculateBonuses(period: string): Promise<{
        id: string;
        userId: string;
        type: string;
        amount: number;
        description: string;
        period: string;
        achievedAt: Date;
    }[]>;
    getBonuses(query: BonusQuery): Promise<{
        bonuses: ({
            user: {
                id: string;
                memberId: string | null;
                fullName: string;
                rank: string;
            };
        } & {
            id: string;
            userId: string;
            type: import(".prisma/client").$Enums.BonusType;
            amount: number;
            paidAt: Date | null;
            createdAt: Date;
            description: string;
            period: string;
            achievedAt: Date;
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
    getBonusById(bonusId: string): Promise<({
        user: {
            id: string;
            memberId: string | null;
            fullName: string;
            rank: string;
        };
    } & {
        id: string;
        userId: string;
        type: import(".prisma/client").$Enums.BonusType;
        amount: number;
        paidAt: Date | null;
        createdAt: Date;
        description: string;
        period: string;
        achievedAt: Date;
    }) | null>;
    getUserBonuses(userId: string, page?: number, limit?: number, type?: string, period?: string): Promise<{
        bonuses: {
            id: string;
            userId: string;
            type: import(".prisma/client").$Enums.BonusType;
            amount: number;
            paidAt: Date | null;
            createdAt: Date;
            description: string;
            period: string;
            achievedAt: Date;
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
    getBonusAnalytics(query: BonusAnalyticsQuery): Promise<{
        period: string;
        startDate: Date;
        endDate: Date;
        totalBonuses: number;
        totalAmount: number;
        bonusesByType: {
            type: import(".prisma/client").$Enums.BonusType;
            count: number;
            amount: number;
        }[];
        topPerformers: {
            userId: string;
            name: string;
            memberId: string;
            bonusCount: number;
            totalBonus: number;
        }[];
    }>;
    private calculateFastStartBonuses;
    private calculateMonthlyBonuses;
    private calculateQuarterlyBonuses;
    private calculateAnnualBonuses;
    private calculateRankAdvancementBonuses;
    private getRankAdvancementBonus;
    private getDateRange;
}
export {};
//# sourceMappingURL=BonusService.d.ts.map