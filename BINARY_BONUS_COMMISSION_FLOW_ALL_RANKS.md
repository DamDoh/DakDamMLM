# Binary Bonus Commission Flow - All Ranks

## Overview

Binary Bonus Commission is calculated **separately for each leg** (Left and Right) based on the **sponsor's rank**. The rate is applied to each leg's volume independently, and the total Binary Bonus is the sum of both legs.

**Key Points:**
- ✅ Binary Bonus does **NOT** require maintenance payment (unlike Matching Bonus)
- ✅ Rate is based on **sponsor's rank**, not downline's rank
- ✅ Each leg (Left/Right) is calculated separately
- ✅ G2 Binary Bonus is available for Manager+ ranks only
- ✅ Qualification requirements must be met (personal PV + group PV)

---

## Binary Bonus Rates by Rank

### G1 Binary Bonus Rates (Generation 1 - Direct Downlines)

| Rank | G1 Rate | Description |
|------|---------|-------------|
| **Member** | 0% | No Binary Bonus |
| **Bronze** | 8% | 8% of leg volume |
| **Silver** | 10% | 10% of leg volume |
| **Gold** | 14% | 14% of leg volume |
| **Diamond** | 17% | 17% of leg volume |
| **Manager** | 17% | 17% of leg volume |
| **Director** | 17% | 17% of leg volume |
| **President** | 17% | 17% of leg volume |
| **Double President** | 17% | 17% of leg volume |

### G2 Binary Bonus Rates (Generation 2 - Only for Manager+)

| Rank | G2 Rate | Description |
|------|---------|-------------|
| **Manager** | 1% | 1% of leg volume per G2 downline |
| **Director** | 3% | 3% of leg volume per G2 downline |
| **President** | 3% | 3% of leg volume per G2 downline |
| **Double President** | 3% | 3% of leg volume per G2 downline |

**Note:** G2 Binary Bonus is only available for Manager+ ranks. Bronze, Silver, Gold, and Diamond ranks do NOT get G2 Binary Bonus.

---

## Qualification Requirements

To earn Binary Bonus, members must meet both **personal PV** and **group PV** requirements:

| Rank | Personal PV Required | Group PV Required |
|------|---------------------|-------------------|
| **Member** | 0 PV | 0 PV |
| **Bronze** | 60 PV | 20 PV |
| **Silver** | 100 PV | 20 PV |
| **Gold** | 500 PV | 20 PV |
| **Diamond** | 1,000 PV | 20 PV |
| **Manager** | 1,000 PV | 40 PV |
| **Director** | 1,000 PV | 40 PV |
| **President** | 1,000 PV | 40 PV |
| **Double President** | 1,000 PV | 40 PV |

**Group PV** = Total team volume (sum of left leg + right leg volumes)

---

## Calculation Flow

### Step 1: Check Eligibility

```
1. Member must be active and not deleted
2. Member must NOT be superadmin
3. Member must have downlines (canEarnCommissions check)
4. Member must meet qualification requirements (personal PV + group PV)
```

### Step 2: Calculate Leg Volumes

```
1. Calculate Left Leg Volume (all downlines in left leg)
2. Calculate Right Leg Volume (all downlines in right leg)
3. Get direct downlines (G1) for each leg
```

### Step 3: Calculate G1 Binary Bonus (All Ranks)

**Formula:**
```
Left Leg G1 Bonus = Left Volume × Sponsor's G1 Rate
Right Leg G1 Bonus = Right Volume × Sponsor's G1 Rate
```

**Example (Silver rank, 10% rate):**
- Left Volume: 500 PV
- Right Volume: 300 PV
- Left Leg G1 Bonus: 500 × 10% = $50.00
- Right Leg G1 Bonus: 300 × 10% = $30.00

### Step 4: Calculate G2 Binary Bonus (Manager+ Only)

**Formula:**
```
For each G2 downline (child of G1 downline):
  G2 Bonus = Leg Volume × Sponsor's G2 Rate

Left Leg G2 Bonus = Sum of all G2 bonuses from left leg
Right Leg G2 Bonus = Sum of all G2 bonuses from right leg
```

**Example (Director rank, 3% G2 rate):**
- Left Volume: 1,000 PV
- Left G1 downline has 2 G2 downlines (both non-Member rank)
- Left Leg G2 Bonus: (1,000 × 3%) × 2 = $60.00

### Step 5: Calculate Total Binary Bonus

**Formula:**
```
Left Leg Total Bonus = Left Leg G1 Bonus + Left Leg G2 Bonus
Right Leg Total Bonus = Right Leg G1 Bonus + Right Leg G2 Bonus
Total Binary Bonus = Left Leg Total Bonus + Right Leg Total Bonus
```

---

## Detailed Flow by Rank

### 1. Member Rank
- **G1 Rate:** 0%
- **G2 Rate:** N/A
- **Qualification:** None required
- **Result:** No Binary Bonus earned

### 2. Bronze Rank
- **G1 Rate:** 8%
- **G2 Rate:** N/A (not eligible)
- **Qualification:** 60 PV personal + 20 PV group
- **Calculation:**
  ```
  Left Leg Bonus = Left Volume × 8%
  Right Leg Bonus = Right Volume × 8%
  Total = Left Leg Bonus + Right Leg Bonus
  ```
