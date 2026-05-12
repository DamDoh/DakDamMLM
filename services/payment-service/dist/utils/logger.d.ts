import winston from 'winston';
declare const logger: winston.Logger;
export { logger };
export declare const logPaymentProcessing: (userId: string, amount: number, method: string, status: string) => void;
export declare const logWalletTransaction: (userId: string, type: string, amount: number, balance: number) => void;
export declare const logPayoutRequest: (userId: string, amount: number, method: string) => void;
export declare const logCommissionPayout: (userId: string, commissionId: string, amount: number) => void;
export declare const logPaymentFailure: (userId: string, amount: number, reason: string) => void;
export declare const logSecurityEvent: (userId: string, action: string, ip?: string) => void;
export declare const logPerformanceMetric: (operation: string, duration: number, metadata?: any) => void;
//# sourceMappingURL=logger.d.ts.map