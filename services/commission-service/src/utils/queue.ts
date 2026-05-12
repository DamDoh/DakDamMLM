import * as amqp from 'amqplib';
import { logger } from './logger';

interface QueueMessage {
  id: string;
  type: string;
  data: any;
  priority?: number;
  retryCount?: number;
  maxRetries?: number;
}

class QueueService {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private isConnected: boolean = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.connect();
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      const url = process.env.RABBITMQ_URL || 'amqp://localhost';
      this.connection = await amqp.connect(url) as unknown as amqp.Connection;
      this.channel = await (this.connection as any).createChannel() as amqp.Channel;

      // Setup exchanges and queues
      await this.setupQueues();

      this.connection!.on('error', (err) => {
        logger.error('RabbitMQ connection error', { error: err.message });
        this.isConnected = false;
        this.scheduleReconnect();
      });

      this.connection!.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        this.isConnected = false;
        this.scheduleReconnect();
      });

      this.isConnected = true;
      logger.info('Connected to RabbitMQ');
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ', { error: (error as Error).message });
      this.scheduleReconnect();
    }
  }

  private async setupQueues(): Promise<void> {
    if (!this.channel) return;

    // Commission exchange
    await this.channel.assertExchange('commissions', 'direct', { durable: true });

    // Queues for different commission operations
    const queues = [
      { name: 'commission_calculations', routingKey: 'calculate' },
      { name: 'commission_payments', routingKey: 'pay' },
      { name: 'commission_payouts', routingKey: 'payout' },
      { name: 'commission_bonuses', routingKey: 'bonus' },
      { name: 'commission_notifications', routingKey: 'notify' },
    ];

    for (const queue of queues) {
      await this.channel.assertQueue(queue.name, {
        durable: true,
        arguments: {
          'x-max-retries': 3,
          'x-message-ttl': 86400000, // 24 hours
        }
      });
      await this.channel.bindQueue(queue.name, 'commissions', queue.routingKey);
    }

    // Dead letter queue
    await this.channel.assertQueue('commission_dlq', { durable: true });

    logger.info('RabbitMQ queues and exchanges setup completed');
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;

    this.reconnectTimeout = setTimeout(async () => {
      logger.info('Attempting to reconnect to RabbitMQ');
      this.reconnectTimeout = null;
      await this.connect();
    }, 5000); // Reconnect after 5 seconds
  }

  async close(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await (this.connection as any).close();
    }
    this.isConnected = false;
    logger.info('RabbitMQ connection closed');
  }

  async publishCommission(message: QueueMessage, routingKey: string = 'calculate'): Promise<void> {
    if (!this.channel || !this.isConnected) {
      throw new Error('RabbitMQ not connected');
    }

    try {
      const messageBuffer = Buffer.from(JSON.stringify(message));
      const published = this.channel.publish('commissions', routingKey, messageBuffer, {
        persistent: true,
        priority: message.priority || 0,
        messageId: message.id,
        timestamp: Date.now(),
      });

      if (published) {
        logger.debug('Commission message published to queue', {
          messageId: message.id,
          routingKey,
          type: message.type
        });
      } else {
        logger.warn('Failed to publish commission message to queue', {
          messageId: message.id,
          routingKey,
          type: message.type
        });
      }
    } catch (error) {
      logger.error('Failed to publish commission message', {
        messageId: message.id,
        routingKey,
        error: (error as Error).message
      });
      throw error;
    }
  }

  async consumeCommissions(queueName: string, handler: (message: QueueMessage) => Promise<void>): Promise<void> {
    if (!this.channel || !this.isConnected) {
      throw new Error('RabbitMQ not connected');
    }

    try {
      await this.channel.consume(queueName, async (msg) => {
        if (!msg) return;

        try {
          const message: QueueMessage = JSON.parse(msg.content.toString());

          logger.debug('Processing commission message from queue', {
            messageId: message.id,
            queueName,
            type: message.type
          });

          await handler(message);

          this.channel!.ack(msg);

          logger.debug('Commission message processed successfully', {
            messageId: message.id,
            queueName
          });
        } catch (error) {
          logger.error('Failed to process commission message', {
            messageId: msg.properties.messageId,
            queueName,
            error: (error as Error).message
          });

          // Check retry count
          const retryCount = (msg.properties.headers?.['x-death']?.[0]?.count || 0) + 1;
          const maxRetries = msg.properties.headers?.['x-max-retries'] || 3;

          if (retryCount < maxRetries) {
            // Retry with delay
            setTimeout(() => {
              this.channel!.nack(msg, false, false); // Don't requeue immediately
            }, 5000 * retryCount); // Exponential backoff
          } else {
            // Move to dead letter queue
            this.channel!.reject(msg, false);
            logger.error('Commission message moved to DLQ after max retries', {
              messageId: msg.properties.messageId,
              queueName,
              retryCount
            });
          }
        }
      }, { noAck: false });

      logger.info(`Started consuming commission messages from queue: ${queueName}`);
    } catch (error) {
      logger.error('Failed to setup consumer', {
        queueName,
        error: (error as Error).message
      });
      throw error;
    }
  }

  // Convenience methods for different commission operations
  async publishCommissionCalculation(orderData: any): Promise<void> {
    await this.publishCommission({
      id: `calc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'commission_calculation',
      data: orderData,
      priority: 2, // High priority for calculations
    }, 'calculate');
  }

  async publishCommissionPayment(commissionData: any): Promise<void> {
    await this.publishCommission({
      id: `pay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'commission_payment',
      data: commissionData,
      priority: 1,
    }, 'pay');
  }

  async publishPayoutProcessing(payoutData: any): Promise<void> {
    await this.publishCommission({
      id: `payout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'payout_processing',
      data: payoutData,
      priority: 1,
    }, 'payout');
  }

  async publishBonusCalculation(bonusData: any): Promise<void> {
    await this.publishCommission({
      id: `bonus-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'bonus_calculation',
      data: bonusData,
      priority: 0, // Lower priority for bonuses
    }, 'bonus');
  }

  async publishCommissionNotification(notificationData: any): Promise<void> {
    await this.publishCommission({
      id: `notify-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'commission_notification',
      data: notificationData,
      priority: 0,
    }, 'notify');
  }

  // Health check
  async healthCheck(): Promise<{ status: string; queues?: any }> {
    try {
      if (!this.isConnected || !this.channel) {
        return { status: 'unhealthy' };
      }

      // Check queue status
      const queues = ['commission_calculations', 'commission_payments', 'commission_payouts'];
      const queueInfo: Record<string, any> = {};

      for (const queue of queues) {
        try {
          const info = await this.channel.assertQueue(queue, { passive: true } as any);
          queueInfo[queue] = {
            messageCount: info.messageCount,
            consumerCount: info.consumerCount,
          };
        } catch (error) {
          (queueInfo as any)[queue] = { error: (error as Error).message };
        }
      }

      return {
        status: 'healthy',
        queues: queueInfo
      };
    } catch (error) {
      return { status: 'unhealthy' };
    }
  }
}

// Export singleton instance
export const queueService = new QueueService();
export default queueService;