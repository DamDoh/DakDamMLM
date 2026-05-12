interface RuleQuery {
    page: number;
    limit: number;
    type?: string;
    isActive?: boolean;
}
export declare class RuleService {
    createRule(ruleData: any): Promise<{
        name: string;
        id: string;
        type: import(".prisma/client").$Enums.CommissionType;
        level: number;
        percentage: number;
        createdAt: Date;
        updatedAt: Date;
        minAmount: number;
        maxAmount: number | null;
        isActive: boolean;
        conditions: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    getRules(query: RuleQuery): Promise<{
        rules: {
            name: string;
            id: string;
            type: import(".prisma/client").$Enums.CommissionType;
            level: number;
            percentage: number;
            createdAt: Date;
            updatedAt: Date;
            minAmount: number;
            maxAmount: number | null;
            isActive: boolean;
            conditions: import("@prisma/client/runtime/client").JsonValue | null;
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
    getRuleById(ruleId: string): Promise<{
        name: string;
        id: string;
        type: import(".prisma/client").$Enums.CommissionType;
        level: number;
        percentage: number;
        createdAt: Date;
        updatedAt: Date;
        minAmount: number;
        maxAmount: number | null;
        isActive: boolean;
        conditions: import("@prisma/client/runtime/client").JsonValue | null;
    } | null>;
    updateRule(ruleId: string, updates: any): Promise<{
        name: string;
        id: string;
        type: import(".prisma/client").$Enums.CommissionType;
        level: number;
        percentage: number;
        createdAt: Date;
        updatedAt: Date;
        minAmount: number;
        maxAmount: number | null;
        isActive: boolean;
        conditions: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    deleteRule(ruleId: string): Promise<void>;
    getActiveRules(): Promise<any>;
    getActiveRulesByType(type: string): Promise<any>;
    validateRule(ruleData: any): Promise<{
        valid: boolean;
        errors: string[];
    }>;
    getRuleAnalytics(ruleId: string): Promise<{
        ruleId: string;
        ruleName: string;
        ruleType: import(".prisma/client").$Enums.CommissionType;
        ruleLevel: number;
        percentage: number;
        totalUsage: number;
        totalCommissions: number;
        totalAmount: number;
        averageCommission: number;
        isActive: boolean;
        createdAt: Date;
    }>;
    bulkUpdateRules(ruleUpdates: Array<{
        id: string;
        updates: any;
    }>): Promise<({
        id: string;
        success: boolean;
        data: {
            name: string;
            id: string;
            type: import(".prisma/client").$Enums.CommissionType;
            level: number;
            percentage: number;
            createdAt: Date;
            updatedAt: Date;
            minAmount: number;
            maxAmount: number | null;
            isActive: boolean;
            conditions: import("@prisma/client/runtime/client").JsonValue | null;
        };
        error?: undefined;
    } | {
        id: string;
        success: boolean;
        error: string;
        data?: undefined;
    })[]>;
    cloneRule(ruleId: string, newName: string): Promise<{
        name: string;
        id: string;
        type: import(".prisma/client").$Enums.CommissionType;
        level: number;
        percentage: number;
        createdAt: Date;
        updatedAt: Date;
        minAmount: number;
        maxAmount: number | null;
        isActive: boolean;
        conditions: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    getRulesSummary(): Promise<{
        totalRules: number;
        activeRules: number;
        inactiveRules: number;
        rulesByType: {
            type: import(".prisma/client").$Enums.CommissionType;
            count: number;
        }[];
    }>;
    getApplicableRules(orderAmount: number, orderPV: number, userLevel?: number): Promise<{
        name: string;
        id: string;
        type: import(".prisma/client").$Enums.CommissionType;
        level: number;
        percentage: number;
        createdAt: Date;
        updatedAt: Date;
        minAmount: number;
        maxAmount: number | null;
        isActive: boolean;
        conditions: import("@prisma/client/runtime/client").JsonValue | null;
    }[]>;
    private checkRankCondition;
}
export {};
//# sourceMappingURL=RuleService.d.ts.map