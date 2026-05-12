# Daily Bonus Commission Flow - All Ranks

## Overview

Daily Bonus Commission (also known as Daily Match Commission) is a binary matching bonus where **EVERY MEMBER** earns from their own binary tree. The commission is **8% of matched PV** between their left and right legs, paid in **$8 increments** with **daily caps based on rank**.

---

## 📊 Commission Rates & Caps by Rank

| Rank | Commission Rate | Daily Match Cap | Max Daily Earnings | PV per Match |
|------|----------------|-----------------|-------------------|--------------|
| **Bronze** | 8% | 1 match | **$8** | 100 PV |
| **Silver** | 8% | 10 matches | **$80** | 100 PV |
| **Gold** | 8% | 40 matches | **$320** | 100 PV |
| **Diamond** | 8% | 80 matches | **$640** | 100 PV |
| **Manager** | 8% | 100 matches | **$800** | 100 PV |
| **Director** | 8% | 116 matches | **$928** | 100 PV |
| **President** | 8% | 140 matches | **$1,120** | 100 PV |
| **Double President** | 8% | 200 matches | **$1,600** | 100 PV |

**Key Constants:**
- **Commission Rate**: 8% (0.08) for ALL ranks
- **Per Match Amount**: $8 (always)
- **PV per Match**: 100 PV = 1 match = $8

---

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    DAILY BONUS COMMISSION FLOW                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  1. ELIGIBILITY CHECKS              │
        └─────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
   ✅ Has both left          ✅ Active member
      & right G1               (not deleted)
      children                  
        │                           │
        │                           │
        ▼                           ▼
   ✅ Not superadmin         ✅ Rank eligible
                              (Bronze+)
        │                           │
        └─────────────┬─────────────┘
                      │
                      ▼
        ┌─────────────────────────────────────┐
        │  2. GET WAITING PV                  │
        │  (Source of Truth)                  │
        └─────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
   Left Waiting PV            Right Waiting PV
   (accumulated from          (accumulated from
    all left downlines)        all right downlines)
        │                           │
        └─────────────┬─────────────┘
                      │
                      ▼
        ┌─────────────────────────────────────┐
        │  3. CALCULATE MATCHED PV            │
        │                                     │
        │  matchedPV = min(leftPV, rightPV)   │
        └─────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────────┐
        │  4. CALCULATE COMMISSION            │
        │                                     │
        │  rawCommission = matchedPV × 8%     │
        │  dailyCap = rank.matchCap × $8      │
        │  cappedCommission = min(raw, cap)   │
        │  matches = floor(capped / $8)       │
        │  actualPayout = matches × $8        │
        └─────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────────┐
        │  5. CHECK DAILY CAP                 │
        │                                     │
        │  - Check if already paid today      │
        │  - If yes, check if PV increased    │
        │  - If PV increased, pay difference  │
        │  - If cap reached, skip             │
        └─────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────────┐
        │  6. UPDATE WAITING PV               │
        │                                     │
        │  if leftPV > rightPV:               │
        │    leftAfter = leftPV - rightPV     │
        │    rightAfter = 0                   │
        │  else:                              │
        │    leftAfter = 0                    │
        │    rightAfter = rightPV - leftPV    │
        └─────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────────┐
        │  7. RECORD TRANSACTION              │
        │                                     │
        │  - Update waiting_pv table          │
        │  - Create pv_match_transaction      │
        │  - Log match details                │
        └─────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────────┐
        │  8. CREDIT WALLET                   │
        │                                     │
        │  - Ensure wallet exists             │
        │  - Credit actualPayout amount       │
        │  - Create wallet transaction        │
        └─────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────────┐
        │  9. CREATE COMMISSION RECORDS       │
        │                                     │
        │  - Create ONE commission per match  │
        │  - Each match = $8                  │
        │  - Type: "Daily Match"              │
        │  - Status: "Paid"                   │
        └─────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────────┐
        │  10. TRIGGER MATCHING BONUS         │
        │      (for Sponsor)                  │
        │                                     │
        │  - Find placement parent            │
        │  - Calculate sponsor's %            │
        │  - Create Matching Bonus commission │
        │  - Credit sponsor's wallet          │
        └─────────────────────────────────────┘
                      │
                      ▼
                 ✅ COMPLETE
