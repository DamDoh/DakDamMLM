# API Rate Limit Documentation

This document provides a comprehensive list of all rate limits configured for API endpoints in the application.

## Default Rate Limit Configurations

These are the base configurations defined in `src/lib/rate-limiter.ts`:
**Optimized for 100M+ users scale**

| Configuration | Window | Max Requests | Description |
|--------------|--------|--------------|-------------|
| **auth** | 15 minutes | 100,000 | Authentication endpoints (skipSuccessfulRequests: true) |
| **api** | 1 minute | 100,000 | General API endpoints |
| **read** | 1 minute | 100,000 | Read-only endpoints |
| **financial** | 1 minute | 50 | Financial operations (increased for scale) |
| **admin** | 1 minute | 1,000 | Admin operations (increased for scale) |

**Note**: For production deployments with 100M+ users, consider using Redis or a distributed cache instead of the in-memory store for shared rate limiting across multiple server instances.

---

## Authentication Endpoints

| Endpoint | Method | Window | Max Requests | Key Generator | Notes |
|----------|--------|--------|--------------|---------------|-------|
| `/api/auth/login` | POST | 15 minutes | 10,000 | IP-based | Uses `createAuthRateLimit()` |
| `/api/auth/register` | POST | 15 minutes | 10,000 | IP-based | Uses `createAuthRateLimit()` |
| `/api/auth/refresh` | POST | 15 minutes | 10,000 | IP-based | Uses `createAuthRateLimit()` |
| `/api/auth/reset-password` | POST | 1 hour | 3 | IP-based | Request reset link |
| `/api/auth/reset-password` | PATCH | 1 hour | 3 | IP-based | Reset password |

---

## Order Endpoints

| Endpoint | Method | Window | Max Requests | Key Generator | Notes |
|----------|--------|--------|--------------|---------------|-------|
| `/api/orders` | POST | 1 minute | 20 | IP-based | Create order |
| `/api/orders` | GET | 1 minute | 100,000 | IP-based | List orders (optimized for 100M users) |
| `/api/orders` | PATCH | 15 minutes | 50,000 (regular) / 100,000 (admin) | IP-based | Update order (optimized for 100M users) |
| `/api/orders` | DELETE | 1 minute | 10 | IP-based | Delete order |
| `/api/orders/[id]` | GET | 1 minute | 100,000 | IP-based | Get order by ID (optimized for 100M users) |

---

## Financial Endpoints

### E-Cash Operations

| Endpoint | Method | Window | Max Requests | Key Generator | Notes |
|----------|--------|--------|--------------|---------------|-------|
| `/api/ecash-topup-requests` | POST | 15 minutes | 100,000 | IP-based | Create top-up request (optimized for 100M users) |
| `/api/ecash-topup-requests` | POST | 15 minutes | 100,000 | User ID | Auto top-up (per user, optimized for 100M users) |
| `/api/ecash-topup-requests` | GET | 15 minutes | 100,000 | IP-based | List requests (optimized for 100M users) |
| `/api/ecash-topup-requests` | PATCH | 15 minutes | 100,000 | IP-based | Update request (optimized for 100M users) |
| `/api/ecash-withdrawal-requests` | POST | 15 minutes | 100,000 | IP-based | Create withdrawal request (optimized for 100M users) |
| `/api/ecash-withdrawal-requests` | POST | 15 minutes | 100,000 | User ID | Create withdrawal (per user, optimized for 100M users) |
| `/api/ecash-withdrawal-requests` | GET | 15 minutes | 100,000 | IP-based | List requests (optimized for 100M users) |
| `/api/ecash-withdrawal-requests` | PATCH | 15 minutes | 100,000 | IP-based | Update request (optimized for 100M users) |
| `/api/user/ecash-balance` | GET | 1 minute | 100,000 | IP-based | Get balance (optimized for 100M users) |
| `/api/e-cash/backfill` | POST | 1 minute | 100,000 | IP-based | Backfill commissions (optimized for 100M users) |

### PV/Top-Up Operations

