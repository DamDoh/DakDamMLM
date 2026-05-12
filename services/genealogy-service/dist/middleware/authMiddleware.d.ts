import { Request, Response, NextFunction } from 'express';
interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        memberId?: string;
        isAdmin: boolean;
    };
}
export declare const authenticateToken: (req: AuthenticatedRequest, res: Response, next: NextFunction) => any;
export declare const requireAdmin: (req: AuthenticatedRequest, res: Response, next: NextFunction) => any;
export {};
//# sourceMappingURL=authMiddleware.d.ts.map