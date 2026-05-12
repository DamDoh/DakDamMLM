# ✅ CRITICAL FIXES IMPLEMENTATION CHECKLIST

**Project:** MLM Binary System (Next.js 15 + Prisma)  
**Date:** May 11, 2025  
**Status:** NOT PRODUCTION READY  
**Estimated Duration:** 3-4 weeks (130-145 hours)

---

## 🔴 PHASE 1: CRITICAL ISSUES (Week 1) - ~35 hours

**DO NOT SKIP - System will lose money without these fixes**

### CRITICAL #1: Wallet Race Condition
- [ ] **Issue:** `/api/wallet/transfer-pv` allows double-spending
- [ ] **File:** `src/app/api/wallet/transfer-pv/route.ts:27-82`
- [ ] **Severity:** FINANCIAL LOSS ($2K+ per attack)
- [ ] **Fix:**
  - [ ] Wrap in database transaction with Serializable isolation
  - [ ] Add row-level lock on wallet
  - [ ] Write unit test for concurrent transfers
  - [ ] Load test with 100+ concurrent requests
- [ ] **Test:** Try sending 2 simultaneous $1000 transfers with $1000 balance
- [ ] **Estimated Time:** 2 hours
- [ ] **Files to Modify:** 1
- [ ] **Status:** ⏳ TODO

---

### CRITICAL #2: Order Race Condition
- [ ] **Issue:** `/api/orders` creates order without transactional consistency
- [ ] **File:** `src/app/api/orders/route.ts:104-149`
- [ ] **Severity:** DATA CORRUPTION (inventory negative, PV not updated)
- [ ] **Fix:**
  - [ ] Wrap order creation, inventory update, PV update in single transaction
  - [ ] Add inventory reservation system
  - [ ] Add order idempotency check
  - [ ] Write integration test for concurrent orders
- [ ] **Test:** Try creating 10 orders simultaneously with 5 items in stock
- [ ] **Estimated Time:** 2 hours
- [ ] **Files to Modify:** 1-2 (order service + route)
- [ ] **Status:** ⏳ TODO

---

### CRITICAL #3: Wrong Genealogy Field
- [ ] **Issue:** Commission calculations use `sponsorId` instead of `placementParentId`
- [ ] **Files:**
  - [ ] `src/services/commission-calculation-engine.ts:249`
  - [ ] `api-gateway/src/services/rank-maintenance-service.ts`
  - [ ] Any other commission service files
- [ ] **Severity:** FINANCIAL OVERPAYMENT (30-50% per member, $10K-$50K/month loss)
- [ ] **Fix:**
  - [ ] Search codebase for all `sponsorId` queries in commission context
  - [ ] Replace with `placementParentId` for binary tree operations
  - [ ] Add comment explaining difference: sponsorId = who referred, placementParentId = binary position
  - [ ] Write test verifying correct genealogy field used
  - [ ] Create migration to correct any historical commission records
- [ ] **Test:** Verify commission calculation uses correct tree position
- [ ] **Estimated Time:** 4 hours
- [ ] **Files to Modify:** 5-8
- [ ] **Search Pattern:** `where.*sponsorId` in commission/bonus files
- [ ] **Status:** ⏳ TODO

---

