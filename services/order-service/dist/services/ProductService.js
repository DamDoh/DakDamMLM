"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductService = void 0;
const database_1 = require("../config/database");
const cache_1 = require("../utils/cache");
const logger_1 = require("../utils/logger");
class ProductService {
    async createProduct(productData) {
        const product = await database_1.orderDb.product.create({
            data: productData,
        });
        logger_1.logger.info('Product created', {
            productId: product.id,
            name: product.name,
            sku: product.sku,
        });
        return product;
    }
    async getProducts(query) {
        const { page, limit, category, search, sortBy, sortOrder } = query;
        const skip = (page - 1) * limit;
        const where = { isActive: true };
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
            database_1.orderDb.product.findMany({
                where,
                orderBy: {
                    [sortBy]: sortOrder,
                },
                skip,
                take: limit,
            }),
            database_1.orderDb.product.count({ where }),
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
    async getProductById(productId) {
        // Try cache first
        let product = await cache_1.cacheService.getCachedProduct(productId);
        if (product) {
            return product;
        }
        // Fetch from database
        product = await database_1.orderDb.product.findUnique({
            where: { id: productId },
        });
        if (product) {
            // Cache for future requests
            await cache_1.cacheService.setCachedProduct(productId, product);
        }
        return product;
    }
    async updateProduct(productId, updates) {
        const product = await database_1.orderDb.product.update({
            where: { id: productId },
            data: updates,
        });
        // Invalidate cache
        await cache_1.cacheService.invalidateProductCache(productId);
        logger_1.logger.info('Product updated', {
            productId,
            name: product.name,
        });
        return product;
    }
    async deleteProduct(productId) {
        const product = await database_1.orderDb.product.findUnique({
            where: { id: productId },
            select: { name: true },
        });
        if (!product) {
            throw new Error('Product not found');
        }
        await database_1.orderDb.product.update({
            where: { id: productId },
            data: { isActive: false },
        });
        // Invalidate cache
        await cache_1.cacheService.invalidateProductCache(productId);
        logger_1.logger.info('Product deleted (soft delete)', {
            productId,
            name: product.name,
            sku: product.sku,
        });
    }
    async searchProducts(query, limit = 10) {
        const products = await database_1.orderDb.product.findMany({
            where: {
                isActive: true,
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { description: { contains: query, mode: 'insensitive' } },
                    { ...{ sku: { contains: query, mode: 'insensitive' } } },
                    { category: { contains: query, mode: 'insensitive' } },
                ],
            },
            take: limit,
            orderBy: {
                name: 'asc',
            },
        });
        return products;
    }
    async getProductsByCategory(category, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const [products, total] = await Promise.all([
            database_1.orderDb.product.findMany({
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
            database_1.orderDb.product.count({
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
    async getLowStockProducts(threshold = 10) {
        const products = await database_1.orderDb.product.findMany({
            where: {
                isActive: true,
                ...{ stockQuantity: { lte: threshold } },
            },
            orderBy: {
                ...{ stockQuantity: 'asc' },
            },
        });
        return products;
    }
    async updateInventory(productId, quantity, reason) {
        const product = await database_1.orderDb.product.findUnique({
            where: { id: productId },
            select: { name: true },
        });
        if (!product) {
            throw new Error('Product not found');
        }
        const productWithStock = await database_1.orderDb.product.findUnique({
            where: { id: productId },
        });
        const currentStock = productWithStock?.stockQuantity || 0;
        const newStock = currentStock + quantity;
        if (newStock < 0) {
            throw new Error('Insufficient stock');
        }
        const updatedProduct = await database_1.orderDb.product.update({
            where: { id: productId },
            data: { ...{ stockQuantity: newStock } },
        });
        // Log inventory change
        await database_1.orderDb.inventoryLog.create({
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
        await cache_1.cacheService.invalidateProductCache(productId);
        logger_1.logger.info('Inventory updated', {
            productId,
            productName: product.name,
            quantityChange: quantity,
            newStock,
            reason,
        });
        return updatedProduct;
    }
}
exports.ProductService = ProductService;
//# sourceMappingURL=ProductService.js.map