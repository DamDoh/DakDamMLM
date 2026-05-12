# Binary Stock Commission System - Implementation Guide

## Overview

This document describes the implementation of the MLM Binary Stock Commission System with differential commission rules and delayed payout logic. The system ensures that higher-level stockholders earn differential commission ONLY AFTER the lower-level stockholder completes a sale to a NEW registered user.

## System Architecture

### Commission Levels

| Level | Name | Base Commission |
|-------|------|----------------|
| **S** | Small Mobile | 0.8% |
| **M** | Mobile | 1.7% |
| **C** | Center | 2.6% |
| **D** | Dealer | 3.0% |

### Core Rules (CRITICAL - MUST ENFORCE)

1. **All Commissions Are Auto-Paid Immediately**
   - When a stockist transfers stock to a NEW registered user, commissions are created and paid immediately
   - No pending status - all commissions are paid as soon as the transfer occurs

2. **Differential Commission Calculation**
   - When a downline stockist sells to a NEW user, the upline stockist receives differential commission
   - Differential rate = Upline level rate - Downline level rate
   - Example: M (1.7%) has S (0.8%) as downline → M gets 0.9% differential when S sells

3. **Binary Stock Relationship Required**
   - Commissions are only created if there's a binary stock relationship (placementParentId)
   - The upline stockist must be in the binary tree hierarchy above the downline

4. **No Reverse Commission**
   - Lower-level stockists cannot earn commission when selling to higher-level stockists
   - Same-level stockists cannot earn commission from each other
   - Selling upward in hierarchy = 0% commission

5. **New User Validation**
   - Commissions are only created when selling to a NEW registered user
   - System validates that the buyer is truly a new user (first order/transfer)

## Implementation Details

### Database Schema Changes

The `Commission` model has been extended with the following fields:

```prisma
model Commission {
  // ... existing fields ...
  
  // Binary Stock Commission fields
  sellerId        String?  // ID of the stockist who sold/transferred stock
  buyerId         String?  // ID of the recipient (stockist or regular user)
  sellerLevel     String?  // Stockist level of seller (S, M, C, D)
  buyerLevel      String?  // Stockist level of buyer (S, M, C, D, or null)
  pvAmount        Float?   // PV value of the stock transfer
  commissionRate  Float?   // Commission rate percentage used
  triggerSaleId   String?  // Order/sale ID that triggered commission release
}
```

### Key Services

#### 1. Binary Stock Commission Service (`src/services/binary-stock-commission-service.ts`)

**Functions:**
- `calculateDifferentialCommissionRate()` - Calculates differential commission rate
- `createBinaryStockCommission()` - Creates commission with PENDING/PAID status
- `releasePendingCommissions()` - Releases pending commissions when lower-level sells to new user
- `isNewRegisteredUser()` - Validates if a user is new (first order)

**Commission Status Logic:**
- **PAID**: All commissions are paid immediately (auto-paid)
- **No PENDING status**: System changed to auto-pay all commissions

#### 2. Inventory Service (`src/services/inventory-service.ts`)

**Modified Function:**
- `transferStock()` - Now uses binary stock commission service
  - Calculates differential commission based on seller/buyer levels
  - Creates PAID commissions immediately when stockist sells to new user
  - Checks for upline stockist and creates differential commission automatically
  - All commissions are auto-paid (no pending status)

#### 3. Order Service (`src/app/api/orders/route.ts`)

**Note:**
- Commission release logic removed (all commissions are now auto-paid)
- Commissions are created directly during stock transfer

## Commission Flow Examples

### ⚠️ IMPORTANT RULE: Commissions are ONLY created when selling to NEW users
- **Stockist → Stockist transfers = NO COMMISSION** (inventory transfer only)
- **Stockist → New User = CREATE COMMISSIONS** (both base + differential)

---

### Example 1: M → S → New User (1000 PV)

**Scenario:** Adminstock M (ID: ADMIN010) has Adminstock S (ID: ADMIN009) as downline in binary stock.

