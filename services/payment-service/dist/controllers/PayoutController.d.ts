import express, { Request, Response } from 'express';
export declare class PayoutController {
    private payoutService;
    constructor();
    requestPayout: (req: Request, res: Response) => Promise<express.Response<any, Record<string, any>> | undefined>;
    getPayoutRequests: (req: Request, res: Response) => Promise<void>;
    getPayoutRequest: (req: Request, res: Response) => Promise<express.Response<any, Record<string, any>> | undefined>;
    approvePayout: (req: Request, res: Response) => Promise<void>;
    rejectPayout: (req: Request, res: Response) => Promise<express.Response<any, Record<string, any>> | undefined>;
    processPayout: (req: Request, res: Response) => Promise<void>;
    processCommissionPayout: (req: Request, res: Response) => Promise<express.Response<any, Record<string, any>> | undefined>;
    getPayoutAnalytics: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=PayoutController.d.ts.map