import { orderDb as db } from '../config/database';
import { cacheService } from '../utils/cache';
import { logger } from '../utils/logger';

interface ProductQuery {
  page: number;
  limit: number;
  category?: string;
  search?: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export class ProductService {
  async createProduct(productData: any) {
    const product = await db.product.create({
      data: productData,
    });

    logger.info('Product created', {
      productId: product.id,
      name: product.name,
      sku: (product as any).sku,
    });

    return product;
  }

  async getProducts(query: ProductQuery) {
    const { page, limit, category, search, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: limit,
      }),
      db.product.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getProductById(productId: string) {
    // Try cache first
    let product = await cacheService.getCachedProduct(productId);
    if (product) {
      return product;
    }

    // Fetch from database
    product = await db.product.findUnique({
      where: { id: productId },
    });

    if (product) {
      // Cache for future requests
      await cacheService.setCachedProduct(productId, product);
    }

    return product;
  }

  async updateProduct(productId: string, updates: any) {
    const product = await db.product.update({
      where: { id: productId },
      data: updates,
    });

    // Invalidate cache
    await cacheService.invalidateProductCache(productId);

    logger.info('Product updated', {
      productId,
      name: product.name,
    });

    return product;
  }

  async deleteProduct(productId: string) {
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { name: true },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    await db.product.update({
      where: { id: productId },
      data: { isActive: false },
    });

    // Invalidate cache
    await cacheService.invalidateProductCache(productId);

    logger.info('Product deleted (soft delete)', {
      productId,
      name: product.name,
      sku: (product as any).sku,
    });
  }

  async searchProducts(query: string, limit: number = 10) {
    const products = await db.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { ...({ sku: { contains: query, mode: 'insensitive' } } as any) },
          { category: { contains: query, mode: 'insensitive' } },
        ],
      } as any,
      take: limit,
      orderBy: {
        name: 'asc',
      },
    });

    return products;
  }

  async getProductsByCategory(category: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      db.product.findMany({
        where: {
          category,
          isActive: true,
        },
        orderBy: {
          name: 'asc',
        },
        skip,
        take: limit,
      }),
      db.product.count({
        where: {
          category,
          isActive: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getLowStockProducts(threshold: number = 10) {
    const products = await db.product.findMany({
      where: {
        isActive: true,
        ...({ stockQuantity: { lte: threshold } } as any),
      },
      orderBy: {
        ...({ stockQuantity: 'asc' } as any),
      },
    });

    return products;
  }

  async updateInventory(productId: string, quantity: number, reason: string) {
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { name: true },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const productWithStock = await db.product.findUnique({
      where: { id: productId },
    }) as any;

    const currentStock = productWithStock?.stockQuantity || 0;
    const newStock = currentStock + quantity;

    if (newStock < 0) {
      throw new Error('Insufficient stock');
    }

    const updatedProduct = await db.product.update({
      where: { id: productId },
      data: { ...({ stockQuantity: newStock } as any) },
    });

    // Log inventory change
    await (db as any).inventoryLog.create({
      data: {
        productId,
        changeType: quantity > 0 ? 'INCREASE' : 'DECREASE',
        quantityChange: Math.abs(quantity),
        previousStock: currentStock,
        newStock,
        reason,
        performedBy: 'system', // Would be actual user in real implementation
      },
    });

    // Invalidate cache
    await cacheService.invalidateProductCache(productId);

    logger.info('Inventory updated', {
      productId,
      productName: product.name,
      quantityChange: quantity,
      newStock,
      reason,
    });

    return updatedProduct;
  }

  async syncProductsFromExternal(sourceUrl: string, apiKey: string) {
    // Fetch products from external API
    const response = await fetch(sourceUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.statusText}`);
    }

    const externalProducts = await response.json();

    const syncedProducts = [];
    for (const extProduct of externalProducts) {
      const productData = {
        name: extProduct.name,
        description: extProduct.description,
        price: extProduct.price,
        sku: extProduct.sku,
        category: extProduct.category,
        stockQuantity: extProduct.stock,
        isActive: true,
        // Map other fields as needed
      };

      const product = await db.product.upsert({
        where: { sku: extProduct.sku },
        update: productData,
        create: productData,
      });

      syncedProducts.push(product);
    }

    logger.info('Products synced from external source', {
      count: syncedProducts.length,
      sourceUrl,
    });

    return { syncedCount: syncedProducts.length, products: syncedProducts };
  }
}