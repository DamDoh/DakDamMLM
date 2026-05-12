# Stockist Commission Flow Examples - Complete Guide

This document provides step-by-step example flows for all stockist levels (S, M, C, D) showing exactly how commissions are calculated in both scenarios.

---

## 📋 Quick Reference

### Commission Rates
- **S (Small Mobile)**: 0.8% base
- **M (Mobile)**: 1.7% base
- **C (Center)**: 2.6% base
- **D (Dealer)**: 3.0% base

### Photo 2 Rules (Binary Stock Page)
- **S**: Can sell to regular users (0.8%), but **NOT to M, C, D** (0% commission)
- **M**: Can sell to regular users (1.7%), S (0.9%), but **NOT to C, D** (0% commission)
- **C**: Can sell to regular users (2.6%), M (0.9%), S (1.8%), but **NOT to D** (0% commission)
- **D**: Can sell to regular users (3%), C (0.4%), M (1.3%), S (2.2%)

---

## 🔄 Example Flows

### Example 1: Level S (Small Mobile) - 0.8%

#### Flow A: My Stock Page Transfer
```
1. User Action: Level S stockist clicks "Transfer to Downline" on My Stock page
2. Selects: 1,000 PV worth of products
3. Selects Recipient: Any downline member (regular user or any stockist level)
4. Commission Mode: 'base'
5. Commission Calculation:
   - Seller Level: S
   - Commission Rate: 0.8% (base rate - always same)
   - PV: 1,000
   - Commission = 1,000 × 0.8% = $8.00
6. Result: ✅ Earns $8.00 commission
```

#### Flow B: Binary Stock Page Transfer
```
1. User Action: Level S stockist clicks on downline member in binary tree
2. Selects: 1,000 PV worth of products
3. Selects Recipient: Any downline member
4. Commission Mode: 'differential' (Photo 2 rules)
5. Commission Calculation:
   - Seller Level: S
   - Recipient Level: Regular User (no stockist level)
   - Commission Rate: 0.8% (base rate)
   - PV: 1,000
   - Commission = 1,000 × 0.8% = $8.00
6. Result: ✅ Earns $8.00 commission

OR if recipient is M, C, or D level:
5. Commission Calculation:
   - Seller Level: S
   - Recipient Level: M (or C, or D)
   - Commission Rate: 0% (Photo 2: S cannot sell to M, C, D)
   - PV: 1,000
   - Commission = 1,000 × 0% = $0.00
6. Result: ❌ NO COMMISSION ($0.00)
```

---

### Example 2: Level M (Mobile) - 1.7% Base

#### Flow A: My Stock Page Transfer
```
1. User Action: Level M stockist clicks "Transfer to Downline" on My Stock page
2. Selects: 1,000 PV worth of products
3. Selects Recipient: Any downline member
4. Commission Mode: 'base'
5. Commission Calculation:
   - Seller Level: M
   - Commission Rate: 1.7% (base rate - always same)
   - PV: 1,000
   - Commission = 1,000 × 1.7% = $17.00
6. Result: ✅ Earns $17.00 commission (regardless of recipient level)
```

#### Flow B: Binary Stock Page Transfer - Different Scenarios

**Scenario B1: Transfer to Regular User**
```
1. User Action: Level M stockist clicks on regular user in binary tree
2. Selects: 1,000 PV worth of products
3. Commission Mode: 'differential'
4. Commission Calculation:
   - Seller Level: M
   - Recipient Level: None (regular user)
   - Commission Rate: 1.7% (base rate for regular users)
   - PV: 1,000
   - Commission = 1,000 × 1.7% = $17.00
5. Result: ✅ Earns $17.00 commission
```

**Scenario B2: Transfer to S Level Stockist**
```
1. User Action: Level M stockist clicks on S level downline in binary tree
2. Selects: 1,000 PV worth of products
3. Commission Mode: 'differential'
4. Commission Calculation:
   - Seller Level: M
   - Recipient Level: S
   - Commission Rate: 0.9% (differential rate M→S)
   - PV: 1,000
   - Commission = 1,000 × 0.9% = $9.00
5. Result: ✅ Earns $9.00 commission
```

**Scenario B3: Transfer to M, C, or D Level Stockist**
```
1. User Action: Level M stockist clicks on M/C/D level downline in binary tree
2. Selects: 1,000 PV worth of products
3. Commission Mode: 'differential'
4. Commission Calculation:
   - Seller Level: M
   - Recipient Level: M (or C, or D)
   - Commission Rate: 0% (Photo 2: M cannot sell to C or D - "can't get any commission")
   - PV: 1,000
   - Commission = 1,000 × 0% = $0.00
5. Result: ❌ NO COMMISSION ($0.00)
```

