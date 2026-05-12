# Binary Bonus Commission Flow - Complete Guide for All Ranks

## 📋 Overview

Binary Bonus Commission is a **two-tier commission system**:
- **G1 Binary Bonus**: Earned from direct downlines (Generation 1)
- **G2 Binary Bonus**: Additional bonus for Manager+ ranks from second-generation downlines

**Key Points:**
- ✅ Binary Bonus does **NOT** require maintenance payment (unlike Matching Bonus)
- ✅ G1 Rate is based on **sponsor's rank**
- ✅ G2 Rate is based on **sponsor's rank** (Manager+ only)
- ✅ Each leg (Left/Right) is calculated **separately**
- ✅ G2 Binary Bonus is **ONE-TIME** per G2 downline (paid when G2 first qualifies)

---

## 💰 Binary Bonus Rates by Rank

### G1 Binary Bonus Rates (All Ranks)

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

### G2 Binary Bonus Rates (Manager+ Only)

| Rank | G2 Rate | Description |
|------|---------|-------------|
| **Manager** | 1% | 1% of G2's individual PV (one-time) |
| **Director** | 3% | 3% of G2's individual PV (one-time) |
| **President** | 3% | 3% of G2's individual PV (one-time) |
| **Double President** | 3% | 3% of G2's individual PV (one-time) |

**Note:** Bronze, Silver, Gold, and Diamond ranks do **NOT** get G2 Binary Bonus.

---

## 📊 Qualification Requirements

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

## 🔄 Calculation Flow

### Step 1: Check Eligibility

```
1. Member must be active and not deleted
2. Member must NOT be superadmin
3. Member must have downlines (canEarnCommissions check)
4. Member must meet qualification requirements (personal PV + group PV)
```

### Step 2: Calculate Leg Volumes

```
1. Calculate Left Leg Volume (all downlines in left leg subtree)
2. Calculate Right Leg Volume (all downlines in right leg subtree)
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
- Left Leg G1 Bonus: 500 × 10% = **$50.00**
- Right Leg G1 Bonus: 300 × 10% = **$30.00**

### Step 4: Calculate G2 Binary Bonus (Manager+ Only)

**Formula (ONE-TIME per G2 downline):**
```
For each eligible G2 downline:
  G2 Bonus = G2's Individual PV × Sponsor's G2 Rate

