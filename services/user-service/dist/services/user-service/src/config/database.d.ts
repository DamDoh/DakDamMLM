import { PrismaClient } from '@prisma/client';
declare class UserDatabaseConnection {
    private static instance;
    private prisma;
    private constructor();
    static getInstance(): UserDatabaseConnection;
    getClient(): PrismaClient;
    healthCheck(): Promise<boolean>;
}
export declare const userDb: PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
export declare const userDatabaseConnection: UserDatabaseConnection;
export {};
//# sourceMappingURL=database.d.ts.map