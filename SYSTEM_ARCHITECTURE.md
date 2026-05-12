# DakDam MLM System Architecture Documentation

## Overview

DakDam is a comprehensive Binary Tree Multi-Level Marketing (MLM) platform built with modern microservices architecture. This document provides complete technical documentation for developers to understand, maintain, and extend the system.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Next.js API Gateway (Port 3000)                │ │
│  │  ┌─────────────┬─────────────┬─────────────┬─────────────┐ │ │
│  │  │   Frontend  │   Admin UI  │   API       │   Auth      │ │ │
│  │  │   (React)   │   Dashboard │   Routes    │   Routes    │ │ │
│  │  └─────────────┴─────────────┴─────────────┴─────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MICROSERVICES LAYER                           │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐     │
│  │ User        │ Commission  │ Genealogy   │ Payment     │     │
│  │ Service     │ Service     │ Service     │ Service     │     │
│  │ (Port 3001) │ (Port 3002) │ (Port 3003) │ (Port 3004) │     │
│  ├─────────────┼─────────────┼─────────────┼─────────────┤     │
│  │ Order       │ Notification│ Analytics   │ OTP         │     │
│  │ Service     │ Service     │ Service     │ Service     │     │
│  │ (Port 3005) │ (Port 3006) │ (Port 3007) │ (Port 3008) │     │
│  ├─────────────┼─────────────┼─────────────┼─────────────┤     │
│  │ Admin       │ Company     │ Upload      │ Migration   │     │
│  │ Service     │ Service     │ Service     │ Service     │     │
│  │ (Port 3009) │ (Port 3010) │ (Port 3011) │ (Port 3012) │     │
│  └─────────────┴─────────────┴─────────────┴─────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                          │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐     │
│  │ PostgreSQL  │   Redis     │ RabbitMQ    │   Nginx     │     │
│  │ Database    │   Cache     │   Queue     │   Reverse   │     │
│  │ (Port 5432) │ (Port 6379) │ (Port 5672) │   Proxy     │     │
│  └─────────────┴─────────────┴─────────────┴─────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend & API Gateway
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **UI Library**: React 18
- **Styling**: Tailwind CSS + Radix UI components
- **State Management**: React Context API + Custom Hooks
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts
- **Icons**: Lucide React
- **Internationalization**: next-i18next

### Backend Microservices
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **API Documentation**: Swagger/OpenAPI
- **Logging**: Winston
- **Metrics**: Prometheus metrics
- **Caching**: Redis
- **Message Queue**: RabbitMQ (planned)

### Database & Storage
- **Primary Database**: PostgreSQL 15
- **ORM**: Prisma
- **Migration Tool**: Prisma Migrate
- **Connection Pooling**: Built-in Prisma pooling
- **File Storage**: Local filesystem (configurable to S3/Cloud Storage)

### Infrastructure & DevOps
- **Containerization**: Docker
- **Orchestration**: Kubernetes
- **Reverse Proxy**: Nginx
- **Load Balancing**: Kubernetes Services
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack (planned)
- **CI/CD**: GitHub Actions
- **Testing**: Jest + Playwright E2E

### Security & Authentication
- **Authentication**: JWT with refresh tokens
- **Password Hashing**: bcrypt (12 rounds)
- **Rate Limiting**: express-rate-limit
- **CORS**: Configured per environment
- **Helmet**: Security headers
- **Input Validation**: Zod schemas
- **SQL Injection Prevention**: Prisma parameterized queries

## Microservices Architecture

### Service Communication Patterns

1. **API Gateway Pattern**: Next.js handles client requests and routes to appropriate microservices
2. **Direct Service Communication**: Services communicate via HTTP REST APIs
3. **Database Sharing**: All services share the same PostgreSQL database with schema isolation
4. **Event-Driven (Planned)**: RabbitMQ for asynchronous communication between services

### Service Responsibilities

#### 1. User Service (Port 3001)
**Purpose**: User management, authentication, and profile operations

**Key Features**:
- User registration and login
- JWT token management
- Password reset functionality
- User profile management
- Multi-tenant company support
- Genealogy relationship management

