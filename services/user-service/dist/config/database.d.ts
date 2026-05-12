import { PrismaClient } from '@prisma/client';
declare class UserDatabaseConnection {
    private static instance;
    private prisma;
    private constructor();
    static getInstance(): UserDatabaseConnection;
    getClient(): PrismaClient;
    healthCheck(): Promise<boolean>;
}
export declare const userDb: any;
export declare const userDatabaseConnection: UserDatabaseConnection;
export {};
//# sourceMappingURL=database.d.ts.map