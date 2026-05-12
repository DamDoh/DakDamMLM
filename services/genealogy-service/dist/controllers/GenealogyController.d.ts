import { Request, Response } from 'express';
interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        memberId?: string;
        isAdmin: boolean;
    };
}
export declare class GenealogyController {
    private genealogyService;
    constructor();
    private createResponse;
    getGenealogyTree: (req: AuthenticatedRequest, res: Response) => Promise<any>;
    getDownline: (req: AuthenticatedRequest, res: Response) => Promise<any>;
    getUpline: (req: AuthenticatedRequest, res: Response) => Promise<any>;
    moveDownline: (req: Request, res: Response) => Promise<void>;
    getGenealogyStats: (req: Request, res: Response) => Promise<void>;
    getPlacementInfo: (req: AuthenticatedRequest, res: Response) => Promise<any>;
    getBinaryTree: (req: AuthenticatedRequest, res: Response) => Promise<any>;
    getDownlinePaginated: (req: AuthenticatedRequest, res: Response) => Promise<any>;
    validatePlacement: (req: AuthenticatedRequest, res: Response) => Promise<any>;
    getGenealogyMetrics: (req: AuthenticatedRequest, res: Response) => Promise<any>;
    bulkUpdateGenealogy: (req: AuthenticatedRequest, res: Response) => Promise<any>;
}
export {};
//# sourceMappingURL=GenealogyController.d.ts.map