**API Endpoints**:
- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/genealogy` - Get user's genealogy tree

**Database Tables**:
- `users` - User accounts and profiles
- `companies` - Multi-tenant company data
- `genealogy_movements` - Genealogy tree changes

#### 2. Commission Service (Port 3002)
**Purpose**: Commission calculations, payouts, and financial operations

**Key Features**:
- Binary tree commission calculations
- Matching bonus processing
- Rank advancement calculations
- Commission payment processing
- Financial reporting and analytics
- Performance metrics and monitoring

**API Endpoints**:
- `POST /api/commissions/calculate` - Calculate commissions for period
- `GET /api/commissions/history/:userId` - Get commission history
- `POST /api/commissions/payout` - Process commission payouts
- `GET /api/commissions/summary` - Get commission summaries

**Database Tables**:
- `commissions` - Commission records
- `commission_disputes` - Commission dispute tracking
- `financial_controls` - Financial control operations

#### 3. Genealogy Service (Port 3003)
**Purpose**: Binary tree management and genealogy operations

**Key Features**:
- Binary tree structure management
- Member placement algorithms
- Tree traversal and visualization
- Genealogy movement tracking
- Tree compression for inactive members
- Genealogy analytics and reporting

**API Endpoints**:
- `GET /api/genealogy/tree/:memberId` - Get genealogy tree
- `POST /api/genealogy/move` - Move member in tree
- `GET /api/genealogy/stats/:memberId` - Get genealogy statistics
- `POST /api/genealogy/compress` - Compress inactive branches

**Database Tables**:
- User genealogy fields (placement_parent_id, position, children, team_size)
- `genealogy_movements` - Movement history and approvals

#### 4. Payment Service (Port 3004)
**Purpose**: Payment processing and e-cash wallet management

**Key Features**:
- E-cash wallet operations
- Peer-to-peer transfers
- Payment proof processing
- Top-up request management
- Financial transaction logging
- Escrow system for large transfers

**API Endpoints**:
- `GET /api/wallet/balance` - Get wallet balance
- `POST /api/wallet/transfer` - Transfer e-cash
- `POST /api/payment-proofs/upload` - Upload payment proof
- `GET /api/ecash-topup-requests` - Get top-up requests

**Database Tables**:
- `wallets` - User e-cash wallets
- `wallet_transactions` - Transaction history
- `wallet_transfers` - Transfer records
- `ecash_topup_requests` - Top-up request processing

#### 5. Order Service (Port 3005)
**Purpose**: Product ordering and fulfillment

**Key Features**:
- Product catalog management
- Order processing and fulfillment
- Inventory management
- Stock request processing
- Order status tracking
- Purchase analytics

**API Endpoints**:
- `POST /api/orders` - Create new order
- `GET /api/orders/:userId` - Get user orders
- `PUT /api/orders/:id/status` - Update order status
- `GET /api/products` - Get product catalog

**Database Tables**:
- `orders` - Order records
- `order_items` - Order line items
- `products` - Product catalog
- `stock_requests` - Stock request processing

#### 6. Notification Service (Port 3006)
**Purpose**: Multi-channel notification management

**Key Features**:
- Email notifications
- SMS notifications
- Push notifications
- In-app notifications
- Notification preferences
- Template management

**API Endpoints**:
- `POST /api/notifications/send` - Send notification
- `GET /api/notifications/:userId` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/preferences` - Update preferences

**Database Tables**:
- `notifications` - Notification records
- `notification_preferences` - User preferences

#### 7. Analytics Service (Port 3007)
**Purpose**: Business intelligence and reporting

**Key Features**:
- Key performance metrics
- Growth analytics
- Commission forecasting
- Business health scoring
- Custom reporting
- Data visualization

**API Endpoints**:
- `GET /api/analytics/key-metrics` - Get key metrics
- `GET /api/analytics/growth` - Get growth analytics
- `GET /api/analytics/health-score` - Get business health score
- `GET /api/analytics/reports/:type` - Generate reports

