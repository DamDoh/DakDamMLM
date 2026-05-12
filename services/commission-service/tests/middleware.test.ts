import { Request, Response } from 'express';
import { authenticateToken, requireAdmin, requireOwnershipOrAdmin } from '../src/middleware/auth';
import { validateCommissionData, validatePagination, validateDateRange } from '../src/middleware/validation';

jest.mock('../../../shared/utils', () => ({
  generateRequestId: jest.fn(() => 'test-request-id'),
}));

import { generateRequestId } from '../../../shared/utils';

describe('Authentication Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      params: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      set: jest.fn(),
      get: jest.fn(),
    };
    mockNext = jest.fn();

    (generateRequestId as jest.Mock).mockReturnValue('test-request-id');
  });

  describe('authenticateToken', () => {
    it('should call next() for valid token', () => {
      mockRequest.headers = {
        authorization: 'Bearer valid.jwt.token',
      };

      // Mock JWT verification
      const jwt = require('jsonwebtoken');
      jwt.verify = jest.fn().mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        isAdmin: false,
      });

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockRequest as any).user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        isAdmin: false,
      });
    });

    it('should return 401 for missing token', () => {
      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access token is required',
        timestamp: expect.any(String),
        requestId: 'test-request-id',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 for invalid token', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid.token',
      };

      const jwt = require('jsonwebtoken');
      jwt.verify = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid or expired token',
        timestamp: expect.any(String),
        requestId: 'test-request-id',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('should call next() for admin user', () => {
      (mockRequest as any).user = { isAdmin: true };

      requireAdmin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 for non-admin user', () => {
      (mockRequest as any).user = { isAdmin: false };

      requireAdmin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Admin access required',
        timestamp: expect.any(String),
        requestId: 'test-request-id',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireOwnershipOrAdmin', () => {
    it('should call next() for admin user', () => {
      (mockRequest as any).user = { isAdmin: true, id: 'admin-123' };
      mockRequest.params = { userId: 'user-456' };

      const middleware = requireOwnershipOrAdmin('userId');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next() for resource owner', () => {
      (mockRequest as any).user = { isAdmin: false, id: 'user-123' };
      mockRequest.params = { userId: 'user-123' };

      const middleware = requireOwnershipOrAdmin('userId');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 for non-owner non-admin user', () => {
      (mockRequest as any).user = { isAdmin: false, id: 'user-123' };
      mockRequest.params = { userId: 'user-456' };

      const middleware = requireOwnershipOrAdmin('userId');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access denied',
        timestamp: expect.any(String),
        requestId: 'test-request-id',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});

describe('Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      body: {},
      query: {},
      params: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();

    (generateRequestId as jest.Mock).mockReturnValue('test-request-id');
  });

  describe('validateCommissionData', () => {
    it('should call next() for valid commission data', () => {
      mockRequest.body = {
        userId: 'user-123',
        orderId: 'order-456',
        amount: 1000,
      };

      validateCommissionData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 400 for missing userId', () => {
      mockRequest.body = {
        orderId: 'order-456',
        amount: 1000,
      };

      validateCommissionData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Valid userId is required',
        timestamp: expect.any(String),
        requestId: 'test-request-id',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid amount', () => {
      mockRequest.body = {
        userId: 'user-123',
        orderId: 'order-456',
        amount: -100,
      };

      validateCommissionData(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Valid amount (greater than 0) is required',
        timestamp: expect.any(String),
        requestId: 'test-request-id',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validatePagination', () => {
    it('should call next() and attach pagination for valid params', () => {
      mockRequest.query = {
        page: '2',
        limit: '20',
      };

      validatePagination(mockRequest as Request, mockResponse as Response, mockNext);

      expect((mockRequest as any).pagination).toEqual({
        page: 2,
        limit: 20,
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use defaults for missing params', () => {
      mockRequest.query = {};

      validatePagination(mockRequest as Request, mockResponse as Response, mockNext);

      expect((mockRequest as any).pagination).toEqual({
        page: 1,
        limit: 10,
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 400 for invalid page number', () => {
      mockRequest.query = {
        page: '0',
      };

      validatePagination(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Page must be a positive integer',
        timestamp: expect.any(String),
        requestId: 'test-request-id',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 for limit too high', () => {
      mockRequest.query = {
        limit: '200',
      };

      validatePagination(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Limit must be between 1 and 100',
        timestamp: expect.any(String),
        requestId: 'test-request-id',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validateDateRange', () => {
    it('should call next() for valid date range', () => {
      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };

      validateDateRange(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 400 for missing dates', () => {
      mockRequest.query = {
        startDate: '2024-01-01',
        // Missing endDate
      };

      validateDateRange(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Both startDate and endDate are required',
        timestamp: expect.any(String),
        requestId: 'test-request-id',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid date format', () => {
      mockRequest.query = {
        startDate: 'invalid-date',
        endDate: '2024-12-31',
      };

      validateDateRange(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid date format',
        timestamp: expect.any(String),
        requestId: 'test-request-id',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 for start date after end date', () => {
      mockRequest.query = {
        startDate: '2024-12-31',
        endDate: '2024-01-01',
      };

      validateDateRange(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'startDate cannot be after endDate',
        timestamp: expect.any(String),
        requestId: 'test-request-id',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 for date range too large', () => {
      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2025-12-31', // More than 1 year
      };

      validateDateRange(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Date range cannot exceed 1 year',
        timestamp: expect.any(String),
        requestId: 'test-request-id',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});