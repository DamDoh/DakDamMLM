import { PrismaClient } from '@prisma/client';
declare class DatabaseConnection {
    private static instance;
    private prisma;
    private connectionPromise;
    private constructor();
    static getInstance(): DatabaseConnection;
    getClient(): PrismaClient;
    healthCheck(): Promise<boolean>;
    getConnectionInfo(): Promise<{
        isConnected: boolean;
        connectionCount: number;
    }>;
}
export declare const db: PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
export declare const databaseConnection: DatabaseConnection;
export declare class DatabaseUtils {
    static withTransaction<T>(operation: (tx: PrismaClient) => Promise<T>, maxRetries?: number): Promise<T>;
    static batchInsert<T>(data: T[], batchSize: number | undefined, insertFn: (batch: T[]) => Promise<any>): Promise<void>;
    static safeQuery<T>(queryFn: () => Promise<T>, timeoutMs?: number): Promise<T>;
}
export {};
//# sourceMappingURL=database.d.ts.map