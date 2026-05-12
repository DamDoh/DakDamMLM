import { Request, Response } from 'express';
export declare class CampaignController {
    private campaignService;
    constructor();
    createCampaign: (req: Request, res: Response) => Promise<void>;
    getCampaigns: (req: Request, res: Response) => Promise<void>;
    getCampaign: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    updateCampaign: (req: Request, res: Response) => Promise<void>;
    deleteCampaign: (req: Request, res: Response) => Promise<void>;
    executeCampaign: (req: Request, res: Response) => Promise<void>;
    scheduleCampaign: (req: Request, res: Response) => Promise<void>;
    cancelCampaign: (req: Request, res: Response) => Promise<void>;
    getCampaignAnalytics: (req: Request, res: Response) => Promise<void>;
    getCampaignsAnalytics: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=CampaignController.d.ts.map