| Endpoint | Method | Window | Max Requests | Key Generator | Notes |
|----------|--------|--------|--------------|---------------|-------|
| `/api/rank-topup` | POST | 15 minutes | 100,000 | User ID | Rank top-up (per user, optimized for 100M users) |
| `/api/maintenance-topup-requests` | POST | 15 minutes | 100,000 | IP-based | Create maintenance request (optimized for 100M users) |
| `/api/maintenance-topup-requests` | POST | 15 minutes | 100,000 | User ID | Auto maintenance (per user, optimized for 100M users) |
| `/api/maintenance-topup-requests` | GET | 15 minutes | 100,000 | IP-based | List requests (optimized for 100M users) |
| `/api/maintenance-topup-requests` | PATCH | 15 minutes | 100,000 | IP-based | Update request (optimized for 100M users) |
| `/api/pv-topup-requests` | POST | 15 minutes | 100,000 | IP-based | Create PV top-up request (optimized for 100M users) |
| `/api/pv-topup-requests` | POST | 15 minutes | 100,000 | User ID | Auto PV top-up (per user, optimized for 100M users) |
| `/api/pv-topup-requests` | GET | 15 minutes | 100,000 | IP-based | List requests (optimized for 100M users) |
| `/api/pv-topup-requests` | PATCH | 15 minutes | 100,000 | IP-based | Update request (optimized for 100M users) |

---

## Stock & Inventory Endpoints

| Endpoint | Method | Window | Max Requests | Key Generator | Notes |
|----------|--------|--------|--------------|---------------|-------|
| `/api/stock-requests` | GET | 15 minutes | 100,000 | IP-based | List stock requests (optimized for 100M users) |
| `/api/stock-requests` | POST | 15 minutes | 100,000 | IP-based | Create stock request (optimized for 100M users) |
| `/api/stock-requests` | PATCH | 15 minutes | 100,000 | IP-based | Update stock request (optimized for 100M users) |
| `/api/binary-stock` | GET | 1 minute | 100,000 | IP-based | Binary stock page (optimized for 100M users) |
| `/api/inventory` | GET | 1 minute | 100,000 | IP-based | Get inventory (optimized for 100M users) |

---

## Commission Endpoints

| Endpoint | Method | Window | Max Requests | Key Generator | Notes |
|----------|--------|--------|--------------|---------------|-------|
| `/api/commissions` | GET | 1 minute | 100,000 | IP-based | List commissions (optimized for 100M users) |
| `/api/commissions/calculate` | POST | 1 minute | 100,000 | IP-based | Calculate commissions (optimized for 100M users) |
| `/api/commissions/calculate-stockist` | POST | 1 minute | 100,000 | IP-based | Calculate stockist commission (optimized for 100M users) |

---

## Product Endpoints

| Endpoint | Method | Window | Max Requests | Key Generator | Notes |
|----------|--------|--------|--------------|---------------|-------|
| `/api/products` | GET | 1 minute | 100,000 | IP-based | List products (optimized for 100M users) |
| `/api/products` | POST | 15 minutes | 100,000 | IP-based | Create product (optimized for 100M users) |
| `/api/products` | PATCH | 15 minutes | 100,000 | IP-based | Update product (optimized for 100M users) |
| `/api/products` | DELETE | 15 minutes | 100,000 | IP-based | Delete product (optimized for 100M users) |
| `/api/products/reset` | POST | 1 hour | 100,000 | IP-based | Reset products (optimized for 100M users) |

---

## Notification Endpoints

| Endpoint | Method | Window | Max Requests | Key Generator | Notes |
|----------|--------|--------|--------------|---------------|-------|
| `/api/notifications` | GET | 1 minute | 100,000 | User ID + IP | Get notifications (optimized for 100M users) |
| `/api/notifications` | POST | 1 minute | 100,000 | IP-based | Create notification (optimized for 100M users) |
| `/api/notifications/[id]` | GET | 1 minute | 100,000 | IP-based | Get notification by ID (optimized for 100M users) |

---

## Business Rules Endpoints

