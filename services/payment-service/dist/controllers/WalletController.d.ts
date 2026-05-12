import express, { Request, Response } from 'express';
export declare class WalletController {
    private walletService;
    constructor();
    getWallet: (req: Request, res: Response) => Promise<void>;
    creditWallet: (req: Request, res: Response) => Promise<express.Response<any, Record<string, any>> | undefined>;
    debitWallet: (req: Request, res: Response) => Promise<express.Response<any, Record<string, any>> | undefined>;
    getWalletTransactions: (req: Request, res: Response) => Promise<void>;
    getWalletBalance: (req: Request, res: Response) => Promise<void>;
    getWalletAnalytics: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=WalletController.d.ts.map