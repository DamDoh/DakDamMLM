# Matching Bonus Commission Flow - All Ranks

## Overview

**Matching Bonus** is a commission where sponsors earn a percentage of their downlines' **Daily Match** commissions. The formula is:

**M = D × % of generation**

Where:
- **M** = Matching Bonus amount
- **D** = Daily Match amount earned by downline
- **%** = Sponsor's rank-based percentage for that generation

---

## 📊 Matching Bonus Rates by Rank & Generation

| Rank | G1 Rate | G2 Rate | G3 Rate | Total Max | Eligible Generations |
|------|---------|---------|---------|-----------|---------------------|
| **Bronze** | 20% | 0% | 0% | **20%** | G1 only |
| **Silver** | 30% | 0% | 0% | **30%** | G1 only |
| **Gold** | 40% | 5% | 0% | **45%** | G1 + G2 |
| **Diamond** | 50% | 10% | 0% | **60%** | G1 + G2 |
| **Manager** | 60% | 10% | 5% | **75%** | G1 + G2 + G3 |
| **Director** | 60% | 10% | 10% | **80%** | G1 + G2 + G3 |
| **President** | 60% | 10% | 10% | **80%** | G1 + G2 + G3 |
| **Double President** | 60% | 10% | 10% | **80%** | G1 + G2 + G3 |

**Key Points:**
- **G1** = Direct downlines (placement children)
- **G2** = Downlines of G1 (grandchildren)
- **G3** = Downlines of G2 (great-grandchildren)
- Each generation uses its own rate
- Rates are applied to **Daily Match** amounts, not PV

---

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│              MATCHING BONUS COMMISSION FLOW                     │
│                    (For All Ranks)                              │
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
   ✅ Not superadmin         ✅ Has downlines
   ✅ Active member           ✅ Can earn commissions
        │                           │
        └─────────────┬─────────────┘
                      │
                      ▼
        ┌─────────────────────────────────────┐
        │  CHECK MAINTENANCE (REQUIRED)       │
        │                                     │
        │  ✅ Maintenance paid                │
        │  ❌ If not paid → RETURN []         │
        │     (Hard block - no bonus)         │
        └─────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────────┐
        │  CHECK RANK RATES                   │
        │                                     │
        │  ✅ Rank has rates configured       │
        │  ❌ If no rates → RETURN []         │
        └─────────────────────────────────────┘
                      │
                      ▼
                      │
                      ▼
        ┌─────────────────────────────────────┐
        │  2. GET SPONSOR'S RANK RATES        │
        │                                     │
        │  rankRates = getMatchingBonusRate()│
        │  - Bronze: G1=20%                  │
        │  - Silver: G1=30%                  │
        │  - Gold: G1=40%, G2=5%              │
        │  - Diamond: G1=50%, G2=10%         │
        │  - Manager+: G1=60%, G2=10%, G3=5-10%│
        └─────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────────┐
        │  3. GET ELIGIBLE DOWNLINES          │
        │                                     │
        │  - Get G1 (direct downlines)        │
        │  - Get G2 (if rank eligible)        │
        │  - Get G3 (if rank eligible)        │
        │  - Filter by eligible generations   │
        │  - Track leg position (left/right)  │
        └─────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────────┐
        │  4. FIND DAILY MATCH COMMISSIONS     │
        │                                     │
        │  - Query commission table            │
        │  - Type: 'Daily Match'              │
        │  - Status: 'Paid'                   │
        │  - UserId: in eligibleDownlineIds   │
        │  - Date: Last 7 days (filtered)     │
        └─────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────────┐
        │  5. GROUP BY DOWNLINE               │
        │                                     │
        │  commissionMap[downlineId] =        │
        │    sum of all Daily Match amounts   │
        └─────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────────┐
        │  6. CALCULATE MATCHING BONUS         │
        │     (By Leg & Generation)           │
        │                                     │
        │  For each eligible downline:         │
        │    dailyMatch = commissionMap[id]   │
        │    generationRate = rankRates[gen]  │
        │    matchingBonus = dailyMatch × rate│
        │    leg = downline.position           │
        │    Accumulate by leg (left/right)    │
        └─────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────────┐
        │  7. CREATE COMMISSION ENTRIES       │
        │     (Separate for Each Leg)         │
        │                                     │
        │  - Left Leg Matching Bonus          │
        │    (sum of all left leg bonuses)    │
        │  - Right Leg Matching Bonus          │
        │    (sum of all right leg bonuses)    │
        │  - Each entry includes:              │
        │    * Generation breakdown (G1/G2/G3)│
        │    * Total Daily Match amount        │
        │    * List of contributing downlines │
        └─────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────────────┐
        │  8. PROCESS PAYMENT                 │
        │                                     │
        │  - Create commission records        │
        │  - Credit wallet                    │
        │  - Mark as Paid                     │
        │  - Add to E-Cash                    │
        └─────────────────────────────────────┘
                      │
                      ▼
                 ✅ COMPLETE