| Endpoint | Method | Window | Max Requests | Key Generator | Notes |
|----------|--------|--------|--------------|---------------|-------|
| `/api/business-rules` | GET | 15 minutes | 100,000 | IP-based | List business rules (optimized for 100M users) |
| `/api/business-rules` | POST | 15 minutes | 100,000 | IP-based | Create business rule (optimized for 100M users) |
| `/api/business-rules/[id]` | GET | 15 minutes | 100,000 | IP-based | Get business rule (optimized for 100M users) |
| `/api/business-rules/[id]` | PATCH | 15 minutes | 100,000 | IP-based | Update business rule (optimized for 100M users) |
| `/api/business-rules/performance` | GET | 15 minutes | 100,000 | IP-based | Get performance metrics (optimized for 100M users) |
| `/api/business-rules/simulate` | POST | 15 minutes | 100,000 | IP-based | Simulate business rules (optimized for 100M users) |

---

## Rule Templates Endpoints

| Endpoint | Method | Window | Max Requests | Key Generator | Notes |
|----------|--------|--------|--------------|---------------|-------|
| `/api/rule-templates` | GET | 1 minute | 100,000 | IP-based | List rule templates (optimized for 100M users) |
| `/api/rule-templates` | POST | 15 minutes | 100,000 | IP-based | Create rule template (optimized for 100M users) |
| `/api/rule-templates/[id]` | GET | 1 minute | 100,000 | IP-based | Get rule template (optimized for 100M users) |
| `/api/rule-templates/[id]` | PATCH | 15 minutes | 100,000 | IP-based | Update rule template (optimized for 100M users) |
| `/api/rule-templates/[id]` | DELETE | 15 minutes | 100,000 | IP-based | Delete rule template (optimized for 100M users) |
| `/api/rule-templates/[id]/apply` | POST | 15 minutes | 100,000 | IP-based | Apply rule template (optimized for 100M users) |

---

## Rule Sets Endpoints

| Endpoint | Method | Window | Max Requests | Key Generator | Notes |
|----------|--------|--------|--------------|---------------|-------|
| `/api/rule-sets` | GET | 1 minute | 100,000 | IP-based | List rule sets (optimized for 100M users) |
| `/api/rule-sets` | POST | 15 minutes | 100,000 | IP-based | Create rule set (optimized for 100M users) |
| `/api/rule-sets/[id]` | GET | 1 minute | 100,000 | IP-based | Get rule set (optimized for 100M users) |
| `/api/rule-sets/[id]` | PATCH | 15 minutes | 100,000 | IP-based | Update rule set (optimized for 100M users) |
| `/api/rule-sets/[id]` | DELETE | 15 minutes | 100,000 | IP-based | Delete rule set (optimized for 100M users) |

---

## Rule Versions Endpoints

| Endpoint | Method | Window | Max Requests | Key Generator | Notes |
|----------|--------|--------|--------------|---------------|-------|
| `/api/rule-versions` | GET | 1 minute | 100,000 | IP-based | List rule versions (optimized for 100M users) |
| `/api/rule-versions/[ruleId]/restore` | POST | 15 minutes | 100,000 | IP-based | Restore rule version (optimized for 100M users) |

---

## Language Endpoints

| Endpoint | Method | Window | Max Requests | Key Generator | Notes |
|----------|--------|--------|--------------|---------------|-------|
| `/api/languages` | POST | 15 minutes | 100,000 | IP-based | Create/update language (optimized for 100M users) |
| `/api/languages/[code]` | GET | 15 minutes | 100,000 | IP-based | Get language (optimized for 100M users) |
| `/api/languages/[code]` | DELETE | 15 minutes | 100,000 | IP-based | Delete language (optimized for 100M users) |

---

## Company Endpoints

| Endpoint | Method | Window | Max Requests | Key Generator | Notes |
|----------|--------|--------|--------------|---------------|-------|
| `/api/company` | POST | 1 hour | 100,000 | IP-based | Create company (optimized for 100M users) |
| `/api/company` | GET | 15 minutes | 100,000 | IP-based | Get company (optimized for 100M users) |

---

## Super Admin Endpoints

