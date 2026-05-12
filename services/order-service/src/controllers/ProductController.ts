import { Request, Response } from 'express';
import { ProductService } from '../services/ProductService';
import { recordProductQuery, recordError } from '../utils/metrics';

export class ProductController {
  private productService: ProductService;

  constructor() {
    this.productService = new ProductService();
  }

  createProduct = async (req: Request, res: Response) => {
    try {
      const product = await this.productService.createProduct((req as any).body);

      (res as any).status(201).json({
        success: true,
        data: product,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('product_creation', '/products');
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  getProducts = async (req: Request, res: Response) => {
    try {
      const {
        page = 1,
        limit = 10,
        category,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = (req as any).query;

      const result = await this.productService.getProducts({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        category: category as string,
        search: search as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
      });

      recordProductQuery(category as string);

      (res as any).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('products_listing', '/products');
      (res as any).status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  getProduct = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      const product = await this.productService.getProductById(id);

      if (!product) {
        return (res as any).status(404).json({
          success: false,
          error: 'Product not found',
          timestamp: new Date().toISOString(),
          requestId: (res as any).get('X-Request-ID'),
        });
      }

      (res as any).json({
        success: true,
        data: product,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('product_retrieval', '/products/:id');
      (res as any).status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  updateProduct = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      const product = await this.productService.updateProduct(id, (req as any).body);

      (res as any).json({
        success: true,
        data: product,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('product_update', '/products/:id');
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  deleteProduct = async (req: Request, res: Response) => {
    try {
      const { id } = (req as any).params;
      await this.productService.deleteProduct(id);

      (res as any).json({
        success: true,
        message: 'Product deleted successfully',
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('product_deletion', '/products/:id');
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  searchProducts = async (req: Request, res: Response) => {
    try {
      const { query } = (req as any).params;
      const { limit = 10 } = (req as any).query;

      const products = await this.productService.searchProducts(query, parseInt(limit as string));

      recordProductQuery('search');

      (res as any).json({
        success: true,
        data: products,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('product_search', '/products/search/:query');
      (res as any).status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  getProductsByCategory = async (req: Request, res: Response) => {
    try {
      const { category } = (req as any).params;
      const { page = 1, limit = 10 } = (req as any).query;

      const result = await this.productService.getProductsByCategory(
        category,
        parseInt(page as string),
        parseInt(limit as string)
      );

      recordProductQuery(category);

      (res as any).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('products_by_category', '/products/category/:category');
      (res as any).status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  // Additional methods for inventory management
  getProductInventory = async (req: Request, res: Response) => {
    // Implementation for getting product inventory
    (res as any).status(501).json({ message: 'Not implemented yet' });
  };

  updateProductInventory = async (req: Request, res: Response) => {
    // Implementation for updating product inventory
    (res as any).status(501).json({ message: 'Not implemented yet' });
  };

  getLowStockProducts = async (req: Request, res: Response) => {
    // Implementation for getting low stock products
    (res as any).status(501).json({ message: 'Not implemented yet' });
  };

  addProductVariant = async (req: Request, res: Response) => {
    // Implementation for adding product variant
    (res as any).status(501).json({ message: 'Not implemented yet' });
  };

  updateProductVariant = async (req: Request, res: Response) => {
    // Implementation for updating product variant
    (res as any).status(501).json({ message: 'Not implemented yet' });
  };

  deleteProductVariant = async (req: Request, res: Response) => {
    // Implementation for deleting product variant
    (res as any).status(501).json({ message: 'Not implemented yet' });
  };

  syncProducts = async (req: Request, res: Response) => {
    try {
      const { sourceUrl, apiKey } = (req as any).body;
      const result = await this.productService.syncProductsFromExternal(sourceUrl, apiKey);

      (res as any).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('product_sync', '/products/sync');
      (res as any).status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };
}