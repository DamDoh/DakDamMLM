import { PrismaClient } from '@prisma/client';
declare class PaymentDatabaseConnection {
    private static instance;
    private prisma;
    private constructor();
    static getInstance(): PaymentDatabaseConnection;
    getClient(): PrismaClient;
    healthCheck(): Promise<boolean>;
}
export declare const paymentDb: any;
export declare const paymentDatabaseConnection: PaymentDatabaseConnection;
export {};
//# sourceMappingURL=database.d.ts.map