"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiClient = exports.ApiClient = void 0;
exports.createApiClient = createApiClient;
const axios_1 = __importDefault(require("axios"));
class ApiClient {
    constructor(serviceUrls) {
        this.clients = new Map();
        this.serviceUrls = serviceUrls;
        this.initializeClients();
    }
    initializeClients() {
        Object.entries(this.serviceUrls).forEach(([service, baseURL]) => {
            const client = axios_1.default.create({
                baseURL,
                timeout: 10000, // 10 second timeout
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            // Add request interceptor for correlation ID
            client.interceptors.request.use((config) => {
                config.headers['x-correlation-id'] = this.generateCorrelationId();
                return config;
            });
            // Add response interceptor for error handling
            client.interceptors.response.use((response) => response, (error) => {
                console.error(`API call to ${service} failed:`, error.message);
                return Promise.reject(error);
            });
            this.clients.set(service, client);
        });
    }
    generateCorrelationId() {
        return `api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    // User Service API methods
    async getUser(userId) {
        const response = await this.clients.get('user').get(`/users/${userId}`);
        return response.data;
    }
    async getUserByMemberId(memberId) {
        const response = await this.clients.get('user').get(`/users/member/${memberId}`);
        return response.data;
    }
    async updateUser(userId, updates) {
        const response = await this.clients.get('user').put(`/users/${userId}`, updates);
        return response.data;
    }
    async getUserGenealogy(userId) {
        const response = await this.clients.get('genealogy').get(`/genealogy/tree/${userId}`);
        return response.data;
    }
    // Order Service API methods
    async getOrder(orderId) {
        const response = await this.clients.get('order').get(`/orders/${orderId}`);
        return response.data;
    }
    async createOrder(orderData) {
        const response = await this.clients.get('order').post('/orders', orderData);
        return response.data;
    }
    async updateOrderStatus(orderId, status) {
        const response = await this.clients.get('order').put(`/orders/${orderId}/status`, { status });
        return response.data;
    }
    // Commission Service API methods
    async calculateCommissions(orderId) {
        const response = await this.clients.get('commission').post('/commissions/calculate', { orderId });
        return response.data;
    }
    async getUserCommissions(userId) {
        const response = await this.clients.get('commission').get(`/commissions/user/${userId}`);
        return response.data;
    }
    // Notification Service API methods
    async sendNotification(notificationData) {
        const response = await this.clients.get('notification').post('/notifications', notificationData);
        return response.data;
    }
    async sendEmail(to, subject, body) {
        const response = await this.clients.get('notification').post('/notifications/email', {
            to,
            subject,
            body,
        });
        return response.data;
    }
    // Payment Service API methods
    async processPayment(paymentData) {
        const response = await this.clients.get('payment').post('/payments', paymentData);
        return response.data;
    }
    async getPaymentStatus(paymentId) {
        const response = await this.clients.get('payment').get(`/payments/${paymentId}`);
        return response.data;
    }
    // Generic method for any service call
    async callService(service, method, endpoint, data) {
        const client = this.clients.get(service);
        if (!client) {
            throw new Error(`Service ${service} not configured`);
        }
        const config = {
            method,
            url: endpoint,
        };
        if (data && (method === 'post' || method === 'put')) {
            config.data = data;
        }
        else if (data && method === 'get') {
            config.params = data;
        }
        return await client.request(config);
    }
}
exports.ApiClient = ApiClient;
// Factory function to create API client with default service URLs
function createApiClient() {
    const serviceUrls = {
        user: process.env.USER_SERVICE_URL || 'http://localhost:3001',
        order: process.env.ORDER_SERVICE_URL || 'http://localhost:3004',
        commission: process.env.COMMISSION_SERVICE_URL || 'http://localhost:3002',
        notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
        payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3008',
        genealogy: process.env.GENEALOGY_SERVICE_URL || 'http://localhost:3003',
    };
    return new ApiClient(serviceUrls);
}
// Export singleton instance
exports.apiClient = createApiClient();
//# sourceMappingURL=api-client.js.map