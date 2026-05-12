import express, { Request, Response } from 'express';
export declare class PaymentController {
    private paymentService;
    constructor();
    processPayment: (req: Request, res: Response) => Promise<express.Response<any, Record<string, any>> | undefined>;
    processRefund: (req: Request, res: Response) => Promise<express.Response<any, Record<string, any>> | undefined>;
    getTransactions: (req: Request, res: Response) => Promise<void>;
    getTransaction: (req: Request, res: Response) => Promise<express.Response<any, Record<string, any>> | undefined>;
    getUserTransactions: (req: Request, res: Response) => Promise<express.Response<any, Record<string, any>> | undefined>;
    getPaymentAnalytics: (req: Request, res: Response) => Promise<void>;
    getRevenueAnalytics: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=PaymentController.d.ts.map