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
export declare class RabbitMQEventPublisher implements EventPublisher {
    private serviceName;
    private connection;
    private channel;
    private readonly exchange;
    constructor(serviceName: string);
    connect(): Promise<void>;
    publish(event: DomainEvent): Promise<void>;
    publishBatch(events: DomainEvent[]): Promise<void>;
    close(): Promise<void>;
}
export declare class DomainEvents {
    static createEvent(type: string, aggregateId: string, aggregateType: string, data: any, metadata?: Partial<DomainEvent['metadata']>): DomainEvent;
    static userRegistered(userId: string, userData: any): DomainEvent;
    static userUpdated(userId: string, changes: any): DomainEvent;
    static userActivated(userId: string): DomainEvent;
    static userDeactivated(userId: string): DomainEvent;
    static orderPlaced(orderId: string, orderData: any): DomainEvent;
    static orderStatusChanged(orderId: string, oldStatus: string, newStatus: string): DomainEvent;
    static orderCancelled(orderId: string, reason: string): DomainEvent;
    static commissionCalculated(orderId: string, commissions: any[]): DomainEvent;
    static commissionPaid(commissionId: string, amount: number): DomainEvent;
    static paymentProcessed(paymentId: string, amount: number, status: string): DomainEvent;
    static paymentFailed(paymentId: string, reason: string): DomainEvent;
    static userPlacedInTree(userId: string, sponsorId: string, placementData: any): DomainEvent;
    static treeStructureChanged(userId: string, changes: any): DomainEvent;
}
export declare function initializeEventPublisher(serviceName: string): EventPublisher;
export declare function getEventPublisher(): EventPublisher;
export declare function publishEvent(event: DomainEvent): Promise<void>;
export declare function publishEvents(events: DomainEvent[]): Promise<void>;
//# sourceMappingURL=event-publisher.d.ts.map