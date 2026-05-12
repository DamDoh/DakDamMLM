import winston from 'winston';
declare const logger: winston.Logger;
export { logger };
export declare const logCommissionCalculated: (userId: string, orderId: string, amount: number, type: string) => void;
export declare const logCommissionPaid: (userId: string, commissionId: string, amount: number, method: string) => void;
export declare const logPayoutProcessed: (userId: string, payoutId: string, amount: number, status: string) => void;
export declare const logBonusAchieved: (userId: string, bonusType: string, amount: number, period: string) => void;
export declare const logCommissionError: (userId: string, orderId: string, error: string) => void;
export declare const logPayoutError: (userId: string, payoutId: string, error: string) => void;
//# sourceMappingURL=logger.d.ts.map