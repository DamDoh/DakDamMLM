import { orderDb as db } from '../config/database';
import { cacheService } from '../utils/cache';
import { logger } from '../utils/logger';
import { OrderService } from './OrderService';

interface CartItem {
  productId: string;
  quantity: number;
  variant?: any;
}

export class CartService {
  private orderService: OrderService;

  constructor() {
    this.orderService = new OrderService();
  }

  async getCart(userId: string) {
    // Try cache first
    let cart = await cacheService.getCachedCart(userId);
    if (cart) {
      return cart;
    }

    // Fetch from database
    cart = await (db as any).cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      // Create empty cart if it doesn't exist
      cart = await (db as any).cart.create({
        data: {
          userId,
          items: [],
          totalAmount: 0,
        },
      });
    }

    // Cache the cart
    await cacheService.setCachedCart(userId, cart);

    return cart;
  }

  async addItem(userId: string, item: CartItem) {
    const { productId, quantity, variant } = item;

    // Validate product exists and is available
    const product = await db.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    if (!product.isActive) {
      throw new Error('Product is not available');
    }

    const productStock = (product as any).stockQuantity || 0;
    if (productStock < quantity) {
      throw new Error(`Insufficient stock. Available: ${productStock}`);
    }

    // Get current cart
    let cart = await this.getCart(userId);
    const items = cart.items as any[] || [];

    // Check if item already exists in cart
    const existingItemIndex = items.findIndex(
      (item: any) => item.productId === productId &&
      JSON.stringify(item.variant) === JSON.stringify(variant)
    );

    if (existingItemIndex >= 0) {
      // Update quantity
      items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item
      items.push({
        productId,
        productName: product.name,
        quantity,
        unitPrice: product.price,
        totalPrice: product.price * quantity,
        variant,
      });
    }

    // Recalculate total
    const totalAmount = items.reduce((total: number, item: any) => total + item.totalPrice, 0);

    // Update cart in database
    cart = await (db as any).cart.update({
      where: { userId },
      data: {
        items,
        totalAmount,
        updatedAt: new Date(),
      },
    });

    // Update cache
    await cacheService.setCachedCart(userId, cart);

    logger.info('Item added to cart', {
      userId,
      productId,
      productName: product.name,
      quantity,
      totalAmount,
    });

    return cart;
  }

  async updateItem(userId: string, productId: string, quantity: number) {
    if (quantity <= 0) {
      return this.removeItem(userId, productId);
    }

    // Validate product stock
    const product = await db.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const productStock = (product as any).stockQuantity || 0;
    if (productStock < quantity) {
      throw new Error(`Insufficient stock. Available: ${productStock}`);
    }

    // Get current cart
    let cart = await this.getCart(userId);
    const items = cart.items as any[] || [];

    // Find and update item
    const itemIndex = items.findIndex((item: any) => item.productId === productId);

    if (itemIndex === -1) {
      throw new Error('Item not found in cart');
    }

    items[itemIndex].quantity = quantity;
    items[itemIndex].totalPrice = items[itemIndex].unitPrice * quantity;

    // Recalculate total
    const totalAmount = items.reduce((total: number, item: any) => total + item.totalPrice, 0);

    // Update cart in database
    cart = await (db as any).cart.update({
      where: { userId },
      data: {
        items,
        totalAmount,
        updatedAt: new Date(),
      },
    });

    // Update cache
    await cacheService.setCachedCart(userId, cart);

    logger.info('Cart item updated', {
      userId,
      productId,
      newQuantity: quantity,
      totalAmount,
    });

    return cart;
  }

  async removeItem(userId: string, productId: string) {
    // Get current cart
    let cart = await this.getCart(userId);
    const items = cart.items as any[] || [];

    // Filter out the item
    const filteredItems = items.filter((item: any) => item.productId !== productId);

    // Recalculate total
    const totalAmount = filteredItems.reduce((total: number, item: any) => total + item.totalPrice, 0);

    // Update cart in database
    cart = await (db as any).cart.update({
      where: { userId },
      data: {
        items: filteredItems,
        totalAmount,
        updatedAt: new Date(),
      },
    });

    // Update cache
    await cacheService.setCachedCart(userId, cart);

    logger.info('Item removed from cart', {
      userId,
      productId,
      totalAmount,
    });

    return cart;
  }

  async clearCart(userId: string) {
    // Update cart in database
    const cart = await (db as any).cart.update({
      where: { userId },
      data: {
        items: [],
        totalAmount: 0,
        updatedAt: new Date(),
      },
    });

    // Update cache
    await cacheService.setCachedCart(userId, cart);

    logger.info('Cart cleared', { userId });

    return cart;
  }

  async checkout(userId: string, checkoutData: {
    shippingAddress?: any;
    billingAddress?: any;
    paymentMethod?: string;
  }) {
    // Get current cart
    const cart = await this.getCart(userId);

    if (!cart || !cart.items || cart.items.length === 0) {
      throw new Error('Cart is empty');
    }

    const items = cart.items as any[];

    // Create order using the order service
    const order = await this.orderService.createOrder({
      userId,
      items: items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        variant: item.variant,
      })),
      shippingAddress: checkoutData.shippingAddress,
      billingAddress: checkoutData.billingAddress,
      paymentMethod: checkoutData.paymentMethod,
    });

    // Clear the cart after successful order creation
    await this.clearCart(userId);

    logger.info('Cart checkout completed', {
      userId,
      orderId: order.id,
      orderNumber: (order as any).orderNumber || order.id,
      totalAmount: order.totalAmount,
      itemCount: items.length,
    });

    return order;
  }

  async getCartSummary(userId: string) {
    const cart = await this.getCart(userId);

    if (!cart || !cart.items) {
      return {
        itemCount: 0,
        totalAmount: 0,
        items: [],
      };
    }

    const items = cart.items as any[];
    const itemCount = items.length;
    const totalAmount = cart.totalAmount;

    return {
      itemCount,
      totalAmount,
      items: items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
    };
  }
}