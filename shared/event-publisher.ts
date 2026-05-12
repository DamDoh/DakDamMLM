import { v4 as uuidv4 } from 'uuid';

export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: string;
  data: any;
  metadata: {
    timestamp: string;
    correlationId?: string;
    userId?: string;
    service: string;
    version: string;
  };
}

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
  publishBatch(events: DomainEvent[]): Promise<void>;
}

export class RabbitMQEventPublisher implements EventPublisher {
  private connection: any = null;
  private channel: any = null;
  private readonly exchange = 'domain_events';

  constructor(private serviceName: string) {}

  async connect(): Promise<void> {
    // This would connect to RabbitMQ in a real implementation
    // For now, we'll just log the events
    console.log(`Event publisher connected for service: ${this.serviceName}`);
  }

  async publish(event: DomainEvent): Promise<void> {
    event.metadata.service = this.serviceName;
    event.metadata.timestamp = new Date().toISOString();

    console.log(`Publishing domain event: ${event.type}`, {
      aggregateId: event.aggregateId,
      correlationId: event.metadata.correlationId,
    });

    // In a real implementation, this would publish to RabbitMQ:
    // await this.channel.publish(this.exchange, event.type, Buffer.from(JSON.stringify(event)));
  }

  async publishBatch(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  async close(): Promise<void> {
    // Close RabbitMQ connection
    console.log(`Event publisher closed for service: ${this.serviceName}`);
  }
}

// Event factory functions
export class DomainEvents {
  static createEvent(
    type: string,
    aggregateId: string,
    aggregateType: string,
    data: any,
    metadata: Partial<DomainEvent['metadata']> = {}
  ): DomainEvent {
    return {
      id: uuidv4(),
      type,
      aggregateId,
      aggregateType,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        service: metadata.service || 'unknown',
        version: '1.0',
        ...metadata,
      },
    };
  }

  // User domain events
  static userRegistered(userId: string, userData: any): DomainEvent {
    return this.createEvent('UserRegistered', userId, 'User', userData);
  }

  static userUpdated(userId: string, changes: any): DomainEvent {
    return this.createEvent('UserUpdated', userId, 'User', changes);
  }

  static userActivated(userId: string): DomainEvent {
    return this.createEvent('UserActivated', userId, 'User', {});
  }

  static userDeactivated(userId: string): DomainEvent {
    return this.createEvent('UserDeactivated', userId, 'User', {});
  }

  // Order domain events
  static orderPlaced(orderId: string, orderData: any): DomainEvent {
    return this.createEvent('OrderPlaced', orderId, 'Order', orderData);
  }

  static orderStatusChanged(orderId: string, oldStatus: string, newStatus: string): DomainEvent {
    return this.createEvent('OrderStatusChanged', orderId, 'Order', { oldStatus, newStatus });
  }

  static orderCancelled(orderId: string, reason: string): DomainEvent {
    return this.createEvent('OrderCancelled', orderId, 'Order', { reason });
  }

  // Commission domain events
  static commissionCalculated(orderId: string, commissions: any[]): DomainEvent {
    return this.createEvent('CommissionCalculated', orderId, 'Order', { commissions });
  }

  static commissionPaid(commissionId: string, amount: number): DomainEvent {
    return this.createEvent('CommissionPaid', commissionId, 'Commission', { amount });
  }

  // Payment domain events
  static paymentProcessed(paymentId: string, amount: number, status: string): DomainEvent {
    return this.createEvent('PaymentProcessed', paymentId, 'Payment', { amount, status });
  }

  static paymentFailed(paymentId: string, reason: string): DomainEvent {
    return this.createEvent('PaymentFailed', paymentId, 'Payment', { reason });
  }

  // Genealogy domain events
  static userPlacedInTree(userId: string, sponsorId: string, placementData: any): DomainEvent {
    return this.createEvent('UserPlacedInTree', userId, 'User', { sponsorId, ...placementData });
  }

  static treeStructureChanged(userId: string, changes: any): DomainEvent {
    return this.createEvent('TreeStructureChanged', userId, 'User', changes);
  }
}

// Global event publisher instance
let globalEventPublisher: EventPublisher | null = null;

export function initializeEventPublisher(serviceName: string): EventPublisher {
  globalEventPublisher = new RabbitMQEventPublisher(serviceName);
  return globalEventPublisher;
}

export function getEventPublisher(): EventPublisher {
  if (!globalEventPublisher) {
    throw new Error('Event publisher not initialized. Call initializeEventPublisher() first.');
  }
  return globalEventPublisher;
}

// Convenience function for publishing events
export async function publishEvent(event: DomainEvent): Promise<void> {
  const publisher = getEventPublisher();
  await publisher.publish(event);
}

export async function publishEvents(events: DomainEvent[]): Promise<void> {
  const publisher = getEventPublisher();
  await publisher.publishBatch(events);
}