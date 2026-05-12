import { AxiosResponse } from 'axios';
export interface ServiceEndpoints {
    user: string;
    order: string;
    commission: string;
    notification: string;
    payment: string;
    genealogy: string;
}
export declare class ApiClient {
    private clients;
    private serviceUrls;
    constructor(serviceUrls: ServiceEndpoints);
    private initializeClients;
    private generateCorrelationId;
    getUser(userId: string): Promise<any>;
    getUserByMemberId(memberId: string): Promise<any>;
    updateUser(userId: string, updates: any): Promise<any>;
    getUserGenealogy(userId: string): Promise<any>;
    getOrder(orderId: string): Promise<any>;
    createOrder(orderData: any): Promise<any>;
    updateOrderStatus(orderId: string, status: string): Promise<any>;
    calculateCommissions(orderId: string): Promise<any>;
    getUserCommissions(userId: string): Promise<any>;
    sendNotification(notificationData: any): Promise<any>;
    sendEmail(to: string, subject: string, body: string): Promise<any>;
    processPayment(paymentData: any): Promise<any>;
    getPaymentStatus(paymentId: string): Promise<any>;
    callService(service: keyof ServiceEndpoints, method: 'get' | 'post' | 'put' | 'delete', endpoint: string, data?: any): Promise<AxiosResponse>;
}
export declare function createApiClient(): ApiClient;
export declare const apiClient: ApiClient;
//# sourceMappingURL=api-client.d.ts.map