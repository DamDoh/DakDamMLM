interface CreateOrderData {
    userId: string;
    items: Array<{
        productId: string;
        quantity: number;
        variant?: any;
    }>;
    shippingAddress?: any;
    billingAddress?: any;
    paymentMethod?: string;
}
interface OrderQuery {
    userId?: string;
    status?: string;
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
}
interface AnalyticsQuery {
    period: string;
    startDate?: string;
    endDate?: string;
}
export declare class OrderService {
    createOrder(orderData: CreateOrderData): Promise<{
        items: {
            id: string;
            status: import(".prisma/client").$Enums.OrderItemStatus;
            orderId: string;
            productId: string;
            productName: string;
            quantity: number;
            unitPrice: number;
            totalPrice: number;
            pv: number;
            sku: string | null;
            variant: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
    } & {
        id: string;
        orderNumber: string;
        userId: string;
        status: import(".prisma/client").$Enums.OrderStatus;
        totalAmount: number;
        taxAmount: number;
        shippingAmount: number;
        discountAmount: number;
        currency: string;
        paymentMethod: string | null;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        shippingAddress: import("@prisma/client/runtime/library").JsonValue | null;
        billingAddress: import("@prisma/client/runtime/library").JsonValue | null;
        notes: string | null;
        orderedAt: Date;
        shippedAt: Date | null;
        deliveredAt: Date | null;
        cancelledAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getOrderById(orderId: string): Promise<any>;
    getOrders(query: OrderQuery): Promise<{
        orders: ({
            [x: string]: ({
                id: string;
                status: import(".prisma/client").$Enums.OrderItemStatus;
                orderId: string;
                productId: string;
                productName: string;
                quantity: number;
                unitPrice: number;
                totalPrice: number;
                pv: number;
                sku: string | null;
                variant: import("@prisma/client/runtime/library").JsonValue | null;
            } | {
                id: string;
                status: import(".prisma/client").$Enums.OrderItemStatus;
                orderId: string;
                productId: string;
                productName: string;
                quantity: number;
                unitPrice: number;
                totalPrice: number;
                pv: number;
                sku: string | null;
                variant: import("@prisma/client/runtime/library").JsonValue | null;
            })[] | ({
                id: string;
                status: import(".prisma/client").$Enums.ShipmentStatus;
                shippingAddress: import("@prisma/client/runtime/library").JsonValue;
                notes: string | null;
                shippedAt: Date | null;
                deliveredAt: Date | null;
                createdAt: Date;
                updatedAt: Date;
                orderId: string;
                trackingNumber: string | null;
                carrier: string | null;
                shippingMethod: string;
                shippingCost: number;
                estimatedDelivery: Date | null;
                weight: number | null;
                dimensions: import("@prisma/client/runtime/library").JsonValue | null;
            } | {
                id: string;
                status: import(".prisma/client").$Enums.ShipmentStatus;
                shippingAddress: import("@prisma/client/runtime/library").JsonValue;
                notes: string | null;
                shippedAt: Date | null;
                deliveredAt: Date | null;
                createdAt: Date;
                updatedAt: Date;
                orderId: string;
                trackingNumber: string | null;
                carrier: string | null;
                shippingMethod: string;
                shippingCost: number;
                estimatedDelivery: Date | null;
                weight: number | null;
                dimensions: import("@prisma/client/runtime/library").JsonValue | null;
            })[] | ({
                id: string;
                status: import(".prisma/client").$Enums.RefundStatus;
                notes: string | null;
                createdAt: Date;
                updatedAt: Date;
                orderId: string;
                amount: number;
                reason: string;
                processedAt: Date | null;
                processedBy: string | null;
            } | {
                id: string;
                status: import(".prisma/client").$Enums.RefundStatus;
                notes: string | null;
                createdAt: Date;
                updatedAt: Date;
                orderId: string;
                amount: number;
                reason: string;
                processedAt: Date | null;
                processedBy: string | null;
            })[] | {
                id: string;
                status: import(".prisma/client").$Enums.OrderItemStatus;
                orderId: string;
                productId: string;
                productName: string;
                quantity: number;
                unitPrice: number;
                totalPrice: number;
                pv: number;
                sku: string | null;
                variant: import("@prisma/client/runtime/library").JsonValue | null;
            }[] | {
                id: string;
                status: import(".prisma/client").$Enums.ShipmentStatus;
                shippingAddress: import("@prisma/client/runtime/library").JsonValue;
                notes: string | null;
                shippedAt: Date | null;
                deliveredAt: Date | null;
                createdAt: Date;
                updatedAt: Date;
                orderId: string;
                trackingNumber: string | null;
                carrier: string | null;
                shippingMethod: string;
                shippingCost: number;
                estimatedDelivery: Date | null;
                weight: number | null;
                dimensions: import("@prisma/client/runtime/library").JsonValue | null;
            }[] | {
                id: string;
                status: import(".prisma/client").$Enums.RefundStatus;
                notes: string | null;
                createdAt: Date;
                updatedAt: Date;
                orderId: string;
                amount: number;
                reason: string;
                processedAt: Date | null;
                processedBy: string | null;
            }[];
            [x: number]: never;
            [x: symbol]: never;
        } & {
            id: string;
            orderNumber: string;
            userId: string;
            status: import(".prisma/client").$Enums.OrderStatus;
            totalAmount: number;
            taxAmount: number;
            shippingAmount: number;
            discountAmount: number;
            currency: string;
            paymentMethod: string | null;
            paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
            shippingAddress: import("@prisma/client/runtime/library").JsonValue | null;
            billingAddress: import("@prisma/client/runtime/library").JsonValue | null;
            notes: string | null;
            orderedAt: Date;
            shippedAt: Date | null;
            deliveredAt: Date | null;
            cancelledAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        })[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    updateOrder(orderId: string, updates: any): Promise<{
        items: {
            id: string;
            status: import(".prisma/client").$Enums.OrderItemStatus;
            orderId: string;
            productId: string;
            productName: string;
            quantity: number;
            unitPrice: number;
            totalPrice: number;
            pv: number;
            sku: string | null;
            variant: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
    } & {
        id: string;
        orderNumber: string;
        userId: string;
        status: import(".prisma/client").$Enums.OrderStatus;
        totalAmount: number;
        taxAmount: number;
        shippingAmount: number;
        discountAmount: number;
        currency: string;
        paymentMethod: string | null;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        shippingAddress: import("@prisma/client/runtime/library").JsonValue | null;
        billingAddress: import("@prisma/client/runtime/library").JsonValue | null;
        notes: string | null;
        orderedAt: Date;
        shippedAt: Date | null;
        deliveredAt: Date | null;
        cancelledAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateOrderStatus(orderId: string, status: string, notes?: string): Promise<{
        items: {
            id: string;
            status: import(".prisma/client").$Enums.OrderItemStatus;
            orderId: string;
            productId: string;
            productName: string;
            quantity: number;
            unitPrice: number;
            totalPrice: number;
            pv: number;
            sku: string | null;
            variant: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
    } & {
        id: string;
        orderNumber: string;
        userId: string;
        status: import(".prisma/client").$Enums.OrderStatus;
        totalAmount: number;
        taxAmount: number;
        shippingAmount: number;
        discountAmount: number;
        currency: string;
        paymentMethod: string | null;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        shippingAddress: import("@prisma/client/runtime/library").JsonValue | null;
        billingAddress: import("@prisma/client/runtime/library").JsonValue | null;
        notes: string | null;
        orderedAt: Date;
        shippedAt: Date | null;
        deliveredAt: Date | null;
        cancelledAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    cancelOrder(orderId: string, reason?: string): Promise<{
        items: {
            id: string;
            status: import(".prisma/client").$Enums.OrderItemStatus;
            orderId: string;
            productId: string;
            productName: string;
            quantity: number;
            unitPrice: number;
            totalPrice: number;
            pv: number;
            sku: string | null;
            variant: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
    } & {
        id: string;
        orderNumber: string;
        userId: string;
        status: import(".prisma/client").$Enums.OrderStatus;
        totalAmount: number;
        taxAmount: number;
        shippingAmount: number;
        discountAmount: number;
        currency: string;
        paymentMethod: string | null;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        shippingAddress: import("@prisma/client/runtime/library").JsonValue | null;
        billingAddress: import("@prisma/client/runtime/library").JsonValue | null;
        notes: string | null;
        orderedAt: Date;
        shippedAt: Date | null;
        deliveredAt: Date | null;
        cancelledAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    shipOrder(orderId: string, shippingData: {
        trackingNumber?: string;
        carrier?: string;
        shippingMethod: string;
    }): Promise<any>;
    deliverOrder(orderId: string): Promise<{
        items: {
            id: string;
            status: import(".prisma/client").$Enums.OrderItemStatus;
            orderId: string;
            productId: string;
            productName: string;
            quantity: number;
            unitPrice: number;
            totalPrice: number;
            pv: number;
            sku: string | null;
            variant: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
    } & {
        id: string;
        orderNumber: string;
        userId: string;
        status: import(".prisma/client").$Enums.OrderStatus;
        totalAmount: number;
        taxAmount: number;
        shippingAmount: number;
        discountAmount: number;
        currency: string;
        paymentMethod: string | null;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        shippingAddress: import("@prisma/client/runtime/library").JsonValue | null;
        billingAddress: import("@prisma/client/runtime/library").JsonValue | null;
        notes: string | null;
        orderedAt: Date;
        shippedAt: Date | null;
        deliveredAt: Date | null;
        cancelledAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getOrderSummary(query: AnalyticsQuery): Promise<{
        period: string;
        startDate: Date;
        endDate: Date;
        totalOrders: any;
        totalRevenue: number;
        averageOrderValue: number;
        orderStatusDistribution: Record<string, number>;
    }>;
    getRevenueAnalytics(query: AnalyticsQuery): Promise<{
        period: string;
        startDate: Date;
        endDate: Date;
        revenueByPeriod: unknown;
        topProducts: {
            productId: string;
            productName: string;
            quantitySold: number;
            revenue: number;
        }[];
    }>;
    private generateOrderNumber;
    private getProductWithInventory;
    private updateInventoryForOrder;
    private getDateRange;
}
export {};
//# sourceMappingURL=OrderService.d.ts.map