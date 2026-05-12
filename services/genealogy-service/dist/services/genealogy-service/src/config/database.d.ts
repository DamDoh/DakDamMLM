import { PrismaClient } from '@prisma/client';
declare class GenealogyDatabaseConnection {
    private static instance;
    private prisma;
    private constructor();
    static getInstance(): GenealogyDatabaseConnection;
    getClient(): PrismaClient;
    healthCheck(): Promise<boolean>;
}
export declare const genealogyDb: any;
export declare const genealogyDatabaseConnection: GenealogyDatabaseConnection;
export {};
//# sourceMappingURL=database.d.ts.map