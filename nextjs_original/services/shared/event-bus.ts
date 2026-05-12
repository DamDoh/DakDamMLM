import { DomainEvent } from './types';
import { EventUtils } from './utils';

// Event bus for microservice communication
export interface EventHandler {
  (event: DomainEvent): Promise<void>;
}

export interface EventSubscription {
  eventType: string;
  handler: EventHandler;
  serviceName: string;
}

class EventBus {
  private subscriptions = new Map<string, EventSubscription[]>();
  private eventQueue: DomainEvent[] = [];
  private processing = false;

  // Subscribe to events
  subscribe(eventType: string, handler: EventHandler, serviceName: string): void {
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, []);
    }

    this.subscriptions.get(eventType)!.push({
      eventType,
      handler,
      serviceName,
    });
  }

  // Unsubscribe from events
  unsubscribe(eventType: string, serviceName: string): void {
    const handlers = this.subscriptions.get(eventType);
    if (handlers) {
      const filtered = handlers.filter(h => h.serviceName !== serviceName);
      this.subscriptions.set(eventType, filtered);
    }
  }

  // Publish events
  async publish(event: DomainEvent): Promise<void> {
    console.log(`📨 Publishing event: ${event.type} for aggregate ${event.aggregateType}:${event.aggregateId}`);

    // Add to queue for async processing
    this.eventQueue.push(event);

    // Process immediately if not already processing
    if (!this.processing) {
      this.processEvents();
    }
  }

  // Process events in queue
  private async processEvents(): Promise<void> {
    if (this.processing || this.eventQueue.length === 0) return;

    this.processing = true;

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      await this.handleEvent(event);
    }

    this.processing = false;
  }

  // Handle individual event
  private async handleEvent(event: DomainEvent): Promise<void> {
    const handlers = this.subscriptions.get(event.type) || [];

    const promises = handlers.map(async (subscription) => {
      try {
        console.log(`🔄 Processing event ${event.type} in service ${subscription.serviceName}`);
        await subscription.handler(event);
      } catch (error) {
        console.error(`❌ Error in event handler for ${event.type} in ${subscription.serviceName}:`, error);
        // In production, implement retry logic and dead letter queue
      }
    });

    await Promise.allSettled(promises);
  }

  // Get subscription info for monitoring
  getSubscriptionInfo(): Record<string, string[]> {
    const info: Record<string, string[]> = {};

    for (const [eventType, subscriptions] of this.subscriptions.entries()) {
      info[eventType] = subscriptions.map(s => s.serviceName);
    }

    return info;
  }

  // Health check
  getHealth(): { queueSize: number; processing: boolean; subscriptions: number } {
    return {
      queueSize: this.eventQueue.length,
      processing: this.processing,
      subscriptions: this.subscriptions.size,
    };
  }
}

// Singleton event bus instance
export const eventBus = new EventBus();

// Event types for the MLM system
export const EventTypes = {
  // User events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_RANK_ADVANCED: 'user.rank_advanced',

  // Commission events
  COMMISSION_CALCULATED: 'commission.calculated',
  COMMISSION_PAID: 'commission.paid',

  // Order events
  ORDER_CREATED: 'order.created',
  ORDER_FULFILLED: 'order.fulfilled',

  // Genealogy events
  MEMBER_PLACED: 'genealogy.member_placed',
  TREE_COMPRESSED: 'genealogy.tree_compressed',

  // Notification events
  NOTIFICATION_SENT: 'notification.sent',
  NOTIFICATION_READ: 'notification.read',

  // Analytics events
  ANALYTICS_COMPUTED: 'analytics.computed',
  REPORT_GENERATED: 'analytics.report_generated',

  // OTP events
  OTP_GENERATED: 'otp.generated',
  OTP_VERIFIED: 'otp.verified',
  OTP_FAILED: 'otp.failed',
} as const;

// Event creators for common domain events
export class DomainEventCreators {
  static userCreated(userId: string, userData: Record<string, any>): DomainEvent {
    return EventUtils.createEvent(
      EventTypes.USER_CREATED,
      userId,
      'User',
      userData
    );
  }

  static userUpdated(userId: string, changes: Record<string, any>): DomainEvent {
    return EventUtils.createEvent(
      EventTypes.USER_UPDATED,
      userId,
      'User',
      { changes }
    );
  }

  static commissionCalculated(
    userId: string,
    commissionId: string,
    amount: number,
    type: string
  ): DomainEvent {
    return EventUtils.createEvent(
      EventTypes.COMMISSION_CALCULATED,
      commissionId,
      'Commission',
      { userId, amount, type }
    );
  }

  static orderFulfilled(orderId: string, userId: string, amount: number): DomainEvent {
    return EventUtils.createEvent(
      EventTypes.ORDER_FULFILLED,
      orderId,
      'Order',
      { userId, amount }
    );
  }

  static rankAdvanced(userId: string, newRank: string, bonus: number): DomainEvent {
    return EventUtils.createEvent(
      EventTypes.USER_RANK_ADVANCED,
      userId,
      'User',
      { newRank, bonus }
    );
  }

  static notificationSent(memberId: string, notificationId: string, type: string): DomainEvent {
    return EventUtils.createEvent(
      EventTypes.NOTIFICATION_SENT,
      notificationId,
      'Notification',
      { memberId, type }
    );
  }

  static otpGenerated(identifier: string, type: 'email' | 'sms', purpose: string, companyId?: string): DomainEvent {
    return EventUtils.createEvent(
      EventTypes.OTP_GENERATED,
      identifier,
      'OtpCode',
      { type, purpose, companyId }
    );
  }

  static otpVerified(identifier: string, type: 'email' | 'sms', purpose: string, companyId?: string): DomainEvent {
    return EventUtils.createEvent(
      EventTypes.OTP_VERIFIED,
      identifier,
      'OtpCode',
      { type, purpose, companyId }
    );
  }
}