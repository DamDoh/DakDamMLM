# DakDam MLM Database Schema Documentation

This document provides comprehensive documentation of the PostgreSQL database schema used in the DakDam MLM platform.

## Database Overview

### Technology Stack
- **Database**: PostgreSQL 15+
- **ORM**: Prisma 6.17.1
- **Migration Tool**: Prisma Migrate
- **Connection Pooling**: Prisma built-in pooling
- **Backup Strategy**: Continuous with point-in-time recovery

### Architecture Principles
- **Multi-tenancy**: Company-based data isolation
- **Soft Deletes**: Maintain data integrity with `deleted` flags
- **Audit Trail**: Complete change tracking with `createdAt`, `updatedAt`
- **Performance**: Strategic indexing for query optimization
- **Data Integrity**: Foreign key constraints and check constraints
- **Scalability**: Partitioning-ready design for large datasets

## Core Entities

### 1. Company (Multi-tenancy Root)
```sql
CREATE TABLE companies (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT UNIQUE NOT NULL,
  domain         TEXT UNIQUE,
  description    TEXT,
  logo_url       TEXT,
  favicon_url    TEXT,
  primary_color  TEXT,
  secondary_color TEXT,
  website        TEXT,
  email          TEXT,
  phone          TEXT,
  address        JSONB,
  tax_id         TEXT,
  license_number TEXT,
  industry       TEXT,
  country        TEXT,
  currency       TEXT DEFAULT 'USD',
  timezone       TEXT DEFAULT 'UTC',
  is_active      BOOLEAN DEFAULT true,
  is_verified    BOOLEAN DEFAULT false,

  -- Authentication preferences
  allow_email_login          BOOLEAN DEFAULT true,
  allow_phone_login          BOOLEAN DEFAULT true,
  require_email_verification BOOLEAN DEFAULT false,
  require_phone_verification BOOLEAN DEFAULT false,

  -- Branding
  custom_css       TEXT,
  login_page_config JSONB,

  created_at DATE DEFAULT NOW(),
  updated_at DATE DEFAULT NOW()
);
```

**Relationships:**
- One-to-many with Users, Products, Business Rules, Orders, Commissions
- Parent to all company-scoped entities

**Key Features:**
- Multi-tenant data isolation
- Custom branding and theming
- Authentication policy configuration
- Geographic and regulatory compliance fields

### 2. User (Member Profile)
```sql
CREATE TABLE users (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT UNIQUE NOT NULL,
  phone_number      TEXT UNIQUE NOT NULL,
  password          TEXT NOT NULL,
  first_name        TEXT NOT NULL,
  surname           TEXT NOT NULL,
  full_name         TEXT NOT NULL,
  member_id         TEXT UNIQUE NOT NULL,
  account_type      TEXT DEFAULT 'Customer',
  sponsor_id        TEXT REFERENCES users(id),
  company_id        TEXT REFERENCES companies(id),
  id_card_url       TEXT,
  id_card_number    TEXT UNIQUE,
  active            BOOLEAN DEFAULT true,
  is_admin          BOOLEAN DEFAULT false,

  -- MLM & Genealogy fields
  rank              TEXT DEFAULT 'Member',
  pv                DECIMAL(10,2) DEFAULT 0,
  pv_date           TIMESTAMP,
  team_size         JSONB DEFAULT '{"left": 0, "right": 0, "total": 0}',
  children          JSONB DEFAULT '{"left": null, "right": null}',
  placement_parent_id TEXT REFERENCES users(id),
  position          TEXT CHECK (position IN ('left', 'right')),

  -- Stockist fields
  store_owner_level TEXT CHECK (store_owner_level IN ('District', 'Provincial', 'Regional', 'Commune')),

  -- Additional profile fields
  avatar_url        TEXT,
  addresses         JSONB DEFAULT '[]',
  last_activity_date TIMESTAMP,

  -- Soft delete fields
  deleted           BOOLEAN DEFAULT false,
  deleted_date      TIMESTAMP,
  deleted_by        TEXT,

  -- Account lockout fields
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until      TIMESTAMP,
  last_failed_login TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_users_sponsor_id ON users(sponsor_id);
CREATE INDEX idx_users_placement_parent_id ON users(placement_parent_id);
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_rank ON users(rank);
CREATE INDEX idx_users_deleted ON users(deleted);
CREATE INDEX idx_users_active ON users(active);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_company_rank ON users(company_id, rank);
CREATE INDEX idx_users_company_active ON users(company_id, active);
```

