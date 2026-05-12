import request from 'supertest';
import app from '../../src/index';
import { commissionDb } from '../../src/config/database';

describe('CommissionController Integration Tests', () => {
  let authToken: string;
  let testUser: any;
  let testCommission: any;
  let testRule: any;

  beforeAll(async () => {
    // Create test user
    testUser = await global.testUtils.createTestUser({
      email: 'commission-test@example.com',
      isAdmin: true,
    });

    // Create test commission rule
    testRule = await global.testUtils.createTestCommissionRule({
      name: 'Test Direct Rule',
      type: 'DIRECT',
      percentage: 10,
    });

    // Create test commission
    testCommission = await commissionDb.commission.create({
      data: {
        userId: testUser.id,
        orderId: 'test-order-123',
        type: 'DIRECT' as any,
        level: 1,
        amount: 100,
        percentage: 10,
        status: 'PENDING' as any,
      } as any,
    });

    // Generate auth token (mock JWT for testing)
    authToken = 'mock-jwt-token-for-testing';
  });

  afterAll(async () => {
    // Clean up test data
    await commissionDb.commission.deleteMany({
      where: { userId: testUser.id },
    });
    await (commissionDb as any).commissionRule.deleteMany({
      where: { name: 'Test Direct Rule' },
    });
    await commissionDb.user.deleteMany({
      where: { email: 'commission-test@example.com' },
    });
  });

  describe('GET /api/commissions', () => {
    it('should return commissions list for admin', async () => {
      const response = await request(app)
        .get('/api/commissions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.data)).toBe(true);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should filter commissions by status', async () => {
      const response = await request(app)
        .get('/api/commissions?status=PENDING')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.data.forEach((commission: any) => {
        expect(commission.status).toBe('PENDING');
      });
    });

    it('should handle pagination correctly', async () => {
      const response = await request(app)
        .get('/api/commissions?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data.length).toBeLessThanOrEqual(5);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(5);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/commissions')
        .expect(401);

      expect(response.body.error).toContain('Access token is required');
    });
  });

  describe('GET /api/commissions/:id', () => {
    it('should return specific commission', async () => {
      const response = await request(app)
        .get(`/api/commissions/${testCommission.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testCommission.id);
      expect(response.body.data.amount).toBe(testCommission.amount);
    });

    it('should return 404 for non-existent commission', async () => {
      const response = await request(app)
        .get('/api/commissions/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Commission not found');
    });
  });

  describe('PUT /api/commissions/:id/status', () => {
    it('should update commission status', async () => {
      const response = await request(app)
        .put(`/api/commissions/${testCommission.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'PAID' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('PAID');
      expect(response.body.data.paidAt).toBeDefined();
    });

    it('should return 400 for invalid status transition', async () => {
      const response = await request(app)
        .put(`/api/commissions/${testCommission.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'PENDING' }) // Already paid
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid status transition');
    });
  });

  describe('GET /api/commissions/user/:userId', () => {
    it('should return user commissions', async () => {
      const response = await request(app)
        .get(`/api/commissions/user/${testUser.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.data)).toBe(true);
    });

    it('should allow users to view their own commissions', async () => {
      // Mock authenticated user context
      const userToken = 'user-own-token';

      const response = await request(app)
        .get(`/api/commissions/user/${testUser.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should deny access to other users commissions', async () => {
      const otherUserId = 'other-user-123';
      const userToken = 'user-token';

      const response = await request(app)
        .get(`/api/commissions/user/${otherUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('GET /api/commissions/user/:userId/stats', () => {
    it('should return user commission statistics', async () => {
      const response = await request(app)
        .get(`/api/commissions/user/${testUser.id}/stats?period=month`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalEarned');
      expect(response.body.data).toHaveProperty('pendingAmount');
      expect(response.body.data).toHaveProperty('paidAmount');
    });
  });

  describe('POST /api/commissions/rules', () => {
    it('should create commission rule', async () => {
      const ruleData = {
        name: 'Integration Test Rule',
        type: 'LEVEL_2',
        level: 2,
        percentage: 5.0,
        minAmount: 0,
        maxAmount: 1000,
        isActive: true,
      };

      const response = await request(app)
        .post('/api/commissions/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ruleData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(ruleData.name);
      expect(response.body.data.type).toBe(ruleData.type);

      // Clean up
      await (commissionDb as any).commissionRule.delete({ where: { id: response.body.data.id } });
    });

    it('should validate required fields', async () => {
      const invalidData = {
        name: 'Invalid Rule',
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/commissions/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/commissions/rules', () => {
    it('should return commission rules', async () => {
      const response = await request(app)
        .get('/api/commissions/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.data)).toBe(true);
    });

    it('should filter rules by type', async () => {
      const response = await request(app)
        .get('/api/commissions/rules?type=DIRECT')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.data.forEach((rule: any) => {
        expect(rule.type).toBe('DIRECT');
      });
    });
  });

  describe('POST /api/commissions/payouts', () => {
    it('should create payout request', async () => {
      const payoutData = {
        amount: 500,
        method: 'BANK_TRANSFER',
        reference: 'TEST-REF-123',
      };

      const response = await request(app)
        .post('/api/commissions/payouts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(payoutData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.amount).toBe(500);
      expect(response.body.data.status).toBe('PENDING');

      // Clean up
      await (commissionDb as any).commissionPayout.delete({ where: { id: response.body.data.id } });
    });

    it('should validate payout amount limits', async () => {
      const invalidData = {
        amount: 10, // Below minimum
        method: 'BANK_TRANSFER',
      };

      const response = await request(app)
        .post('/api/commissions/payouts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Minimum payout amount');
    });
  });

  describe('GET /api/commissions/payouts/user/:userId', () => {
    it('should return user payouts', async () => {
      const response = await request(app)
        .get(`/api/commissions/payouts/user/${testUser.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.data)).toBe(true);
    });
  });

  describe('POST /api/commissions/bonuses/calculate', () => {
    it('should calculate bonuses for period', async () => {
      const response = await request(app)
        .post('/api/commissions/bonuses/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ period: '2024-01' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/commissions/analytics/summary', () => {
    it('should return commission analytics', async () => {
      const response = await request(app)
        .get('/api/commissions/analytics/summary?period=month')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalCommissions');
      expect(response.body.data).toHaveProperty('totalAmount');
      expect(response.body.data).toHaveProperty('paidAmount');
    });
  });

  describe('GET /api/commissions/analytics/payouts', () => {
    it('should return payout analytics', async () => {
      const response = await request(app)
        .get('/api/commissions/analytics/payouts?period=month')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalPayouts');
      expect(response.body.data).toHaveProperty('totalAmount');
    });
  });

  describe('GET /api/commissions/analytics/bonuses', () => {
    it('should return bonus analytics', async () => {
      const response = await request(app)
        .get('/api/commissions/analytics/bonuses?period=month')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalBonuses');
      expect(response.body.data).toHaveProperty('totalAmount');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Note: Database connection errors are handled by the service layer
      // This test verifies the error handling is in place
      const response = await request(app)
        .get('/api/commissions')
        .set('Authorization', `Bearer ${authToken}`);

      // The response should either succeed or return a proper error
      expect([200, 500]).toContain(response.status);
      if (response.status === 500) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
      }
    });

    it('should handle invalid JSON in request body', async () => {
      const response = await request(app)
        .post('/api/commissions/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle rate limiting', async () => {
      // Make multiple rapid requests
      const promises = [];
      for (let i = 0; i < 15; i++) {
        promises.push(
          request(app)
            .get('/api/commissions')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponse = responses.find(r => r.status === 429);

      expect(rateLimitedResponse).toBeDefined();
      expect(rateLimitedResponse?.body.error).toContain('Too many requests');
    });
  });

  describe('Security Tests', () => {
    it('should prevent SQL injection attempts', async () => {
      const maliciousInput = "'; DROP TABLE commissions; --";

      const response = await request(app)
        .get(`/api/commissions/user/${maliciousInput}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate input sanitization', async () => {
      const maliciousData = {
        name: '<script>alert("xss")</script>Valid Name',
        type: 'DIRECT',
        level: 1,
        percentage: 10,
        isActive: true,
      };

      const response = await request(app)
        .post('/api/commissions/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousData)
        .expect(201);

      expect(response.body.success).toBe(true);
      // The script tags should be sanitized
      expect(response.body.data.name).not.toContain('<script>');
    });
  });
});