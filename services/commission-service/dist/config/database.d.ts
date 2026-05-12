import { PrismaClient } from '@prisma/client';
declare class CommissionDatabaseConnection {
    private static instance;
    private prisma;
    private constructor();
    static getInstance(): CommissionDatabaseConnection;
    getClient(): PrismaClient;
    healthCheck(): Promise<boolean>;
}
export declare const commissionDb: PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/client").DefaultArgs>;
export declare const commissionDatabaseConnection: CommissionDatabaseConnection;
export {};
//# sourceMappingURL=database.d.ts.map