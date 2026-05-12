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
        title: 'Payment Service API',
        version: '1.0.0',
        description: 'A comprehensive microservice for payment processing, wallet management, and commission payouts in MLM systems',
        contact: {
            name: 'API Support',
            email: 'support@mlm-platform.com',
        },
    },
    servers: [
        {
            url: 'http://localhost:3008',
            description: 'Development server',
        },
        {
            url: 'https://api.mlm-platform.com/payments',
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
            PaymentTransaction: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Transaction ID' },
                    transactionId: { type: 'string', description: 'Unique transaction identifier' },
                    userId: { type: 'string', description: 'User ID' },
                    orderId: { type: 'string', description: 'Associated order ID' },
                    commissionId: { type: 'string', description: 'Associated commission ID' },
                    type: {
                        type: 'string',
                        enum: ['PAYMENT', 'COMMISSION', 'REFUND', 'WITHDRAWAL', 'DEPOSIT'],
                        description: 'Transaction type'
                    },
                    method: {
                        type: 'string',
                        enum: ['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'BANK_TRANSFER', 'CRYPTO', 'CASH', 'CHECK'],
                        description: 'Payment method'
                    },
                    provider: {
                        type: 'string',
                        enum: ['STRIPE', 'PAYPAL', 'BANK', 'MANUAL', 'CRYPTO'],
                        description: 'Payment provider'
                    },
                    amount: { type: 'number', description: 'Transaction amount' },
                    currency: { type: 'string', default: 'USD', description: 'Currency code' },
                    status: {
                        type: 'string',
                        enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
                        description: 'Transaction status'
                    },
                    fees: { type: 'number', description: 'Processing fees' },
                    netAmount: { type: 'number', description: 'Net amount after fees' },
                    processedAt: { type: 'string', format: 'date-time', description: 'Processing timestamp' },
                },
            },
            Wallet: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Wallet ID' },
                    userId: { type: 'string', description: 'User ID' },
                    balance: { type: 'number', description: 'Current balance' },
                    pendingAmount: { type: 'number', description: 'Pending amount' },
                    totalEarned: { type: 'number', description: 'Total earned' },
                    totalWithdrawn: { type: 'number', description: 'Total withdrawn' },
                    currency: { type: 'string', default: 'USD', description: 'Currency code' },
                    isActive: { type: 'boolean', description: 'Wallet active status' },
                },
            },
            PayoutRequest: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Payout request ID' },
                    userId: { type: 'string', description: 'User ID' },
                    amount: { type: 'number', description: 'Payout amount' },
                    currency: { type: 'string', default: 'USD', description: 'Currency code' },
                    method: {
                        type: 'string',
                        enum: ['BANK_TRANSFER', 'PAYPAL', 'CHECK', 'WIRE_TRANSFER', 'CRYPTO'],
                        description: 'Payout method'
                    },
                    status: {
                        type: 'string',
                        enum: ['PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
                        description: 'Payout status'
                    },
                    accountDetails: { type: 'object', description: 'Account details for payout' },
                    requestedAt: { type: 'string', format: 'date-time', description: 'Request timestamp' },
                    processedAt: { type: 'string', format: 'date-time', description: 'Processing timestamp' },
                    fees: { type: 'number', description: 'Processing fees' },
                    netAmount: { type: 'number', description: 'Net payout amount' },
                },
            },
            WalletTransaction: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Transaction ID' },
                    walletId: { type: 'string', description: 'Wallet ID' },
                    userId: { type: 'string', description: 'User ID' },
                    type: {
                        type: 'string',
                        enum: ['CREDIT', 'DEBIT', 'HOLD', 'RELEASE'],
                        description: 'Transaction type'
                    },
                    amount: { type: 'number', description: 'Transaction amount' },
                    balanceBefore: { type: 'number', description: 'Balance before transaction' },
                    balanceAfter: { type: 'number', description: 'Balance after transaction' },
                    description: { type: 'string', description: 'Transaction description' },
                    referenceId: { type: 'string', description: 'Reference ID (order, commission, etc.)' },
                    referenceType: { type: 'string', description: 'Reference type' },
                    createdAt: { type: 'string', format: 'date-time', description: 'Transaction timestamp' },
                },
            },
            PaymentAnalytics: {
                type: 'object',
                properties: {
                    period: { type: 'string', description: 'Time period' },
                    totalTransactions: { type: 'integer', description: 'Total transactions' },
                    totalVolume: { type: 'number', description: 'Total payment volume' },
                    averageTransactionValue: { type: 'number', description: 'Average transaction value' },
                    successRate: { type: 'number', description: 'Transaction success rate' },
                    paymentMethodDistribution: {
                        type: 'object',
                        description: 'Transactions by payment method',
                        additionalProperties: { type: 'integer' }
                    },
                    revenueByProvider: {
                        type: 'object',
                        description: 'Revenue by payment provider',
                        additionalProperties: { type: 'number' }
                    },
                    topPayingUsers: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                userId: { type: 'string' },
                                totalPaid: { type: 'number' },
                                transactionCount: { type: 'integer' },
                            },
                        },
                    },
                },
            },
            WalletAnalytics: {
                type: 'object',
                properties: {
                    totalWallets: { type: 'integer', description: 'Total active wallets' },
                    totalBalance: { type: 'number', description: 'Total balance across all wallets' },
                    averageBalance: { type: 'number', description: 'Average wallet balance' },
                    pendingPayouts: { type: 'integer', description: 'Number of pending payouts' },
                    totalEarned: { type: 'number', description: 'Total earnings' },
                    totalWithdrawn: { type: 'number', description: 'Total withdrawals' },
                    topEarners: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                userId: { type: 'string' },
                                totalEarned: { type: 'number' },
                                currentBalance: { type: 'number' },
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
                                    transactions: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/PaymentTransaction' }
                                    },
                                    wallets: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/Wallet' }
                                    },
                                    payouts: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/PayoutRequest' }
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