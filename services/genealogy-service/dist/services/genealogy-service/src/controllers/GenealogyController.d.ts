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
    getGenealogyTree: (req: AuthenticatedRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    getDownline: (req: AuthenticatedRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    getUpline: (req: AuthenticatedRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    moveDownline: (req: Request, res: Response) => Promise<void>;
    getGenealogyStats: (req: Request, res: Response) => Promise<void>;
    getPlacementInfo: (req: AuthenticatedRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    getBinaryTree: (req: AuthenticatedRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    getDownlinePaginated: (req: AuthenticatedRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    validatePlacement: (req: AuthenticatedRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    getGenealogyMetrics: (req: AuthenticatedRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    bulkUpdateGenealogy: (req: AuthenticatedRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
}
export {};
//# sourceMappingURL=GenealogyController.d.ts.map