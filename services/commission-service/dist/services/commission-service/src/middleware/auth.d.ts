import { Request, Response } from 'express';
type NextFunction = (err?: any) => void;
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
export declare const requireOwnershipOrAdmin: (userIdParam?: string) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => any;
export {};
//# sourceMappingURL=auth.d.ts.map