```

---

## 📝 Detailed Step-by-Step Flow

### **Step 1: Eligibility Checks**

**Location**: `/src/services/commission-calculation-engine.ts` (lines 787-809)

```typescript
✅ Member is NOT superadmin
✅ Member has downlines (canEarnCommissions)
✅ Member is active and not deleted
✅ Monthly maintenance is paid (REQUIRED - hard block if not paid)
✅ Member's rank has Matching Bonus rates configured
```

**CRITICAL**: 
- **Monthly maintenance payment is REQUIRED for Matching Bonus**
- If maintenance is not paid, the method returns empty array `[]` immediately (no bonus)
- Maintenance is **ONLY** required for Matching Bonus, NOT for Binary Bonus
- Maintenance check is done INSIDE `calculateMatchingBonus` method (lines 801-809)

**Note**: PV requirement (20 PV group volume) is preferred but not strictly enforced. However, maintenance payment is strictly required.

### **Step 2: Get Rank Rates**

**Location**: `/src/services/commission-calculation-engine.ts` (lines 753-766)

```typescript
const rankRates = getMatchingBonusRate(memberRank);

// Returns: { g1: number, g2: number, g3: number }
// Example for Gold: { g1: 0.40, g2: 0.05, g3: 0 }
```

**Rates Table:**
- **Bronze**: G1=20%, G2=0%, G3=0%
- **Silver**: G1=30%, G2=0%, G3=0%
- **Gold**: G1=40%, G2=5%, G3=0%
- **Diamond**: G1=50%, G2=10%, G3=0%
- **Manager**: G1=60%, G2=10%, G3=5%
- **Director**: G1=60%, G2=10%, G3=10%
- **President**: G1=60%, G2=10%, G3=10%
- **Double President**: G1=60%, G2=10%, G3=10%

### **Step 3: Get Eligible Downlines**

**Location**: `/src/services/commission-calculation-engine.ts` (lines 1267-1347)

```typescript
// Get all downlines with generation tracking
const allDownlines = await getAllDownlinesWithGenerations(memberId);

// Filter by eligible generations based on rank
const eligibleGenerations = [];
if (rankRates.g1 > 0) eligibleGenerations.push(1);
if (rankRates.g2 > 0) eligibleGenerations.push(2);
if (rankRates.g3 > 0) eligibleGenerations.push(3);

const eligibleDownlines = allDownlines.filter(
  d => eligibleGenerations.includes(d.generation)
);
```

**Generation Logic:**
- **G1**: Direct downlines (placementParentId = sponsorId)
- **G2**: Downlines of G1 (placementParentId = G1.id)
- **G3**: Downlines of G2 (placementParentId = G2.id)
- **Leg Position**: G1 uses own position, G2/G3 inherit from G1 ancestor

### **Step 4: Find Daily Match Commissions**

**Location**: `/src/services/commission-calculation-engine.ts` (lines 916-943)

```typescript
// Query for Daily Match commissions
const dailyMatchCommissions = await prisma.commission.findMany({
  where: {
    userId: { in: eligibleDownlineIds },
    type: 'Daily Match',
    status: 'Paid'
    // No strict date filter - checks last 7 days client-side
  }
});