```

---

## 📝 Detailed Step-by-Step Flow

### **Step 1: Eligibility Checks**

**Location**: `/src/app/api/bonus/daily-match/route.ts` (lines 38-113)

```typescript
✅ User is authenticated
✅ User exists and is active
✅ User is NOT superadmin
✅ User has downlines (can earn commissions)
✅ User's rank is in BONUS_CONFIG (Bronze+)
✅ User has BOTH left AND right G1 children
   - Children must not be deleted
   - Children must not be "Member" rank
```

### **Step 2: Get Waiting PV**

**Location**: `/src/app/api/bonus/daily-match/route.ts` (lines 115-128)

```typescript
waitingPV = await PVMatchingService.getWaitingPV(userId);
leftWaitingPV = waitingPV.leftWaitingPV;   // Accumulated from left leg
rightWaitingPV = waitingPV.rightWaitingPV; // Accumulated from right leg
```

**Source of Truth**: The `waiting_pv` table stores the accumulated PV from all downlines in each leg.

### **Step 3: Calculate Matched PV**

**Location**: `/src/app/api/bonus/daily-match/route.ts` (lines 130-140)

```typescript
matchedPV = Math.min(leftWaitingPV, rightWaitingPV);
```

**Rule**: Always uses the **smaller** leg for matching.

### **Step 4: Calculate Commission**

**Location**: `/src/app/api/bonus/daily-match/route.ts` (lines 161-176)

```typescript
// Raw commission calculation
rawCommission = matchedPV × 0.08  // 8% for ALL ranks

// Get rank-specific daily cap
dailyCapAmount = rule.matchCap × $8  // e.g., Silver = 10 × $8 = $80

// Apply cap
cappedCommission = Math.min(rawCommission, dailyCapAmount)

// Calculate number of matches (rounded down)
matches = Math.floor(cappedCommission / $8)

// Actual payout (always in $8 increments)
actualPayout = matches × $8
```

**Examples:**

| Rank | Matched PV | Raw Commission | Daily Cap | Matches | Actual Payout |
|------|------------|----------------|-----------|---------|---------------|
| Bronze | 200 PV | $16 | $8 | 1 | **$8** |
| Silver | 1,500 PV | $120 | $80 | 10 | **$80** |
| Gold | 5,000 PV | $400 | $320 | 40 | **$320** |
| Diamond | 10,000 PV | $800 | $640 | 80 | **$640** |
| Manager | 12,000 PV | $960 | $800 | 100 | **$800** |
| Director | 15,000 PV | $1,200 | $928 | 116 | **$928** |
| President | 18,000 PV | $1,440 | $1,120 | 140 | **$1,120** |
| Double President | 25,000 PV | $2,000 | $1,600 | 200 | **$1,600** |

### **Step 5: Check Daily Cap & Existing Payments**

**Location**: `/src/app/api/bonus/daily-match/route.ts` (lines 192-305)

```typescript
// Check if already paid today
todayKey = new Date().toISOString().slice(0, 10);
existingTransactions = await findDailyMatchToday(userId, todayKey);

