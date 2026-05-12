import { Request, Response } from 'express';
export declare class CartController {
    private cartService;
    constructor();
    getCart: (req: Request, res: Response) => Promise<void>;
    addItem: (req: Request, res: Response) => Promise<void>;
    updateItem: (req: Request, res: Response) => Promise<void>;
    removeItem: (req: Request, res: Response) => Promise<void>;
    clearCart: (req: Request, res: Response) => Promise<void>;
    checkout: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=CartController.d.ts.map