"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueService = void 0;
const amqp = __importStar(require("amqplib"));
const logger_1 = require("./logger");
class QueueService {
    constructor() {
        this.connection = null;
        this.channel = null;
        this.isConnected = false;
        this.reconnectTimeout = null;
        this.connect();
    }
    async connect() {
        if (this.isConnected)
            return;
        try {
            const url = process.env.RABBITMQ_URL || 'amqp://localhost';
            this.connection = await amqp.connect(url);
            this.channel = await this.connection.createChannel();
            // Setup exchanges and queues
            await this.setupQueues();
            this.connection.on('error', (err) => {
                logger_1.logger.error('RabbitMQ connection error', { error: err.message });
                this.isConnected = false;
                this.scheduleReconnect();
            });
            this.connection.on('close', () => {
                logger_1.logger.warn('RabbitMQ connection closed');
                this.isConnected = false;
                this.scheduleReconnect();
            });
            this.isConnected = true;
            logger_1.logger.info('Connected to RabbitMQ');
        }
        catch (error) {
            logger_1.logger.error('Failed to connect to RabbitMQ', { error: error.message });
            this.scheduleReconnect();
        }
    }
    async setupQueues() {
        if (!this.channel)
            return;
        // Notification exchange
        await this.channel.assertExchange('notifications', 'direct', { durable: true });
        // Queues for different notification types
        const queues = [
            { name: 'email_notifications', routingKey: 'email' },
            { name: 'sms_notifications', routingKey: 'sms' },
            { name: 'push_notifications', routingKey: 'push' },
            { name: 'campaign_notifications', routingKey: 'campaign' },
            { name: 'system_notifications', routingKey: 'system' },
        ];
        for (const queue of queues) {
            await this.channel.assertQueue(queue.name, {
                durable: true,
                arguments: {
                    'x-max-retries': 3,
                    'x-message-ttl': 86400000, // 24 hours
                }
            });
            await this.channel.bindQueue(queue.name, 'notifications', queue.routingKey);
        }
        // Dead letter queue
        await this.channel.assertQueue('notification_dlq', { durable: true });
        logger_1.logger.info('RabbitMQ queues and exchanges setup completed');
    }
    scheduleReconnect() {
        if (this.reconnectTimeout)
            return;
        this.reconnectTimeout = setTimeout(async () => {
            logger_1.logger.info('Attempting to reconnect to RabbitMQ');
            this.reconnectTimeout = null;
            await this.connect();
        }, 5000); // Reconnect after 5 seconds
    }
    async close() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.channel) {
            await this.channel.close();
        }
        if (this.connection) {
            await this.connection.close();
        }
        this.isConnected = false;
        logger_1.logger.info('RabbitMQ connection closed');
    }
    async publishNotification(message, routingKey = 'system') {
        if (!this.channel || !this.isConnected) {
            throw new Error('RabbitMQ not connected');
        }
        try {
            const messageBuffer = Buffer.from(JSON.stringify(message));
            const published = this.channel.publish('notifications', routingKey, messageBuffer, {
                persistent: true,
                priority: message.priority || 0,
                messageId: message.id,
                timestamp: Date.now(),
            });
            if (published) {
                logger_1.logger.debug('Notification published to queue', {
                    messageId: message.id,
                    routingKey,
                    type: message.type
                });
            }
            else {
                logger_1.logger.warn('Failed to publish notification to queue', {
                    messageId: message.id,
                    routingKey,
                    type: message.type
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to publish notification', {
                messageId: message.id,
                routingKey,
                error: error.message
            });
            throw error;
        }
    }
    async consumeNotifications(queueName, handler) {
        if (!this.channel || !this.isConnected) {
            throw new Error('RabbitMQ not connected');
        }
        try {
            await this.channel.consume(queueName, async (msg) => {
                if (!msg)
                    return;
                try {
                    const message = JSON.parse(msg.content.toString());
                    logger_1.logger.debug('Processing notification from queue', {
                        messageId: message.id,
                        queueName,
                        type: message.type
                    });
                    await handler(message);
                    this.channel.ack(msg);
                    logger_1.logger.debug('Notification processed successfully', {
                        messageId: message.id,
                        queueName
                    });
                }
                catch (error) {
                    logger_1.logger.error('Failed to process notification', {
                        messageId: msg.properties.messageId,
                        queueName,
                        error: error.message
                    });
                    // Check retry count
                    const retryCount = (msg.properties.headers?.['x-death']?.[0]?.count || 0) + 1;
                    const maxRetries = msg.properties.headers?.['x-max-retries'] || 3;
                    if (retryCount < maxRetries) {
                        // Retry with delay
                        setTimeout(() => {
                            this.channel.nack(msg, false, false); // Don't requeue immediately
                        }, 5000 * retryCount); // Exponential backoff
                    }
                    else {
                        // Move to dead letter queue
                        this.channel.reject(msg, false);
                        logger_1.logger.error('Notification moved to DLQ after max retries', {
                            messageId: msg.properties.messageId,
                            queueName,
                            retryCount
                        });
                    }
                }
            }, { noAck: false });
            logger_1.logger.info(`Started consuming notifications from queue: ${queueName}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to setup consumer', {
                queueName,
                error: error.message
            });
            throw error;
        }
    }
    // Convenience methods for different notification types
    async publishEmailNotification(notificationData) {
        await this.publishNotification({
            id: `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'email',
            data: notificationData,
            priority: 1,
        }, 'email');
    }
    async publishSMSNotification(notificationData) {
        await this.publishNotification({
            id: `sms-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'sms',
            data: notificationData,
            priority: 2, // Higher priority for SMS
        }, 'sms');
    }
    async publishPushNotification(notificationData) {
        await this.publishNotification({
            id: `push-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'push',
            data: notificationData,
            priority: 1,
        }, 'push');
    }
    async publishCampaignNotification(campaignData) {
        await this.publishNotification({
            id: `campaign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'campaign',
            data: campaignData,
            priority: 0, // Lower priority for campaigns
        }, 'campaign');
    }
    // Health check
    async healthCheck() {
        try {
            if (!this.isConnected || !this.channel) {
                return { status: 'unhealthy' };
            }
            // Check queue status
            const queues = ['email_notifications', 'sms_notifications', 'push_notifications'];
            const queueInfo = {};
            for (const queue of queues) {
                try {
                    const info = await this.channel.assertQueue(queue, { passive: true });
                    queueInfo[queue] = {
                        messageCount: info.messageCount,
                        consumerCount: info.consumerCount,
                    };
                }
                catch (error) {
                    queueInfo[queue] = { error: error.message };
                }
            }
            return {
                status: 'healthy',
                queues: queueInfo
            };
        }
        catch (error) {
            return { status: 'unhealthy' };
        }
    }
}
// Export singleton instance
exports.queueService = new QueueService();
exports.default = exports.queueService;
//# sourceMappingURL=queue.js.map