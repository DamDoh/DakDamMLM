import { Request, Response } from 'express';
import { CartService } from '../services/CartService';
import { recordCartOperation, recordError } from '../utils/metrics';

export class CartController {
  private cartService: CartService;

  constructor() {
    this.cartService = new CartService();
  }

  getCart = async (req: Request, res: Response) => {
    try {
      // In a real implementation, userId would come from JWT token
      const userId = ((req as any).query.userId as string) || 'default-user';

      const cart = await this.cartService.getCart(userId);

      (res as any).json({
        success: true,
        data: cart,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('cart_retrieval', '/cart');
      (res as any).status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  addItem = async (req: Request, res: Response) => {
    try {
      const { userId, productId, quantity, variant } = (req as any).body;

      const cart = await this.cartService.addItem(userId, {
        productId,
        quantity,
        variant,
      });

      recordCartOperation('add_item');

      (res as any).json({
        success: true,
        data: cart,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('cart_item_addition', '/cart/items');
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  updateItem = async (req: Request, res: Response) => {
    try {
      const { productId } = (req as any).params;
      const { userId, quantity } = (req as any).body;

      const cart = await this.cartService.updateItem(userId, productId, quantity);

      recordCartOperation('update_item');

      (res as any).json({
        success: true,
        data: cart,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('cart_item_update', '/cart/items/:productId');
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  removeItem = async (req: Request, res: Response) => {
    try {
      const { productId } = (req as any).params;
      const { userId } = (req as any).body;

      const cart = await this.cartService.removeItem(userId, productId);

      recordCartOperation('remove_item');

      (res as any).json({
        success: true,
        data: cart,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('cart_item_removal', '/cart/items/:productId');
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  clearCart = async (req: Request, res: Response) => {
    try {
      const { userId } = (req as any).body;

      const cart = await this.cartService.clearCart(userId);

      recordCartOperation('clear_cart');

      (res as any).json({
        success: true,
        data: cart,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('cart_clear', '/cart');
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };

  checkout = async (req: Request, res: Response) => {
    try {
      const {
        userId,
        shippingAddress,
        billingAddress,
        paymentMethod
      } = (req as any).body;

      const order = await this.cartService.checkout(userId, {
        shippingAddress,
        billingAddress,
        paymentMethod,
      });

      recordCartOperation('checkout');

      (res as any).json({
        success: true,
        data: order,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    } catch (error: any) {
      recordError('cart_checkout', '/cart/checkout');
      (res as any).status(400).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: (res as any).get('X-Request-ID'),
      });
    }
  };
}