**Step 1: Adminstock M transfers stock to Adminstock S**
- ❌ **NO COMMISSION** (stockist to stockist = inventory transfer only)
- Stock is stored in S's inventory for future sales

**Step 2: Adminstock S transfers 1000 PV to NEW registered user**
- ✅ **Adminstock S gets base commission:** 0.8% × 1000 PV = **$8.00** (PAID immediately)
- ✅ **Adminstock M gets differential commission:** 0.9% × 1000 PV = **$9.00** (PAID immediately)
- Differential rate: 1.7% (M) - 0.8% (S) = 0.9%

**Final Result:**
- Adminstock S: **$8.00** (base commission)
- Adminstock M: **$9.00** (differential commission)
- **Total Commissions:** $17.00

---

### Example 2: C → M → New User (1000 PV)

**Scenario:** Adminstock C has Adminstock M as downline in binary stock.

**Step 1: Adminstock C transfers stock to Adminstock M**
- ❌ **NO COMMISSION** (stockist to stockist = inventory transfer only)
- Stock is stored in M's inventory

**Step 2: Adminstock M transfers 1000 PV to NEW registered user**
- ✅ **Adminstock M gets base commission:** 1.7% × 1000 PV = **$17.00** (PAID immediately)
- ✅ **Adminstock C gets differential commission:** 0.9% × 1000 PV = **$9.00** (PAID immediately)
- Differential rate: 2.6% (C) - 1.7% (M) = 0.9%

**Final Result:**
- Adminstock M: **$17.00** (base commission)
- Adminstock C: **$9.00** (differential commission)
- **Total Commissions:** $26.00

---

### Example 3: C → S → New User (1000 PV)

**Scenario:** Adminstock C has Adminstock S as downline in binary stock.

**Step 1: Adminstock C transfers stock to Adminstock S**
- ❌ **NO COMMISSION** (stockist to stockist = inventory transfer only)
- Stock is stored in S's inventory

**Step 2: Adminstock S transfers 1000 PV to NEW registered user**
- ✅ **Adminstock S gets base commission:** 0.8% × 1000 PV = **$8.00** (PAID immediately)
- ✅ **Adminstock C gets differential commission:** 1.8% × 1000 PV = **$18.00** (PAID immediately)
- Differential rate: 2.6% (C) - 0.8% (S) = 1.8%

**Final Result:**
- Adminstock S: **$8.00** (base commission)
- Adminstock C: **$18.00** (differential commission)
- **Total Commissions:** $26.00

---

### Example 4: D → C → New User (1000 PV)

**Scenario:** Adminstock D has Adminstock C as downline in binary stock.

**Step 1: Adminstock D transfers stock to Adminstock C**
- ❌ **NO COMMISSION** (stockist to stockist = inventory transfer only)
- Stock is stored in C's inventory

**Step 2: Adminstock C transfers 1000 PV to NEW registered user**
- ✅ **Adminstock C gets base commission:** 2.6% × 1000 PV = **$26.00** (PAID immediately)
- ✅ **Adminstock D gets differential commission:** 0.4% × 1000 PV = **$4.00** (PAID immediately)
- Differential rate: 3.0% (D) - 2.6% (C) = 0.4%

**Final Result:**
- Adminstock C: **$26.00** (base commission)
- Adminstock D: **$4.00** (differential commission)
- **Total Commissions:** $30.00

---

### Example 5: D → M → New User (1000 PV)

**Scenario:** Adminstock D has Adminstock M as downline in binary stock.

**Step 1: Adminstock D transfers stock to Adminstock M**
- ❌ **NO COMMISSION** (stockist to stockist = inventory transfer only)
- Stock is stored in M's inventory

**Step 2: Adminstock M transfers 1000 PV to NEW registered user**
- ✅ **Adminstock M gets base commission:** 1.7% × 1000 PV = **$17.00** (PAID immediately)
- ✅ **Adminstock D gets differential commission:** 1.3% × 1000 PV = **$13.00** (PAID immediately)
- Differential rate: 3.0% (D) - 1.7% (M) = 1.3%