// Filter to last 7 days
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
const filteredCommissions = dailyMatchCommissions.filter(c => {
  const commissionDate = new Date(c.date);
  return commissionDate >= sevenDaysAgo || commissionDate >= todayStart;
});
```

**Key Points:**
- Only **Paid** Daily Match commissions count
- Checks last **7 days** of commissions
- Multiple Daily Match commissions from same downline are **summed**

### **Step 5: Group by Downline**

**Location**: `/src/services/commission-calculation-engine.ts` (lines 976-980)

```typescript
// Sum all Daily Match amounts per downline
const commissionMap = filteredCommissions.reduce((acc, c) => {
  acc[c.userId] = (acc[c.userId] || 0) + c.amount;
  return acc;
}, {});
```

**Example:**
- Downline A earned $8 Daily Match today
- Downline A earned $8 Daily Match yesterday
- commissionMap[A.id] = $16

### **Step 6: Calculate Matching Bonus**

**Location**: `/src/services/commission-calculation-engine.ts` (lines 1053-1102)

```typescript
// For each eligible downline
for (const downline of eligibleDownlines) {
  const dailyMatch = commissionMap[downline.id] || 0;
  if (dailyMatch <= 0) continue;
  
  // Get rate for this generation
  const generationRate = 
    downline.generation === 1 ? rankRates.g1 :
    downline.generation === 2 ? rankRates.g2 :
    rankRates.g3;
  
  // Calculate Matching Bonus
  const matchingBonus = Math.round((dailyMatch * generationRate) * 100) / 100;
  
  // Determine leg (left or right)
  const leg = downline.position?.toLowerCase() === 'right' ? 'right' : 'left';
  
  // Accumulate by leg
  legBonuses[leg].amount += matchingBonus;
  legBonuses[leg].downlines.push(downline.memberId);
}
```

**Formula Examples:**
- **Bronze sponsor** (20% G1): Downline earned $8 Daily Match → $8 × 20% = **$1.60**
- **Silver sponsor** (30% G1): Downline earned $8 Daily Match → $8 × 30% = **$2.40**
- **Gold sponsor** (40% G1, 5% G2):
  - G1 downline earned $8 → $8 × 40% = **$3.20**
  - G2 downline earned $8 → $8 × 5% = **$0.40**
- **Diamond sponsor** (50% G1, 10% G2):
  - G1 downline earned $8 → $8 × 50% = **$4.00**
  - G2 downline earned $8 → $8 × 10% = **$0.80**

### **Step 7: Create Commission Entries**

**Location**: `/src/services/commission-calculation-engine.ts` (lines 1164-1232)

```typescript
// Create LEFT leg Matching Bonus entry
if (totalLeftBonus > 0) {
  results.push({
    type: 'matching_bonus',
    amount: totalLeftBonus,
    description: `Matching Bonus (Left Leg): $${leftLegDailyMatch} Daily Match × ${generations} = $${totalLeftBonus}`,
    metadata: {
      leg: 'left',
      sponsorRank: memberRank,
      dailyMatchTotal: leftLegDailyMatch,
      downlines: legBonuses.left.downlines,
      generationBreakdown: { g1: leftLegG1, g2: leftLegG2, g3: leftLegG3 }
    }
  });
}

// Create RIGHT leg Matching Bonus entry
if (totalRightBonus > 0) {
  results.push({
    type: 'matching_bonus',
    amount: totalRightBonus,
    description: `Matching Bonus (Right Leg): $${rightLegDailyMatch} Daily Match × ${generations} = $${totalRightBonus}`,
    metadata: {
      leg: 'right',
      sponsorRank: memberRank,
      dailyMatchTotal: rightLegDailyMatch,
      downlines: legBonuses.right.downlines,
      generationBreakdown: { g1: rightLegG1, g2: rightLegG2, g3: rightLegG3 }
    }
  });
}
```

**Key Points:**
- **Separate entries** for left and right legs
- Each entry shows generation breakdown (G1/G2/G3)
- Includes list of contributing downlines
- Only created if amount > 0

### **Step 8: Process Payment**

**Location**: `/src/services/commission-calculation-engine.ts` (lines 1413-1527)

```typescript
// For each Matching Bonus entry
await prisma.commission.create({
  data: {
    userId: sponsorId,
    amount: matchingBonus.amount,
    type: 'Matching Bonus',
    description: matchingBonus.description,
    status: 'Pending',
    date: new Date()
  }
});

// Credit wallet
await WalletService.creditWallet(
  sponsorId,
  matchingBonus.amount,
  matchingBonus.description,
  commission.id,
  'commission'
);

// Mark as Paid
await prisma.commission.update({
  where: { id: commission.id },
  data: { status: 'Paid' }
});

// Add to E-Cash
await addCommissionToECash(
  sponsorId,
  matchingBonus.amount,
  commission.id,
  'matching_bonus'
);
```

---

## 🎯 Example Scenarios by Rank

### **Scenario 1: Bronze Sponsor (20% G1 only)**

```
Sponsor Rank: Bronze
Matching Bonus Rates: G1=20%, G2=0%, G3=0%

Downlines:
  - G1 Left: Member A earned $8 Daily Match
  - G1 Right: Member B earned $8 Daily Match

