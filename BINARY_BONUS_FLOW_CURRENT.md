# Binary Bonus Flow - Current Implementation

## Overview
Binary Bonus is calculated when a member achieves or upgrades their rank (Bronze+). The commission is paid to the member's **placement parent** (upline in binary tree) based on the **sponsor's rank** commission rate.

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. PV TRANSFER/TOPUP OCCURS                                     │
│    - Admin transfers PV OR Member receives PV topup            │
│    - Member's PV increases: oldPV → newPV                       │
│    - Rank auto-updates if threshold met                         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. RANK UPDATE CHECK                                             │
│    Condition: rankUpdated && newRank !== 'Member'               │
│    If TRUE → Proceed to Binary Bonus Calculation                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. CALL calculateBinaryBonusOnRankChange(memberId, pvAdded?)   │
│    Endpoints that trigger:                                       │
│    • /api/members/[id]/transfer-pv                              │
│    • /api/pv-topup-requests                                      │
│    • /api/ecash-topup-requests                                   │
│    • /api/wallet/transfer-pv                                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. VALIDATION CHECKS                                             │
│    ✓ Member exists?                                              │
│    ✓ Has placementParentId? (placed in binary tree)            │
│    ✓ Created within last 90 days?                               │
│    ✓ Member rank is Bronze+? (not "Member")                      │
│    ✓ Sponsor exists and has valid rank (Bronze+)?               │
│    If ANY fails → Return false, skip calculation                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. GET PV POINTS & COMMISSION RATE                              │
│    Member Rank → getPVPointsByRank(rank)                         │
│    • Bronze: 60 PV                                               │
│    • Silver: 100 PV                                              │
│    • Gold: 500 PV                                                │
│    • Diamond/Manager+: 1000 PV                                   │
│                                                                  │
│    Sponsor Rank → getCommissionRateByRank(rank)                  │
│    • Bronze: 8%                                                  │
│    • Silver: 10%                                                 │
│    • Gold: 14%                                                   │
│    • Diamond/Manager+: 17%                                       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. DETERMINE CALCULATION METHOD                                  │
│    IF pvAdded is provided:                                       │
│      → Check for existing Binary Bonus commission                │
│      → IF found: This is a RANK UPGRADE                           │
│         • Use pvAdded (actual PV added) for calculation          │
│      → IF NOT found: This is FIRST TIME                          │
│         • Use rank PV points for calculation                     │
│    ELSE:                                                         │
│      → Use rank PV points (first-time rank achievement)          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. CALCULATE COMMISSION                                          │
│    Formula: pvToCalculate × commissionRate                       │
│    Example: 400 PV × 10% = $40.00                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. CREATE COMMISSION RECORD                                      │
│    • userId: member.placementParentId (sponsor gets commission)  │
│    • amount: calculated commission amount                        │
│    • type: 'Binary Bonus'                                       │
│    • status: 'Paid'                                              │
│    • description: Includes member info and calculation details │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 9. CREDIT SPONSOR'S WALLET                                       │
│    • WalletService.creditWallet()                                │
│    • Amount: commission amount                                   │
│    • Description: Binary Bonus details                          │
│    • Reference: commission.id                                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 10. G2 BINARY BONUS (If Applicable)                              │
│     • If sponsor has Manager+ rank                               │
│     • Calculate G2 bonus for grandparent                        │
│     • Rate: 1-3% of G2 downline's PV                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Flow Breakdown

### Step 1: PV Transfer/Topup
**Triggers:**
- Admin PV transfer (`/api/members/[id]/transfer-pv`)
- PV topup request approval (`/api/pv-topup-requests`)
- E-cash topup request approval (`/api/ecash-topup-requests`)
- Member-to-member PV transfer (`/api/wallet/transfer-pv`)

**Actions:**
```typescript
// Example: Member receives +400 PV
oldPV = 100
newPV = 500
rank: "Silver" → "Gold" (auto-updated)
```

---

### Step 2: Binary Bonus Trigger
**Condition Check:**
```typescript
if (rankUpdated && newRank !== 'Member') {
  await calculateBinaryBonusOnRankChange(memberId, pvAdded);
}
```

**Parameters:**
- `memberId`: The member whose rank changed
- `pvAdded` (optional): Actual PV amount added (e.g., 400 PV)

---

### Step 3: Validation Checks

```typescript
// 1. Member exists?
if (!member) return false;

// 2. Has placement parent?
if (!member.placementParentId) return false;

// 3. Created within 90 days?
const daysSinceCreation = (Date.now() - member.createdAt) / (1000 * 60 * 60 * 24);
if (daysSinceCreation > 90) return false;

// 4. Member rank is Bronze+?
if (memberRank === 'Member' || !validRanks.includes(memberRank)) return false;

// 5. Sponsor exists and has valid rank?
const sponsorId = member.sponsorId || member.placementParentId;
if (!sponsor || sponsor.rank === 'Member') return false;
```

---

### Step 4: PV Points & Commission Rate