**Final Result:**
- Adminstock M: **$17.00** (base commission)
- Adminstock D: **$13.00** (differential commission)
- **Total Commissions:** $30.00

---

### Example 6: D → S → New User (1000 PV)

**Scenario:** Adminstock D has Adminstock S as downline in binary stock.

**Step 1: Adminstock D transfers stock to Adminstock S**
- ❌ **NO COMMISSION** (stockist to stockist = inventory transfer only)
- Stock is stored in S's inventory

**Step 2: Adminstock S transfers 1000 PV to NEW registered user**
- ✅ **Adminstock S gets base commission:** 0.8% × 1000 PV = **$8.00** (PAID immediately)
- ✅ **Adminstock D gets differential commission:** 2.2% × 1000 PV = **$22.00** (PAID immediately)
- Differential rate: 3.0% (D) - 0.8% (S) = 2.2%

**Final Result:**
- Adminstock S: **$8.00** (base commission)
- Adminstock D: **$22.00** (differential commission)
- **Total Commissions:** $30.00

---

### Example 7: Complex Chain - D → C → M → S → New User (1000 PV)

**Scenario:** Full chain with all levels in binary stock hierarchy.

**Step 1: Adminstock D transfers stock to Adminstock C**
- ❌ **NO COMMISSION** (stockist to stockist = inventory transfer)

**Step 2: Adminstock C transfers stock to Adminstock M**
- ❌ **NO COMMISSION** (stockist to stockist = inventory transfer)

**Step 3: Adminstock M transfers stock to Adminstock S**
- ❌ **NO COMMISSION** (stockist to stockist = inventory transfer)

**Step 4: Adminstock S transfers 1000 PV to NEW registered user**
- ✅ **Adminstock S gets base commission:** 0.8% × 1000 PV = **$8.00** (PAID immediately)
- ✅ **Adminstock M gets differential commission:** 0.9% × 1000 PV = **$9.00** (PAID immediately)
  - Rate: 1.7% (M) - 0.8% (S) = 0.9%
- ✅ **Adminstock C gets differential commission:** 0.9% × 1000 PV = **$9.00** (PAID immediately)
  - Rate: 2.6% (C) - 1.7% (M) = 0.9%
- ✅ **Adminstock D gets differential commission:** 0.4% × 1000 PV = **$4.00** (PAID immediately)
  - Rate: 3.0% (D) - 2.6% (C) = 0.4%

**Final Result:**
- Adminstock S: **$8.00** (0.8% base commission)
- Adminstock M: **$9.00** (0.9% differential: 1.7% - 0.8%)
- Adminstock C: **$9.00** (0.9% differential: 2.6% - 1.7%)
- Adminstock D: **$4.00** (0.4% differential: 3.0% - 2.6%)
- **Total Commissions:** $30.00

---

### Example 8: Direct Sale to Regular User (No Binary Relationship)

**Scenario:** Any stockist sells directly to a regular user (not a stockist, no binary relationship).

**Step 1: Adminstock M transfers 1000 PV to Regular User**
- ✅ **Adminstock M gets base commission:** 1.7% × 1000 PV = **$17.00** (PAID immediately)
- ❌ **No upline commission** (regular user has no binary stock parent/placementParentId)

**Final Result:**
- Adminstock M: **$17.00** (base commission only)
- **Total Commissions:** $17.00

**Note:** If Adminstock M has an upline stockist (e.g., Adminstock D) in binary stock, the upline would also get differential commission. This example assumes no binary relationship.

---

## Key Rules Summary

1. **Commission is created when downline sells to NEW user**
   - Downline gets base commission (their level rate)
   - Upline gets differential commission (if upline is higher level)

2. **Differential Commission Formula:**
   ```
   Differential Rate = Upline Level Rate - Downline Level Rate
   Commission Amount = PV × Differential Rate
   ```

3. **All commissions are PAID immediately** (auto-paid, no pending status)

