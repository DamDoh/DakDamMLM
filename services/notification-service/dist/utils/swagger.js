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
        title: 'Notification Service API',
        version: '1.0.0',
        description: 'Multi-channel notification service for MLM platform - Email, SMS, Push Notifications, and Campaigns',
        contact: {
            name: 'API Support',
            email: 'support@mlm-platform.com',
        },
    },
    servers: [
        {
            url: 'http://localhost:3005',
            description: 'Development server',
        },
        {
            url: 'https://api.mlm-platform.com/notifications',
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
            Notification: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Notification ID' },
                    userId: { type: 'string', description: 'User ID' },
                    type: {
                        type: 'string',
                        enum: ['WELCOME', 'PASSWORD_RESET', 'COMMISSION_EARNED', 'ORDER_PLACED', 'PAYMENT_SUCCESS'],
                        description: 'Notification type'
                    },
                    channel: {
                        type: 'string',
                        enum: ['EMAIL', 'SMS', 'PUSH', 'IN_APP'],
                        description: 'Notification channel'
                    },
                    category: {
                        type: 'string',
                        enum: ['AUTHENTICATION', 'COMMISSIONS', 'ORDERS', 'PAYMENTS', 'SECURITY'],
                        description: 'Notification category'
                    },
                    priority: {
                        type: 'string',
                        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
                        description: 'Notification priority'
                    },
                    title: { type: 'string', description: 'Notification title' },
                    body: { type: 'string', description: 'Notification body' },
                    data: { type: 'object', description: 'Additional notification data' },
                    isRead: { type: 'boolean', description: 'Read status' },
                    isSent: { type: 'boolean', description: 'Sent status' },
                    sentAt: { type: 'string', format: 'date-time', description: 'Sent timestamp' },
                    createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
                },
            },
            NotificationTemplate: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Template ID' },
                    name: { type: 'string', description: 'Template name' },
                    type: {
                        type: 'string',
                        enum: ['WELCOME', 'PASSWORD_RESET', 'COMMISSION_EARNED'],
                        description: 'Template type'
                    },
                    channel: {
                        type: 'string',
                        enum: ['EMAIL', 'SMS', 'PUSH'],
                        description: 'Template channel'
                    },
                    category: {
                        type: 'string',
                        enum: ['AUTHENTICATION', 'COMMISSIONS', 'ORDERS'],
                        description: 'Template category'
                    },
                    title: { type: 'string', description: 'Template title' },
                    body: { type: 'string', description: 'Template body with {{variables}}' },
                    isActive: { type: 'boolean', description: 'Template active status' },
                    createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
                },
            },
            UserNotificationPreference: {
                type: 'object',
                properties: {
                    userId: { type: 'string', description: 'User ID' },
                    emailEnabled: { type: 'boolean', description: 'Email notifications enabled' },
                    smsEnabled: { type: 'boolean', description: 'SMS notifications enabled' },
                    pushEnabled: { type: 'boolean', description: 'Push notifications enabled' },
                    marketingEmails: { type: 'boolean', description: 'Marketing emails enabled' },
                    transactionalEmails: { type: 'boolean', description: 'Transactional emails enabled' },
                    commissionAlerts: { type: 'boolean', description: 'Commission alerts enabled' },
                    orderUpdates: { type: 'boolean', description: 'Order updates enabled' },
                    securityAlerts: { type: 'boolean', description: 'Security alerts enabled' },
                    quietHoursStart: { type: 'string', description: 'Quiet hours start time (HH:MM)' },
                    quietHoursEnd: { type: 'string', description: 'Quiet hours end time (HH:MM)' },
                    timezone: { type: 'string', description: 'User timezone' },
                },
            },
            NotificationCampaign: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Campaign ID' },
                    name: { type: 'string', description: 'Campaign name' },
                    description: { type: 'string', description: 'Campaign description' },
                    type: {
                        type: 'string',
                        enum: ['INSTANT', 'SCHEDULED', 'RECURRING', 'AUTOMATED'],
                        description: 'Campaign type'
                    },
                    status: {
                        type: 'string',
                        enum: ['DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'CANCELLED'],
                        description: 'Campaign status'
                    },
                    targetUsers: { type: 'object', description: 'User targeting criteria' },
                    scheduledAt: { type: 'string', format: 'date-time', description: 'Scheduled timestamp' },
                    totalRecipients: { type: 'integer', description: 'Total target recipients' },
                    sentCount: { type: 'integer', description: 'Notifications sent' },
                    deliveredCount: { type: 'integer', description: 'Notifications delivered' },
                    openedCount: { type: 'integer', description: 'Notifications opened' },
                    clickedCount: { type: 'integer', description: 'Links clicked' },
                    createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
                },
            },
            NotificationAnalytics: {
                type: 'object',
                properties: {
                    period: { type: 'string', description: 'Time period' },
                    totalNotifications: { type: 'integer', description: 'Total notifications sent' },
                    deliveryRate: { type: 'number', description: 'Delivery success rate' },
                    openRate: { type: 'number', description: 'Open rate for email notifications' },
                    clickRate: { type: 'number', description: 'Click rate for email notifications' },
                    channelDistribution: {
                        type: 'object',
                        description: 'Notifications by channel',
                        additionalProperties: { type: 'integer' }
                    },
                    typeDistribution: {
                        type: 'object',
                        description: 'Notifications by type',
                        additionalProperties: { type: 'integer' }
                    },
                    topPerformingTemplates: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                templateId: { type: 'string' },
                                templateName: { type: 'string' },
                                sentCount: { type: 'integer' },
                                deliveryRate: { type: 'number' },
                                engagementRate: { type: 'number' },
                            },
                        },
                    },
                },
            },
            CampaignAnalytics: {
                type: 'object',
                properties: {
                    campaignId: { type: 'string', description: 'Campaign ID' },
                    campaignName: { type: 'string', description: 'Campaign name' },
                    totalRecipients: { type: 'integer', description: 'Total recipients' },
                    sentCount: { type: 'integer', description: 'Notifications sent' },
                    deliveredCount: { type: 'integer', description: 'Notifications delivered' },
                    openedCount: { type: 'integer', description: 'Notifications opened' },
                    clickedCount: { type: 'integer', description: 'Links clicked' },
                    bouncedCount: { type: 'integer', description: 'Bounced notifications' },
                    deliveryRate: { type: 'number', description: 'Delivery rate percentage' },
                    openRate: { type: 'number', description: 'Open rate percentage' },
                    clickRate: { type: 'number', description: 'Click rate percentage' },
                    bounceRate: { type: 'number', description: 'Bounce rate percentage' },
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
                                    notifications: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/Notification' }
                                    },
                                    campaigns: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/NotificationCampaign' }
                                    },
                                    templates: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/NotificationTemplate' }
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