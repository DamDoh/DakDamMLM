interface RuleQuery {
    page: number;
    limit: number;
    type?: string;
    isActive?: boolean;
}
export declare class RuleService {
    createRule(ruleData: any): Promise<any>;
    getRules(query: RuleQuery): Promise<{
        rules: any;
        pagination: {
            page: number;
            limit: number;
            total: any;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    getRuleById(ruleId: string): Promise<any>;
    updateRule(ruleId: string, updates: any): Promise<any>;
    deleteRule(ruleId: string): Promise<void>;
    getActiveRules(): Promise<any>;
    getActiveRulesByType(type: string): Promise<any>;
    validateRule(ruleData: any): Promise<{
        valid: boolean;
        errors: string[];
    }>;
    getRuleAnalytics(ruleId: string): Promise<{
        ruleId: string;
        ruleName: any;
        ruleType: any;
        ruleLevel: any;
        percentage: any;
        totalUsage: number;
        totalCommissions: number;
        totalAmount: number;
        averageCommission: number;
        isActive: any;
        createdAt: any;
    }>;
    bulkUpdateRules(ruleUpdates: Array<{
        id: string;
        updates: any;
    }>): Promise<({
        id: string;
        success: boolean;
        data: any;
        error?: undefined;
    } | {
        id: string;
        success: boolean;
        error: string;
        data?: undefined;
    })[]>;
    cloneRule(ruleId: string, newName: string): Promise<any>;
    getRulesSummary(): Promise<{
        totalRules: any;
        activeRules: any;
        inactiveRules: number;
        rulesByType: any;
    }>;
    getApplicableRules(orderAmount: number, orderPV: number, userLevel?: number): Promise<any>;
    private checkRankCondition;
}
export {};
//# sourceMappingURL=RuleService.d.ts.map