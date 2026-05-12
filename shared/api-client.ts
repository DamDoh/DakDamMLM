import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface ServiceEndpoints {
  user: string;
  order: string;
  commission: string;
  notification: string;
  payment: string;
  genealogy: string;
}

export class ApiClient {
  private clients: Map<string, AxiosInstance> = new Map();
  private serviceUrls: ServiceEndpoints;

  constructor(serviceUrls: ServiceEndpoints) {
    this.serviceUrls = serviceUrls;
    this.initializeClients();
  }

  private initializeClients() {
    Object.entries(this.serviceUrls).forEach(([service, baseURL]) => {
      const client = axios.create({
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
      client.interceptors.response.use(
        (response) => response,
        (error) => {
          console.error(`API call to ${service} failed:`, error.message);
          return Promise.reject(error);
        }
      );

      this.clients.set(service, client);
    });
  }

  private generateCorrelationId(): string {
    return `api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // User Service API methods
  async getUser(userId: string): Promise<any> {
    const response = await this.clients.get('user')!.get(`/users/${userId}`);
    return response.data;
  }

  async getUserByMemberId(memberId: string): Promise<any> {
    const response = await this.clients.get('user')!.get(`/users/member/${memberId}`);
    return response.data;
  }

  async updateUser(userId: string, updates: any): Promise<any> {
    const response = await this.clients.get('user')!.put(`/users/${userId}`, updates);
    return response.data;
  }

  async getUserGenealogy(userId: string): Promise<any> {
    const response = await this.clients.get('genealogy')!.get(`/genealogy/tree/${userId}`);
    return response.data;
  }

  // Order Service API methods
  async getOrder(orderId: string): Promise<any> {
    const response = await this.clients.get('order')!.get(`/orders/${orderId}`);
    return response.data;
  }

  async createOrder(orderData: any): Promise<any> {
    const response = await this.clients.get('order')!.post('/orders', orderData);
    return response.data;
  }

  async updateOrderStatus(orderId: string, status: string): Promise<any> {
    const response = await this.clients.get('order')!.put(`/orders/${orderId}/status`, { status });
    return response.data;
  }

  // Commission Service API methods
  async calculateCommissions(orderId: string): Promise<any> {
    const response = await this.clients.get('commission')!.post('/commissions/calculate', { orderId });
    return response.data;
  }

  async getUserCommissions(userId: string): Promise<any> {
    const response = await this.clients.get('commission')!.get(`/commissions/user/${userId}`);
    return response.data;
  }

  // Notification Service API methods
  async sendNotification(notificationData: any): Promise<any> {
    const response = await this.clients.get('notification')!.post('/notifications', notificationData);
    return response.data;
  }

  async sendEmail(to: string, subject: string, body: string): Promise<any> {
    const response = await this.clients.get('notification')!.post('/notifications/email', {
      to,
      subject,
      body,
    });
    return response.data;
  }

  // Payment Service API methods
  async processPayment(paymentData: any): Promise<any> {
    const response = await this.clients.get('payment')!.post('/payments', paymentData);
    return response.data;
  }

  async getPaymentStatus(paymentId: string): Promise<any> {
    const response = await this.clients.get('payment')!.get(`/payments/${paymentId}`);
    return response.data;
  }

  // Generic method for any service call
  async callService(service: keyof ServiceEndpoints, method: 'get' | 'post' | 'put' | 'delete', endpoint: string, data?: any): Promise<AxiosResponse> {
    const client = this.clients.get(service);
    if (!client) {
      throw new Error(`Service ${service} not configured`);
    }

    const config: AxiosRequestConfig = {
      method,
      url: endpoint,
    };

    if (data && (method === 'post' || method === 'put')) {
      config.data = data;
    } else if (data && method === 'get') {
      config.params = data;
    }

    return await client.request(config);
  }
}

// Factory function to create API client with default service URLs
export function createApiClient(): ApiClient {
  const serviceUrls: ServiceEndpoints = {
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
export const apiClient = createApiClient();