| Endpoint | Method | Window | Max Requests | Key Generator | Notes |
|----------|--------|--------|--------------|---------------|-------|
| `/api/super-admin/security-audit` | GET | 15 minutes | 100,000 | IP-based | Security audit (optimized for 100M users) |
| `/api/super-admin/diagnostics` | GET | 15 minutes | 100,000 | IP-based | System diagnostics (optimized for 100M users) |
| `/api/super-admin/companies` | GET | 15 minutes | 100,000 | IP-based | List companies (optimized for 100M users) |
| `/api/super-admin/companies/[companyId]` | GET | 15 minutes | 100,000 | IP-based | Get company (optimized for 100M users) |

---

## Referral & Sponsor Endpoints

| Endpoint | Method | Window | Max Requests | Key Generator | Notes |
|----------|--------|--------|--------------|---------------|-------|
| `/api/referral/sponsor` | GET | 1 minute | 100,000 | IP-based | Get sponsor (optimized for 100M users) |
| `/api/sponsors` | GET | 1 minute | 100,000 | IP-based | List sponsors (optimized for 100M users) |

---

## Metrics Endpoints

| Endpoint | Method | Window | Max Requests | Key Generator | Notes |
|----------|--------|--------|--------------|---------------|-------|
| `/api/metrics/performance` | GET | 1 minute | 100,000 | IP-based | Performance metrics (optimized for 100M users) |

---

## Microservices Rate Limits

### Order Service
- **Window**: 15 minutes
- **Max Requests**: 100,000 per IP (optimized for 100M users)
- **Speed Limiter**: 50 requests without delay, then 100ms delay per request (max 2 seconds)

### Commission Service
- **Window**: 15 minutes
- **Max Requests**: 100,000 per IP (optimized for 100M users)
- **Speed Limiter**: 50 requests without delay, then 100ms delay per request (max 2 seconds)

### Payment Service
- **Window**: 15 minutes
- **Max Requests**: 100,000 per IP (optimized for 100M users)
- **Speed Limiter**: 50 requests without delay, then 100ms delay per request (max 2 seconds)

### Notification Service
- **Window**: 15 minutes
- **Max Requests**: 100,000 per IP (optimized for 100M users)
- **Speed Limiter**: 50 requests without delay, then 100ms delay per request (max 2 seconds)

---

## API Gateway Rate Limits

The API Gateway has its own rate limiting service with the following configurations:
**Optimized for 100M+ users scale**

| Endpoint Type | Window | Max Requests | Block Duration |
|--------------|--------|--------------|----------------|
| `wallet_transfer` | 1 minute | 100,000 | 5 minutes |
| `wallet_withdraw` | 1 minute | 100,000 | 10 minutes |
| `commission_calculate` | 1 minute | 100,000 | 15 minutes |
| `auth_login` | 5 minutes | 100,000 | 15 minutes |
| `auth_register` | 1 hour | 100,000 | 1 hour |
| `password_reset` | 1 hour | 100,000 | 2 hours |
| `order_create` | 1 minute | 100,000 | 5 minutes |
| `profile_update` | 5 minutes | 100,000 | - |
| `api_general` | 1 minute | 100,000 | - |

---

## Rate Limit Headers

All rate-limited endpoints return the following headers:

- `X-RateLimit-Limit`: Maximum number of requests allowed
- `X-RateLimit-Remaining`: Number of requests remaining in the current window
- `X-RateLimit-Reset`: Unix timestamp (seconds) when the rate limit resets
- `Retry-After`: Number of seconds to wait before retrying (when limit exceeded)

---

## Rate Limit Error Response