**Relationships:**
- Belongs to Company (multi-tenancy)
- Self-referencing for sponsor hierarchy
- Self-referencing for placement genealogy
- One-to-one with Wallet
- One-to-many with Orders, Commissions, Notifications

**Key Business Logic:**
- Genealogy tree structure with left/right placement
- Rank advancement based on PV and team performance
- Account security with lockout mechanisms
- Soft deletes for audit compliance

### 3. Business Rules Engine
```sql
CREATE TABLE business_rules (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  type         TEXT NOT NULL,
  category     TEXT NOT NULL,
  priority     INTEGER DEFAULT 0,
  is_active    BOOLEAN DEFAULT true,
  conditions   JSONB NOT NULL,
  calculation  JSONB NOT NULL,
  applicable_to JSONB NOT NULL,
  frequency    TEXT DEFAULT 'monthly',
  payout_timing TEXT DEFAULT 'end_of_period',
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW(),
  created_by   TEXT NOT NULL,
  version      INTEGER DEFAULT 1,
  tags         JSONB DEFAULT '[]',
  metadata     JSONB,

  -- Multi-tenancy
  company_id   TEXT REFERENCES companies(id) ON DELETE CASCADE
);
```

**Rule Structure Examples:**

**Binary Commission Rule:**
```json
{
  "name": "Binary Commission",
  "type": "binary_bonus",
  "category": "commission",
  "priority": 100,
  "conditions": [
    {
      "type": "rank",
      "operator": "greater_equal",
      "value": "Bronze"
    }
  ],
  "calculation": {
    "type": "percentage",
    "percentage": 10
  },
  "applicableTo": ["distributor"],
  "frequency": "monthly"
}
```

**Matching Bonus Rule:**
```json
{
  "name": "Leadership Matching",
  "type": "matching_bonus",
  "conditions": [
    {
      "type": "rank",
      "operator": "equals",
      "value": "Diamond"
    }
  ],
  "calculation": {
    "type": "tiered_percentage",
    "tiers": [
      { "min": 1, "max": 5, "value": 5 },
      { "min": 6, "max": 10, "value": 7 },
      { "min": 11, "value": 10 }
    ]
  }
}
```

### 4. Commission System
```sql
CREATE TABLE commissions (
  id        TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   TEXT NOT NULL REFERENCES users(id),
  date      TIMESTAMP DEFAULT NOW(),
  type      TEXT NOT NULL,
  status    TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Paid', 'Cancelled')),
  amount    DECIMAL(10,2) NOT NULL,
  company_id TEXT REFERENCES companies(id),

  -- Commission details
  level     INTEGER,
  description TEXT,
  period_start TIMESTAMP,
  period_end TIMESTAMP,
  order_id  TEXT,
  rule_id   TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_commissions_user_id ON commissions(user_id);
CREATE INDEX idx_commissions_company_id ON commissions(company_id);
CREATE INDEX idx_commissions_status ON commissions(status);
CREATE INDEX idx_commissions_date ON commissions(date);
CREATE INDEX idx_commissions_user_date ON commissions(user_id, date);
CREATE INDEX idx_commissions_company_status ON commissions(company_id, status);
```

