'use server';

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { updateStockLevels, getStockLevel, reserveStock, releaseStock } from '@/services/inventory-service';

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  pv: number;
  imageUrl?: string;
  unitType: string;
}

export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  totalAmount: number;
  totalPV: number;
  itemCount: number;
  companyId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface TaxCalculation {
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  shippingCost: number;
  total: number;
  currency: string;
}

export interface OrderSummary {
  items: CartItem[];
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  totalAmount: number;
  totalPV: number;
  currency: string;
  shippingAddress?: ShippingAddress;
}

/**
 * Add item to cart
 */
export async function addToCart(
  userId: string,
  productId: string,
  quantity: number,
  companyId?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    // Get product details
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        price: true,
        pv: true,
        qty: true,
        imageUrl: true,
        unitType: true,
        isActive: true,
        companyId: true
      }
    });

    if (!product) {
      return { success: false, message: 'Product not found' };
    }

    if (!product.isActive) {
      return { success: false, message: 'Product is not available' };
    }

    if (product.qty < quantity) {
      return { success: false, message: `Insufficient stock. Available: ${product.qty}` };
    }

    // Check if user has existing cart
    let cart = await prisma.cart.findFirst({
      where: { userId, companyId }
    });

    if (!cart) {
      // Create new cart
      cart = await prisma.cart.create({
        data: {
          userId,
          companyId,
          items: [{
            id: `cart_${Date.now()}_${productId}`,
            productId: product.id,
            productName: product.name,
            quantity,
            price: product.price,
            pv: product.pv || 0,
            imageUrl: product.imageUrl || '',
            unitType: product.unitType
          }]
        }
      });
    } else {
      // Update existing cart
      const existingItems = cart.items as CartItem[];
      const existingItemIndex = existingItems.findIndex(item => item.productId === productId);

      if (existingItemIndex >= 0) {
        // Update quantity
        existingItems[existingItemIndex].quantity += quantity;
      } else {
        // Add new item
        existingItems.push({
          id: `cart_${Date.now()}_${productId}`,
          productId: product.id,
          productName: product.name,
          quantity,
          price: product.price,
          pv: product.pv || 0,
          imageUrl: product.imageUrl || '',
          unitType: product.unitType
        });
      }

      await prisma.cart.update({
        where: { id: cart.id },
        data: { items: existingItems }
      });
    }

    revalidatePath('/cart');
    return { success: true };
  } catch (error) {
    logger.error('Failed to add item to cart', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      productId,
      quantity
    });
    return { success: false, message: 'Failed to add item to cart' };
  }
}

/**
 * Remove item from cart
 */
export async function removeFromCart(
  userId: string,
  productId: string,
  companyId?: string
): Promise<{ success: boolean }> {
  try {
    const cart = await prisma.cart.findFirst({
      where: { userId, companyId }
    });

    if (!cart) {
      return { success: false };
    }

    const existingItems = cart.items as CartItem[];
    const updatedItems = existingItems.filter(item => item.productId !== productId);

    if (updatedItems.length === 0) {
      // Remove cart if empty
      await prisma.cart.delete({
        where: { id: cart.id }
      });
    } else {
      await prisma.cart.update({
        where: { id: cart.id },
        data: { items: updatedItems }
      });
    }

    revalidatePath('/cart');
    return { success: true };
  } catch (error) {
    logger.error('Failed to remove item from cart', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      productId
    });
    return { success: false };
  }
}

/**
 * Update cart item quantity
 */
