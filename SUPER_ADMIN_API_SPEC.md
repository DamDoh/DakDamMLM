# Super Admin Module API Architecture

## Authentication & Authorization

### Authentication Flow
```
Client Request → API Gateway → Auth Middleware → MFA Verification → IAM Check → Handler
```

### Middleware Stack
1. **CORS Middleware**: Strict origin validation for super admin domains
2. **Rate Limiting**: Distributed Redis-based rate limiting with configurable rules
3. **Authentication**: JWT validation with super admin claims
4. **MFA Verification**: TOTP/SMS/hardware token validation
5. **IAM Authorization**: ABAC policy evaluation
6. **Audit Logging**: Automatic logging of all requests
7. **Security Headers**: HSTS, CSP, X-Frame-Options, etc.

## API Endpoints

### Tenant Management (`/api/super-admin/tenants`)

#### Lifecycle Operations
```typescript
POST   /api/super-admin/tenants
// Create new tenant with provisioning workflow
// Requires: dual authorization for production tenants
// Body: { name, domain, planId, adminUser, residencyRuleId }

PUT    /api/super-admin/tenants/:id/lifecycle
// Update tenant lifecycle state
// Actions: suspend, resume, terminate
// Requires: dual authorization for destructive actions

GET    /api/super-admin/tenants/:id/metrics
// Get tenant health and usage metrics
// Returns: active users, resource usage, compliance status
```

#### Configuration Management
```typescript
GET    /api/super-admin/tenants
// List all tenants with filtering and pagination
// Query: ?status=active&plan=premium&page=1&limit=50

PUT    /api/super-admin/tenants/:id/config
// Update tenant configuration
// Body: { allowEmailLogin, requireMFA, customLimits }

GET    /api/super-admin/tenants/:id/audit
// Get tenant-specific audit logs
// Query: ?action=user_login&dateFrom=2024-01-01
```

### Global Configuration (`/api/super-admin/config`)

```typescript
GET    /api/super-admin/config/global
// Get all global configurations
// Returns: feature flags, system limits, security policies

PUT    /api/super-admin/config/global/:key
// Update global configuration
// Requires: dual authorization for security-related configs
// Body: { value, effectiveDate, expiryDate }

POST   /api/super-admin/config/features
// Toggle feature flags
// Body: { featureKey, enabled, targetTenants }
```

### Identity & Access Management (`/api/super-admin/iam`)

```typescript
GET    /api/super-admin/iam/roles
// List all super admin roles and their permissions

POST   /api/super-admin/iam/users/:userId/role
// Assign role to super admin user
// Requires: higher level admin authorization

POST   /api/super-admin/iam/users/:userId/impersonate
// Start impersonation session
// Returns: impersonation token, session details
// Requires: level 1 or 2 admin

DELETE /api/super-admin/iam/users/:userId/impersonate
// End impersonation session
```

### Auditing & Monitoring (`/api/super-admin/audit`)

```typescript
GET    /api/super-admin/audit/logs
// Query audit logs with advanced filtering
// Query: ?superAdminId=123&action=company_create&dateFrom=2024-01-01&anomalyOnly=true

GET    /api/super-admin/monitoring/health
// System health dashboard data
// Returns: metrics, alerts, anomaly detections

GET    /api/super-admin/monitoring/anomalies
// Active anomaly alerts
// Query: ?severity=high&resolved=false

POST   /api/super-admin/monitoring/anomalies/:id/resolve
// Resolve anomaly alert
```

### Compliance & Governance (`/api/super-admin/compliance`)

```typescript
POST   /api/super-admin/compliance/reports/generate
// Generate compliance report
// Body: { companyId?, reportType: 'GDPR'|'SOC2'|'HIPAA', periodStart, periodEnd }

GET    /api/super-admin/compliance/reports
// List compliance reports
// Query: ?companyId=123&status=completed&type=GDPR

GET    /api/super-admin/compliance/isolation-checks
// Data isolation verification status
// Returns: checks by tenant, risk levels, remediation status

POST   /api/super-admin/compliance/isolation-checks/run
// Execute isolation verification
// Body: { companyId, checkTypes: ['data_leakage', 'encryption'] }
```

### Security & Resilience (`/api/super-admin/security`)

```typescript
POST   /api/super-admin/security/dual-auth/request
// Create dual authorization request
// Body: { actionType, requestData, riskLevel, approvalDeadline }

GET    /api/super-admin/security/dual-auth/pending
// List pending dual authorization requests

PUT    /api/super-admin/security/dual-auth/:id/approve
// Approve dual authorization request
// Requires: different admin from requester

POST   /api/super-admin/security/rate-limits
// Configure rate limiting rules
// Body: { endpoint, method, limit, window, scope }

GET    /api/super-admin/security/sessions
// Active super admin sessions
// For monitoring and force logout capabilities
```

## API Response Format

### Standard Response
```typescript
interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    requestId: string;
    timestamp: string;
    processingTime: number;
  };
}
```

### Error Codes
- `AUTH_REQUIRED`: Authentication required
- `MFA_REQUIRED`: Multi-factor authentication required
- `INSUFFICIENT_PERMISSIONS`: IAM policy violation
- `DUAL_AUTH_REQUIRED`: Dual authorization required
- `RATE_LIMIT_EXCEEDED`: Rate limit exceeded
- `TENANT_SUSPENDED`: Tenant not accessible
- `VALIDATION_ERROR`: Input validation failed

## WebSocket Integration

### Real-time Monitoring
```typescript
// Connection: /ws/super-admin/monitoring
interface WSMessage {
  type: 'health_update' | 'anomaly_alert' | 'audit_event';
  payload: any;
  timestamp: string;
}

// Subscribe to specific tenant metrics
ws.send(JSON.stringify({
  action: 'subscribe',
  channels: ['tenant_123.metrics', 'system.health']
}));
```

## Caching Strategy

### Redis Cache Layers
1. **Configuration Cache**: Global configs with TTL
2. **Permission Cache**: IAM policies with invalidation on changes
3. **Rate Limit Counters**: Sliding window counters
4. **Session Cache**: Active sessions with TTL

### Cache Invalidation
- Configuration changes: Broadcast invalidation
- Permission updates: User-specific invalidation
- Rate limits: Automatic expiration

## Database Optimization

### Read Replicas
- Audit logs: Dedicated read replica
- Metrics: Time-series optimized replica
- Configurations: Cached with Redis

### Indexing Strategy
- Audit logs: Composite indexes on (superAdminId, createdAt, action)
- Metrics: Time-based partitioning
- Permissions: JSON path indexes for ABAC queries

## Security Considerations

### Transport Security
- TLS 1.3 minimum
- Certificate pinning
- HSTS preload

### Data Protection
- End-to-end encryption for sensitive payloads
- Field-level encryption for PII
- Secure key management

### Monitoring & Alerting
- API latency monitoring
- Error rate alerting
- Suspicious activity detection
- Compliance drift monitoring