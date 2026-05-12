"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cartRoutes = void 0;
const express_1 = __importDefault(require("express"));
const CartController_1 = require("../controllers/CartController");
const router = express_1.default.Router();
exports.cartRoutes = router;
const cartController = new CartController_1.CartController();
// Cart operations
router.get('/', cartController.getCart);
router.post('/items', cartController.addItem);
router.put('/items/:productId', cartController.updateItem);
router.delete('/items/:productId', cartController.removeItem);
router.delete('/', cartController.clearCart);
// Cart checkout
router.post('/checkout', cartController.checkout);
//# sourceMappingURL=cartRoutes.js.map