import winston from 'winston';
declare const logger: winston.Logger;
export { logger };
export declare const logOrderCreation: (userId: string, orderId: string, amount: number) => void;
export declare const logOrderStatusChange: (orderId: string, oldStatus: string, newStatus: string) => void;
export declare const logInventoryUpdate: (productId: string, change: number, reason: string) => void;
export declare const logPaymentProcessing: (orderId: string, amount: number, status: string) => void;
export declare const logCommissionTrigger: (orderId: string, userId: string, commissionAmount: number) => void;
export declare const logSecurityEvent: (userId: string, action: string, ip?: string) => void;
export declare const logPerformanceMetric: (operation: string, duration: number, metadata?: any) => void;
//# sourceMappingURL=logger.d.ts.map