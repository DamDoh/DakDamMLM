# 📋 DakDam MLM Platform - Comprehensive Features List

## System Overview
DakDam is a complete Multi-Level Marketing (MLM) platform built with Next.js, TypeScript, Prisma, and PostgreSQL. It provides a full-featured binary tree MLM system with advanced compensation management, e-commerce, and multi-tenant support.

---

## 🏢 **1. Multi-Tenancy & Company Management**

### Company Setup
- **Multi-Company Support**: Host multiple MLM companies on one platform
- **Company Profiles**: Name, logo, favicon, domain, description
- **Custom Branding**: Primary/secondary colors, custom CSS, login page customization
- **Company Settings**: Currency, timezone, country, industry, tax ID
- **Domain Management**: Custom domain support for each company
- **Authentication Preferences**: Email/phone login toggle, verification requirements

### Company Configuration
- **Business Information**: Address, phone, email, website, license number
- **Status Management**: Active/inactive companies, verification status
- **Company-Specific Rules**: Custom business rules and compensation plans per company

---

## 👥 **2. User Management & Authentication**

### User Registration & Profiles
- **Multiple Registration Methods**:
  - Email + Password
  - Phone Number + OTP
  - Sponsor referral link registration
- **User Profiles**:
  - Personal information (first name, surname, full name)
  - Contact details (email, phone)
  - ID card upload and verification
  - Avatar/profile picture
  - Multiple addresses support
  - Member ID (unique identifier)
- **Account Types**: Customer, Distributor, Stockist, Admin

### Authentication System
- **OTP-Based Authentication**:
  - Email OTP verification
  - SMS OTP verification (self-hosted)
  - Configurable OTP settings per company
  - Rate limiting (5 requests per hour, 20 per day)
  - Automatic OTP expiry (10 minutes default)
  - Maximum verification attempts (3 by default)
- **Password Authentication**:
  - bcrypt hashing (12 rounds)
  - Password change functionality
  - Forgot password/reset with tokens
  - Password policy enforcement
- **JWT Token System**:
  - Short-lived access tokens (15 minutes)
  - Long-lived refresh tokens (7 days)
  - Automatic token rotation
- **Security Features**:
  - Account lockout after failed attempts
  - Session management
  - IP address logging
  - User agent tracking

### Account Security
- **Failed Login Protection**: Track failed attempts, temporary lockout
- **Email/Phone Verification**: Optional but recommended email verification
- **Account Status**: Active/inactive, soft delete functionality
- **Last Activity Tracking**: Monitor user engagement

---

## 🌳 **3. Genealogy & Binary Tree System**

### Binary Tree Structure
- **Binary Placement**:
  - Left and right leg placement
  - Parent-child relationships
  - Position tracking (left/right)
  - Sponsor vs placement parent distinction
- **Tree Operations**:
  - Interactive tree visualization
  - Member search and navigation
  - Zoom in/out capabilities
  - Expandable/collapsible nodes
- **Genealogy Movement**:
  - Move members between positions
  - Requires approval for movements
  - Time-limited movement windows (24 hours default)
  - Movement history and audit trail
  - Reason tracking for movements

### Network Statistics
- **Team Size Tracking**:
  - Left leg count
  - Right leg count
  - Total network size
- **Volume Tracking**:
  - Personal Volume (PV)
  - Group Volume (GV)
  - Binary volume calculations
  - PV date tracking
- **Network Analytics**:
  - Active vs inactive members
  - Network depth and width
  - Growth trends and patterns

---

## 💰 **4. Commission & Compensation System**

### Commission Types
- **Binary Commission**: Based on weaker leg volume
- **Matching Bonus**: Leadership and team matching bonuses
- **Retail Profit**: Direct sales profit margins
- **Fast-Start Bonus**: New member recruitment bonuses
- **Rank Achievement Bonus**: Rank advancement rewards
- **Leadership Bonus**: Team performance incentives
- **Pool Bonus**: Company-wide profit sharing

### Commission Calculation
- **Automated Calculation Engine**:
  - Real-time commission calculations
  - Configurable calculation frequency (weekly/monthly/quarterly)
  - Multiple calculation methods (percentage, fixed, tiered, formula-based)
  - Minimum payout thresholds
