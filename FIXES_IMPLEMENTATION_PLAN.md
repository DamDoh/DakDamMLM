# 🔧 FIXES IMPLEMENTATION PLAN

**Created:** 2025-10-19  
**Based on:** COMPREHENSIVE_APP_AUDIT_REPORT.md  
**Status:** In Progress

---

## IMPLEMENTATION SEQUENCE

### ✅ PHASE 1: QUICK WINS (Completed)

#### 1.1 Remove Backup Files ✅
- **Status:** COMPLETED
- **Files Removed:**
  - `src/app/change-password-redirect/page.tsx.bak`
  - `src/app/ecash/page.tsx.bak`
  - `src/app/profile/page.tsx.bak`
- **Impact:** Cleaned up repository

---

### 🔄 PHASE 2: CODE CONSOLIDATION (In Progress)

#### 2.1 Commission Service Consolidation
- **Status:** IN PROGRESS
- **Action Plan:**
  1. ✅ Verify which files import from `services/commission-service/`
  2. ⏳ Update `services/commission-service/index.ts` to re-export from `src/services/commission-service.ts`
  3. ⏳ Migrate event bus integration if needed
  4. ⏳ Test commission calculations still work
  5. ⏳ Document the consolidation

**Current Import in server-actions.ts (Line 34-41):**
```typescript
export {
  // Commission service functions
  calculateBinaryBonus,
  calculateStockistBonus,
  calculateMatchingBonus,
  addCommission,
  runCommissionCycle
} from './commission-service';
```
This imports from `src/services/commission-service.ts` ✅ CORRECT

---

### 🚨 PHASE 3: CRITICAL SECURITY FIXES (Next)

#### 3.1 Add Commission Dispute Model to Prisma Schema
- **Priority:** CRITICAL
- **Current Issue:** Using Notification table as workaround
- **File:** `prisma/schema.prisma`
- **Action:**
  ```prisma
  model CommissionDispute {
    id            String   @id @default(cuid())
    commissionId  String
    memberId      String
    amount        Float    @default(0)
    reason        String
    description   String?
    status        String   @default("pending") // pending, resolved, rejected
    createdAt     DateTime @default(now())
    resolvedAt    DateTime?
    resolvedBy    String?
    resolution    String?
    
    @@map("commission_disputes")
  }
  ```
- **Then Update:** `src/services/server-actions.ts` functions:
  - `createCommissionDispute()` (line 307)
  - `resolveCommissionDispute()` (line 336)
  - `getCommissionDisputes()` (line 354)

#### 3.2 Implement Inventory Management System
- **Priority:** CRITICAL
- **Files to Create:**
  - `src/services/inventory-service.ts`
- **Functions Needed:**
  - `updateStockLevels(productId, quantity, operation: 'add' | 'subtract')`
  - `getStockLevel(productId)`
  - `reserveStock(productId, quantity)`
  - `releaseStock(productId, quantity)`
  - `transferStock(fromUserId, toUserId, items[])`
- **Update Locations (9 places with TODOs):**
  - `approveStockRequest()` - line 264
  - `transferStock()` - line 297
  - `sellStockToDownline()` - line 549

#### 3.3 Email Verification System
- **Priority:** CRITICAL
- **Files to Create:**
  - `src/services/email-service.ts`
  - `src/lib/email-templates.ts`
- **Schema Update:**
  ```prisma
  model EmailVerification {
    id        String   @id @default(cuid())
    email     String
    token     String   @unique
    expiresAt DateTime
    verified  Boolean  @default(false)
    createdAt DateTime @default(now())
    
    @@map("email_verifications")
  }
  ```
- **Functions:**
  - `generateVerificationToken(email)`
  - `sendVerificationEmail(email, token)`
  - `verifyEmail(token)`
- **Update:** `src/app/company-register/actions.ts` line 65-66

#### 3.4 Password Reset Token System
- **Priority:** CRITICAL
- **Schema Update:**
  ```prisma
  model PasswordResetToken {
    id        String   @id @default(cuid())
    userId    String
    token     String   @unique
    expiresAt DateTime
    used      Boolean  @default(false)
    createdAt DateTime @default(now())
    
    @@map("password_reset_tokens")
  }
  ```
- **Update Files:**
  - Create `src/services/password-reset-service.ts`
  - Update auth API routes with proper token validation

#### 3.5 Account Lockout Mechanism
- **Priority:** HIGH
- **Schema Fields:** Already exist in User model ✅
  - `failedLoginAttempts`
  - `lockedUntil`
  - `lastFailedLogin`
- **Update:** `services/auth-service/index.ts` loginUser function
- **Logic:**
  ```typescript
  - Check if account is locked (lockedUntil > now)
  - Increment failedLoginAttempts on failed login
  - Lock account after 5 failed attempts for 30 minutes
  - Reset failedLoginAttempts on successful login
  ```

---

### 📋 PHASE 4: HIGH PRIORITY FUNCTIONALITY (After Critical)