### 5. Wallet & E-cash System
```sql
CREATE TABLE wallets (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT UNIQUE NOT NULL REFERENCES users(id),
  balance     DECIMAL(10,2) DEFAULT 0 CHECK (balance >= 0),
  currency    TEXT DEFAULT 'USD',
  is_active   BOOLEAN DEFAULT true,
  company_id  TEXT REFERENCES companies(id),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE wallet_transactions (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id     TEXT NOT NULL REFERENCES wallets(id),
  type          TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'transfer_in', 'transfer_out', 'commission', 'withdrawal')),
  amount        DECIMAL(10,2) NOT NULL,
  balance_before DECIMAL(10,2) NOT NULL,
  balance_after  DECIMAL(10,2) NOT NULL,
  description   TEXT,
  reference_id  TEXT,
  reference_type TEXT CHECK (reference_type IN ('order', 'commission', 'transfer', 'withdrawal', 'topup')),
  status        TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  metadata      JSONB,
  company_id    TEXT REFERENCES companies(id),
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE wallet_transfers (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  from_wallet_id TEXT NOT NULL REFERENCES wallets(id),
  to_wallet_id   TEXT NOT NULL REFERENCES wallets(id),
  amount        DECIMAL(10,2) NOT NULL,
  fee           DECIMAL(10,2) DEFAULT 0,
  description   TEXT,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  escrow_amount DECIMAL(10,2),
  escrow_expires TIMESTAMP,
  approved_by   TEXT REFERENCES users(id),
  approved_at   TIMESTAMP,
  cancelled_by  TEXT REFERENCES users(id),
  cancelled_at  TIMESTAMP,
  company_id    TEXT REFERENCES companies(id),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);
```

**Business Logic:**
- Balance integrity with CHECK constraints
- Double-entry accounting principles
- Escrow system for large transfers
- Transfer approval workflows

### 6. Order & Product System
```sql
CREATE TABLE products (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  price           DECIMAL(10,2) NOT NULL,
  pv              DECIMAL(10,2) DEFAULT 0,
  qty             INTEGER DEFAULT 0,
  category        TEXT NOT NULL,
  image_url       TEXT,
  is_active       BOOLEAN DEFAULT true,
  unit_type       TEXT DEFAULT 'piece',
  type            TEXT DEFAULT 'single',
  original_price  DECIMAL(10,2),
  package_items   JSONB,
  rating          DECIMAL(3,2),
  company_id      TEXT REFERENCES companies(id),
  is_global_product BOOLEAN DEFAULT false,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        TEXT UNIQUE NOT NULL,
  user_id         TEXT NOT NULL REFERENCES users(id),
  date            TIMESTAMP DEFAULT NOW(),
  status          TEXT DEFAULT 'Pending',
  item_count      INTEGER DEFAULT 0,
  amount          DECIMAL(10,2) DEFAULT 0,
  total_amount    DECIMAL(10,2) DEFAULT 0,
  company_id      TEXT REFERENCES companies(id),
  idempotency_key TEXT UNIQUE,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  quantity   INTEGER NOT NULL,
  price      DECIMAL(10,2) NOT NULL,
  pv         DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 7. Genealogy Movement System
```sql
CREATE TABLE genealogy_movements (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id         TEXT NOT NULL REFERENCES users(id),
  company_id        TEXT NOT NULL REFERENCES companies(id),
  moved_by          TEXT NOT NULL REFERENCES users(id),
  from_parent_id    TEXT NOT NULL REFERENCES users(id),
  to_parent_id      TEXT NOT NULL REFERENCES users(id),
  from_position     TEXT NOT NULL CHECK (from_position IN ('left', 'right')),
  to_position       TEXT NOT NULL CHECK (to_position IN ('left', 'right')),
  movement_reason   TEXT,
  status            TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'rejected')),
  approved_by       TEXT REFERENCES users(id),
  approved_at       TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);