export async function updateCartItem(
  userId: string,
  productId: string,
  quantity: number,
  companyId?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    if (quantity <= 0) {
      return removeFromCart(userId, productId, companyId);
    }

    // Check stock availability
    const stockLevel = await getStockLevel(productId, companyId);
    if (stockLevel < quantity) {
      return { success: false, message: `Insufficient stock. Available: ${stockLevel}` };
    }

    const cart = await prisma.cart.findFirst({
      where: { userId, companyId }
    });

    if (!cart) {
      return { success: false, message: 'Cart not found' };
    }

    const existingItems = cart.items as CartItem[];
    const itemIndex = existingItems.findIndex(item => item.productId === productId);

    if (itemIndex === -1) {
      return { success: false, message: 'Item not found in cart' };
    }

    existingItems[itemIndex].quantity = quantity;

    await prisma.cart.update({
      where: { id: cart.id },
      data: { items: existingItems }
    });

    revalidatePath('/cart');
    return { success: true };
  } catch (error) {
    logger.error('Failed to update cart item', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      productId,
      quantity
    });
    return { success: false, message: 'Failed to update cart item' };
  }
}

/**
 * Get user's cart
 */
export async function getCart(userId: string, companyId?: string): Promise<Cart | null> {
  try {
    const cart = await prisma.cart.findFirst({
      where: { userId, companyId }
    });

    if (!cart) {
      return null;
    }

    const items = cart.items as CartItem[];
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalPV = items.reduce((sum, item) => sum + ((item.pv || 0) * item.quantity), 0);

    return {
      id: cart.id,
      userId: cart.userId,
      items,
      totalAmount,
      totalPV,
      itemCount: items.length,
      companyId: cart.companyId || undefined,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt
    };
  } catch (error) {
    logger.error('Failed to get cart', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
    return null;
  }
}

/**
 * Clear cart
 */
export async function clearCart(userId: string, companyId?: string): Promise<boolean> {
  try {
    await prisma.cart.deleteMany({
      where: { userId, companyId }
    });

    revalidatePath('/cart');
    return true;
  } catch (error) {
    logger.error('Failed to clear cart', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
    return false;
  }
}

/**
 * Calculate tax and shipping
 */
export async function calculateTaxAndShipping(
  subtotal: number,
  shippingAddress?: ShippingAddress,
  currency: string = 'USD',
  companyId?: string
): Promise<TaxCalculation> {
  try {
    // Get tax rates from company settings or defaults
    const company = companyId ? await prisma.company.findUnique({
      where: { id: companyId },
      select: { country: true, currency: true }
    }) : null;

    const taxRate = 0.08; // Default 8% tax rate
    const taxAmount = subtotal * taxRate;

    // Calculate shipping based on address and subtotal
    let shippingCost = 0;
    if (shippingAddress) {
      // Free shipping over $100
      if (subtotal < 100) {
        shippingCost = shippingAddress.country === 'US' ? 9.99 : 19.99;
      }
    } else {
      shippingCost = 9.99; // Default shipping
    }

    const total = subtotal + taxAmount + shippingCost;

    return {
      subtotal,
      taxRate,
      taxAmount,
      shippingCost,
      total,
      currency: company?.currency || currency
    };
  } catch (error) {
    logger.error('Failed to calculate tax and shipping', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    // Return default calculation
    return {
      subtotal,
      taxRate: 0.08,
      taxAmount: subtotal * 0.08,
      shippingCost: 9.99,
      total: subtotal + (subtotal * 0.08) + 9.99,
      currency
    };
  }
}

/**
 * Validate cart before checkout
 */
export async function validateCart(
  userId: string,
  companyId?: string
): Promise<{ valid: boolean; errors: string[] }> {
  try {
    const cart = await getCart(userId, companyId);
    if (!cart || cart.items.length === 0) {
      return { valid: false, errors: ['Cart is empty'] };
    }

    const errors: string[] = [];

    // Check stock availability for each item
    for (const item of cart.items) {
      const stockLevel = await getStockLevel(item.productId, companyId);
      if (stockLevel < item.quantity) {
        errors.push(`${item.productName}: Insufficient stock (available: ${stockLevel})`);
      }
    }

    return { valid: errors.length === 0, errors };
  } catch (error) {
    logger.error('Failed to validate cart', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
    return { valid: false, errors: ['Failed to validate cart'] };
  }
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\services\cart-service.ts