- **Commission Processing**:
  - Automated payout scheduling
  - Manual calculation triggers
  - Approval workflows
  - Status tracking (Pending/Paid/Cancelled)
  - Commission history and breakdown

### Financial Controls
- **Commission Management**:
  - Hold and release mechanisms
  - Adjustment processing
  - Dispute handling and resolution
  - Tax calculation support
- **Commission Disputes**:
  - Dispute submission and tracking
  - Investigation workflows
  - Resolution processing
  - Communication with members

---

## 🏆 **5. Rank & Advancement System**

### Rank Levels
- **Standard Ranks**:
  - Member (Entry level)
  - Bronze
  - Silver
  - Gold
  - Platinum
  - Diamond
- **Rank Requirements**:
  - Personal Volume (PV) thresholds
  - Group Volume (GV) requirements
  - Team size minimums
  - Active member counts
  - Qualified leg requirements

### Rank Management
- **Automatic Rank Advancement**: Based on qualification criteria
- **Manual Rank Changes**: Admin override capability
- **Rank Maintenance**: Monthly/quarterly maintenance requirements
- **Rank History**: Complete rank change tracking
- **Rank Benefits**: Commission rate increases, bonus eligibility

---

## 🏪 **6. E-Commerce & Product Management**

### Product Catalog
- **Product Information**:
  - Name, description, category
  - High-quality images
  - Price (retail and wholesale)
  - Personal Volume (PV) values
  - Stock quantity tracking
  - Unit types (piece, box, case, etc.)
  - Product ratings and reviews
- **Product Types**:
  - Single products
  - Package/bundle products with items list
  - Active/inactive status
- **Global Products**: Shared products across companies

### Inventory Management
- **Stock Tracking**:
  - Real-time inventory levels
  - Low stock alerts
  - Stock adjustments
  - Inventory transactions log
- **Stock Requests** (for Stockists):
  - Request submission and approval
  - Item-level detail tracking
  - Processor assignment
  - Status tracking (pending/approved/rejected)
  - Value and count calculations

### Order Management
- **Order Processing**:
  - Order creation with unique order IDs
  - Multiple order items support
  - Order status tracking (Pending/Processing/Shipped/Delivered/Cancelled)
  - Order history and details
  - Item quantity and pricing
- **Idempotency**: Duplicate order prevention with idempotency keys
- **Order Analytics**: Count, amount, total calculations

---

## 💳 **7. E-Cash Wallet System**

### Wallet Features
- **Digital Wallet**:
  - Balance tracking per user
  - Multi-currency support (USD default)
  - Active/inactive status
  - Company-specific wallets
- **Wallet Transactions**:
  - Credit and debit operations
  - Transfer tracking (in/out)
  - Commission deposits
  - Withdrawal processing
  - Top-up capabilities
  - Balance before/after tracking
  - Transaction status (pending/completed/failed/cancelled)

### Fund Transfers
- **Peer-to-Peer Transfers**:
  - Wallet-to-wallet transfers
  - Transfer fees support
  - Optional descriptions
  - Status tracking
- **Escrow System**:
  - Large transfer approval requirements (>$1,000)
  - Escrow amount holding
  - Escrow expiration dates
  - Approval workflows
  - Cancellation capabilities
- **Transfer Security**:
  - Amount validation
  - Sufficient balance checks
  - Approval logging
  - Transfer history

### E-Cash Top-Up Requests
- **Top-Up Management**:
  - Member top-up requests
  - Proof of payment upload
  - Admin approval workflow
  - Status tracking (pending/approved/rejected)
  - Processor assignment
  - Remark/notes support

---

## 📊 **8. Business Rules Engine**

### Rule Management System
- **50+ Rule Types Supported**:
  - Commission rules (binary, unilevel, matrix, hybrid)
  - Bonus rules (matching, leadership, fast-start, retail)
  - Qualification rules (rank advancement, maintenance)
  - Incentive rules (travel, car, house bonuses)
  - Penalty rules (compliance, performance)
- **Rule Configuration**:
  - Name, description, category
  - Priority system (0-1000)
  - Active/inactive status
  - Version control
  - Tags and metadata
  - Applicable member types (distributor/stockist/customer)
  - Frequency settings (weekly/monthly/quarterly/annual/continuous)
  - Payout timing options