- **Example:**
  - Left: 200 PV → $16.00
  - Right: 150 PV → $12.00
  - **Total: $28.00**

### 3. Silver Rank
- **G1 Rate:** 10%
- **G2 Rate:** N/A (not eligible)
- **Qualification:** 100 PV personal + 20 PV group
- **Calculation:**
  ```
  Left Leg Bonus = Left Volume × 10%
  Right Leg Bonus = Right Volume × 10%
  Total = Left Leg Bonus + Right Leg Bonus
  ```
- **Example:**
  - Left: 500 PV → $50.00
  - Right: 300 PV → $30.00
  - **Total: $80.00**

### 4. Gold Rank
- **G1 Rate:** 14%
- **G2 Rate:** N/A (not eligible)
- **Qualification:** 500 PV personal + 20 PV group
- **Calculation:**
  ```
  Left Leg Bonus = Left Volume × 14%
  Right Leg Bonus = Right Volume × 14%
  Total = Left Leg Bonus + Right Leg Bonus
  ```
- **Example:**
  - Left: 1,000 PV → $140.00
  - Right: 800 PV → $112.00
  - **Total: $252.00**

### 5. Diamond Rank
- **G1 Rate:** 17%
- **G2 Rate:** N/A (not eligible)
- **Qualification:** 1,000 PV personal + 20 PV group
- **Calculation:**
  ```
  Left Leg Bonus = Left Volume × 17%
  Right Leg Bonus = Right Volume × 17%
  Total = Left Leg Bonus + Right Leg Bonus
  ```
- **Example:**
  - Left: 2,000 PV → $340.00
  - Right: 1,500 PV → $255.00
  - **Total: $595.00**

### 6. Manager Rank
- **G1 Rate:** 17%
- **G2 Rate:** 1%
- **Qualification:** 1,000 PV personal + 40 PV group
- **Calculation:**
  ```
  Left Leg G1 Bonus = Left Volume × 17%
  Right Leg G1 Bonus = Right Volume × 17%
  
  Left Leg G2 Bonus = (Left Volume × 1%) × Number of G2 Downlines
  Right Leg G2 Bonus = (Right Volume × 1%) × Number of G2 Downlines
  
  Left Leg Total = Left Leg G1 Bonus + Left Leg G2 Bonus
  Right Leg Total = Right Leg G1 Bonus + Right Leg G2 Bonus
  Total = Left Leg Total + Right Leg Total
  ```
- **Example:**
  - Left: 3,000 PV, 2 G2 downlines → G1: $510.00, G2: $60.00 → **$570.00**
  - Right: 2,500 PV, 1 G2 downline → G1: $425.00, G2: $25.00 → **$450.00**
  - **Total: $1,020.00**

### 7. Director Rank
- **G1 Rate:** 17%
- **G2 Rate:** 3%
- **Qualification:** 1,000 PV personal + 40 PV group
- **Calculation:**
  ```
  Left Leg G1 Bonus = Left Volume × 17%
  Right Leg G1 Bonus = Right Volume × 17%
  
  Left Leg G2 Bonus = (Left Volume × 3%) × Number of G2 Downlines
  Right Leg G2 Bonus = (Right Volume × 3%) × Number of G2 Downlines
  
  Left Leg Total = Left Leg G1 Bonus + Left Leg G2 Bonus
  Right Leg Total = Right Leg G1 Bonus + Right Leg G2 Bonus
  Total = Left Leg Total + Right Leg Total
  ```
- **Example:**
  - Left: 5,000 PV, 3 G2 downlines → G1: $850.00, G2: $450.00 → **$1,300.00**
  - Right: 4,000 PV, 2 G2 downlines → G1: $680.00, G2: $240.00 → **$920.00**
  - **Total: $2,220.00**

### 8. President Rank
- **G1 Rate:** 17%
- **G2 Rate:** 3%
- **Qualification:** 1,000 PV personal + 40 PV group
- **Calculation:** Same as Director
- **Example:**
  - Left: 6,000 PV, 4 G2 downlines → G1: $1,020.00, G2: $720.00 → **$1,740.00**
  - Right: 5,000 PV, 3 G2 downlines → G1: $850.00, G2: $450.00 → **$1,300.00**
  - **Total: $3,040.00**

### 9. Double President Rank
- **G1 Rate:** 17%
- **G2 Rate:** 3%
- **Qualification:** 1,000 PV personal + 40 PV group
- **Calculation:** Same as Director/President
- **Example:**
  - Left: 10,000 PV, 5 G2 downlines → G1: $1,700.00, G2: $1,500.00 → **$3,200.00**
  - Right: 8,000 PV, 4 G2 downlines → G1: $1,360.00, G2: $960.00 → **$2,320.00**
  - **Total: $5,520.00**

---

## Important Notes

### 1. Rate Determination
- Binary Bonus rate is based on **sponsor's rank**, NOT downline's rank
- Example: A Silver sponsor (10%) gets 10% of their leg volumes, regardless of their downlines' ranks

