import { Request, Response } from 'express';
type NextFunction = (err?: any) => void;
export declare const validateUserId: (req: Request, res: Response, next: NextFunction) => any;
export declare const validatePagination: (req: Request, res: Response, next: NextFunction) => any;
export declare const validateCommissionData: (req: Request, res: Response, next: NextFunction) => any;
export declare const validateBatchCommissions: (req: Request, res: Response, next: NextFunction) => any;
export declare const validateDateRange: (req: Request, res: Response, next: NextFunction) => any;
export declare const validatePeriod: (req: Request, res: Response, next: NextFunction) => any;
export declare const validateTopEarners: (req: Request, res: Response, next: NextFunction) => any;
export {};
//# sourceMappingURL=validation.d.ts.map