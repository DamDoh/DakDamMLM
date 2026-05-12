import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
export declare class ApprovalController {
    private notificationService;
    getPendingApprovals(req: AuthRequest, res: Response): Promise<void>;
    reviewProof(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    bulkReviewProofs(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getApprovalHistory(req: AuthRequest, res: Response): Promise<void>;
    getApprovalStats(req: AuthRequest, res: Response): Promise<void>;
    escalateProof(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    private checkIfUserIsDownline;
    private triggerInventoryRelease;
    private recordMetric;
}
//# sourceMappingURL=ApprovalController.d.ts.map