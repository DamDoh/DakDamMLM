"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerSpec = exports.swaggerUi = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
exports.swaggerUi = swagger_ui_express_1.default;
const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
        title: 'Order Service API',
        version: '1.0.0',
        description: 'A comprehensive microservice for order management, product catalog, shopping cart, and inventory in MLM systems',
        contact: {
            name: 'API Support',
            email: 'support@mlm-platform.com',
        },
    },
    servers: [
        {
            url: 'http://localhost:3004',
            description: 'Development server',
        },
        {
            url: 'https://api.mlm-platform.com/orders',
            description: 'Production server',
        },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            },
        },
        schemas: {
            Order: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Order ID' },
                    orderNumber: { type: 'string', description: 'Unique order number' },
                    userId: { type: 'string', description: 'User ID' },
                    status: {
                        type: 'string',
                        enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'],
                        description: 'Order status'
                    },
                    totalAmount: { type: 'number', description: 'Total order amount' },
                    taxAmount: { type: 'number', description: 'Tax amount' },
                    shippingAmount: { type: 'number', description: 'Shipping cost' },
                    discountAmount: { type: 'number', description: 'Discount amount' },
                    currency: { type: 'string', default: 'USD', description: 'Currency code' },
                    paymentMethod: { type: 'string', description: 'Payment method used' },
                    paymentStatus: {
                        type: 'string',
                        enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
                        description: 'Payment status'
                    },
                    shippingAddress: { type: 'object', description: 'Shipping address' },
                    billingAddress: { type: 'object', description: 'Billing address' },
                    orderedAt: { type: 'string', format: 'date-time', description: 'Order date' },
                    shippedAt: { type: 'string', format: 'date-time', description: 'Shipped date' },
                    deliveredAt: { type: 'string', format: 'date-time', description: 'Delivered date' },
                },
            },
            OrderItem: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Order item ID' },
                    orderId: { type: 'string', description: 'Order ID' },
                    productId: { type: 'string', description: 'Product ID' },
                    productName: { type: 'string', description: 'Product name' },
                    quantity: { type: 'integer', description: 'Quantity ordered' },
                    unitPrice: { type: 'number', description: 'Unit price' },
                    totalPrice: { type: 'number', description: 'Total price for this item' },
                    pv: { type: 'number', description: 'Product Value for commissions' },
                    sku: { type: 'string', description: 'Stock Keeping Unit' },
                    status: {
                        type: 'string',
                        enum: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'],
                        description: 'Item status'
                    },
                },
            },
            Product: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Product ID' },
                    name: { type: 'string', description: 'Product name' },
                    description: { type: 'string', description: 'Product description' },
                    sku: { type: 'string', description: 'Stock Keeping Unit' },
                    price: { type: 'number', description: 'Product price' },
                    pv: { type: 'number', description: 'Product Value for commissions' },
                    cost: { type: 'number', description: 'Product cost' },
                    category: { type: 'string', description: 'Product category' },
                    brand: { type: 'string', description: 'Product brand' },
                    images: { type: 'array', items: { type: 'string' }, description: 'Product images' },
                    isActive: { type: 'boolean', description: 'Whether product is active' },
                    stockQuantity: { type: 'integer', description: 'Current stock quantity' },
                    minStockLevel: { type: 'integer', description: 'Minimum stock level' },
                    tags: { type: 'array', items: { type: 'string' }, description: 'Product tags' },
                },
            },
            Cart: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Cart ID' },
                    userId: { type: 'string', description: 'User ID' },
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                productId: { type: 'string' },
                                productName: { type: 'string' },
                                quantity: { type: 'integer' },
                                unitPrice: { type: 'number' },
                                totalPrice: { type: 'number' },
                            },
                        },
                        description: 'Cart items'
                    },
                    totalAmount: { type: 'number', description: 'Total cart amount' },
                },
            },
            OrderSummary: {
                type: 'object',
                properties: {
                    period: { type: 'string', description: 'Time period' },
                    totalOrders: { type: 'integer', description: 'Total number of orders' },
                    totalRevenue: { type: 'number', description: 'Total revenue' },
                    averageOrderValue: { type: 'number', description: 'Average order value' },
                    orderStatusDistribution: {
                        type: 'object',
                        description: 'Orders by status',
                        additionalProperties: { type: 'integer' }
                    },
                    topProducts: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                productId: { type: 'string' },
                                productName: { type: 'string' },
                                quantitySold: { type: 'integer' },
                                revenue: { type: 'number' },
                            },
                        },
                    },
                },
            },
            InventoryLog: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Log ID' },
                    productId: { type: 'string', description: 'Product ID' },
                    changeType: {
                        type: 'string',
                        enum: ['INCREASE', 'DECREASE', 'ADJUSTMENT'],
                        description: 'Type of inventory change'
                    },
                    quantityChange: { type: 'integer', description: 'Quantity changed' },
                    previousStock: { type: 'integer', description: 'Previous stock level' },
                    newStock: { type: 'integer', description: 'New stock level' },
                    reason: { type: 'string', description: 'Reason for change' },
                    performedBy: { type: 'string', description: 'User who performed the change' },
                    performedAt: { type: 'string', format: 'date-time', description: 'When the change occurred' },
                },
            },
            ApiResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', description: 'Operation success status' },
                    data: { description: 'Response data' },
                    error: { type: 'string', description: 'Error message if any' },
                    timestamp: { type: 'string', format: 'date-time', description: 'Response timestamp' },
                    requestId: { type: 'string', description: 'Unique request identifier' },
                },
            },
            PaginatedResponse: {
                allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                        type: 'object',
                        properties: {
                            data: {
                                type: 'object',
                                properties: {
                                    orders: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/Order' }
                                    },
                                    products: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/Product' }
                                    },
                                    pagination: {
                                        type: 'object',
                                        properties: {
                                            page: { type: 'integer', description: 'Current page' },
                                            limit: { type: 'integer', description: 'Items per page' },
                                            total: { type: 'integer', description: 'Total items' },
                                            totalPages: { type: 'integer', description: 'Total pages' },
                                            hasNext: { type: 'boolean', description: 'Has next page' },
                                            hasPrev: { type: 'boolean', description: 'Has previous page' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                ],
            },
        },
    },
    security: [
        {
            bearerAuth: [],
        },
    ],
};
const options = {
    swaggerDefinition,
    apis: ['./src/routes/*.ts', './src/controllers/*.ts'], // Paths to files containing OpenAPI definitions
};
const swaggerSpec = (0, swagger_jsdoc_1.default)(options);
exports.swaggerSpec = swaggerSpec;
//# sourceMappingURL=swagger.js.map