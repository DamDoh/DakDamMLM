import express from 'express';
import { ProductController } from '../controllers/ProductController';

const router = express.Router();
const productController = new ProductController();

// Product CRUD operations
router.post('/', productController.createProduct);
router.get('/', productController.getProducts);
router.get('/:id', productController.getProduct);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

// Product search and filtering
router.get('/search/:query', productController.searchProducts);
router.get('/category/:category', productController.getProductsByCategory);

// Inventory management
router.get('/:id/inventory', productController.getProductInventory);
router.put('/:id/inventory', productController.updateProductInventory);
router.get('/inventory/low-stock', productController.getLowStockProducts);

// Product variants
router.post('/:id/variants', productController.addProductVariant);
router.put('/:id/variants/:variantId', productController.updateProductVariant);
router.delete('/:id/variants/:variantId', productController.deleteProductVariant);

// Catalog sync
router.post('/sync', productController.syncProducts);

export { router as productRoutes };