### Rule Conditions
- **Complex Conditions**:
  - Multi-level AND/OR logic
  - Rank-based conditions
  - Volume thresholds (PV/GV)
  - Recruitment count requirements
  - Active member criteria
  - Qualified leg requirements
  - Custom formula conditions

### Rule Calculations
- **Calculation Types**:
  - Percentage-based
  - Fixed amount
  - Per-unit calculations
  - Tiered percentage
  - Tiered fixed amounts
  - Custom formula evaluation

### Advanced Rule Features
- **Rule Sets**: Group rules into collections
- **Rule Templates**: Pre-built compensation plans (Binary, Unilevel, Matrix, Hybrid)
- **Rule Simulation**: Real-time testing with custom scenarios
- **Conflict Detection**: Automatic conflict identification and resolution
- **Version Control**: Complete version history with rollback
- **Validation**: Real-time validation and error checking
- **Audit Trail**: Complete change tracking for compliance
- **Performance Monitoring**: Execution metrics and optimization

### Company Rule Configuration
- **Customization per Company**:
  - Enabled/disabled rule types
  - Custom calculation types
  - Custom condition types
  - Performance limits (execution time, memory, concurrency)
  - Cache settings (enabled, TTL)
  - Audit settings (enabled, retention)
  - Compliance modes (strict/flexible/disabled)
  - Global overrides and defaults
  - Custom functions
  - Integration settings

### Dynamic Rule Sets
- **Advanced Capabilities**:
  - Dynamic rule creation
  - Rule execution order
  - Target criteria and segmentation
  - Version control with drafts
  - Approval workflows
  - Effective and expiry dates

---

## 🔐 **9. Role-Based Access Control (RBAC)**

### Roles & Permissions
- **System Roles**:
  - Super Admin (full system access)
  - Company Admin (company-level access)
  - Stockist (inventory and sales management)
  - Distributor (team management)
  - Member (basic user access)
- **Custom Roles**:
  - Company-specific role creation
  - Role description and naming
  - Active/inactive status
- **Permission System**:
  - Resource-based permissions (user, product, order, commission, admin)
  - Action-based permissions (create, read, update, delete, manage)
  - Role-permission mapping
- **User Role Assignment**:
  - Multiple roles per user
  - Role assignment tracking (who assigned, when)
  - Role removal and updates

---

## 🔔 **10. Notification System**

### Notification Features
- **Notification Types**:
  - Email notifications
  - Push notifications
  - SMS notifications
  - In-app notifications
- **Notification Categories**:
  - Onboarding notifications
  - Commission updates
  - Team activity
  - System announcements
  - Achievement notifications
  - Order updates
- **Notification Management**:
  - Read/unread status
  - Sent tracking
  - Delivery timestamps
  - Priority levels (low/medium/high/urgent)
  - Custom data payload

### Notification Preferences
- **User Preferences**:
  - Channel preferences (email, push, SMS)
  - Category preferences (toggle per category)
  - Frequency settings (immediate/daily/weekly)
  - Quiet hours configuration
  - Per-channel category control

---

## 📚 **11. Member Onboarding & Progress Tracking**

### Onboarding System
- **Progress Tracking**:
  - Multi-step onboarding process
  - Completed steps tracking
  - Current step indicator
  - Start and last activity dates
  - Completion status
  - Total time spent tracking
- **Learning Features**:
  - Quiz scores tracking
  - Notes and feedback
  - Progress milestones

---

## 📈 **12. Analytics & Reporting**

### Business Intelligence
- **Dashboard Analytics**:
  - Key metrics overview
  - Member growth statistics
  - Revenue and commission data
  - Product performance
  - Real-time monitoring
- **Member Analytics**:
  - Recruitment trends
  - Retention analysis
  - Rank distribution
  - Network health scores
  - Activity patterns
- **Financial Analytics**:
  - Commission payout trends
  - Product sales analysis
  - Geographic distribution
  - Time-based trends
  - Performance metrics

### Reporting Features
- **Custom Reports**: Report builder with export capabilities
- **Scheduled Reports**: Automated report generation
- **Export Options**: CSV, PDF, Excel formats

---

## 🛡️ **13. Security & Compliance**

### Security Features
- **Authentication Security**:
  - JWT token-based authentication
  - bcrypt password hashing
  - Rate limiting (API and authentication endpoints)
  - Session management
  - Account lockout protection