### CRITICAL #4: Stock Request CRUD
- [ ] **Issue:** Only GET implemented, no POST/PATCH/DELETE
- [ ] **Endpoint:** `/api/stock-requests`
- [ ] **Severity:** FUNCTIONALITY BLOCKED (users can't create requests)
- [ ] **Fix:**
  - [ ] Implement POST `/api/stock-requests` to create request
  - [ ] Implement PATCH `/api/stock-requests/[id]` to update status
  - [ ] Implement DELETE `/api/stock-requests/[id]` to cancel request
  - [ ] Add proper validation and authorization
  - [ ] Add notification on status change
  - [ ] Write CRUD tests
- [ ] **Test:** Create → Approve → Complete full workflow
- [ ] **Estimated Time:** 3 hours
- [ ] **Files to Modify:** 1 (route.ts)
- [ ] **Database Models:** Verify StockRequest model has all needed fields
- [ ] **Status:** ⏳ TODO

---

### CRITICAL #5: E-cash Withdrawal CRUD
- [ ] **Issue:** Only GET implemented, no POST/PATCH
- [ ] **Endpoint:** `/api/ecash-withdrawal-requests`
- [ ] **Severity:** FUNCTIONALITY BLOCKED (users can't withdraw e-cash)
- [ ] **Fix:**
  - [ ] Implement POST to create withdrawal request
  - [ ] Implement PATCH to approve/reject request
  - [ ] Add withdrawal processing logic
  - [ ] Add fee calculation if applicable
  - [ ] Add bank transfer integration (or mock for now)
  - [ ] Write workflow tests
- [ ] **Test:** Create → Approve → Process full workflow
- [ ] **Estimated Time:** 3 hours
- [ ] **Files to Modify:** 1 (route.ts) + e-cash service
- [ ] **Database Models:** Verify EcashWithdrawalRequest has all needed fields
- [ ] **Status:** ⏳ TODO

---

### Verification Checkpoint #1
- [ ] All 5 critical issues fixed
- [ ] Each issue has passing unit tests
- [ ] Load tested with 100+ concurrent requests
- [ ] No compilation errors: `npm run type-check`
- [ ] No lint errors: `npm run lint`
- [ ] Database migrations applied
- [ ] Backup created before changes

---

## 🟠 PHASE 2: SECURITY FIXES (Week 1-2) - ~30 hours

**Critical for production but can be parallelized with Phase 1**

### SECURITY #1: Formula Evaluation Code Injection
- [ ] **Issue:** Uses `new Function()` to evaluate formulas
- [ ] **Files:**
  - [ ] `src/services/bonus/calculate-matching-bonus.ts`
  - [ ] `src/services/custom-functions/` (if exists)
  - [ ] Custom function service
- [ ] **Severity:** CODE INJECTION (arbitrary code execution)
- [ ] **Fix:**
  - [ ] Replace `Function()` with safe formula evaluator
  - [ ] Options: `mathjs`, `jexl`, `expression-evaluator`, or custom safe eval
  - [ ] Test with malicious formula payloads
  - [ ] Add formula validation on creation
  - [ ] Whitelist allowed functions
- [ ] **Test:** Try injecting `process.exit()` into formula (should fail)
- [ ] **Estimated Time:** 3 hours
- [ ] **Files to Modify:** 2-3
- [ ] **npm Packages:** Add `mathjs` or `jexl`
- [ ] **Status:** ⏳ TODO

---

### SECURITY #2: Email Verification
- [ ] **Issue:** Companies register without email verification
- [ ] **File:** `src/app/company-register/actions.ts:65-66`
- [ ] **Severity:** BUSINESS LOGIC (unverified accounts)
- [ ] **Fix:**
  - [ ] Create email verification service
  - [ ] Generate secure tokens (32 bytes random)
  - [ ] Set 24-hour expiry
  - [ ] Send verification email
  - [ ] Create verification endpoint
  - [ ] Mark company as verified only after email confirmed
  - [ ] Add rate limiting (3 attempts per hour)
  - [ ] Add tests
- [ ] **Test:** Register company → Check email → Click link → Verify
- [ ] **Estimated Time:** 4 hours
- [ ] **Files to Create:** Email verification service
- [ ] **Files to Modify:** Registration flow, schema (add EmailVerification model)
- [ ] **Status:** ⏳ TODO

---

### SECURITY #3: Password Reset with Secure Tokens
- [ ] **Issue:** Reset token verification missing, no email sending
- [ ] **File:** `src/app/api/auth/reset-password/route.ts:44`
- [ ] **Severity:** SECURITY GAP (anyone can reset anyone's password)
- [ ] **Fix:**
  - [ ] Create password reset service
  - [ ] Generate one-time tokens (48 bytes random)
  - [ ] Set 1-hour expiry
  - [ ] Send reset link via email
  - [ ] Create token verification endpoint
  - [ ] Only reset if token valid and not expired
  - [ ] Track failed attempts
  - [ ] Add tests
- [ ] **Test:** Request reset → Wait for email → Click link → Enter new password
- [ ] **Estimated Time:** 4 hours
- [ ] **Files to Create:** Password reset service
- [ ] **Files to Modify:** Auth route, schema (add PasswordResetToken model)
- [ ] **Status:** ⏳ TODO

---

### SECURITY #4: Account Lockout
- [ ] **Issue:** Fields exist but not implemented
- [ ] **Fields:** `failedLoginAttempts`, `lockedUntil`, `lastFailedLogin`
- [ ] **Severity:** SECURITY GAP (brute force attacks possible)
- [ ] **Fix:**
  - [ ] Increment `failedLoginAttempts` on wrong password
  - [ ] Lock account after 5 failed attempts
  - [ ] Lock for 30 minutes
  - [ ] Send lockout notification email
  - [ ] Allow admin unlock
  - [ ] Log all lockouts
  - [ ] Add tests
- [ ] **Test:** 5 wrong passwords → Account locked → Can't login
- [ ] **Estimated Time:** 2 hours
- [ ] **Files to Modify:** Auth service, login route
- [ ] **Status:** ⏳ TODO

---

### SECURITY #5: Input Validation
- [ ] **Issue:** Many endpoints accept invalid data
- [ ] **Files:** All API routes
- [ ] **Severity:** DATA QUALITY (garbage in, garbage out)
- [ ] **Fix:**
  - [ ] Add zod/joi schemas to all POST/PUT endpoints
  - [ ] Validate all input before processing
  - [ ] Return 400 with clear error on validation failure
  - [ ] Validate email format
  - [ ] Validate phone number format
  - [ ] Validate amounts are positive
  - [ ] Add tests for each validation
- [ ] **Test:** POST with invalid email → 400 error with clear message
- [ ] **Estimated Time:** 12 hours
- [ ] **Files to Modify:** 30+ API routes
- [ ] **npm Package:** `zod` (already in package.json)
- [ ] **Status:** ⏳ TODO

---

### SECURITY #6: MFA Implementation
- [ ] **Issue:** Setup exists but not integrated
- [ ] **Files:** `src/app/api/auth/mfa/`
- [ ] **Severity:** SECURITY FEATURE (optional but important)
- [ ] **Fix:**
  - [ ] Implement TOTP generation
  - [ ] QR code for authenticator apps
  - [ ] Store secret securely (encrypted)
  - [ ] Verify TOTP on login
  - [ ] Backup codes for account recovery
  - [ ] Add tests
- [ ] **Test:** Enable MFA → Scan QR → Verify with authenticator app → Login
- [ ] **Estimated Time:** 6 hours
- [ ] **Files to Modify:** Auth service, MFA routes
- [ ] **npm Package:** `speakeasy` for TOTP
- [ ] **Status:** ⏳ TODO

---

### Verification Checkpoint #2
- [ ] All security fixes implemented
- [ ] Each has passing security tests
- [ ] No input validation bypasses
- [ ] Penetration test checklist passed
- [ ] OWASP Top 10 review complete

---

## 🟡 PHASE 3: BUSINESS LOGIC (Week 2-3) - ~40 hours

**Depends on Phase 1-2 being complete**

### BUSINESS #1: Commission Calculation Verification
- [ ] **Issue:** Ensure genealogy field fix is complete and correct
- [ ] **Test:**
  - [ ] Binary commission correctly uses binary tree
  - [ ] Stockist bonus applies correct multipliers
  - [ ] Matching bonus goes exactly 5 levels deep
  - [ ] Daily match includes only today's orders
  - [ ] Commission caps enforced
  - [ ] Member not overpaid
- [ ] **Test Data:** Create sample genealogy with 20 members, verify all commission calculations
- [ ] **Estimated Time:** 6 hours
- [ ] **Status:** ⏳ TODO

---

### BUSINESS #2: Inventory Atomic Operations
- [ ] **Issue:** Stock transfers not atomic, can oversell
- [ ] **File:** `src/app/api/inventory/route.ts`
- [ ] **Severity:** OPERATIONAL (overselling, negative inventory)
- [ ] **Fix:**
  - [ ] Add reservation system
  - [ ] Make transfers atomic transactions
  - [ ] Prevent negative inventory
  - [ ] Track all transfers in InventoryTransaction
  - [ ] Add low stock alerts
  - [ ] Test concurrent transfers
- [ ] **Test:** 10 concurrent transfers totaling 15 items with 10 in stock (should fail)
- [ ] **Estimated Time:** 5 hours
- [ ] **Files to Modify:** Inventory service, route
- [ ] **Status:** ⏳ TODO

---

### BUSINESS #3: Commission Dispute System
- [ ] **Issue:** Model exists but no APIs
- [ ] **Model:** CommissionDispute exists in schema
- [ ] **Severity:** OPERATIONAL (no conflict resolution)
- [ ] **Fix:**
  - [ ] Create POST `/api/commissions/[id]/dispute` to create dispute
  - [ ] Create GET `/api/disputes` to list user's disputes
  - [ ] Create GET `/api/disputes/[id]` to view dispute details
  - [ ] Create PATCH `/api/disputes/[id]` for admin to resolve
  - [ ] Create admin dashboard for dispute resolution
  - [ ] Add email notifications
  - [ ] Add tests
- [ ] **Test:** Member disputes commission → Admin reviews → Admin adjusts or rejects
- [ ] **Estimated Time:** 6 hours
- [ ] **Files to Create:** Dispute routes, dispute service
- [ ] **Status:** ⏳ TODO

---

### BUSINESS #4: PV Expiration Enforcement
- [ ] **Issue:** `pvDate` tracked but expiration not checked
- [ ] **Severity:** FINANCIAL (PV should expire but doesn't)
- [ ] **Fix:**
  - [ ] Add check in commission calculation: if pvDate + pvExpiryDays < today, exclude
  - [ ] Create scheduled job to purge expired PV
  - [ ] Send notification before PV expires (7 days warning)
  - [ ] Log all expired PV
  - [ ] Add tests
- [ ] **Test:** Create PV with 1-day expiry → Wait 2 days → Verify not counted
- [ ] **Estimated Time:** 3 hours
- [ ] **Files to Modify:** Commission calculation, create purge job
- [ ] **Status:** ⏳ TODO

---

### BUSINESS #5: Rank Downgrade Logic
- [ ] **Issue:** Members keep high ranks even if PV drops
- [ ] **Severity:** OPERATIONAL (rank integrity)
- [ ] **Fix:**
  - [ ] Create scheduled job (daily) to check rank requirements
  - [ ] If member's PV < rank requirement, downgrade
  - [ ] Notify member of downgrade
  - [ ] Log rank changes
  - [ ] Add tests
- [ ] **Test:** Promote member to rank → Reduce PV below requirement → Job runs → Rank downgraded
- [ ] **Estimated Time:** 4 hours
- [ ] **Files to Create:** Rank validation job
- [ ] **Status:** ⏳ TODO

---

### BUSINESS #6: Daily Match Idempotency
- [ ] **Issue:** Could run multiple times per day
- [ ] **Endpoint:** POST `/api/bonus/daily-match`
- [ ] **Severity:** FINANCIAL (double payment)
- [ ] **Fix:**
  - [ ] Check if bonus already calculated for today
  - [ ] Use unique key for today's date
  - [ ] Add execution history
  - [ ] Make job safe to run multiple times
  - [ ] Add tests
- [ ] **Test:** Run daily match twice on same day → Second run should skip
- [ ] **Estimated Time:** 2 hours
- [ ] **Files to Modify:** Daily match service
- [ ] **Status:** ⏳ TODO

---

### BUSINESS #7: Commission Caps Enforcement
- [ ] **Issue:** Caps configured but not enforced
- [ ] **Model:** CommissionCapConfig exists
- [ ] **Severity:** FINANCIAL (members paid more than cap)
- [ ] **Fix:**
  - [ ] Check cap before paying commission
  - [ ] Track cumulative commission for period
  - [ ] Carry over excess to next period
  - [ ] Notify member when approaching cap
  - [ ] Add reports for cap tracking
  - [ ] Add tests
- [ ] **Test:** Set cap to $1000 → Generate $1500 commission → Pay $1000 + carry $500
- [ ] **Estimated Time:** 4 hours
- [ ] **Files to Modify:** Commission calculation service
- [ ] **Status:** ⏳ TODO

---

### Verification Checkpoint #3
- [ ] All business logic tests passing
- [ ] Commission calculations match expected values
- [ ] No members overpaid
- [ ] Inventory consistent
- [ ] No negative values possible
- [ ] All cap enforcement working

---

## 🔵 PHASE 4: CODE QUALITY (Week 3-4) - ~40 hours

**Improves performance and maintainability**

### QUALITY #1: Consolidate Duplicate Services
- [ ] **Issue:** Commission service exists in 2 locations
- [ ] **Files:**
  - [ ] `src/services/commission-service.ts` (1010 lines)
  - [ ] `services/commission-service/index.ts` (735 lines)
- [ ] **Severity:** CODE MAINTENANCE (confusing, duplication)
- [ ] **Fix:**
  - [ ] Analyze both implementations
  - [ ] Determine which is more recent/correct
  - [ ] Merge best parts into single file
  - [ ] Update all imports
  - [ ] Remove duplicate file
  - [ ] Run tests
- [ ] **Estimated Time:** 8 hours
- [ ] **Status:** ⏳ TODO

---

### QUALITY #2: Fix N+1 Query Problem
- [ ] **Issue:** Loading users then fetching related data individually
- [ ] **Files:** `genealogy-service.ts`, `commission-service.ts`, etc.
- [ ] **Severity:** PERFORMANCE (100x slower than needed)
- [ ] **Fix:**
  - [ ] Use Prisma `include` for related data
  - [ ] Use `select` to fetch specific fields
  - [ ] Add batch queries where needed
  - [ ] Profile queries with timings
  - [ ] Add tests for performance
- [ ] **Test:** Load 1000 members with their ranks → should be <1 second
- [ ] **Estimated Time:** 8 hours
- [ ] **Files to Modify:** 5-10 service files
- [ ] **Status:** ⏳ TODO

---

### QUALITY #3: Database Indexes
- [ ] **Issue:** Critical queries missing indexes
- [ ] **Severity:** PERFORMANCE (1000x slower under load)
- [ ] **Fix:**
  - [ ] Add index on `users.placementParentId`
  - [ ] Add index on `users.sponsorId`
  - [ ] Add index on `commission.memberId + commissionType`
  - [ ] Add index on `order.userId + status + date`
  - [ ] Add index on `wallet.userId`
  - [ ] Add composite indexes for common filters
  - [ ] Test index effectiveness
- [ ] **Estimated Time:** 3 hours
- [ ] **Files to Modify:** `prisma/schema.prisma`
- [ ] **Migration:** Run `prisma migrate dev`
- [ ] **Status:** ⏳ TODO

---

### QUALITY #4: Rate Limiting
- [ ] **Issue:** Not applied to commission endpoints
- [ ] **Severity:** OPERATIONAL (DOS attacks)
- [ ] **Fix:**
  - [ ] Add rate limiter middleware to all commission endpoints
  - [ ] Add rate limiter to auth endpoints
  - [ ] Add rate limiter to financial endpoints
  - [ ] Configure different limits for different endpoints
  - [ ] Add rate limit headers to responses
  - [ ] Add tests
- [ ] **Estimated Time:** 4 hours
- [ ] **Files to Modify:** Multiple route files, middleware
- [ ] **Status:** ⏳ TODO

---

### QUALITY #5: Pagination Limits
- [ ] **Issue:** No max limit on list endpoints
- [ ] **Severity:** PERFORMANCE/DOS (can return millions of records)
- [ ] **Fix:**
  - [ ] Add max limit check (1000 records)
  - [ ] Apply to all GET list endpoints
  - [ ] Use cursor-based pagination
  - [ ] Add offset validation
  - [ ] Add tests
- [ ] **Estimated Time:** 6 hours
- [ ] **Files to Modify:** 20+ list endpoints
- [ ] **Status:** ⏳ TODO

---

### QUALITY #6: Error Message Security
- [ ] **Issue:** Error messages leak system information
- [ ] **Severity:** SECURITY (info disclosure)
- [ ] **Fix:**
  - [ ] Use generic error messages for clients
  - [ ] Log detailed errors internally
  - [ ] No database errors in responses
  - [ ] No stack traces in production
  - [ ] Add tests for error responses
- [ ] **Estimated Time:** 4 hours
- [ ] **Files to Modify:** Error handling middleware, routes
- [ ] **Status:** ⏳ TODO

---

### QUALITY #7: Caching Strategy
- [ ] **Issue:** Cache invalidation incomplete
- [ ] **Severity:** DATA QUALITY (stale data)
- [ ] **Fix:**
  - [ ] Implement cache invalidation on updates
  - [ ] Add cache TTL strategy
  - [ ] Use Redis for distributed caching
  - [ ] Monitor cache hit rates
  - [ ] Add tests
- [ ] **Estimated Time:** 6 hours
- [ ] **Files to Modify:** Cache service, update handlers
- [ ] **Status:** ⏳ TODO

---

### QUALITY #8: Code Comments & Documentation
- [ ] **Issue:** Complex logic without explanation
- [ ] **Severity:** MAINTAINABILITY
- [ ] **Fix:**
  - [ ] Add JSDoc comments to all services
  - [ ] Explain complex calculations
  - [ ] Document business rule implementations
  - [ ] Add architecture diagrams to README
- [ ] **Estimated Time:** 8 hours
- [ ] **Status:** ⏳ TODO

---

### Verification Checkpoint #4
- [ ] All code quality improvements complete
- [ ] Performance tests pass (queries <1 second)
- [ ] No N+1 queries detected
- [ ] Error handling is secure
- [ ] Caching working effectively
- [ ] Code is well-documented

---

## ✅ FINAL VERIFICATION STEPS

### Pre-Launch Checklist
- [ ] All phases complete
- [ ] 95%+ test coverage on business logic
- [ ] Zero critical issues remaining
- [ ] Load test: 10,000 concurrent users
- [ ] Stress test: 1M commissions/day
- [ ] Security audit passed
- [ ] OWASP Top 10 assessment passed
- [ ] Database backup created
- [ ] Rollback plan documented
- [ ] On-call team ready
- [ ] Monitoring alerts configured

### Deployment Checklist
- [ ] Database migrations tested in staging
- [ ] All environment variables documented
- [ ] Secrets rotated
- [ ] SSL certificates valid
- [ ] CDN cache cleared
- [ ] Monitoring dashboard active
- [ ] Error tracking enabled
- [ ] Backup automation verified
- [ ] Team trained on troubleshooting
- [ ] Runbook documented

---

## 📊 PROGRESS TRACKING

### Phase 1 Status: ⏳ NOT STARTED
```
CRITICAL #1 (Wallet Race):           [ ] 0%
CRITICAL #2 (Order Transaction):     [ ] 0%
CRITICAL #3 (Genealogy Field):       [ ] 0%
CRITICAL #4 (Stock Requests):        [ ] 0%
CRITICAL #5 (E-cash Withdrawal):     [ ] 0%
Verification Checkpoint:             [ ] 0%
────────────────────────────
TOTAL PHASE 1:                       0/5 (0%)
```

### Phase 2 Status: ⏳ NOT STARTED
```
Security #1-6:                       0/6 (0%)
```

### Phase 3 Status: ⏳ NOT STARTED
```
Business #1-7:                       0/7 (0%)
```

### Phase 4 Status: ⏳ NOT STARTED
```
Quality #1-8:                        0/8 (0%)
```

### Overall Progress: 0/26 Issues (0%)

---

## 📅 TIMELINE ESTIMATE

| Phase | Duration | Status | Start | End |
|-------|----------|--------|-------|-----|
| Phase 1: Critical | 35 hrs | 🔴 TODO | Day 1 | Day 5 |
| Phase 2: Security | 30 hrs | 🔴 TODO | Day 3 | Day 7 |
| Phase 3: Business | 40 hrs | 🔴 TODO | Day 6 | Day 11 |
| Phase 4: Quality | 40 hrs | 🔴 TODO | Day 10 | Day 15 |
| Testing & Buffer | 20 hrs | 🔴 TODO | Day 13 | Day 16 |
| **TOTAL** | **165 hrs** | 🔴 | | **~4 weeks** |

**With 1 developer:** 4-5 weeks  
**With 2 developers:** 2-3 weeks (parallel Phase 1+2)  
**With 3 developers:** 1-2 weeks (all phases parallel)

---

**Generated:** May 11, 2025  
**Review & Update Frequency:** Daily (end of day)  
**Success Criteria:** All checkboxes checked ✅

