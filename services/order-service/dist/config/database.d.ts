import { PrismaClient } from '@prisma/client';
declare class OrderDatabaseConnection {
    private static instance;
    private prisma;
    private constructor();
    static getInstance(): OrderDatabaseConnection;
    getClient(): PrismaClient;
    healthCheck(): Promise<boolean>;
}
export declare const orderDb: PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
export declare const orderDatabaseConnection: OrderDatabaseConnection;
export {};
//# sourceMappingURL=database.d.ts.map