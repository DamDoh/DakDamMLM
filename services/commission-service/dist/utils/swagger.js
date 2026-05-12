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
        title: 'Commission Service API',
        version: '1.0.0',
        description: 'Commission calculation, payout, and bonus management for MLM platform',
        contact: {
            name: 'API Support',
            email: 'support@mlm-platform.com',
        },
    },
    servers: [
        {
            url: 'http://localhost:3002',
            description: 'Development server',
        },
        {
            url: 'https://api.mlm-platform.com/commissions',
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
            Commission: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Commission ID' },
                    userId: { type: 'string', description: 'User ID' },
                    orderId: { type: 'string', description: 'Order ID' },
                    type: {
                        type: 'string',
                        enum: ['DIRECT', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'LEVEL_5', 'UNILEVEL', 'BINARY', 'MATRIX', 'GENERATIONAL', 'PERFORMANCE', 'LOYALTY', 'LEADERSHIP', 'TRAVEL', 'CAR', 'HOUSE'],
                        description: 'Commission type'
                    },
                    level: { type: 'integer', description: 'Commission level' },
                    amount: { type: 'number', description: 'Commission amount' },
                    percentage: { type: 'number', description: 'Commission percentage' },
                    status: {
                        type: 'string',
                        enum: ['PENDING', 'APPROVED', 'PAID', 'CANCELLED', 'HELD', 'LOCKED'],
                        description: 'Commission status'
                    },
                    paidAt: { type: 'string', format: 'date-time', description: 'Payment timestamp' },
                    createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
                },
            },
            CommissionRule: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Rule ID' },
                    name: { type: 'string', description: 'Rule name' },
                    type: {
                        type: 'string',
                        enum: ['DIRECT', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'LEVEL_5', 'UNILEVEL', 'BINARY', 'MATRIX', 'GENERATIONAL', 'PERFORMANCE', 'LOYALTY', 'LEADERSHIP', 'TRAVEL', 'CAR', 'HOUSE'],
                        description: 'Commission type'
                    },
                    level: { type: 'integer', description: 'Commission level' },
                    percentage: { type: 'number', description: 'Commission percentage' },
                    minAmount: { type: 'number', description: 'Minimum amount threshold' },
                    maxAmount: { type: 'number', description: 'Maximum amount threshold' },
                    isActive: { type: 'boolean', description: 'Rule active status' },
                    conditions: { type: 'object', description: 'Additional conditions' },
                    createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
                },
            },
            CommissionPayout: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Payout ID' },
                    userId: { type: 'string', description: 'User ID' },
                    amount: { type: 'number', description: 'Payout amount' },
                    method: {
                        type: 'string',
                        enum: ['BANK_TRANSFER', 'PAYPAL', 'CHECK', 'WIRE_TRANSFER', 'CRYPTO', 'GIFT_CARD'],
                        description: 'Payout method'
                    },
                    status: {
                        type: 'string',
                        enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'],
                        description: 'Payout status'
                    },
                    reference: { type: 'string', description: 'Payment reference' },
                    processedAt: { type: 'string', format: 'date-time', description: 'Processing timestamp' },
                    paidAt: { type: 'string', format: 'date-time', description: 'Payment timestamp' },
                    fees: { type: 'number', description: 'Processing fees' },
                    netAmount: { type: 'number', description: 'Net payout amount' },
                    createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
                },
            },
            CommissionBonus: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Bonus ID' },
                    userId: { type: 'string', description: 'User ID' },
                    type: {
                        type: 'string',
                        enum: ['FAST_START', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'RANK_ADVANCEMENT', 'RECRUITMENT', 'TEAM_BUILDING', 'BREAKAWAY'],
                        description: 'Bonus type'
                    },
                    amount: { type: 'number', description: 'Bonus amount' },
                    description: { type: 'string', description: 'Bonus description' },
                    period: { type: 'string', description: 'Bonus period (Month/Quarter/Year)' },
                    achievedAt: { type: 'string', format: 'date-time', description: 'Achievement timestamp' },
                    paidAt: { type: 'string', format: 'date-time', description: 'Payment timestamp' },
                    createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
                },
            },
            CommissionAnalytics: {
                type: 'object',
                properties: {
                    period: { type: 'string', description: 'Time period' },
                    totalCommissions: { type: 'integer', description: 'Total commissions calculated' },
                    totalAmount: { type: 'number', description: 'Total commission amount' },
                    paidCommissions: { type: 'integer', description: 'Paid commissions' },
                    paidAmount: { type: 'number', description: 'Paid commission amount' },
                    pendingCommissions: { type: 'integer', description: 'Pending commissions' },
                    pendingAmount: { type: 'number', description: 'Pending commission amount' },
                    commissionByType: {
                        type: 'object',
                        description: 'Commissions by type',
                        additionalProperties: { type: 'number' }
                    },
                    commissionByLevel: {
                        type: 'object',
                        description: 'Commissions by level',
                        additionalProperties: { type: 'number' }
                    },
                    topEarners: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                userId: { type: 'string' },
                                fullName: { type: 'string' },
                                totalEarned: { type: 'number' },
                                commissionCount: { type: 'integer' },
                            },
                        },
                    },
                },
            },
            PayoutAnalytics: {
                type: 'object',
                properties: {
                    period: { type: 'string', description: 'Time period' },
                    totalPayouts: { type: 'integer', description: 'Total payouts processed' },
                    totalAmount: { type: 'number', description: 'Total payout amount' },
                    successfulPayouts: { type: 'integer', description: 'Successful payouts' },
                    failedPayouts: { type: 'integer', description: 'Failed payouts' },
                    averageProcessingTime: { type: 'number', description: 'Average processing time in hours' },
                    payoutByMethod: {
                        type: 'object',
                        description: 'Payouts by method',
                        additionalProperties: { type: 'integer' }
                    },
                    monthlyTrends: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                month: { type: 'string' },
                                payoutCount: { type: 'integer' },
                                payoutAmount: { type: 'number' },
                            },
                        },
                    },
                },
            },
            BonusAnalytics: {
                type: 'object',
                properties: {
                    period: { type: 'string', description: 'Time period' },
                    totalBonuses: { type: 'integer', description: 'Total bonuses achieved' },
                    totalAmount: { type: 'number', description: 'Total bonus amount' },
                    bonusesByType: {
                        type: 'object',
                        description: 'Bonuses by type',
                        additionalProperties: { type: 'integer' }
                    },
                    topPerformers: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                userId: { type: 'string' },
                                fullName: { type: 'string' },
                                bonusCount: { type: 'integer' },
                                totalBonus: { type: 'number' },
                            },
                        },
                    },
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
                                    commissions: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/Commission' }
                                    },
                                    payouts: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/CommissionPayout' }
                                    },
                                    bonuses: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/CommissionBonus' }
                                    },
                                    rules: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/CommissionRule' }
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