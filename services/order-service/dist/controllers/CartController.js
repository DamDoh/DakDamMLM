"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CartController = void 0;
const CartService_1 = require("../services/CartService");
const metrics_1 = require("../utils/metrics");
class CartController {
    constructor() {
        this.getCart = async (req, res) => {
            try {
                // In a real implementation, userId would come from JWT token
                const userId = req.query.userId || 'default-user';
                const cart = await this.cartService.getCart(userId);
                res.json({
                    success: true,
                    data: cart,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordError)('cart_retrieval', '/cart');
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.addItem = async (req, res) => {
            try {
                const { userId, productId, quantity, variant } = req.body;
                const cart = await this.cartService.addItem(userId, {
                    productId,
                    quantity,
                    variant,
                });
                (0, metrics_1.recordCartOperation)('add_item');
                res.json({
                    success: true,
                    data: cart,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordError)('cart_item_addition', '/cart/items');
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.updateItem = async (req, res) => {
            try {
                const { productId } = req.params;
                const { userId, quantity } = req.body;
                const cart = await this.cartService.updateItem(userId, productId, quantity);
                (0, metrics_1.recordCartOperation)('update_item');
                res.json({
                    success: true,
                    data: cart,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordError)('cart_item_update', '/cart/items/:productId');
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.removeItem = async (req, res) => {
            try {
                const { productId } = req.params;
                const { userId } = req.body;
                const cart = await this.cartService.removeItem(userId, productId);
                (0, metrics_1.recordCartOperation)('remove_item');
                res.json({
                    success: true,
                    data: cart,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordError)('cart_item_removal', '/cart/items/:productId');
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.clearCart = async (req, res) => {
            try {
                const { userId } = req.body;
                const cart = await this.cartService.clearCart(userId);
                (0, metrics_1.recordCartOperation)('clear_cart');
                res.json({
                    success: true,
                    data: cart,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordError)('cart_clear', '/cart');
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.checkout = async (req, res) => {
            try {
                const { userId, shippingAddress, billingAddress, paymentMethod } = req.body;
                const order = await this.cartService.checkout(userId, {
                    shippingAddress,
                    billingAddress,
                    paymentMethod,
                });
                (0, metrics_1.recordCartOperation)('checkout');
                res.json({
                    success: true,
                    data: order,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
            catch (error) {
                (0, metrics_1.recordError)('cart_checkout', '/cart/checkout');
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: res.get('X-Request-ID'),
                });
            }
        };
        this.cartService = new CartService_1.CartService();
    }
}
exports.CartController = CartController;
//# sourceMappingURL=CartController.js.map