if (existingTransactions.length > 0) {
  previousAmount = sum of existing transactions;
  
  if (actualPayout > previousAmount) {
    // PV increased - pay additional amount
    additionalPayout = actualPayout - previousAmount;
    // Credit additional amount and create new commission records
  } else {
    // Already paid and PV hasn't increased - skip
    return "Already paid today";
  }
}
```

**Rule**: Members can earn **once per day**, but if their PV increases, they can claim the **additional amount** up to their daily cap.

### **Step 6: Update Waiting PV After Match**

**Location**: `/src/app/api/bonus/daily-match/route.ts` (lines 142-159)

```typescript
if (leftWaitingPV > rightWaitingPV) {
  leftAfterMatch = leftWaitingPV - rightWaitingPV;
  rightAfterMatch = 0;
} else if (rightWaitingPV > leftWaitingPV) {
  leftAfterMatch = 0;
  rightAfterMatch = rightWaitingPV - leftWaitingPV;
} else {
  // Equal legs
  leftAfterMatch = 0;
  rightAfterMatch = 0;
}
```

**Rule**: After matching, the **smaller leg becomes 0**, and the **larger leg keeps the difference** as waiting PV for next match.

### **Step 7: Record Transaction**

**Location**: `/src/app/api/bonus/daily-match/route.ts` (lines 235-251, 314-327)

```typescript
// Update waiting PV in database
await PVMatchingService.updateWaitingPV(userId, leftAfterMatch, rightAfterMatch);

// Record match transaction for history
await PVMatchingService.recordMatchTransaction(userId, {
  leftPVUsed: matchedPV,
  rightPVUsed: matchedPV,
  matchedPV,
  leftWaitingAfter: leftAfterMatch,
  rightWaitingAfter: rightAfterMatch,
  commissionRate: 0.08,
  commissionEarned: actualPayout,
  triggerType: 'manual',  // or 'auto'
  memberRank: user.rank,
  dailyCapMatches: rule.matchCap,
  matchesUsed: matches
});
```

### **Step 8: Credit Wallet**

**Location**: `/src/app/api/bonus/daily-match/route.ts` (lines 329-336)

```typescript
// Ensure wallet exists
wallet = await prisma.wallet.upsert({
  where: { userId: userId },
  create: { userId: userId, balance: 0, currency: 'USD' },
  update: {}
});

// Credit wallet
await WalletServiceEnhanced.creditWallet(
  userId,
  actualPayout,
  'Daily Match',
  referenceId,  // e.g., "userId:daily_match:Silver:2024-01-15"
  'daily_match'
);
```

### **Step 9: Create Commission Records**

**Location**: `/src/app/api/bonus/daily-match/route.ts` (lines 338-359)

```typescript
// Create ONE commission record per $8 match
for (let i = 0; i < matches; i++) {
  await prisma.commission.create({
    data: {
      userId: userId,
      amount: $8,  // Each match = $8
      type: 'Daily Match',
      status: 'Paid',
      date: new Date(),
      description: 'Daily Match Bonus - 100 PV matched at 8%'
    }
  });
}
```

**Example**: If a Silver member earns $80, they get **10 separate commission records**, each for $8.

### **Step 10: Trigger Matching Bonus for Sponsor**

**Location**: `/src/app/api/bonus/daily-match/route.ts` (lines 361-485)

```typescript
// Find member's placement parent (sponsor)
sponsor = await findPlacementParent(userId);

if (sponsor && sponsor.canEarnCommissions) {
  // Calculate Matching Bonus based on sponsor's rank
  matchingRates = {
    'Bronze': 0.20,      // 20%
    'Silver': 0.30,      // 30%
    'Gold': 0.40,        // 40%
    'Diamond': 0.50,     // 50%
    'Manager': 0.60,     // 60%
    'Director': 0.60,    // 60%
    'President': 0.60,   // 60%
    'Double President': 0.60  // 60%
  };
  
  rate = matchingRates[sponsor.rank];
  matchingBonusAmount = actualPayout × rate;
  
  // Create Matching Bonus commission for sponsor
  await prisma.commission.create({
    data: {
      userId: sponsor.id,
      amount: matchingBonusAmount,
      type: 'Matching Bonus',
      description: `Matching Bonus: $${actualPayout} × ${rate}% = $${matchingBonusAmount}`,
      status: 'Paid'
    }
  });
  
  // Credit sponsor's wallet
  await WalletServiceEnhanced.creditWallet(sponsor.id, matchingBonusAmount, ...);
}
```

**Example**:
- Member earns $80 Daily Match (Silver rank)
- Sponsor is Gold rank (40% rate)
- Sponsor gets: $80 × 40% = **$32 Matching Bonus**

---

## 🎯 Example Scenarios by Rank

### **Scenario 1: Bronze Member**
```
Rank: Bronze
Daily Cap: 1 match = $8