### 2. Leg Independence
- Left and Right legs are calculated **separately**
- Each leg gets its own Binary Bonus entry in the commission breakdown
- Total Binary Bonus = Sum of both legs

### 3. G2 Binary Bonus Eligibility
- **Only Manager+ ranks** get G2 Binary Bonus
- G2 downlines must be **non-Member rank** to count
- Each G2 downline generates a separate G2 bonus based on the leg's volume

### 4. Volume Calculation
- Leg volumes include **all downlines** in that leg (entire subtree)
- Volumes are calculated from **completed/delivered orders** only
- PV comes from order items, not just order amounts

### 5. Maintenance Payment
- ✅ **Binary Bonus does NOT require maintenance payment**
- ❌ Maintenance is ONLY required for Matching Bonus
- This is a key difference between Binary Bonus and Matching Bonus

### 6. Qualification Check
- Qualification is checked **before** calculating Binary Bonus
- If qualification is not met, Binary Bonus = $0.00
- Qualification requires BOTH personal PV AND group PV thresholds

---

## Commission Entry Structure

Each Binary Bonus commission entry includes:

```typescript
{
  type: 'binary_bonus',
  amount: number, // Leg bonus amount
  description: string, // e.g., "Binary Bonus (Left Leg): 500 PV × 10% (Silver) = $50.00"
  metadata: {
    leg: 'left' | 'right',
    sponsorRank: string,
    legVolume: number,
    binaryRate: number, // G1 rate
    g1Bonus: number,
    g2Rate: number, // G2 rate (0 for non-Manager+)
    g2Bonus: number,
    totalBonus: number,
    leftVolume: number,
    rightVolume: number,
    carryover: {
      left: number, // Left volume - weaker leg
      right: number // Right volume - weaker leg
    }
  }
}
```

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Binary Bonus Calculation                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  1. Check Member Eligibility          │
        │     - Active & not deleted            │
        │     - Not superadmin                  │
        │     - Has downlines                   │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  2. Calculate Leg Volumes              │
        │     - Left Leg Volume                 │
        │     - Right Leg Volume                │
        │     - Get G1 downlines                │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  3. Check Qualification               │
        │     - Personal PV ≥ Required          │
        │     - Group PV ≥ Required             │
        └───────────────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    │               │
            ┌───────▼───────┐ ┌─────▼──────┐
            │  Left Leg     │ │ Right Leg  │
            │  Calculation  │ │ Calculation│
            └───────┬───────┘ └─────┬──────┘
                    │               │
        ┌───────────┴───────────────┴───────────┐
        │  4. Calculate G1 Binary Bonus        │
        │     Left: Left Volume × G1 Rate      │
        │     Right: Right Volume × G1 Rate     │
        └───────────┬───────────────┬───────────┘
                    │               │
        ┌───────────┴───────────────┴───────────┐
        │  5. Calculate G2 Binary Bonus         │
        │     (Manager+ only)                   │
        │     Left: (Left Volume × G2 Rate) ×   │
        │           Number of G2 Downlines      │
        │     Right: (Right Volume × G2 Rate) × │
        │            Number of G2 Downlines     │
        └───────────┬───────────────┬───────────┘
                    │               │
        ┌───────────┴───────────────┴───────────┐
        │  6. Calculate Total                   │
        │     Left Total = G1 + G2              │
        │     Right Total = G1 + G2             │
        │     Total = Left + Right              │
        └───────────┬───────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────────┐
        │  7. Create Commission Entries          │
        │     - Left Leg Binary Bonus            │
        │     - Right Leg Binary Bonus           │
        │     - Credit to Wallet                 │
        │     - Add to E-Cash                    │
        └───────────────────────────────────────┘
```

---

## Summary Table

| Rank | G1 Rate | G2 Rate | Personal PV | Group PV | Example Total* |
|------|---------|---------|-------------|----------|----------------|
| Member | 0% | N/A | 0 | 0 | $0.00 |
| Bronze | 8% | N/A | 60 | 20 | $28.00 |
| Silver | 10% | N/A | 100 | 20 | $80.00 |
| Gold | 14% | N/A | 500 | 20 | $252.00 |
| Diamond | 17% | N/A | 1,000 | 20 | $595.00 |
| Manager | 17% | 1% | 1,000 | 40 | $1,020.00 |
| Director | 17% | 3% | 1,000 | 40 | $2,220.00 |
| President | 17% | 3% | 1,000 | 40 | $3,040.00 |
| Double President | 17% | 3% | 1,000 | 40 | $5,520.00 |

*Examples assume typical volume scenarios and may vary based on actual leg volumes and G2 downline counts.

---

## Code Reference

The Binary Bonus calculation is implemented in:
- **File:** `src/services/commission-calculation-engine.ts`
- **Method:** `calculateMemberCommission()`
- **G1 Rate Method:** `getCommissionRate(rank)`
- **Qualification Method:** `checkQualification(rank, volumeData)`

---

**Last Updated:** Based on current codebase implementation
**Maintenance Required:** ❌ No (unlike Matching Bonus)
