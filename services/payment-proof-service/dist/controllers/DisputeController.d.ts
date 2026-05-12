import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
export declare class DisputeController {
    private notificationService;
    createDispute(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getDisputes(req: AuthRequest, res: Response): Promise<void>;
    getDispute(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    resolveDispute(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    escalateDispute(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getDisputeMessages(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    addDisputeMessage(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getDisputeStats(req: AuthRequest, res: Response): Promise<void>;
    private checkIfUserIsDownline;
    private recordMetric;
}
//# sourceMappingURL=DisputeController.d.ts.map