- **API Security**:
  - CORS configuration
  - Input validation and sanitization
  - SQL injection prevention (Prisma ORM)
  - XSS prevention
  - Helmet security headers
- **Data Protection**:
  - Encryption at rest
  - Audit logging
  - Data validation
  - Multi-tenant data isolation

### Audit & Compliance
- **Audit Logging**:
  - Complete user action logging
  - Entity change tracking (before/after values)
  - IP address and user agent logging
  - Timestamp tracking
  - Action and entity type tracking
- **Compliance Documents**:
  - Terms and conditions
  - Privacy policy
  - Compensation plan documents
  - Custom policy documents
  - Version control for documents
  - Effective date tracking
- **Member Agreements**:
  - Document signing tracking
  - Signature timestamps
  - IP and user agent logging
  - Agreement history

### Data Subject Rights (DSAR)
- **GDPR Compliance**:
  - Access requests
  - Rectification requests
  - Erasure requests (right to be forgotten)
  - Restriction requests
  - Data portability
  - Objection handling
- **Request Management**:
  - Request submission and tracking
  - Status workflow (pending/processing/completed/rejected)
  - Response data storage
  - Completion tracking
  - Notes and documentation

---

## 🚨 **14. Alerting & Monitoring System**

### Alert Management
- **Alert Types**:
  - Rule-based alerts
  - System alerts
  - Security alerts
  - Performance alerts
- **Alert Features**:
  - Severity levels (low/medium/high/critical)
  - Status tracking (active/acknowledged/resolved)
  - Alert data and metadata
  - Resolution tracking
  - Resolver assignment

---

## 🌐 **15. Internationalization (i18n)**

### Multi-Language Support
- **Supported Languages**:
  - English (en)
  - German (de)
  - French (fr)
  - Khmer/Cambodian (km)
  - Vietnamese (vi)
  - Filipino/Tagalog (fil)
- **Translation Features**:
  - 100% key coverage across all languages
  - Custom translation system
  - Language selector component
  - Per-user language preferences

---

## 🔧 **16. OTP Service (Self-Hosted)**

### Simple OTP System
- **OTP Generation**:
  - Email OTP
  - SMS OTP (internal GSM modem support)
  - Configurable code length (default 6 digits)
  - Configurable expiry time (default 10 minutes)
  - Maximum attempts tracking (default 3)
- **OTP Delivery**:
  - SMTP email delivery
  - Internal SMS gateway
  - External provider support (Twilio, AWS SNS, Nexmo)
  - Delivery logging and tracking
  - Cost tracking
- **OTP Settings per Company**:
  - Email/SMS enable/disable
  - Rate limiting per hour/day
  - Custom email templates
  - Custom SMS templates
  - SMTP configuration
  - SMS provider configuration
  - Security requirements (login, transactions)

---

## 📦 **17. Backup & Recovery**

### Backup System
- **Automated Backups**:
  - Daily database backups
  - Cloud storage integration
  - Backup verification
  - Recovery testing
- **Manual Backups**:
  - On-demand backup creation
  - Rule backup and restore
  - Point-in-time recovery
  - Backup description and metadata

---

## 📱 **18. Referral Link System**

### Referral Management
- **Referral Links**:
  - Unique referral codes per sponsor
  - Click tracking
  - Conversion tracking
  - Active/inactive status
  - Expiration dates
  - Custom metadata
- **Referral Relationships**:
  - Sponsor-member tracking
  - Relationship status
  - Referral link attribution
  - Company-level tracking

---

## 🔬 **19. Additional Advanced Features**

### Financial Controls
- **Transaction Controls**:
  - Hold requests
  - Release requests
  - Adjustment processing
  - Freeze capabilities
  - Approval workflows
  - Status tracking

### Email Verification
- **Email Verification System**:
  - Token-based verification
  - Expiration handling
  - Verification status tracking
  - Company-specific verification

### Password Reset
- **Password Reset Tokens**:
  - Secure token generation
  - Expiration handling
  - One-time use enforcement
  - IP and user agent logging
  - Used status tracking

### Inventory Transactions
- **Transaction Tracking**:
  - Purchase, sale, transfer, adjustment, return tracking
  - Quantity change logging
  - Previous and new quantity tracking
  - Reference linking (order ID, transfer ID)
  - Reason tracking