Left Leg G2 Bonus = Sum of all G2 bonuses from left leg G2s
Right Leg G2 Bonus = Sum of all G2 bonuses from right leg G2s
```

**G2 Eligibility:**
- G2 downline must have **rank ≠ "Member"**
- G2 downline must have **PV > 0**
- G2 bonus is paid **ONCE** when G2 first qualifies

**Example (President rank, 3% G2 rate):**
- Left Leg G1 has 2 G2 downlines:
  - G2-1: 1000 PV → Bonus: 1000 × 3% = **$30.00**
  - G2-2: 500 PV → Bonus: 500 × 3% = **$15.00**
- Left Leg G2 Total: **$45.00**

- Right Leg G1 has 1 G2 downline:
  - G2-3: 1000 PV → Bonus: 1000 × 3% = **$30.00**
- Right Leg G2 Total: **$30.00**

### Step 5: Calculate Total Binary Bonus

**Formula:**
```
Left Leg Total Bonus = Left Leg G1 Bonus + Left Leg G2 Bonus
Right Leg Total Bonus = Right Leg G1 Bonus + Right Leg G2 Bonus
Total Binary Bonus = Left Leg Total Bonus + Right Leg Total Bonus
```

---

## 📝 Detailed Examples by Rank

### 1. Member Rank
- **G1 Rate:** 0%
- **G2 Rate:** N/A
- **Qualification:** None required
- **Result:** **$0.00** (No Binary Bonus)

---

### 2. Bronze Rank
- **G1 Rate:** 8%
- **G2 Rate:** N/A (not eligible)
- **Qualification:** 60 PV personal + 20 PV group

**Example:**
- Left Volume: 200 PV
- Right Volume: 150 PV
- Left Leg G1 Bonus: 200 × 8% = **$16.00**
- Right Leg G1 Bonus: 150 × 8% = **$12.00**
- **Total: $28.00**

---

### 3. Silver Rank
- **G1 Rate:** 10%
- **G2 Rate:** N/A (not eligible)
- **Qualification:** 100 PV personal + 20 PV group

**Example:**
- Left Volume: 500 PV
- Right Volume: 300 PV
- Left Leg G1 Bonus: 500 × 10% = **$50.00**
- Right Leg G1 Bonus: 300 × 10% = **$30.00**
- **Total: $80.00**

---

### 4. Gold Rank
- **G1 Rate:** 14%
- **G2 Rate:** N/A (not eligible)
- **Qualification:** 500 PV personal + 20 PV group

**Example:**
- Left Volume: 1,000 PV
- Right Volume: 800 PV
- Left Leg G1 Bonus: 1,000 × 14% = **$140.00**
- Right Leg G1 Bonus: 800 × 14% = **$112.00**
- **Total: $252.00**

---

### 5. Diamond Rank
- **G1 Rate:** 17%
- **G2 Rate:** N/A (not eligible)
- **Qualification:** 1,000 PV personal + 20 PV group

**Example:**
- Left Volume: 2,000 PV
- Right Volume: 1,500 PV
- Left Leg G1 Bonus: 2,000 × 17% = **$340.00**
- Right Leg G1 Bonus: 1,500 × 17% = **$255.00**
- **Total: $595.00**

---

### 6. Manager Rank
- **G1 Rate:** 17%
- **G2 Rate:** 1% (one-time per G2)
- **Qualification:** 1,000 PV personal + 40 PV group

**Example:**
- Left Volume: 3,000 PV
- Right Volume: 2,500 PV
- Left Leg G1 Bonus: 3,000 × 17% = **$510.00**
- Right Leg G1 Bonus: 2,500 × 17% = **$425.00**

**G2 Bonuses (one-time):**
- Left Leg G2s:
  - G2-1: 1000 PV → 1000 × 1% = **$10.00**
  - G2-2: 500 PV → 500 × 1% = **$5.00**
  - Left Leg G2 Total: **$15.00**
- Right Leg G2s:
  - G2-3: 1000 PV → 1000 × 1% = **$10.00**
  - Right Leg G2 Total: **$10.00**

**Final:**
- Left Total: $510.00 + $15.00 = **$525.00**
- Right Total: $425.00 + $10.00 = **$435.00**
- **Grand Total: $960.00**

---

### 7. Director Rank
- **G1 Rate:** 17%
- **G2 Rate:** 3% (one-time per G2)
- **Qualification:** 1,000 PV personal + 40 PV group

**Example:**
- Left Volume: 5,000 PV
- Right Volume: 4,000 PV
- Left Leg G1 Bonus: 5,000 × 17% = **$850.00**
- Right Leg G1 Bonus: 4,000 × 17% = **$680.00**

**G2 Bonuses (one-time):**
- Left Leg G2s:
  - G2-1: 1000 PV → 1000 × 3% = **$30.00**
  - G2-2: 1000 PV → 1000 × 3% = **$30.00**
  - G2-3: 500 PV → 500 × 3% = **$15.00**
  - Left Leg G2 Total: **$75.00**
- Right Leg G2s:
  - G2-4: 1000 PV → 1000 × 3% = **$30.00**
  - G2-5: 1000 PV → 1000 × 3% = **$30.00**
  - Right Leg G2 Total: **$60.00**

**Final:**
- Left Total: $850.00 + $75.00 = **$925.00**
- Right Total: $680.00 + $60.00 = **$740.00**
- **Grand Total: $1,665.00**

---

### 8. President Rank
- **G1 Rate:** 17%
- **G2 Rate:** 3% (one-time per G2)
- **Qualification:** 1,000 PV personal + 40 PV group
- **Calculation:** Same as Director

**Example:**
- Left Volume: 6,000 PV
- Right Volume: 5,000 PV
- Left Leg G1 Bonus: 6,000 × 17% = **$1,020.00**
- Right Leg G1 Bonus: 5,000 × 17% = **$850.00**

**G2 Bonuses (one-time):**
- Left Leg G2s:
  - G2-1: 1000 PV → 1000 × 3% = **$30.00**
  - G2-2: 1000 PV → 1000 × 3% = **$30.00**
  - G2-3: 1000 PV → 1000 × 3% = **$30.00**
  - G2-4: 500 PV → 500 × 3% = **$15.00**
  - Left Leg G2 Total: **$105.00**
- Right Leg G2s:
  - G2-5: 1000 PV → 1000 × 3% = **$30.00**
  - G2-6: 1000 PV → 1000 × 3% = **$30.00**
  - G2-7: 1000 PV → 1000 × 3% = **$30.00**
  - Right Leg G2 Total: **$90.00**

**Final:**
- Left Total: $1,020.00 + $105.00 = **$1,125.00**
- Right Total: $850.00 + $90.00 = **$940.00**
- **Grand Total: $2,065.00**

---

### 9. Double President Rank
- **G1 Rate:** 17%
- **G2 Rate:** 3% (one-time per G2)
- **Qualification:** 1,000 PV personal + 40 PV group
- **Calculation:** Same as Director/President

**Example:**
- Left Volume: 10,000 PV
- Right Volume: 8,000 PV
- Left Leg G1 Bonus: 10,000 × 17% = **$1,700.00**
- Right Leg G1 Bonus: 8,000 × 17% = **$1,360.00**

**G2 Bonuses (one-time):**
- Left Leg G2s:
  - 5 G2s × 1000 PV each → 5 × (1000 × 3%) = **$150.00**
- Right Leg G2s:
  - 4 G2s × 1000 PV each → 4 × (1000 × 3%) = **$120.00**

**Final:**
- Left Total: $1,700.00 + $150.00 = **$1,850.00**
- Right Total: $1,360.00 + $120.00 = **$1,480.00**
- **Grand Total: $3,330.00**

---

## ⚡ Auto-Calculation Triggers

G2 Binary Bonus is **automatically calculated** when:

1. **New G2 Added** - When a new member is registered under a G1 downline
2. **G2 Rank/PV Updated** - When a G2 member's rank or PV is updated
3. **PV Top-up Approved** - When admin approves a PV top-up for a G2 member
4. **PV Transfer** - When PV is transferred to a G2 member
5. **Order Completed** - When a G2 member's order is completed

**Important:** G2 Binary Bonus is paid **ONCE** per G2 downline. If a G2 member already received a bonus, they won't get another one even if their PV increases.

---

## 🎯 Key Points Summary

### 1. Rate Determination
- **G1 Rate**: Based on **sponsor's rank**, NOT downline's rank
- **G2 Rate**: Based on **sponsor's rank** (Manager+ only)
- Example: A Silver sponsor (10%) gets 10% of their leg volumes, regardless of downlines' ranks

### 2. Leg Independence
- Left and Right legs are calculated **separately**
- Each leg gets its own Binary Bonus entry in the commission breakdown
- Total Binary Bonus = Sum of both legs

### 3. G2 Binary Bonus Details
- **Only Manager+ ranks** get G2 Binary Bonus
- G2 downlines must be **non-Member rank** to count
- G2 bonus = **G2's Individual PV × Sponsor's G2 Rate**
- G2 bonus is **ONE-TIME** per G2 downline (paid when G2 first qualifies)

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

## 📊 Quick Reference Table

| Rank | G1 Rate | G2 Rate | Personal PV | Group PV | Example Total* |
|------|---------|---------|-------------|----------|----------------|
| Member | 0% | N/A | 0 | 0 | $0.00 |
| Bronze | 8% | N/A | 60 | 20 | $28.00 |
| Silver | 10% | N/A | 100 | 20 | $80.00 |
| Gold | 14% | N/A | 500 | 20 | $252.00 |
| Diamond | 17% | N/A | 1,000 | 20 | $595.00 |
| Manager | 17% | 1% | 1,000 | 40 | $960.00 |
| Director | 17% | 3% | 1,000 | 40 | $1,665.00 |
| President | 17% | 3% | 1,000 | 40 | $2,065.00 |
| Double President | 17% | 3% | 1,000 | 40 | $3,330.00 |

*Examples assume typical volume scenarios and may vary based on actual leg volumes and G2 downline counts.

---

## 🔍 Commission Entry Structure

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
    rightVolume: number
  }
}
```

**G2 Binary Bonus entries (separate):**
```typescript
{
  type: 'binary_bonus',
  amount: number, // G2 bonus amount (one-time)
  description: string, // e.g., "G2 Binary Bonus: ADMIN004 (1000 PV × 3%) = $30.00"
  status: 'Paid',
  date: Date
}
```

---

## 📚 Code Reference

The Binary Bonus calculation is implemented in:
- **G1 Calculation:** `src/services/commission-calculation-engine.ts` → `calculateMemberCommission()`
- **G2 Auto-Calculation:** `src/services/g2-binary-bonus-auto-calc.ts` → `autoCalculateG2BinaryBonus()`
- **G1 Rate Method:** `getCommissionRate(rank)`
- **Qualification Method:** `checkQualification(rank, volumeData)`

---

**Last Updated:** Based on current codebase implementation  
**Maintenance Required:** ❌ No (unlike Matching Bonus)  
**G2 Bonus Type:** ✅ One-time per G2 downline (paid when G2 first qualifies)