**PV Points by Rank:**
```typescript
getPVPointsByRank(rank):
  Bronze: 60 PV
  Silver: 100 PV
  Gold: 500 PV
  Diamond/Manager+: 1000 PV
```

**Commission Rate by Sponsor Rank:**
```typescript
getCommissionRateByRank(rank):
  Bronze: 8% (0.08)
  Silver: 10% (0.10)
  Gold: 14% (0.14)
  Diamond/Manager+: 17% (0.17)
```

---

### Step 5: Calculation Logic

**Scenario A: First Time Rank Achievement**
```typescript
// No existing commission found
pvToCalculate = getPVPointsByRank(memberRank); // e.g., 500 PV for Gold
commissionAmount = pvToCalculate × commissionRate; // 500 × 10% = $50.00
```

**Scenario B: Rank Upgrade (pvAdded provided)**
```typescript
// Existing commission found for this member
if (existingCommission) {
  pvToCalculate = pvAdded; // Use actual PV added (e.g., 400 PV)
  commissionAmount = pvToCalculate × commissionRate; // 400 × 10% = $40.00
}
```

**Finding Existing Commission:**
```typescript
// Search for Binary Bonus commissions for placementParentId
// Created after member was created
// Match by:
//   - Description contains memberId, OR
//   - Calculated PV matches a rank PV (60, 100, 500, 1000)
```

---

### Step 6: Commission Creation

```typescript
const commission = await prisma.commission.create({
  data: {
    userId: member.placementParentId, // Sponsor gets commission
    amount: commissionAmount,
    type: 'Binary Bonus',
    status: 'Paid',
    date: new Date(),
    description: `Binary Bonus: Member ${memberName} (${memberId}) rank upgraded - ${pvToCalculate} PV added × ${rate}%`
  }
});
```

---

### Step 7: Wallet Credit

```typescript
await WalletService.creditWallet(
  member.placementParentId, // Sponsor's wallet
  commissionAmount,
  `Binary Bonus: Member ${memberName} rank upgraded - ${pvToCalculate} PV added × ${rate}%`,
  commission.id,
  'commission'
);
```

---

## Example Scenarios

### Example 1: First Time Rank Achievement
**Member:** ADMIN006  
**Action:** Receives 100 PV, achieves Silver rank  
**Sponsor:** ADMIN005 (Silver rank, 10% rate)

```
Flow:
1. PV added: 0 → 100
2. Rank: Member → Silver
3. No existing commission found
4. Calculation: 100 PV × 10% = $10.00
5. Commission created: $10.00
6. Sponsor's wallet credited: +$10.00
```

---

### Example 2: Rank Upgrade
**Member:** ADMIN006  
**Action:** Already Silver, receives +400 PV, upgrades to Gold  
**Sponsor:** ADMIN005 (Silver rank, 10% rate)

```
Flow:
1. PV added: 100 → 500 (+400 PV)
2. Rank: Silver → Gold
3. Existing commission found: $10.00 (for Silver rank)
4. pvAdded = 400 PV (provided by endpoint)
5. Calculation: 400 PV × 10% = $40.00
6. Commission created: $40.00 (NEW commission for upgrade)
7. Sponsor's wallet credited: +$40.00
```

**Result:**
- Total commissions for ADMIN006: $10.00 (Silver) + $40.00 (Gold) = $50.00
- Sponsor receives $40.00 for the upgrade

---

## Key Points

1. **Commission Recipient:** Always `placementParentId` (upline in binary tree)
2. **Commission Rate:** Based on **sponsor's rank**, not member's rank
3. **PV Calculation:** 
   - First time: Uses rank PV points (60, 100, 500, 1000)
   - Upgrade: Uses actual PV added (when `pvAdded` provided)
4. **90-Day Rule:** Only calculates for members created within last 90 days
5. **Rank Requirements:** Both member and sponsor must be Bronze+ rank
6. **Multiple Commissions:** Creates NEW commission for each rank upgrade (doesn't modify existing)

---

## Current Issues / Areas for Improvement

1. **Existing Commission Matching:** Uses description or calculated PV matching - may not always be accurate
2. **90-Day Limit:** Hard-coded 90 days - may need to be configurable
3. **Sponsor Selection:** Uses `sponsorId || placementParentId` - may need clearer logic
4. **PV Calculation:** When `pvAdded` not provided, always uses rank PV points - may not reflect actual PV added

---

## Files Involved

1. **`src/lib/referral-tracking.ts`**
   - `calculateBinaryBonusOnRankChange()` - Main calculation function
   - `getPVPointsByRank()` - PV points by rank
   - `getCommissionRateByRank()` - Commission rate by rank

2. **API Endpoints:**
   - `src/app/api/members/[id]/transfer-pv/route.ts`
   - `src/app/api/pv-topup-requests/route.ts`
   - `src/app/api/ecash-topup-requests/route.ts`
   - `src/app/api/wallet/transfer-pv/route.ts`

3. **Services:**
   - `src/services/wallet-service.ts` - Wallet crediting
   - `src/services/g2-binary-bonus-auto-calc.ts` - G2 bonus calculation