---

### Example 3: Level C (Center) - 2.6% Base

#### Flow A: My Stock Page Transfer
```
1. User Action: Level C stockist clicks "Transfer to Downline" on My Stock page
2. Selects: 1,000 PV worth of products
3. Selects Recipient: Any downline member
4. Commission Mode: 'base'
5. Commission Calculation:
   - Seller Level: C
   - Commission Rate: 2.6% (base rate - always same)
   - PV: 1,000
   - Commission = 1,000 × 2.6% = $26.00
6. Result: ✅ Earns $26.00 commission (regardless of recipient level)
```

#### Flow B: Binary Stock Page Transfer - Different Scenarios

**Scenario B1: Transfer to Regular User**
```
1. User Action: Level C stockist clicks on regular user in binary tree
2. Selects: 1,000 PV worth of products
3. Commission Mode: 'differential'
4. Commission Calculation:
   - Seller Level: C
   - Recipient Level: None (regular user)
   - Commission Rate: 2.6% (base rate for regular users)
   - PV: 1,000
   - Commission = 1,000 × 2.6% = $26.00
5. Result: ✅ Earns $26.00 commission
```

**Scenario B2: Transfer to S Level Stockist**
```
1. User Action: Level C stockist clicks on S level downline in binary tree
2. Selects: 1,000 PV worth of products
3. Commission Mode: 'differential'
4. Commission Calculation:
   - Seller Level: C
   - Recipient Level: S
   - Commission Rate: 1.8% (differential rate C→S)
   - PV: 1,000
   - Commission = 1,000 × 1.8% = $18.00
5. Result: ✅ Earns $18.00 commission
```

**Scenario B3: Transfer to M Level Stockist**
```
1. User Action: Level C stockist clicks on M level downline in binary tree
2. Selects: 1,000 PV worth of products
3. Commission Mode: 'differential'
4. Commission Calculation:
   - Seller Level: C
   - Recipient Level: M
   - Commission Rate: 0.9% (differential rate C→M)
   - PV: 1,000
   - Commission = 1,000 × 0.9% = $9.00
5. Result: ✅ Earns $9.00 commission
```

**Scenario B4: Transfer to C or D Level Stockist**
```
1. User Action: Level C stockist clicks on C or D level downline in binary tree
2. Selects: 1,000 PV worth of products
3. Commission Mode: 'differential'
4. Commission Calculation:
   - Seller Level: C
   - Recipient Level: C (or D)
   - Commission Rate: 0% (Photo 2: C cannot sell to D - "can't get any commission")
   - PV: 1,000
   - Commission = 1,000 × 0% = $0.00
5. Result: ❌ NO COMMISSION ($0.00)
```

---

### Example 4: Level D (Dealer) - 3.0% Base

#### Flow A: My Stock Page Transfer
```
1. User Action: Level D stockist clicks "Transfer to Downline" on My Stock page
2. Selects: 1,000 PV worth of products
3. Selects Recipient: Any downline member
4. Commission Mode: 'base'
5. Commission Calculation:
   - Seller Level: D
   - Commission Rate: 3.0% (base rate - always same)
   - PV: 1,000
   - Commission = 1,000 × 3.0% = $30.00
6. Result: ✅ Earns $30.00 commission (regardless of recipient level)
```

#### Flow B: Binary Stock Page Transfer - Different Scenarios

**Scenario B1: Transfer to Regular User**
```
1. User Action: Level D stockist clicks on regular user in binary tree
2. Selects: 1,000 PV worth of products
3. Commission Mode: 'differential'
4. Commission Calculation:
   - Seller Level: D
   - Recipient Level: None (regular user)
   - Commission Rate: 3.0% (base rate for regular users)
   - PV: 1,000
   - Commission = 1,000 × 3.0% = $30.00
5. Result: ✅ Earns $30.00 commission
```

**Scenario B2: Transfer to S Level Stockist**
```
1. User Action: Level D stockist clicks on S level downline in binary tree
2. Selects: 1,000 PV worth of products
3. Commission Mode: 'differential'
4. Commission Calculation:
   - Seller Level: D
   - Recipient Level: S
   - Commission Rate: 2.2% (differential rate D→S)
   - PV: 1,000
   - Commission = 1,000 × 2.2% = $22.00
5. Result: ✅ Earns $22.00 commission
```