**Database Tables**:
- `rule_execution_summaries` - Rule performance data
- Analytics views and materialized views

#### 8. OTP Service (Port 3008)
**Purpose**: One-time password and verification

**Key Features**:
- Email OTP generation and verification
- SMS OTP processing
- OTP delivery tracking
- Rate limiting and security
- Multi-factor authentication support

**API Endpoints**:
- `POST /api/otp/generate` - Generate OTP
- `POST /api/otp/verify` - Verify OTP
- `GET /api/otp/delivery-logs` - Get delivery logs

**Database Tables**:
- `otp_codes` - OTP code storage
- `otp_delivery_logs` - Delivery tracking
- `otp_settings` - Service configuration

#### 9. Admin Service (Port 3009)
**Purpose**: Administrative operations and system management

**Key Features**:
- User management
- System configuration
- Business rules management
- Audit logging
- System health monitoring

**API Endpoints**:
- `GET /api/admin/users` - List all users
- `PUT /api/admin/users/:id` - Update user
- `GET /api/admin/audit-logs` - Get audit logs
- `GET /api/admin/system-health` - System health status

#### 10. Company Service (Port 3010)
**Purpose**: Multi-tenant company management

**Key Features**:
- Company onboarding
- Company settings management
- Branding customization
- Company-specific configurations

**API Endpoints**:
- `POST /api/companies` - Create company
- `GET /api/companies/:id` - Get company details
- `PUT /api/companies/:id` - Update company
- `GET /api/companies/:id/stats` - Get company statistics

#### 11. Upload Service (Port 3011)
**Purpose**: File upload and management

**Key Features**:
- Secure file uploads
- Image processing and optimization
- Document storage
- File access control

**API Endpoints**:
- `POST /api/upload` - Upload file
- `GET /api/upload/:id` - Get file
- `DELETE /api/upload/:id` - Delete file

#### 12. Migration Service (Port 3012)
**Purpose**: Data migration and system updates

**Key Features**:
- Database migrations
- Data transformation
- Legacy system migration
- System upgrade coordination

## Business Rules Engine

### Overview
The system includes a comprehensive business rules engine that allows administrators to configure MLM compensation plans without code changes.

### Key Components
- **Rule Engine**: Core evaluation engine with priority-based execution
- **Rule Templates**: Pre-built compensation plan templates
- **Admin Dashboard**: Web interface for rule management
- **Conflict Detection**: Automatic rule conflict identification
- **Version Control**: Rule versioning and rollback capabilities

### Supported Rule Types
1. **Commission Rules**: Binary, Unilevel, Matrix, Hybrid commissions
2. **Bonus Rules**: Matching bonuses, leadership bonuses, fast-start bonuses
3. **Qualification Rules**: Rank advancement requirements
4. **Incentive Rules**: Travel, car, house bonuses
5. **Penalty Rules**: Compliance and performance penalties

## Database Schema

### Core Entities
- **Users**: Member profiles, genealogy relationships, ranks
- **Companies**: Multi-tenant company isolation
- **Products**: MLM product catalog
- **Orders**: Purchase transactions
- **Commissions**: Earnings and payouts
- **Business Rules**: Dynamic rule system
- **Wallets**: E-cash wallet system
- **Notifications**: Multi-channel notifications

### Key Relationships
- Users belong to Companies (multi-tenancy)
- Users have genealogy relationships (sponsor/placement)
- Commissions are earned by Users
- Orders contain Products purchased by Users
- Business Rules are evaluated for Users
- Wallets belong to Users for e-cash transactions

## Security Architecture

### Authentication & Authorization
- JWT-based authentication with refresh token rotation
- Role-based access control (RBAC)
- Multi-factor authentication support
- Session management with device fingerprinting

### Data Protection
- Password hashing with bcrypt
- Input validation and sanitization
- SQL injection prevention via ORM
- XSS protection with input sanitization
- Financial data encryption

### Network Security
- Rate limiting on all endpoints
- CORS configuration
- Security headers (Helmet)
- Request size limits
- Input sanitization middleware

## Deployment Architecture

