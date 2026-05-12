import express from 'express';
import { CartController } from '../controllers/CartController';

const router = express.Router();
const cartController = new CartController();

// Cart operations
router.get('/', cartController.getCart);
router.post('/items', cartController.addItem);
router.put('/items/:productId', cartController.updateItem);
router.delete('/items/:productId', cartController.removeItem);
router.delete('/', cartController.clearCart);

// Cart checkout
router.post('/checkout', cartController.checkout);

export { router as cartRoutes };