4. **No commission when:**
   - Selling to same or higher level stockist
   - Selling upward in hierarchy
   - No binary stock relationship (placementParentId)

## Commission Rules by Level

### Adminstock S (Small Mobile)
- **Base**: 0.8%
- **Can sell to**: Regular users → Paid immediately
- **Cannot earn**: Differential commission (never sells to lower-level stockists)
- **Selling to M, C, D**: No commission

### Adminstock M (Mobile)
- **Base**: 1.7%
- **Sell to regular users**: Paid immediately (1.7%)
- **Has S as downline**: When S sells to new user → M gets 0.9% differential (PAID immediately)
- **Sell to C, D**: No commission

### Adminstock C (Center)
- **Base**: 2.6%
- **Sell to regular users**: Paid immediately (2.6%)
- **Has M as downline**: When M sells to new user → C gets 0.9% differential (PAID immediately)
- **Has S as downline**: When S sells to new user → C gets 1.8% differential (PAID immediately)
- **Sell to D**: No commission

### Adminstock D (Dealer)
- **Base**: 3.0%
- **Sell to regular users**: Paid immediately (3.0%)
- **Has C as downline**: When C sells to new user → D gets 0.4% differential (PAID immediately)
- **Has M as downline**: When M sells to new user → D gets 1.3% differential (PAID immediately)
- **Has S as downline**: When S sells to new user → D gets 2.2% differential (PAID immediately)

## Validation Rules

### New User Detection
A user is considered "NEW" if:
- They have exactly 1 fulfilled order, AND
- They have 0 stock transfers received

### Commission Creation Validation
Before creating commissions, the system validates:
1. The stockist who sold is still active
2. The sale/transfer is to a NEW registered user
3. There's a binary stock relationship (placementParentId) between upline and downline
4. The upline stockist is a higher level than the downline stockist

### Payment Order
All commissions are paid immediately:
1. Downline stockist gets base commission (their level rate)
2. Upline stockist gets differential commission (if upline is higher level)
3. Both commissions are created and paid at the same time

## Database Migration

To apply the schema changes, run:

```bash
npx prisma migrate dev --name add_binary_stock_commission_fields
```

Or if using Prisma Studio:

```bash
npx prisma db push
```

## Testing Checklist

- [ ] M has S as downline → S transfers to new user → S gets $8 (0.8%), M gets $9 (0.9%)
- [ ] C has M as downline → M transfers to new user → M gets $17 (1.7%), C gets $9 (0.9%)
- [ ] C has S as downline → S transfers to new user → S gets $8 (0.8%), C gets $18 (1.8%)
- [ ] D has C as downline → C transfers to new user → C gets $26 (2.6%), D gets $4 (0.4%)
- [ ] D has M as downline → M transfers to new user → M gets $17 (1.7%), D gets $13 (1.3%)
- [ ] D has S as downline → S transfers to new user → S gets $8 (0.8%), D gets $22 (2.2%)
- [ ] Complex chain D→C→M→S → S transfers to new user → All get commissions immediately
- [ ] S sells to existing user → No commission created
- [ ] M sells to C → No commission (selling upward)
- [ ] Regular user transfers → No commission created

## Error Handling

- Commission creation failures don't block stock transfers
- Commission release failures are logged but don't block order fulfillment
- All errors are logged with full context for debugging
- Failed commissions can be manually reviewed and processed

## Monitoring

Key metrics to monitor:
- Number of commissions created per transfer
- Commission amounts by stockist level
- Binary stock relationship validation
- Failed commission creation attempts

## Future Enhancements

1. Commission release dashboard for admins
2. Automated retry mechanism for failed releases
3. Commission release notifications
4. Commission history with trigger details
5. Bulk commission release for multiple sales

## Support

For issues or questions:
1. Check commission records in database
2. Review logs for commission creation/release
3. Verify user is truly a "new user"
4. Check stockist levels are correct
5. Review pending commissions for the stockist

---

**Created**: January 2025  
**Version**: 1.0  
**Status**: ✅ Implemented
