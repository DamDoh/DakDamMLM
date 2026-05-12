import { Request, Response } from 'express';
export declare class OrderController {
    private orderService;
    constructor();
    createOrder: (req: Request, res: Response) => Promise<void>;
    getOrder: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    getOrders: (req: Request, res: Response) => Promise<void>;
    updateOrder: (req: Request, res: Response) => Promise<void>;
    updateOrderStatus: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    cancelOrder: (req: Request, res: Response) => Promise<void>;
    shipOrder: (req: Request, res: Response) => Promise<void>;
    deliverOrder: (req: Request, res: Response) => Promise<void>;
    getOrderSummary: (req: Request, res: Response) => Promise<void>;
    getRevenueAnalytics: (req: Request, res: Response) => Promise<void>;
    getOrderItems: (req: Request, res: Response) => Promise<void>;
    addOrderItem: (req: Request, res: Response) => Promise<void>;
    updateOrderItem: (req: Request, res: Response) => Promise<void>;
    removeOrderItem: (req: Request, res: Response) => Promise<void>;
    processRefund: (req: Request, res: Response) => Promise<void>;
    getOrderRefunds: (req: Request, res: Response) => Promise<void>;
    private triggerCommissionCalculation;
}
//# sourceMappingURL=OrderController.d.ts.map