import { Request, Response } from 'express';
export declare class ProductController {
    private productService;
    constructor();
    createProduct: (req: Request, res: Response) => Promise<void>;
    getProducts: (req: Request, res: Response) => Promise<void>;
    getProduct: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    updateProduct: (req: Request, res: Response) => Promise<void>;
    deleteProduct: (req: Request, res: Response) => Promise<void>;
    searchProducts: (req: Request, res: Response) => Promise<void>;
    getProductsByCategory: (req: Request, res: Response) => Promise<void>;
    getProductInventory: (req: Request, res: Response) => Promise<void>;
    updateProductInventory: (req: Request, res: Response) => Promise<void>;
    getLowStockProducts: (req: Request, res: Response) => Promise<void>;
    addProductVariant: (req: Request, res: Response) => Promise<void>;
    updateProductVariant: (req: Request, res: Response) => Promise<void>;
    deleteProductVariant: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=ProductController.d.ts.map