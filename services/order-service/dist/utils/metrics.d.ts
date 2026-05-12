declare class MetricsService {
    recordOrderCreation(status: 'success' | 'failed', paymentMethod?: string): void;
    recordOrderStatusChange(oldStatus: string, newStatus: string): void;
    startOrderProcessingTimer(operation: string): (labels?: Partial<Record<"operation", string | number>> | undefined) => number;
    recordProductQuery(category?: string): void;
    recordInventoryUpdate(changeType: string, reason: string): void;
    recordCartOperation(operation: string): void;
    recordOrderRevenue(amount: number, currency?: string, status?: string): void;
    setActiveOrders(count: number, status: string): void;
    setLowStockProducts(count: number): void;
    recordError(type: string, endpoint: string): void;
    recordCommissionTrigger(triggerType: string): void;
    startRequestTimer(method: string, route: string): (labels?: Partial<Record<"method" | "route" | "status_code", string | number>> | undefined) => number;
    observeRequest(method: string, route: string, statusCode: number, duration: number): void;
    startDatabaseQueryTimer(operation: string, table: string): (labels?: Partial<Record<"operation" | "table", string | number>> | undefined) => number;
    getMetrics(): Promise<string>;
    resetMetrics(): void;
    getRegistry(): import("prom-client").Registry<"text/plain; version=0.0.4; charset=utf-8">;
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        latency?: number;
    }>;
}
export declare const metricsService: MetricsService;
export default metricsService;
export declare const recordOrderCreation: (status: "success" | "failed", paymentMethod?: string) => void;
export declare const recordOrderStatusChange: (oldStatus: string, newStatus: string) => void;
export declare const recordProductQuery: (category?: string) => void;
export declare const recordInventoryUpdate: (changeType: string, reason: string) => void;
export declare const recordCartOperation: (operation: string) => void;
export declare const recordOrderRevenue: (amount: number, currency?: string, status?: string) => void;
export declare const recordError: (type: string, endpoint: string) => void;
export declare const recordCommissionTrigger: (triggerType: string) => void;
//# sourceMappingURL=metrics.d.ts.map