Calculation:
  Left Leg:
    Member A: $8 × 20% = $1.60
    Total Left: $1.60
  
  Right Leg:
    Member B: $8 × 20% = $1.60
    Total Right: $1.60

Result:
  ✅ Left Leg Matching Bonus: $1.60
  ✅ Right Leg Matching Bonus: $1.60
  ✅ Total Matching Bonus: $3.20
```

### **Scenario 2: Silver Sponsor (30% G1 only)**

```
Sponsor Rank: Silver
Matching Bonus Rates: G1=30%, G2=0%, G3=0%

Downlines:
  - G1 Left: Member A earned $80 Daily Match (10 matches)
  - G1 Right: Member B earned $40 Daily Match (5 matches)

Calculation:
  Left Leg:
    Member A: $80 × 30% = $24.00
    Total Left: $24.00
  
  Right Leg:
    Member B: $40 × 30% = $12.00
    Total Right: $12.00

Result:
  ✅ Left Leg Matching Bonus: $24.00
  ✅ Right Leg Matching Bonus: $12.00
  ✅ Total Matching Bonus: $36.00
```

### **Scenario 3: Gold Sponsor (40% G1, 5% G2)**

```
Sponsor Rank: Gold
Matching Bonus Rates: G1=40%, G2=5%, G3=0%

Downlines:
  - G1 Left: Member A earned $80 Daily Match
  - G1 Right: Member B earned $40 Daily Match
  - G2 Left (under A): Member C earned $8 Daily Match
  - G2 Right (under B): Member D earned $8 Daily Match

Calculation:
  Left Leg:
    Member A (G1): $80 × 40% = $32.00
    Member C (G2): $8 × 5% = $0.40
    Total Left: $32.40
  
  Right Leg:
    Member B (G1): $40 × 40% = $16.00
    Member D (G2): $8 × 5% = $0.40
    Total Right: $16.40

Result:
  ✅ Left Leg Matching Bonus: $32.40
  ✅ Right Leg Matching Bonus: $16.40
  ✅ Total Matching Bonus: $48.80
```

### **Scenario 4: Diamond Sponsor (50% G1, 10% G2)**

```
Sponsor Rank: Diamond
Matching Bonus Rates: G1=50%, G2=10%, G3=0%

Downlines:
  - G1 Left: Member A earned $80 Daily Match
  - G1 Right: Member B earned $80 Daily Match
  - G2 Left (under A): Member C earned $16 Daily Match
  - G2 Right (under B): Member D earned $16 Daily Match

Calculation:
  Left Leg:
    Member A (G1): $80 × 50% = $40.00
    Member C (G2): $16 × 10% = $1.60
    Total Left: $41.60
  
  Right Leg:
    Member B (G1): $80 × 50% = $40.00
    Member D (G2): $16 × 10% = $1.60
    Total Right: $41.60

Result:
  ✅ Left Leg Matching Bonus: $41.60
  ✅ Right Leg Matching Bonus: $41.60
  ✅ Total Matching Bonus: $83.20
```

### **Scenario 5: Manager Sponsor (60% G1, 10% G2, 5% G3)**

```
Sponsor Rank: Manager
Matching Bonus Rates: G1=60%, G2=10%, G3=5%

Downlines:
  - G1 Left: Member A earned $80 Daily Match
  - G1 Right: Member B earned $80 Daily Match
  - G2 Left (under A): Member C earned $16 Daily Match
  - G2 Right (under B): Member D earned $16 Daily Match
  - G3 Left (under C): Member E earned $8 Daily Match
  - G3 Right (under D): Member F earned $8 Daily Match

Calculation:
  Left Leg:
    Member A (G1): $80 × 60% = $48.00
    Member C (G2): $16 × 10% = $1.60
    Member E (G3): $8 × 5% = $0.40
    Total Left: $50.00
  
  Right Leg:
    Member B (G1): $80 × 60% = $48.00
    Member D (G2): $16 × 10% = $1.60
    Member F (G3): $8 × 5% = $0.40
    Total Right: $50.00

Result:
  ✅ Left Leg Matching Bonus: $50.00
  ✅ Right Leg Matching Bonus: $50.00
  ✅ Total Matching Bonus: $100.00
```

### **Scenario 6: Director/President Sponsor (60% G1, 10% G2, 10% G3)**

```
Sponsor Rank: Director
Matching Bonus Rates: G1=60%, G2=10%, G3=10%

