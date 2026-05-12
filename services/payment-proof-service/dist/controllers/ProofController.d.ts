import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
export declare class ProofController {
    private fileEncryptionService;
    private fraudDetectionService;
    private notificationService;
    uploadProof(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getProofs(req: AuthRequest, res: Response): Promise<void>;
    getProof(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    downloadProof(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    deleteProof(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    createQRCode(req: AuthRequest, res: Response): Promise<void>;
    getQRCodes(req: AuthRequest, res: Response): Promise<void>;
    deleteQRCode(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    private extractPaymentInfo;
    private recordMetric;
}
//# sourceMappingURL=ProofController.d.ts.map