"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductController = void 0;
const ProductService_1 = require("../services/ProductService");
const metrics_1 = require("../utils/metrics");
class ProductController {
    constructor() {
        this.createProduct = async (req, res) => {
            try {
                const product = await this.productService.createProduct(req.body);
                res.status(201).json({
                    success: true,
                    data: product,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordError)('product_creation', '/products');
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getProducts = async (req, res) => {
            try {
                const { page = 1, limit = 10, category, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
                const result = await this.productService.getProducts({
                    page: parseInt(page),
                    limit: parseInt(limit),
                    category: category,
                    search: search,
                    sortBy: sortBy,
                    sortOrder: sortOrder,
                });
                (0, metrics_1.recordProductQuery)(category);
                res.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordError)('products_listing', '/products');
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getProduct = async (req, res) => {
            try {
                const { id } = req.params;
                const product = await this.productService.getProductById(id);
                if (!product) {
                    return res.status(404).json({
                        success: false,
                        error: 'Product not found',
                        timestamp: new Date().toISOString(),
                        requestId: res.get('X-Request-ID'),
                    });
                }
                res.json({
                    success: true,
                    data: product,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordError)('product_retrieval', '/products/:id');
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.updateProduct = async (req, res) => {
            try {
                const { id } = req.params;
                const product = await this.productService.updateProduct(id, req.body);
                res.json({
                    success: true,
                    data: product,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordError)('product_update', '/products/:id');
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.deleteProduct = async (req, res) => {
            try {
                const { id } = req.params;
                await this.productService.deleteProduct(id);
                res.json({
                    success: true,
                    message: 'Product deleted successfully',
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordError)('product_deletion', '/products/:id');
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.searchProducts = async (req, res) => {
            try {
                const { query } = req.params;
                const { limit = 10 } = req.query;
                const products = await this.productService.searchProducts(query, parseInt(limit));
                (0, metrics_1.recordProductQuery)('search');
                res.json({
                    success: true,
                    data: products,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordError)('product_search', '/products/search/:query');
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.getProductsByCategory = async (req, res) => {
            try {
                const { category } = req.params;
                const { page = 1, limit = 10 } = req.query;
                const result = await this.productService.getProductsByCategory(category, parseInt(page), parseInt(limit));
                (0, metrics_1.recordProductQuery)(category);
                res.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordError)('products_by_category', '/products/category/:category');
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        // Additional methods for inventory management
        this.getProductInventory = async (req, res) => {
            // Implementation for getting product inventory
            res.status(501).json({ message: 'Not implemented yet' });
        };
        this.updateProductInventory = async (req, res) => {
            // Implementation for updating product inventory
            res.status(501).json({ message: 'Not implemented yet' });
        };
        this.getLowStockProducts = async (req, res) => {
            // Implementation for getting low stock products
            res.status(501).json({ message: 'Not implemented yet' });
        };
        this.addProductVariant = async (req, res) => {
            // Implementation for adding product variant
            res.status(501).json({ message: 'Not implemented yet' });
        };
        this.updateProductVariant = async (req, res) => {
            // Implementation for updating product variant
            res.status(501).json({ message: 'Not implemented yet' });
        };
        this.deleteProductVariant = async (req, res) => {
            // Implementation for deleting product variant
            res.status(501).json({ message: 'Not implemented yet' });
        };
        this.productService = new ProductService_1.ProductService();
    }
}
exports.ProductController = ProductController;
//# sourceMappingURL=ProductController.js.map