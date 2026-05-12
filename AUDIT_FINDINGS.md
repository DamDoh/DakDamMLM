# DakDam MLM Platform Security & Architecture Audit Findings

## Domain 5: Database & Schema

### Issue 1: Use of Float for Financial Amounts
- **SEVERITY**: Critical
- **ISSUE**: Financial amounts throughout the schema use Float data type instead of Decimal, leading to rounding errors and financial inaccuracies.
- **LOCATION**: 
  - Prisma schema shows numerous Float fields for financial data:
    - Commission.amount (line 591)
    - Wallet.balance (line 1072)
    - WalletTransaction.amount (line 1095)
    - PaymentTransaction.amount (line 1169)
    - ECashTransaction.amountUsd (line 1154)
    - And many others throughout the schema
  - These should be Decimal to prevent floating-point precision errors
- **FIX**: 
  - Change all financial amount fields from Float to Decimal in Prisma schema
  - Specify appropriate precision and scale (e.g., Decimal(15, 2) for currency)
  - Update corresponding Prisma client queries and TypeScript interfaces
  - Ensure mathematical operations use Decimal-aware libraries
  - Migration strategy needed for existing data
- **RISK IF UNFIXED**:
  - Rounding errors in financial calculations
  - Inconsistent account balances
  - Regulatory compliance issues for financial reporting
  - Loss of trust due to financial discrepancies
  - Difficult to reconcile accounts to the penny

### Issue 2: Missing Unique Constraints Preventing Duplicate Commissions
- **SEVERITY**: High
- **ISSUE**: The Commission model lacks unique constraints that could prevent duplicate commission payments for the same order/user/type combination.
- **LOCATION**: 
  - Commission model (lines 584-616) shows no unique constraints
  - Possible to insert multiple commission records for same user/order/type
  - While there's an idempotencyKey on Order model (line 526), commissions lack similar protection
- **FIX**: 
  - Add unique constraint: @@unique([orderId, userId, type]) or similar
  - Consider business logic: what makes a commission truly unique?
  - May need composite unique constraint including level or other distinguishing factors
  - Implement application-level checks before creating commissions
- **RISK IF UNFIXED**:
  - Duplicate commission payouts
  - Financial losses from overpayment
  - Difficulty in detecting and correcting duplicate payments
  - Audit complications

### Issue 3: Missing Soft Delete Patterns on Financial Records
- **SEVERITY**: High
- **ISSUE**: Financial records (commissions, transactions, etc.) use hard deletes instead of soft deletes, making audit trails and recovery difficult.
- **LOCATION**: 
  - Commission model has no deleted flag (unlike User model which has deleted/deletedDate)
  - WalletTransaction, PaymentTransaction, etc. lack soft delete fields
  - FinancialControl and other financial models use hard deletes
- **FIX**: 
  - Add soft delete pattern to financial models:
    - deleted: Boolean @default(false)
    - deletedAt: DateTime?
    - deletedBy: String?
  - Modify queries to exclude deleted records by default
  - Implement archival strategy for old financial records
  - Ensure referential integrity handles soft deletes properly
- **RISK IF UNFIXED**:
  - Inability to recover accidentally deleted financial records
  - Gaps in audit trail for financial transactions
  - Regulatory compliance issues (financial records must be retained)
  - No point-in-time recovery capability

### Issue 4: Missing Indexes on High-Read Columns
- **SEVERITY**: Medium
- **ISSUE**: While some indexes exist, critical query patterns for financial and genealogy operations are missing indexes on frequently queried columns.
- **LOCATION**: 
  - Missing indexes on:
    - Commission.status (queried frequently for pending/paid commissions)
    - WalletTransaction.type (for filtering transaction types)
    - Genealogy-related queries on sponsorship and placement
    - Order.status and Order.date for reporting queries
  - Existing indexes may not cover composite query patterns
- **FIX**: 
  - Add indexes based on query patterns:
    - Commission: @@index([status, userId]), @@index([companyId, status])
    - WalletTransaction: @@index([walletId, type, createdAt])
    - Order: @@index([status, date]), @@index([userId, status])
    - User: Already has good indexes, verify usage
  - Use database query monitoring to identify missing indexes
  - Consider covering indexes for frequent query patterns
- **RISK IF UNFIXED**:
  - Slow query performance as data volume grows
  - Full table scans on filtered queries
  - Poor response times for reporting and dashboard functions
  - Increased database load and resource consumption

### Issue 5: Lack of Financial Record Immutability
- **SEVERITY**: Medium
- **ISSUE**: While there's an AuditLog model, financial records themselves can be updated/deleted, violating immutability principles for financial systems.
- **LOCATION**: 
  - Financial models (Commission, WalletTransaction, etc.) allow updates and deletes
  - No immutable append-only design for financial transactions
  - AuditLog exists but doesn't prevent modification of source records
- **FIX**: 
  - Implement append-only design for financial transactions:
    - Prevent updates to financial amounts after creation
    - Use reversal transactions instead of modifying existing records
    - Make financial records effectively immutable
    - Update related models to use reversal patterns
  - Enhance AuditLog to capture before/after states for financial changes
  - Implement database permissions or application logic to prevent financial record modifications
- **RISK IF UNFIXED**:
  - Ability to alter financial history
  - Regulatory compliance issues (financial records should be immutable)
  - Difficulty in forensic accounting
  - Potential for fraud through record modification

### Issue 6: Missing Constraints for Business Rule Validation
- **SEVERITY**: Medium
- **ISSUE**: While DynamicRuleSet and BusinessRule models exist, the database lacks constraints to ensure rule validity and consistency.
- **LOCATION**: 
  - BusinessRule model (lines 130-154) has JSON fields for conditions and calculation with no validation
  - DynamicRuleSet model (lines 316-342) stores rules as JSON without schema validation
  - No database-level checks for rule correctness
- **FIX**: 
  - Implement JSON schema validation for rule fields using database features (if supported) or application validation
  - Add constraints to ensure:
    - Rule conditions are valid JSON schemas
    - Calculation formulas are syntactically correct
    - Percentage values are within valid ranges (0-100 or 0-1)
    - Referential integrity for rule references
  - Consider using database triggers or application-level validation
- **RISK IF UNFIXED**:
  - Invalid business rules causing calculation errors
  - Inability to guarantee rule correctness
  - Potential for exploitation through malformed rules
  - Difficulty in maintaining rule integrity

## Priority Matrix for Database & Schema Issues

| Priority | Issue | Severity | Blast Radius | Score (Severity × Blast Radius) |
|----------|-------|----------|--------------|----------------------------------|
| 1 | Use of Float for Financial Amounts | Critical | Financial integrity | 9 |
| 2 | Missing Unique Constraints Preventing Duplicate Commissions | High | Financial accuracy | 8 |
| 3 | Missing Soft Delete Patterns on Financial Records | High | Recoverability/audit | 8 |
| 4 | Missing Indexes on High-Read Columns | Medium | Query performance | 6 |
| 5 | Lack of Financial Record Immutability | Medium | Financial integrity | 6 |
| 6 | Missing Constraints for Business Rule Validation | Medium | Rule integrity | 4 |