Left Waiting PV: 150 PV
Right Waiting PV: 200 PV

Calculation:
  matchedPV = min(150, 200) = 150 PV
  rawCommission = 150 × 8% = $12
  dailyCap = 1 × $8 = $8
  cappedCommission = min($12, $8) = $8
  matches = floor($8 / $8) = 1
  actualPayout = 1 × $8 = $8

Result:
  ✅ Earns $8 (1 match)
  ⚠️ $4 is lost (cap reached)
  Left After: 0 PV
  Right After: 50 PV (waiting)
```

### **Scenario 2: Silver Member**
```
Rank: Silver
Daily Cap: 10 matches = $80

Left Waiting PV: 1,500 PV
Right Waiting PV: 1,200 PV

Calculation:
  matchedPV = min(1,500, 1,200) = 1,200 PV
  rawCommission = 1,200 × 8% = $96
  dailyCap = 10 × $8 = $80
  cappedCommission = min($96, $80) = $80
  matches = floor($80 / $8) = 10
  actualPayout = 10 × $8 = $80

Result:
  ✅ Earns $80 (10 matches)
  ⚠️ $16 is lost (cap reached)
  Left After: 300 PV (waiting)
  Right After: 0 PV
```

### **Scenario 3: Gold Member**
```
Rank: Gold
Daily Cap: 40 matches = $320

Left Waiting PV: 5,000 PV
Right Waiting PV: 4,500 PV

Calculation:
  matchedPV = min(5,000, 4,500) = 4,500 PV
  rawCommission = 4,500 × 8% = $360
  dailyCap = 40 × $8 = $320
  cappedCommission = min($360, $320) = $320
  matches = floor($320 / $8) = 40
  actualPayout = 40 × $8 = $320

Result:
  ✅ Earns $320 (40 matches)
  ⚠️ $40 is lost (cap reached)
  Left After: 500 PV (waiting)
  Right After: 0 PV
```

### **Scenario 4: Diamond Member**
```
Rank: Diamond
Daily Cap: 80 matches = $640

Left Waiting PV: 10,000 PV
Right Waiting PV: 8,500 PV

Calculation:
  matchedPV = min(10,000, 8,500) = 8,500 PV
  rawCommission = 8,500 × 8% = $680
  dailyCap = 80 × $8 = $640
  cappedCommission = min($680, $640) = $640
  matches = floor($640 / $8) = 80
  actualPayout = 80 × $8 = $640

Result:
  ✅ Earns $640 (80 matches)
  ⚠️ $40 is lost (cap reached)
  Left After: 1,500 PV (waiting)
  Right After: 0 PV
```

### **Scenario 5: Manager Member**
```
Rank: Manager
Daily Cap: 100 matches = $800

Left Waiting PV: 12,000 PV
Right Waiting PV: 11,500 PV

Calculation:
  matchedPV = min(12,000, 11,500) = 11,500 PV
  rawCommission = 11,500 × 8% = $920
  dailyCap = 100 × $8 = $800
  cappedCommission = min($920, $800) = $800
  matches = floor($800 / $8) = 100
  actualPayout = 100 × $8 = $800

Result:
  ✅ Earns $800 (100 matches)
  ⚠️ $120 is lost (cap reached)
  Left After: 500 PV (waiting)
  Right After: 0 PV
```

### **Scenario 6: Director Member**
```
Rank: Director
Daily Cap: 116 matches = $928