```

**Business Logic:**
- Movement authorization with approval workflows
- Genealogy integrity maintenance
- Audit trail for all movements
- Time-limited movement windows

### 8. Notification System
```sql
CREATE TABLE notifications (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   TEXT NOT NULL REFERENCES users(id),
  type        TEXT NOT NULL CHECK (type IN ('email', 'push', 'sms', 'in_app')),
  category    TEXT NOT NULL CHECK (category IN ('onboarding', 'commission', 'team', 'system', 'achievement', 'order')),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB DEFAULT '{}',
  is_read     BOOLEAN DEFAULT false,
  is_sent     BOOLEAN DEFAULT false,
  sent_date   TIMESTAMP,
  read_date   TIMESTAMP,
  created_date TIMESTAMP DEFAULT NOW(),
  priority    TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

CREATE TABLE notification_preferences (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  TEXT UNIQUE NOT NULL REFERENCES users(id),
  email      JSONB DEFAULT '{}',
  push       JSONB DEFAULT '{}',
  sms        JSONB DEFAULT '{}',
  frequency  TEXT DEFAULT 'immediate' CHECK (frequency IN ('immediate', 'daily', 'weekly')),
  quiet_hours JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 9. OTP & Security System
```sql
CREATE TABLE otp_codes (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  purpose    TEXT NOT NULL CHECK (purpose IN ('verification', 'password_reset', 'login_2fa')),
  code       TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  attempts   INTEGER DEFAULT 0,
  is_active  BOOLEAN DEFAULT true,
  company_id TEXT REFERENCES companies(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE otp_delivery_logs (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  otp_id     TEXT,
  identifier TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  provider   TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('sent', 'delivered', 'failed')),
  error      TEXT,
  message_id TEXT,
  cost       DECIMAL(5,4),
  ip_address TEXT,
  user_agent TEXT,
  company_id TEXT REFERENCES companies(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 10. Audit & Compliance System
```sql
CREATE TABLE audit_logs (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT REFERENCES users(id),
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT,
  changes    JSONB,
  ip_address TEXT,
  user_agent TEXT,
  company_id TEXT REFERENCES companies(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE compliance_documents (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('terms', 'privacy', 'compensation', 'policy')),
  content       TEXT NOT NULL,
  version       TEXT NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  effective_date TIMESTAMP NOT NULL,
  company_id    TEXT REFERENCES companies(id),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW(),
  created_by    TEXT NOT NULL
);

CREATE TABLE member_agreements (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  TEXT NOT NULL REFERENCES users(id),
  document_id TEXT NOT NULL REFERENCES compliance_documents(id) ON DELETE CASCADE,
  signed     BOOLEAN DEFAULT false,
  signed_at  TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT,
  company_id TEXT REFERENCES companies(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 11. Stock & Inventory System
```sql
CREATE TABLE stock_requests (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  stockist_id      TEXT NOT NULL REFERENCES users(id),
  stockist_name    TEXT NOT NULL,
  stockist_level   TEXT DEFAULT 'District',
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled')),
  created_date     TIMESTAMP DEFAULT NOW(),
  processed_date   TIMESTAMP,
  processed_by     TEXT REFERENCES users(id),
  total_value      DECIMAL(10,2) DEFAULT 0,
  item_count       INTEGER DEFAULT 0,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE stock_request_items (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_request_id  TEXT NOT NULL REFERENCES stock_requests(id) ON DELETE CASCADE,
  product_id        TEXT NOT NULL,
  product_name      TEXT NOT NULL,
  requested_quantity INTEGER NOT NULL,
  approved_quantity INTEGER,
  unit_price        DECIMAL(10,2) DEFAULT 0,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE inventory_transactions (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  TEXT NOT NULL,
  user_id     TEXT REFERENCES users(id),
  type        TEXT NOT NULL CHECK (type IN ('purchase', 'sale', 'transfer', 'adjustment', 'return')),
  quantity    INTEGER NOT NULL,
  previous_qty INTEGER NOT NULL,
  new_qty     INTEGER NOT NULL,
  reference   TEXT,
  reason      TEXT,
  company_id  TEXT REFERENCES companies(id),
  created_at  TIMESTAMP DEFAULT NOW(),
  created_by  TEXT NOT NULL
);
```

### 12. E-cash Top-up System
```sql
CREATE TABLE ecash_topup_requests (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    TEXT NOT NULL REFERENCES users(id),
  member_name  TEXT NOT NULL,
  amount       DECIMAL(10,2) NOT NULL,
  remark       TEXT DEFAULT '',
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  created_date TIMESTAMP DEFAULT NOW(),
  processed_date TIMESTAMP,
  processed_by TEXT REFERENCES users(id),
  proof_url    TEXT DEFAULT '',
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);
```

## Database Relationships

### Entity Relationship Diagram (Simplified)

```
Company (1) ──── (M) Users
   │                    │
   │                    ├── (1) Wallet
   │                    ├── (M) Orders ─── (M) OrderItems ─── (1) Products
   │                    ├── (M) Commissions
   │                    ├── (M) Notifications
   │                    └── (M) Genealogy Movements
   │
   ├── (M) Business Rules
   ├── (M) Rule Templates
   ├── (M) Products
   ├── (M) Referral Links ─── (M) Referral Relationships
   └── (M) Audit Logs
```

## Performance Optimizations

### Indexing Strategy
1. **Primary Keys**: All tables have UUID primary keys
2. **Foreign Keys**: Automatic indexing on foreign key columns
3. **Composite Indexes**: Multi-column indexes for common query patterns
4. **Partial Indexes**: Conditional indexes for active records
5. **Functional Indexes**: Expression-based indexes where needed

### Query Optimization
1. **Connection Pooling**: Prisma handles connection pooling
2. **Query Batching**: Multiple queries batched in transactions
3. **Result Caching**: Application-level caching with Redis
4. **Read Replicas**: Planned for high-read scenarios

### Data Partitioning (Future)
1. **Time-based Partitioning**: Audit logs, notifications by month
2. **Company-based Partitioning**: Large multi-tenant tables
3. **Hash Partitioning**: Users table by company_id

## Data Integrity & Constraints

### Check Constraints
- Balance >= 0 in wallets
- Position IN ('left', 'right') in genealogy
- Status values restricted to valid enums
- Percentage values between 0-100

### Foreign Key Constraints
- CASCADE deletes for company-scoped data
- SET NULL for optional relationships
- RESTRICT for critical data protection

### Unique Constraints
- Email and phone uniqueness per company
- Member ID uniqueness across system
- Idempotency keys for order processing

## Backup & Recovery

### Backup Strategy
1. **Daily Full Backups**: Complete database snapshots
2. **Hourly Incremental Backups**: Change data capture
3. **Point-in-time Recovery**: WAL-based recovery
4. **Cross-region Replication**: Disaster recovery

### Retention Policies
- **Transaction Data**: 7 years for compliance
- **Audit Logs**: 7 years minimum
- **Backups**: 30 days rolling retention
- **Archives**: Long-term cold storage

## Migration Strategy

### Prisma Migrations
```bash
# Generate migration
npx prisma migrate dev --name add_new_feature

# Apply to production
npx prisma migrate deploy

# Reset for development
npx prisma migrate reset
```

### Data Migrations
- **Version-controlled**: All migrations tracked in Git
- **Transactional**: Rollback on failure
- **Idempotent**: Safe to run multiple times
- **Tested**: Migration testing in CI/CD

## Monitoring & Maintenance

### Health Checks
- **Connection Pool Status**: Monitor Prisma connections
- **Query Performance**: Slow query identification
- **Disk Space**: Storage capacity monitoring
- **Replication Lag**: Read replica synchronization

### Maintenance Tasks
- **VACUUM ANALYZE**: Statistics updates weekly
- **REINDEX**: Index maintenance monthly
- **Partition Rotation**: Old data archiving
- **Backup Verification**: Restore testing quarterly

## Security Considerations

### Data Encryption
- **At Rest**: PostgreSQL encryption for sensitive fields
- **In Transit**: TLS 1.3 for all connections
- **Application Level**: Additional encryption for PII

### Access Control
- **Role-based Access**: Database-level row security policies
- **Connection Limiting**: IP-based access restrictions
- **Query Auditing**: All queries logged for security

### Compliance
- **GDPR**: Data minimization and consent management
- **SOX**: Financial data audit trails
- **Industry Standards**: PCI DSS for payment data

## Development Best Practices

### Schema Changes
1. **Migration First**: Always create migrations for schema changes
2. **Backward Compatible**: Ensure existing code continues to work
3. **Data Migration**: Include data transformation when needed
4. **Rollback Plan**: Always have rollback strategy

### Query Optimization
1. **N+1 Problem**: Use Prisma's include for relations
2. **Pagination**: Always implement pagination for large datasets
3. **Indexing**: Add indexes for new query patterns
4. **Caching**: Implement caching for frequently accessed data

### Data Validation
1. **Application Level**: Zod schemas for input validation
2. **Database Level**: Check constraints for data integrity
3. **Business Logic**: Custom validation in service layer

This comprehensive database schema documentation provides the foundation for understanding the DakDam MLM platform's data architecture. The schema is designed for scalability, performance, and compliance with modern data management best practices.