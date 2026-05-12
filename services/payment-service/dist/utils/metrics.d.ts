declare class MetricsService {
    recordPaymentTransaction(status: 'success' | 'failed', method: string, provider: string): void;
    startPaymentProcessingTimer(method: string, provider: string): (labels?: Partial<Record<"method" | "provider", string | number>> | undefined) => number;
    setWalletBalanceTotal(amount: number): void;
    setActiveWallets(count: number): void;
    recordPayoutRequest(status: string, method: string): void;
    recordCommissionPayout(status: 'success' | 'failed'): void;
    setPendingPayouts(count: number): void;
    recordRefundRequest(status: string): void;
    recordPaymentError(type: string, provider: string): void;
    startRequestTimer(method: string, route: string): (labels?: Partial<Record<"method" | "route" | "status_code", string | number>> | undefined) => number;
    observeRequest(method: string, route: string, statusCode: number, duration: number): void;
    startDatabaseQueryTimer(operation: string, table: string): (labels?: Partial<Record<"operation" | "table", string | number>> | undefined) => number;
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
export declare const recordPaymentTransaction: (status: "success" | "failed", method: string, provider: string) => void;
export declare const recordPayoutRequest: (status: string, method: string) => void;
export declare const recordCommissionPayout: (status: "success" | "failed") => void;
export declare const recordRefundRequest: (status: string) => void;
export declare const recordPaymentError: (type: string, provider: string) => void;
//# sourceMappingURL=metrics.d.ts.map