---

## 🚀 **20. Technical Features**

### Architecture
- **Tech Stack**:
  - Next.js 15 with App Router
  - TypeScript for type safety
  - Prisma ORM with PostgreSQL
  - Tailwind CSS for styling
  - Radix UI components
  - React 18
- **Performance**:
  - Server-side rendering (SSR)
  - Lazy loading components
  - Database connection pooling
  - Efficient query optimization
  - Caching strategies
  - Mobile-responsive design
- **Code Quality**:
  - TypeScript strict mode
  - ESLint configuration
  - Playwright E2E testing
  - Component-based architecture
  - Service layer abstraction

### API Features
- **RESTful API**:
  - JWT authentication
  - Rate limiting
  - Error handling
  - Request/response logging
  - API documentation
  - Webhook support
- **Health Monitoring**:
  - System health endpoint
  - Service status tracking
  - Performance metrics
  - Uptime monitoring

---

## 📋 **Summary Statistics**

### Database Models: 40+
- Company, User, Product, Order, OrderItem
- Commission, StockItem, ReferralLink, ReferralRelationship
- StockRequest, StockRequestItem, EcashTopupRequest
- Notification, NotificationPreference, MemberProgress
- GenealogyMovement, CommissionDispute, EmailVerification
- PasswordResetToken, FinancialControl, ComplianceDocument
- MemberAgreement, InventoryTransaction, AuditLog
- OtpCode, OtpDeliveryLog, OtpSettings
- Wallet, WalletTransaction, WalletTransfer
- Role, Permission, RolePermission, UserRole
- Alert, DSARRequest
- BusinessRule, RuleTemplate, RuleSet, RuleSetBusinessRule
- RuleExecutionLog, RuleValidationLog, CustomFunction
- RuleExecutionSummary, CompanyRuleConfig, DynamicRuleSet
- RuleVersion, RuleBackup

### Feature Categories: 20+
1. Multi-Tenancy & Company Management
2. User Management & Authentication
3. Genealogy & Binary Tree System
4. Commission & Compensation System
5. Rank & Advancement System
6. E-Commerce & Product Management
7. E-Cash Wallet System
8. Business Rules Engine
9. Role-Based Access Control (RBAC)
10. Notification System
11. Member Onboarding & Progress Tracking
12. Analytics & Reporting
13. Security & Compliance
14. Alerting & Monitoring System
15. Internationalization (i18n)
16. OTP Service (Self-Hosted)
17. Backup & Recovery
18. Referral Link System
19. Financial Controls & Management
20. Technical Infrastructure

---

## 🎯 **Key Differentiators**

1. **Complete Multi-Tenant Architecture**: Host unlimited MLM companies
2. **Dynamic Business Rules Engine**: No-code compensation plan changes
3. **Self-Hosted OTP System**: Eliminate third-party authentication costs
4. **Advanced RBAC**: Granular permission control
5. **Comprehensive Audit Trail**: Full compliance and regulatory support
6. **Real-Time Analytics**: Business intelligence dashboard
7. **Binary Tree Genealogy**: Interactive visualization and management
8. **E-Cash Wallet System**: Internal currency with peer-to-peer transfers
9. **Mobile-First Design**: Fully responsive across all devices
10. **Multi-Language Support**: 6 languages with 100% coverage

---

## 📝 **Conclusion**

DakDam is a production-ready, enterprise-grade MLM platform that provides everything needed to run a successful network marketing business. With 40+ database models, 20+ feature categories, and comprehensive security and compliance features, it stands as one of the most complete MLM solutions available.

The platform's modular architecture, combined with its powerful business rules engine and multi-tenant support, makes it suitable for:
- Small MLM startups
- Mid-sized network marketing companies
- Large multi-national MLM enterprises
- Multi-company MLM platforms
- White-label MLM solutions

**Technology**: Modern, maintainable, and scalable
**Security**: Enterprise-grade with complete audit trails
**Flexibility**: Highly configurable without code changes
**Compliance**: GDPR-ready with DSAR support
**Performance**: Optimized for high-volume operations

---

**Last Updated**: November 2024
**Platform Version**: 1.3.0
**Database**: PostgreSQL with Prisma ORM
**Framework**: Next.js 15 with TypeScript