### Development Environment
- Docker Compose for local development
- Hot reloading for all services
- Local PostgreSQL and Redis instances
- Development-specific logging and debugging

### Production Environment
- Kubernetes orchestration
- Load balancing with ingress
- Horizontal pod autoscaling
- Persistent volume storage
- Secrets management
- Health checks and readiness probes

### Infrastructure Components
- **API Gateway**: Next.js handles routing and serves frontend
- **Microservices**: Individual Express.js services
- **Database**: PostgreSQL with connection pooling
- **Cache**: Redis for session and data caching
- **Queue**: RabbitMQ for asynchronous processing
- **Monitoring**: Prometheus metrics collection
- **Logging**: Structured logging with Winston

## Monitoring & Observability

### Application Metrics
- Request/response times
- Error rates
- Database query performance
- Cache hit/miss ratios
- Business metrics (commissions, orders, users)

### Infrastructure Monitoring
- CPU and memory usage
- Disk space and I/O
- Network traffic
- Container health status
- Kubernetes cluster health

### Logging
- Structured logging with Winston
- Log levels: ERROR, WARN, INFO, DEBUG
- Centralized log aggregation (planned)
- Audit logging for compliance

## Development Workflow

### Local Development
1. Clone repository
2. Install dependencies: `npm install`
3. Set up database: `npm run db:migrate`
4. Start services: `docker-compose up`
5. Run development server: `npm run dev`

### Testing
- Unit tests: `npm run test:unit`
- Integration tests: `npm run test:integration`
- E2E tests: `npm run test:e2e`
- Performance tests: `npm run test:performance`

### Deployment
- Build: `npm run build`
- Docker build: `docker build -t dakdam .`
- Kubernetes deploy: `kubectl apply -f k8s/`

## API Design Patterns

### RESTful API Design
- Resource-based URLs
- HTTP methods for CRUD operations
- JSON request/response format
- Consistent error response format
- Pagination for list endpoints
- Filtering and sorting support

### Authentication
- Bearer token authentication
- Refresh token rotation
- Token expiration handling
- Secure token storage

### Error Handling
- Consistent error response format
- HTTP status codes
- Error codes for programmatic handling
- User-friendly error messages

### Rate Limiting
- Configurable rate limits per endpoint
- Burst handling
- Rate limit headers in responses
- Graceful degradation

## Performance Optimization

### Database Optimization
- Proper indexing on frequently queried columns
- Query optimization with EXPLAIN
- Connection pooling
- Read replicas (planned)

### Caching Strategy
- Redis for session storage
- Application-level caching
- Database query result caching
- CDN for static assets

### Code Optimization
- Lazy loading for components
- Code splitting
- Bundle optimization
- Memory leak prevention

## Scalability Considerations

### Horizontal Scaling
- Stateless microservices
- Load balancing
- Database read replicas
- Redis clustering

### Vertical Scaling
- Resource limits configuration
- Performance monitoring
- Auto-scaling policies

### Data Scaling
- Database partitioning (planned)
- Archive old data
- Data retention policies

## Compliance & Security

### Regulatory Compliance
- GDPR compliance features
- Data retention policies
- Audit logging
- Right to erasure (DSAR)
- Data portability

### Security Best Practices
- OWASP Top 10 protection
- Secure coding practices
- Regular security audits
- Dependency vulnerability scanning
- Security headers and CSP

## Future Enhancements

### Planned Features
- RabbitMQ integration for event-driven architecture
- GraphQL API for flexible queries
- Real-time notifications with WebSockets
- Advanced analytics dashboard
- Mobile app development
- Multi-region deployment
- Advanced AI-powered business insights

### Technology Upgrades
- Service mesh (Istio)
- Advanced monitoring (Datadog)
- Distributed tracing (Jaeger)
- Advanced security (OAuth 2.0, OpenID Connect)

---

This documentation provides a comprehensive overview of the DakDam MLM system architecture. For detailed API documentation, see `API_DOCUMENTATION.md`. For deployment instructions, see `DEPLOYMENT_GUIDE.md`.