import { PrismaClient } from '@prisma/client';
declare class NotificationDatabaseConnection {
    private static instance;
    private prisma;
    private constructor();
    static getInstance(): NotificationDatabaseConnection;
    getClient(): PrismaClient;
    healthCheck(): Promise<boolean>;
}
export declare const notificationDb: any;
export declare const notificationDatabaseConnection: NotificationDatabaseConnection;
export {};
//# sourceMappingURL=database.d.ts.map