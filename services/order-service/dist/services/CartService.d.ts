interface CartItem {
    productId: string;
    quantity: number;
    variant?: any;
}
export declare class CartService {
    private orderService;
    constructor();
    getCart(userId: string): Promise<any>;
    addItem(userId: string, item: CartItem): Promise<any>;
    updateItem(userId: string, productId: string, quantity: number): Promise<any>;
    removeItem(userId: string, productId: string): Promise<any>;
    clearCart(userId: string): Promise<any>;
    checkout(userId: string, checkoutData: {
        shippingAddress?: any;
        billingAddress?: any;
        paymentMethod?: string;
    }): Promise<{
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
    getCartSummary(userId: string): Promise<{
        itemCount: number;
        totalAmount: any;
        items: {
            productId: any;
            productName: any;
            quantity: any;
            unitPrice: any;
            totalPrice: any;
        }[];
    }>;
}
export {};
//# sourceMappingURL=CartService.d.ts.map