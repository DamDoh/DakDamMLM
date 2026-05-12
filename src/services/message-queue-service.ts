// Message Queue Service
// Provides asynchronous processing capabilities for commission calculations and other heavy operations

import { logger } from '@/lib/logger';
import { getEnvConfig } from '@/lib/env-validation';

interface QueueMessage {
  id: string;
  type: string;
  payload: any;
  priority: 'low' | 'normal' | 'high' | 'critical';
  createdAt: Date;
  retryCount: number;
  maxRetries: number;
}

interface QueueOptions {
  maxRetries: number;
  timeout: number; // milliseconds
  priority: QueueMessage['priority'];
}

interface QueueProcessor<T = any> {
  process: (message: QueueMessage) => Promise<T>;
  onError?: (error: Error, message: QueueMessage) => Promise<void>;
  onSuccess?: (result: T, message: QueueMessage) => Promise<void>;
}

class MessageQueueService {
  private queues: Map<string, QueueMessage[]> = new Map();
  private processors: Map<string, QueueProcessor> = new Map();
  private processing: Set<string> = new Set();
  private env = getEnvConfig();

  constructor() {
    // Start processing queues
    this.startProcessing();
  }

  /**
   * Add a message to a queue
   */
  async enqueue(
    queueName: string,
    type: string,
    payload: any,
    options: Partial<QueueOptions> = {}
  ): Promise<string> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const message: QueueMessage = {
      id: messageId,
      type,
      payload,
      priority: options.priority || 'normal',
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
    };

    // Get or create queue
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }

    const queue = this.queues.get(queueName)!;

    // Insert based on priority
    const insertIndex = this.getInsertIndex(queue, message.priority);
    queue.splice(insertIndex, 0, message);

    logger.info(`Message enqueued: ${messageId} in queue ${queueName}`, {
      type,
      priority: message.priority,
      queueSize: queue.length,
    });

    return messageId;
  }

  /**
   * Register a processor for a queue
   */
  registerProcessor(queueName: string, processor: QueueProcessor): void {
    this.processors.set(queueName, processor);
    logger.info(`Processor registered for queue: ${queueName}`);
  }

  /**
   * Get queue statistics
   */
  getQueueStats(queueName?: string): Record<string, any> {
    if (queueName) {
      const queue = this.queues.get(queueName) || [];
      const stats = this.calculateQueueStats(queue);
      return { [queueName]: stats };
    }

    const allStats: Record<string, any> = {};
    for (const [name, queue] of this.queues.entries()) {
      allStats[name] = this.calculateQueueStats(queue);
    }
    return allStats;
  }

  private calculateQueueStats(queue: QueueMessage[]): any {
    const priorities = { low: 0, normal: 0, high: 0, critical: 0 };
    let oldestMessage: Date | null = null;
    let retries = 0;

    for (const msg of queue) {
      priorities[msg.priority]++;
      retries += msg.retryCount;
      if (!oldestMessage || msg.createdAt < oldestMessage) {
        oldestMessage = msg.createdAt;
      }
    }

    return {
      size: queue.length,
      priorities,
      totalRetries: retries,
      oldestMessage: oldestMessage?.toISOString(),
      processing: Array.from(this.processing).filter(id =>
        queue.some(msg => msg.id === id)
      ).length,
    };
  }

  private getInsertIndex(queue: QueueMessage[], priority: QueueMessage['priority']): number {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };

    for (let i = 0; i < queue.length; i++) {
      if (priorityOrder[priority] < priorityOrder[queue[i].priority]) {
        return i;
      }
    }

    return queue.length;
  }

  private startProcessing(): void {
    // Process queues every second
    setInterval(() => {
      this.processQueues();
    }, 1000);
  }

  private async processQueues(): Promise<void> {
    for (const [queueName, queue] of this.queues.entries()) {
      if (queue.length === 0) continue;

      const processor = this.processors.get(queueName);
      if (!processor) continue;

      // Process one message at a time per queue to avoid overwhelming
      const message = queue[0];
      if (this.processing.has(message.id)) continue;

      this.processing.add(message.id);

      try {
        // Check if message has timed out
        const age = Date.now() - message.createdAt.getTime();
        if (age > 300000) { // 5 minutes
          logger.warn(`Message ${message.id} timed out, removing from queue`);
          queue.shift();
          this.processing.delete(message.id);
          continue;
        }

        logger.debug(`Processing message ${message.id} from queue ${queueName}`);

        const result = await processor.process(message);

        // Remove from queue
        queue.shift();

        // Call success callback
        if (processor.onSuccess) {
          await processor.onSuccess(result, message);
        }

        logger.info(`Message ${message.id} processed successfully`);

      } catch (error) {
        logger.error(`Failed to process message ${message.id}:`, { error });

        message.retryCount++;

        if (message.retryCount >= message.maxRetries) {
          logger.error(`Message ${message.id} failed permanently after ${message.maxRetries} retries`);

          // Call error callback
          if (processor.onError) {
            await processor.onError(error as Error, message);
          }

          // Remove from queue
          queue.shift();
        } else {
          logger.warn(`Retrying message ${message.id} (${message.retryCount}/${message.maxRetries})`);
          // Move to end of queue for retry
          queue.push(queue.shift()!);
        }

      } finally {
        this.processing.delete(message.id);
      }
    }
  }

  /**
   * Clear a queue (for testing/admin purposes)
   */
  clearQueue(queueName: string): void {
    this.queues.set(queueName, []);
    logger.info(`Queue ${queueName} cleared`);
  }

  /**
   * Health check
   */
  healthCheck(): { status: string; queues: number; totalMessages: number; timestamp: string } {
    let totalMessages = 0;
    for (const queue of this.queues.values()) {
      totalMessages += queue.length;
    }

    return {
      status: 'healthy',
      queues: this.queues.size,
      totalMessages,
      timestamp: new Date().toISOString(),
    };
  }
}

// Singleton instance
let messageQueueService: MessageQueueService | null = null;

export function getMessageQueueService(): MessageQueueService {
  if (!messageQueueService) {
    messageQueueService = new MessageQueueService();
  }
  return messageQueueService;
}

export { MessageQueueService };
export type { QueueMessage, QueueOptions, QueueProcessor };