Left Waiting PV: 15,000 PV
Right Waiting PV: 12,000 PV

Calculation:
  matchedPV = min(15,000, 12,000) = 12,000 PV
  rawCommission = 12,000 × 8% = $960
  dailyCap = 116 × $8 = $928
  cappedCommission = min($960, $928) = $928
  matches = floor($928 / $8) = 116
  actualPayout = 116 × $8 = $928

Result:
  ✅ Earns $928 (116 matches)
  ⚠️ $32 is lost (cap reached)
  Left After: 3,000 PV (waiting)
  Right After: 0 PV
```

### **Scenario 7: President Member**
```
Rank: President
Daily Cap: 140 matches = $1,120

Left Waiting PV: 18,000 PV
Right Waiting PV: 15,000 PV

Calculation:
  matchedPV = min(18,000, 15,000) = 15,000 PV
  rawCommission = 15,000 × 8% = $1,200
  dailyCap = 140 × $8 = $1,120
  cappedCommission = min($1,200, $1,120) = $1,120
  matches = floor($1,120 / $8) = 140
  actualPayout = 140 × $8 = $1,120

Result:
  ✅ Earns $1,120 (140 matches)
  ⚠️ $80 is lost (cap reached)
  Left After: 3,000 PV (waiting)
  Right After: 0 PV
```

### **Scenario 8: Double President Member**
```
Rank: Double President
Daily Cap: 200 matches = $1,600

Left Waiting PV: 25,000 PV
Right Waiting PV: 20,000 PV

Calculation:
  matchedPV = min(25,000, 20,000) = 20,000 PV
  rawCommission = 20,000 × 8% = $1,600
  dailyCap = 200 × $8 = $1,600
  cappedCommission = min($1,600, $1,600) = $1,600
  matches = floor($1,600 / $8) = 200
  actualPayout = 200 × $8 = $1,600

Result:
  ✅ Earns $1,600 (200 matches)
  ✅ No loss (cap exactly met)
  Left After: 5,000 PV (waiting)
  Right After: 0 PV
```

---

## 🔄 Auto-Trigger Flow

Daily Match can also be triggered **automatically** when:
1. A new member joins the binary tree
2. A member's PV is updated
3. Batch processing runs

**Location**: `/src/services/daily-match-trigger.ts`

```typescript
// Auto-trigger when new member joins
export async function checkAndTriggerDailyMatch(parentId: string): Promise<void> {
  // Same flow as manual trigger, but:
  // - triggerType: 'auto'
  // - Triggered by system events
}
```

---

## 📋 Key Implementation Files

| File | Purpose |
|------|---------|
| `/src/app/api/bonus/daily-match/route.ts` | **Manual trigger endpoint** - POST handler |
| `/src/services/daily-match-trigger.ts` | **Auto-trigger service** - System-triggered matches |
| `/src/services/pv-matching-service.ts` | **PV calculation service** - Waiting PV management |
| `/src/services/wallet-service-enhanced.ts` | **Wallet service** - Credit/debit operations |
| `prisma/schema.prisma` | Database schema for commissions, wallets, waiting_pv |

---

## ✅ Summary

1. **All ranks use 8% commission rate**
2. **All ranks paid in $8 increments**
3. **Daily caps vary by rank** (1-200 matches)
4. **Waiting PV is source of truth** (not user.pv)
5. **Matching uses smaller leg** (min(left, right))
6. **Remaining PV carried forward** to next match
7. **One commission record per $8 match**
8. **Sponsor gets Matching Bonus** based on their rank
9. **Can trigger manually or automatically**
10. **Once per day** (but can update if PV increases)

---

## 🎯 Quick Reference

```
Commission = min(leftPV, rightPV) × 8%
Capped at: rank.matchCap × $8
Paid in: $8 increments (matches)
Updates: Once per day (or when PV increases)
Carries Forward: Larger leg difference
Triggers: Manual (API) or Auto (system events)
```