**Scenario B3: Transfer to M Level Stockist**
```
1. User Action: Level D stockist clicks on M level downline in binary tree
2. Selects: 1,000 PV worth of products
3. Commission Mode: 'differential'
4. Commission Calculation:
   - Seller Level: D
   - Recipient Level: M
   - Commission Rate: 1.3% (differential rate D→M)
   - PV: 1,000
   - Commission = 1,000 × 1.3% = $13.00
5. Result: ✅ Earns $13.00 commission
```

**Scenario B4: Transfer to C Level Stockist**
```
1. User Action: Level D stockist clicks on C level downline in binary tree
2. Selects: 1,000 PV worth of products
3. Commission Mode: 'differential'
4. Commission Calculation:
   - Seller Level: D
   - Recipient Level: C
   - Commission Rate: 0.4% (differential rate D→C)
   - PV: 1,000
   - Commission = 1,000 × 0.4% = $4.00
5. Result: ✅ Earns $4.00 commission
```

**Scenario B5: Transfer to D Level Stockist**
```
1. User Action: Level D stockist clicks on D level downline in binary tree
2. Selects: 1,000 PV worth of products
3. Commission Mode: 'differential'
4. Commission Calculation:
   - Seller Level: D
   - Recipient Level: D (same level)
   - Commission Rate: 0% (same level - no commission)
   - PV: 1,000
   - Commission = 1,000 × 0% = $0.00
5. Result: ❌ NO COMMISSION ($0.00)
```

---

## 📊 Summary Table

### My Stock Page (Base Rates - Always Same)
| Seller Level | PV Transferred | Commission Rate | Commission Earned |
|--------------|----------------|-----------------|-------------------|
| S            | 1,000          | 0.8%            | $8.00             |
| M            | 1,000          | 1.7%            | $17.00            |
| C            | 1,000          | 2.6%            | $26.00            |
| D            | 1,000          | 3.0%            | $30.00            |

### Binary Stock Page (Photo 2 Rules - Varies by Recipient)
| Seller | Recipient      | Commission Rate | PV    | Commission | Notes                    |
|--------|----------------|-----------------|-------|------------|--------------------------|
| S      | Regular User   | 0.8%            | 1,000 | $8.00      | Base rate                |
| S      | M, C, or D     | 0%              | 1,000 | $0.00      | ❌ NO COMMISSION         |
| M      | Regular User   | 1.7%            | 1,000 | $17.00     | Base rate                |
| M      | S              | 0.9%            | 1,000 | $9.00      | Differential rate        |
| M      | M, C, or D     | 0%              | 1,000 | $0.00      | ❌ NO COMMISSION         |
| C      | Regular User   | 2.6%            | 1,000 | $26.00     | Base rate                |
| C      | S              | 1.8%            | 1,000 | $18.00     | Differential rate        |
| C      | M              | 0.9%            | 1,000 | $9.00      | Differential rate        |
| C      | C or D         | 0%              | 1,000 | $0.00      | ❌ NO COMMISSION         |
| D      | Regular User   | 3.0%            | 1,000 | $30.00     | Base rate                |
| D      | S              | 2.2%            | 1,000 | $22.00     | Differential rate        |
| D      | M              | 1.3%            | 1,000 | $13.00     | Differential rate        |
| D      | C              | 0.4%            | 1,000 | $4.00      | Differential rate        |
| D      | D              | 0%              | 1,000 | $0.00      | ❌ NO COMMISSION (same)  |

---

## 🔑 Key Points

1. **My Stock Page**: Always uses base rates (0.8%, 1.7%, 2.6%, 3.0%) regardless of recipient level
2. **Binary Stock Page**: Uses Photo 2 rules with differential rates and "no commission" restrictions
3. **No Commission Cases** (Binary Stock Page only):
   - S → M, C, D: $0.00
   - M → M, C, D: $0.00
   - C → C, D: $0.00
   - D → D: $0.00 (same level)
4. **Transfer Restrictions**: Lower levels cannot transfer to higher levels (enforced by `canTransferStock()`)

---

## 💡 Real-World Example

**Scenario**: Level C stockist wants to transfer stock

**On My Stock Page**:
- Transfers 5,000 PV to any downline → Earns $130.00 (5,000 × 2.6%)

**On Binary Stock Page**:
- Transfers 5,000 PV to regular user → Earns $130.00 (5,000 × 2.6%)
- Transfers 5,000 PV to S level → Earns $90.00 (5,000 × 1.8%)
- Transfers 5,000 PV to M level → Earns $45.00 (5,000 × 0.9%)
- Transfers 5,000 PV to C or D level → Earns $0.00 (NO COMMISSION)
