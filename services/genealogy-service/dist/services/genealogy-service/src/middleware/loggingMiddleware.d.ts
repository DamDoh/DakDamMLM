import { Request, Response, NextFunction } from 'express';
export declare const requestLogger: (req: Request, res: Response, next: NextFunction) => void;
export declare const errorLogger: (error: any, req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=loggingMiddleware.d.ts.map