Downlines:
  - G1 Left: Member A earned $80 Daily Match
  - G1 Right: Member B earned $80 Daily Match
  - G2 Left (under A): Member C earned $16 Daily Match
  - G2 Right (under B): Member D earned $16 Daily Match
  - G3 Left (under C): Member E earned $8 Daily Match
  - G3 Right (under D): Member F earned $8 Daily Match

Calculation:
  Left Leg:
    Member A (G1): $80 × 60% = $48.00
    Member C (G2): $16 × 10% = $1.60
    Member E (G3): $8 × 10% = $0.80
    Total Left: $50.40
  
  Right Leg:
    Member B (G1): $80 × 60% = $48.00
    Member D (G2): $16 × 10% = $1.60
    Member F (G3): $8 × 10% = $0.80
    Total Right: $50.40

Result:
  ✅ Left Leg Matching Bonus: $50.40
  ✅ Right Leg Matching Bonus: $50.40
  ✅ Total Matching Bonus: $100.80
```

---

## 🔑 Key Business Rules

### **1. Generation Eligibility**
- **Bronze/Silver**: Only G1 (direct downlines)
- **Gold**: G1 + G2
- **Diamond**: G1 + G2
- **Manager+**: G1 + G2 + G3

### **2. Leg Separation**
- Matching Bonus is calculated **separately** for left and right legs
- Each leg creates its own commission entry
- Leg position is inherited: G1 uses own position, G2/G3 inherit from G1 ancestor

### **3. Daily Match Source**
- Only **Paid** Daily Match commissions count
- Checks last **7 days** of Daily Match commissions
- Multiple Daily Match commissions from same downline are **summed**

### **4. Maintenance Requirement**
- **CRITICAL**: Monthly maintenance payment is **REQUIRED** for Matching Bonus
- If maintenance is not paid, Matching Bonus will **NOT** be calculated (returns empty array)
- Maintenance is **ONLY** required for Matching Bonus, NOT for Binary Bonus or other commissions
- Maintenance must be paid for the current month (YYYY-MM format)

### **5. Calculation Formula**
```
Matching Bonus = Daily Match Amount × Generation Rate

Where:
- Daily Match Amount = Sum of all Paid Daily Match commissions from that downline (last 7 days)
- Generation Rate = Sponsor's rank rate for that generation (G1/G2/G3)
```

### **6. Commission Entry Structure**
- **Two separate entries** per sponsor: Left Leg and Right Leg
- Each entry includes:
  - Total amount
  - Generation breakdown (G1/G2/G3 amounts)
  - List of contributing downlines
  - Total Daily Match amount that generated the bonus

---

## 📋 Implementation Files

| File | Purpose |
|------|---------|
| `/src/services/commission-calculation-engine.ts` | **Main calculation logic** - `calculateMatchingBonus()` method |
| `/src/services/commission-calculation-engine.ts` | **Rate lookup** - `getMatchingBonusRate()` method |
| `/src/services/commission-calculation-engine.ts` | **Downline retrieval** - `getAllDownlinesWithGenerations()` method |
| `/src/app/api/bonus/daily-match/route.ts` | **Trigger point** - Calls Matching Bonus calculation after Daily Match |
| `/src/services/daily-match-trigger.ts` | **Auto-trigger** - Also triggers Matching Bonus |

---

## ✅ Summary

1. **Formula**: M = D × % of generation
2. **Source**: Downlines' **Paid Daily Match** commissions (last 7 days)
3. **Rates vary by rank**: Bronze (20%) → Double President (80% total)
4. **Generations vary by rank**: Bronze/Silver (G1 only) → Manager+ (G1+G2+G3)
5. **Separate entries**: Left leg and Right leg calculated separately
6. **Maintenance**: **REQUIRED** - Hard block if not paid (ONLY for Matching Bonus, NOT for Binary Bonus)
7. **Leg inheritance**: G2/G3 inherit leg position from G1 ancestor
8. **Multiple commissions**: Sums all Daily Match from same downline
9. **Time window**: Last 7 days of Daily Match commissions

---

## 🎯 Quick Reference

```
Matching Bonus = Daily Match × Generation Rate

Bronze:  20% G1 only
Silver:  30% G1 only
Gold:    40% G1 + 5% G2
Diamond: 50% G1 + 10% G2
Manager: 60% G1 + 10% G2 + 5% G3
Director+: 60% G1 + 10% G2 + 10% G3

Separate entries for Left and Right legs
Only from Paid Daily Match commissions (last 7 days)
```