When a rate limit is exceeded, the API returns:

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again in X minutes.",
  "retryAfter": 900,
  "retryAfterMinutes": 15
}
```

Status Code: **429 Too Many Requests**

---

## Development Mode

In development mode, rate limits can be bypassed by adding the header:
```
x-bypass-rate-limit: true
```

---

## Notes

1. **IP-based rate limiting**: Most endpoints use IP-based rate limiting, extracted from `x-forwarded-for`, `x-real-ip`, or `cf-connecting-ip` headers.

2. **User-based rate limiting**: Some endpoints (like financial operations) use user ID-based rate limiting for more accurate tracking.

3. **Skip successful requests**: Authentication endpoints skip counting successful requests to prevent legitimate users from being rate-limited.

4. **Cleanup**: Rate limit entries are automatically cleaned up every 5 minutes to prevent memory leaks.

5. **Production limits**: Some limits are intentionally high for production testing (e.g., auth: 10,000 per 15 minutes).

---

## Summary by Rate Limit Category

**All endpoints have been optimized for 100M+ users scale with 100,000 max requests per window.**

### All Endpoints (100,000 requests) - Optimized for 100M+ Users

#### Authentication & Security
- Authentication (login, register, refresh): 100,000/15 minutes
- Password reset: 100,000/hour
- Super admin security audit: 100,000/15 minutes
- Super admin diagnostics: 100,000/15 minutes

#### E-Cash Operations
- E-cash top-up requests (GET, POST, PATCH): 100,000/15 minutes
- E-cash withdrawal requests (GET, POST, PATCH): 100,000/15 minutes
- E-cash balance: 100,000/minute
- E-cash backfill: 100,000/minute
- E-cash withdrawal/top-up (per user): 100,000/15 minutes

#### PV/Top-Up Operations
- Rank top-up: 100,000/15 minutes (per user)
- Maintenance top-up requests (GET, POST, PATCH): 100,000/15 minutes
- Maintenance auto: 100,000/15 minutes (per user)
- PV top-up requests (GET, POST, PATCH): 100,000/15 minutes
- PV top-up (per user): 100,000/15 minutes

#### Orders
- Order creation: 100,000/minute
- Orders list: 100,000/minute
- Orders by ID: 100,000/minute
- Order update (regular): 100,000/15 minutes
- Order update (admin): 100,000/15 minutes
- Order deletion: 100,000/minute

#### Stock & Inventory
- Stock requests (GET, POST, PATCH): 100,000/15 minutes
- Binary stock: 100,000/minute
- Inventory: 100,000/minute

#### Commissions
- Commissions list: 100,000/minute
- Commission calculation: 100,000/minute
- Commission calculate stockist: 100,000/minute

#### Products
- Products list: 100,000/minute
- Product creation: 100,000/15 minutes
- Product update: 100,000/15 minutes
- Product deletion: 100,000/15 minutes
- Product reset: 100,000/hour

#### Notifications
- Notifications get: 100,000/minute (per user)
- Notifications create: 100,000/minute
- Notifications by ID: 100,000/minute

#### Business Rules
- Business rules list: 100,000/15 minutes
- Business rules create: 100,000/15 minutes
- Business rules get: 100,000/15 minutes
- Business rules update: 100,000/15 minutes
- Business rules performance: 100,000/15 minutes
- Business rules simulate: 100,000/15 minutes

#### Rule Templates
- Rule templates list: 100,000/minute
- Rule templates create: 100,000/15 minutes
- Rule templates get: 100,000/minute
- Rule templates update: 100,000/15 minutes
- Rule templates delete: 100,000/15 minutes
- Rule templates apply: 100,000/15 minutes

#### Rule Sets
- Rule sets list: 100,000/minute
- Rule sets create: 100,000/15 minutes
- Rule sets get: 100,000/minute
- Rule sets update: 100,000/15 minutes
- Rule sets delete: 100,000/15 minutes

#### Rule Versions
- Rule versions list: 100,000/minute
- Rule versions restore: 100,000/15 minutes

#### Languages
- Language create/update: 100,000/15 minutes
- Language get: 100,000/15 minutes
- Language delete: 100,000/15 minutes

#### Company
- Company creation: 100,000/hour
- Company get: 100,000/15 minutes
- Super admin companies list: 100,000/15 minutes
- Super admin companies get: 100,000/15 minutes

#### Referral & Sponsor
- Referral sponsor: 100,000/minute
- Sponsors list: 100,000/minute

#### Metrics
- Performance metrics: 100,000/minute

#### Default Configurations
- General API: 100,000/minute
- Read endpoints: 100,000/minute
- Financial operations: 100,000/minute (default)
- Admin operations: 100,000/minute (default)

---

*Last Updated: Generated from codebase analysis*
