# DakDam MLM API Documentation

## Overview

DakDam is a comprehensive Binary MLM (Multi-Level Marketing) platform built with Next.js, TypeScript, and Prisma. This documentation covers all API endpoints, authentication, rate limiting, and integration details.

## Table of Contents

1. [Authentication](#authentication)
2. [Rate Limiting](#rate-limiting)
3. [API Endpoints](#api-endpoints)
4. [Data Models](#data-models)
5. [Error Handling](#error-handling)
6. [Security](#security)
7. [Integration Examples](#integration-examples)

## Authentication

### JWT Token-Based Authentication

DakDam uses JWT (JSON Web Tokens) for authentication with refresh token rotation.

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "user123",
      "email": "user@example.com",
      "memberId": "M001",
      "fullName": "John Doe",
      "isAdmin": false,
      "accountType": "Distributor"
    }
  }
}
```

#### Registration
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "surname": "Doe",
  "phoneNumber": "+1234567890",
  "memberId": "M001",
  "sponsorId": "M002"
}
```

#### Token Refresh
```http
POST /api/auth/refresh
Authorization: Bearer <refresh_token>
```

## Rate Limiting

All API endpoints implement rate limiting to prevent abuse.

### Rate Limit Headers

Every API response includes rate limit headers:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1640995200
```

### Rate Limit Configurations

| Endpoint Type | Window | Max Requests | Description |
|---------------|--------|--------------|-------------|
| Authentication | 15 minutes | 5 requests | Login/Register endpoints |
| General API | 1 minute | 60 requests | Standard API endpoints |
| Read Operations | 1 minute | 120 requests | GET endpoints |
| Financial | 1 minute | 10 requests | Money-related operations |
| Admin | 1 minute | 30 requests | Administrative operations |

### Rate Limit Exceeded Response

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again later.",
  "retryAfter": 60
}
```

Status: `429 Too Many Requests`

## API Endpoints

### Authentication Endpoints

#### POST `/api/auth/login`
Authenticate user and return JWT tokens.

**Rate Limit:** 5 requests per 15 minutes

#### POST `/api/auth/register`
Register new user account.

**Rate Limit:** 5 requests per 15 minutes

#### POST `/api/auth/refresh`
Refresh access token using refresh token.

**Rate Limit:** 60 requests per minute

#### POST `/api/auth/change-password`
Change user password (requires authentication).

**Rate Limit:** 10 requests per minute

### User Management Endpoints

#### GET `/api/user/ecash-balance`
Get user's e-cash balance.

**Authentication:** Required
**Rate Limit:** 120 requests per minute

**Response:**
```json
{
  "success": true,
  "data": {
    "balance": 1250.50,
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}
```

### Dashboard Endpoints

#### GET `/api/dashboard`
Get user dashboard data including commissions, genealogy stats, and recent activity.

**Authentication:** Required
**Rate Limit:** 60 requests per minute

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { /* user object */ },
    "commissions": {
      "total": 2500.00,
      "thisMonth": 450.00,
      "pending": 125.00
    },
    "genealogy": {
      "totalMembers": 45,
      "activeMembers": 32,
      "leftLeg": 22,
      "rightLeg": 23
    },
    "recentActivity": [ /* activity array */ ]
  }
}
```

### Analytics Endpoints

#### GET `/api/analytics/key-metrics`
Get key business metrics for admin users.

**Authentication:** Required (Admin only)
**Rate Limit:** 30 requests per minute

### Product Endpoints

#### GET `/api/products`
Get all available products.

**Authentication:** Required
**Rate Limit:** 120 requests per minute

#### POST `/api/products`
Create new product (Admin only).

**Authentication:** Required (Admin only)
**Rate Limit:** 30 requests per minute

### Order Endpoints

#### POST `/api/orders`
Create new order.

**Authentication:** Required
**Rate Limit:** 10 requests per minute

### Inventory Endpoints

#### GET `/api/inventory`
Get user's inventory/stock levels.

**Authentication:** Required
**Rate Limit:** 120 requests per minute

#### POST `/api/stock-requests`
Request stock from distributor.

**Authentication:** Required
**Rate Limit:** 10 requests per minute

### Commission Endpoints

#### GET `/api/commissions`
Get user's commission history.

**Authentication:** Required
**Rate Limit:** 60 requests per minute

### Notification Endpoints

#### GET `/api/notifications`
Get user's notifications.

**Authentication:** Required
**Rate Limit:** 120 requests per minute

#### PUT `/api/notifications/[id]`
Mark notification as read.

**Authentication:** Required
**Rate Limit:** 60 requests per minute

### Health Check Endpoints

#### GET `/api/health`
Get system health status.

**Authentication:** Not required
**Rate Limit:** 120 requests per minute

## Data Models

### User/Member Model
```typescript
interface Member {
  id: string;
  memberId: string;
  firstName: string;
  surname: string;
  fullName: string;
  email: string | null;
  phoneNumber: string;
  avatarUrl: string;
  rank: Rank;
  accountType: AccountType;
  pv: number;
  pvDate: string;
  sponsorId: string | null;
  placementParentId: string | null;
  position: 'left' | 'right' | null;
  children: { left: string | null; right: string | null };
  teamSize: { left: number; right: number; total: number };
  active: boolean;
  isAdmin: boolean;
  storeOwnerLevel: StockistLevel | null;
  addresses: Address[];
  joinDate: string;
  lastActivityDate: string | null;
}
```

### Commission Model
```typescript
interface Commission {
  id: string;
  userId: string;
  date: string;
  type: string;
  status: 'Paid' | 'Pending' | 'Cancelled';
  amount: number;
  description?: string;
}
```

### Order Model
```typescript
interface Order {
  orderId: string;
  userId: string;
  status: OrderStatus;
  amount: number;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}
```

## Error Handling

### Standard Error Response Format

```json
{
  "error": "ErrorType",
  "message": "Human-readable error message",
  "details": { /* optional additional details */ }
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing authentication)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

### Validation Errors

```json
{
  "error": "ValidationError",
  "message": "Invalid input data",
  "details": {
    "field": "email",
    "message": "Email format is invalid"
  }
}
```

## Security

### Authentication Security

1. **JWT Tokens**: Short-lived access tokens (15 minutes) with long-lived refresh tokens (7 days)
2. **Password Hashing**: bcrypt with salt rounds
3. **Rate Limiting**: Prevents brute force attacks
4. **Session Management**: Automatic token rotation

### API Security

1. **CORS**: Configured for allowed origins
2. **Helmet**: Security headers middleware
3. **Input Validation**: Comprehensive input sanitization
4. **SQL Injection Prevention**: Parameterized queries via Prisma
5. **XSS Prevention**: Input sanitization and React's built-in XSS protection

### Data Protection

1. **Encryption**: Sensitive data encrypted at rest
2. **Audit Logging**: All user actions logged for compliance
3. **Data Validation**: Strict input validation on all endpoints
4. **Rate Limiting**: Prevents abuse and DoS attacks

## Integration Examples

### JavaScript/Node.js Client

```javascript
class DakDamClient {
  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('accessToken');
  }

  async login(email, password) {
    const response = await fetch(`${this.baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    this.token = data.data.accessToken;
    localStorage.setItem('accessToken', this.token);
    return data;
  }

  async getDashboard() {
    const response = await fetch(`${this.baseURL}/dashboard`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch dashboard');
    }

    return response.json();
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    const response = await fetch(`${this.baseURL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${refreshToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    this.token = data.data.accessToken;
    localStorage.setItem('accessToken', this.token);
    return data;
  }
}
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';

export function useDakDamAPI() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    setUser(data.data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('accessToken');

    const response = await fetch(`/api${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json'
      }
    });

    // Handle token refresh on 401
    if (response.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const refreshResponse = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${refreshToken}` }
          });

          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            localStorage.setItem('accessToken', refreshData.data.accessToken);
            // Retry original request
            return apiCall(endpoint, options);
          }
        } catch (error) {
          logout();
          throw new Error('Session expired');
        }
      }
      logout();
      throw new Error('Authentication required');
    }

    return response.json();
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      // Validate token and set user
      apiCall('/dashboard')
        .then(data => setUser(data.data.user))
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  return { user, loading, login, logout, apiCall };
}
```

## Webhook Integration

DakDam supports webhooks for real-time notifications of important events.

### Supported Events

- `commission.paid` - Commission payment processed
- `member.joined` - New member registration
- `order.completed` - Order fulfillment completed
- `stock.requested` - Stock request submitted

### Webhook Payload Example

```json
{
  "event": "commission.paid",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "commissionId": "comm_123",
    "memberId": "M001",
    "amount": 150.00,
    "type": "Binary Bonus"
  },
  "signature": "sha256=..."
}
```

## Monitoring and Logging

### Application Logs

DakDam includes comprehensive logging with the following levels:

- **ERROR**: Application errors and failures
- **WARN**: Warning conditions and security events
- **INFO**: General information and successful operations
- **DEBUG**: Detailed debugging information (development only)

### Log Format

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "message": "Login successful",
  "context": {
    "userId": "user123",
    "ip": "192.168.1.1",
    "duration": 150
  },
  "requestId": "req_123",
  "userId": "user123"
}
```

### Health Monitoring

The `/api/health` endpoint provides system health information:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "database": "healthy",
    "cache": "healthy",
    "external": "healthy"
  },
  "metrics": {
    "uptime": "2d 4h 30m",
    "memory": "75%",
    "cpu": "45%"
  }
}
```

## Deployment Considerations

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dakdam"

# JWT
JWT_SECRET="your-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret"

# Email (optional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# External Services (optional)
REDIS_URL="redis://localhost:6379"
LOGGING_SERVICE_URL="https://logs.example.com"
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure proper database connection
- [ ] Set strong JWT secrets
- [ ] Enable HTTPS
- [ ] Configure rate limiting thresholds
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation
- [ ] Set up backup procedures
- [ ] Configure CORS for production domains

## Support

For API integration support or questions:

- **Documentation**: This document
- **API Explorer**: Available at `/api/docs` (development only)
- **Support Email**: support@dakdam.com
- **GitHub Issues**: For bug reports and feature requests

## Version History

- **v1.0.0**: Initial release with core MLM functionality
- **v1.1.0**: Added rate limiting and enhanced security
- **v1.2.0**: Improved logging and monitoring capabilities
- **v1.3.0**: Added comprehensive API documentation

---

**Last Updated:** January 15, 2024
**API Version:** v1.3.0