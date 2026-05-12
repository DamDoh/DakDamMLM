declare class MetricsService {
    recordNotificationSent(type: string, channel: string, status: 'success' | 'failed'): void;
    startNotificationProcessingTimer(channel: string, type: string): (labels?: Partial<Record<"type" | "channel", string | number>> | undefined) => number;
    setNotificationsQueued(count: number): void;
    recordNotificationFailed(channel: string, reason: string): void;
    setTemplatesActive(count: number): void;
    setCampaignsActive(count: number): void;
    setUserPreferencesTotal(count: number): void;
    startRequestTimer(method: string, route: string): (labels?: Partial<Record<"method" | "route" | "status_code", string | number>> | undefined) => number;
    observeRequest(method: string, route: string, statusCode: number, duration: number): void;
    startTemplateRenderingTimer(templateId: string): (labels?: Partial<Record<"template_id", string | number>> | undefined) => number;
    recordProviderAPICall(provider: string, method: string, status: 'success' | 'failed'): void;
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
export declare const recordNotificationSent: (type: string, channel: string, status: "success" | "failed") => void;
export declare const recordNotificationFailed: (channel: string, reason: string) => void;
export declare const recordProviderAPICall: (provider: string, method: string, status: "success" | "failed") => void;
//# sourceMappingURL=metrics.d.ts.map