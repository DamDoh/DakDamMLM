"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.productRoutes = void 0;
const express_1 = __importDefault(require("express"));
const ProductController_1 = require("../controllers/ProductController");
const router = express_1.default.Router();
exports.productRoutes = router;
const productController = new ProductController_1.ProductController();
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
//# sourceMappingURL=productRoutes.js.map