export declare const prisma: any;
export declare function checkDatabaseHealth(): Promise<{
    healthy: boolean;
    responseTime: number;
    connectionCount?: number;
    error?: string;
}>;
export declare function disconnectDatabase(): Promise<void>;
export declare function startConnectionPoolMonitoring(): void;
//# sourceMappingURL=database.d.ts.map