#### 4.1 Financial Service Implementation
- **File:** Create `src/services/financial-service.ts`
- **Functions:**
  ```typescript
  export async function getPendingFinancialControls(): Promise<FinancialControl[]>
  export async function createFinancialControl(control: FinancialControl): Promise<void>
  export async function approveFinancialControl(id: string): Promise<void>
  export async function rejectFinancialControl(id: string): Promise<void>
  ```
- **Schema:**
  ```prisma
  model FinancialControl {
    id        String   @id @default(cuid())
    type      String   // hold, release, adjustment
    amount    Float
    memberId  String
    reason    String
    status    String   @default("pending")
    createdAt DateTime @default(now())
    approvedBy String?
    approvedAt DateTime?
    
    @@map("financial_controls")
  }
  ```

#### 4.2 Compliance Service Implementation
- **File:** Create `src/services/compliance-service.ts`
- **Functions:**
  ```typescript
  export async function getActiveComplianceDocuments(): Promise<ComplianceDoc[]>
  export async function getMemberAgreements(): Promise<Agreement[]>
  export async function createAgreement(memberId, type): Promise<void>
  export async function signAgreement(agreementId, signature): Promise<void>
  ```
- **Schema:**
  ```prisma
  model ComplianceDocument {
    id          String   @id @default(cuid())
    title       String
    type        String   // terms, privacy, compensation
    content     String
    version     String
    isActive    Boolean  @default(true)
    effectiveDate DateTime
    createdAt   DateTime @default(now())
    
    @@map("compliance_documents")
  }
  
  model MemberAgreement {
    id         String   @id @default(cuid())
    memberId   String
    documentId String
    signed     Boolean  @default(false)
    signedAt   DateTime?
    ipAddress  String?
    
    @@map("member_agreements")
  }
  ```

#### 4.3 Admin Notification System
- **Update Locations:** 8 places with "TODO: Send notification to admin"
- **Files:**
  - `approveStockRequest()` - already has notification service imported
  - `createCommissionDispute()` - line 329
  - `requestEcashTopUp()` - line 411
  - `requestStockTransfer()` - line 506
  - Add notification triggers using existing notification service

#### 4.4 Complete Commission Verification
- **File:** `src/services/server-actions.ts` line 379
- **Enhance:** `verifyCommissionCalculation()` function
- **Add Logic:**
  - Recalculate commission using business rules
  - Compare with stored amount
  - Check rank caps were applied correctly
  - Validate leg volumes if binary
  - Return detailed verification result

---

### 🔒 PHASE 5: SECURITY ENHANCEMENTS

#### 5.1 Replace Formula Evaluation with Math.js
- **File:** `src/services/rule-engine.ts` line 566
- **Action:**
  1. Install: `npm install mathjs`
  2. Replace Function() constructor with math.evaluate()
  3. Keep whitelist validation
  4. Add try-catch with safe fallback

#### 5.2 Input Validation Middleware
- **File:** Create `src/lib/validation-middleware.ts`
- **Implement:**
  - Zod schema validation wrapper
  - Sanitization functions
  - Rate limiting per endpoint
  - Request body size limits

---

### 📊 PHASE 6: TESTING & VALIDATION

#### 6.1 Test Each Fix
- Commission service consolidation
- Email verification flow
- Password reset flow
- Account lockout
- Inventory management
- Financial/Compliance services

#### 6.2 Update Documentation
- Update API documentation
- Add migration guides
- Document new services

---

## PROGRESS TRACKER

| Phase | Task | Status | Time Est. | Actual |
|-------|------|--------|-----------|---------|
| 1 | Remove backup files | ✅ Done | 5 min | 5 min |
| 2 | Commission consolidation | 🔄 In Progress | 2 hours | - |
| 3.1 | Commission dispute model | ⏳ Pending | 1 hour | - |
| 3.2 | Inventory management | ⏳ Pending | 4 hours | - |
| 3.3 | Email verification | ⏳ Pending | 3 hours | - |
| 3.4 | Password reset tokens | ⏳ Pending | 2 hours | - |
| 3.5 | Account lockout | ⏳ Pending | 1 hour | - |
| 4.1 | Financial service | ⏳ Pending | 3 hours | - |
| 4.2 | Compliance service | ⏳ Pending | 3 hours | - |
| 4.3 | Admin notifications | ⏳ Pending | 2 hours | - |
| 4.4 | Commission verification | ⏳ Pending | 2 hours | - |
| 5.1 | Math.js integration | ⏳ Pending | 1 hour | - |
| 5.2 | Validation middleware | ⏳ Pending | 2 hours | - |

**Total Estimated Time:** ~26 hours
**Completed:** 5 minutes
**Remaining:** ~25.9 hours

---

## NOTES

- All schema changes require running: `npx prisma migrate dev`
- Test each change in isolation before moving to next
- Update audit report as fixes are completed
- Document breaking changes in CHANGELOG.md

---

**Last Updated:** 2025-10-19 22:28 UTC