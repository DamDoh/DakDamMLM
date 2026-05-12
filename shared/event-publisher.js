"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainEvents = exports.RabbitMQEventPublisher = void 0;
exports.initializeEventPublisher = initializeEventPublisher;
exports.getEventPublisher = getEventPublisher;
exports.publishEvent = publishEvent;
exports.publishEvents = publishEvents;
const uuid_1 = require("uuid");
class RabbitMQEventPublisher {
    constructor(serviceName) {
        this.serviceName = serviceName;
        this.connection = null;
        this.channel = null;
        this.exchange = 'domain_events';
    }
    async connect() {
        // This would connect to RabbitMQ in a real implementation
        // For now, we'll just log the events
        console.log(`Event publisher connected for service: ${this.serviceName}`);
    }
    async publish(event) {
        event.metadata.service = this.serviceName;
        event.metadata.timestamp = new Date().toISOString();
        console.log(`Publishing domain event: ${event.type}`, {
            aggregateId: event.aggregateId,
            correlationId: event.metadata.correlationId,
        });
        // In a real implementation, this would publish to RabbitMQ:
        // await this.channel.publish(this.exchange, event.type, Buffer.from(JSON.stringify(event)));
    }
    async publishBatch(events) {
        for (const event of events) {
            await this.publish(event);
        }
    }
    async close() {
        // Close RabbitMQ connection
        console.log(`Event publisher closed for service: ${this.serviceName}`);
    }
}
exports.RabbitMQEventPublisher = RabbitMQEventPublisher;
// Event factory functions
class DomainEvents {
    static createEvent(type, aggregateId, aggregateType, data, metadata = {}) {
        return {
            id: (0, uuid_1.v4)(),
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
    static userRegistered(userId, userData) {
        return this.createEvent('UserRegistered', userId, 'User', userData);
    }
    static userUpdated(userId, changes) {
        return this.createEvent('UserUpdated', userId, 'User', changes);
    }
    static userActivated(userId) {
        return this.createEvent('UserActivated', userId, 'User', {});
    }
    static userDeactivated(userId) {
        return this.createEvent('UserDeactivated', userId, 'User', {});
    }
    // Order domain events
    static orderPlaced(orderId, orderData) {
        return this.createEvent('OrderPlaced', orderId, 'Order', orderData);
    }
    static orderStatusChanged(orderId, oldStatus, newStatus) {
        return this.createEvent('OrderStatusChanged', orderId, 'Order', { oldStatus, newStatus });
    }
    static orderCancelled(orderId, reason) {
        return this.createEvent('OrderCancelled', orderId, 'Order', { reason });
    }
    // Commission domain events
    static commissionCalculated(orderId, commissions) {
        return this.createEvent('CommissionCalculated', orderId, 'Order', { commissions });
    }
    static commissionPaid(commissionId, amount) {
        return this.createEvent('CommissionPaid', commissionId, 'Commission', { amount });
    }
    // Payment domain events
    static paymentProcessed(paymentId, amount, status) {
        return this.createEvent('PaymentProcessed', paymentId, 'Payment', { amount, status });
    }
    static paymentFailed(paymentId, reason) {
        return this.createEvent('PaymentFailed', paymentId, 'Payment', { reason });
    }
    // Genealogy domain events
    static userPlacedInTree(userId, sponsorId, placementData) {
        return this.createEvent('UserPlacedInTree', userId, 'User', { sponsorId, ...placementData });
    }
    static treeStructureChanged(userId, changes) {
        return this.createEvent('TreeStructureChanged', userId, 'User', changes);
    }
}
exports.DomainEvents = DomainEvents;
// Global event publisher instance
let globalEventPublisher = null;
function initializeEventPublisher(serviceName) {
    globalEventPublisher = new RabbitMQEventPublisher(serviceName);
    return globalEventPublisher;
}
function getEventPublisher() {
    if (!globalEventPublisher) {
        throw new Error('Event publisher not initialized. Call initializeEventPublisher() first.');
    }
    return globalEventPublisher;
}
// Convenience function for publishing events
async function publishEvent(event) {
    const publisher = getEventPublisher();
    await publisher.publish(event);
}
async function publishEvents(events) {
    const publisher = getEventPublisher();
    await publisher.publishBatch(events);
}
//# sourceMappingURL=event-publisher.js.map