declare class MetricsService {
    recordCommissionCalculated(type: string, level: number): void;
    startCommissionCalculationTimer(orderCount: number, levelsCalculated: number): (labels?: Partial<Record<"order_count" | "levels_calculated", string | number>> | undefined) => number;
    recordCommissionPaid(method: string, status: 'success' | 'failed'): void;
    recordCommissionAmount(amount: number, type: string, currency?: string): void;
    recordPayoutProcessed(method: string, status: 'success' | 'failed'): void;
    startPayoutProcessingTimer(method: string): (labels?: Partial<Record<"method", string | number>> | undefined) => number;
    recordBonusAchieved(type: string, period: string): void;
    setActiveCommissionRules(count: number): void;
    setPendingCommissions(count: number): void;
    setPendingPayouts(count: number): void;
    startRequestTimer(method: string, route: string): (labels?: Partial<Record<"method" | "route" | "status_code", string | number>> | undefined) => number;
    observeRequest(method: string, route: string, statusCode: number, duration: number): void;
    getMetrics(): Promise<string>;
    resetMetrics(): void;
    getRegistry(): import("prom-client").Registry<"text/plain; version=0.0.4; charset=utf-8">;
    healthCheck(): Promise<{
        status: string;
        metrics?: any;
    }>;
}
export declare const metricsService: MetricsService;
export default metricsService;
export declare const recordCommissionCalculated: (type: string, level: number) => void;
export declare const recordCommissionPaid: (method: string, status: "success" | "failed") => void;
export declare const recordCommissionAmount: (amount: number, type: string, currency?: string) => void;
export declare const recordPayoutProcessed: (method: string, status: "success" | "failed") => void;
export declare const recordBonusAchieved: (type: string, period: string) => void;
//# sourceMappingURL=metrics.d.ts.map