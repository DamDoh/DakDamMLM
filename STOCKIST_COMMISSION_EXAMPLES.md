# Stockist Commission Examples - All Levels (S, M, C, D)

This document provides example flows for how commissions work for each stockist level in both scenarios.

## Base Commission Rates (All Levels)
- **S (Small Mobile)**: 0.8% per PV
- **M (Mobile)**: 1.7% per PV
- **C (Center)**: 2.6% per PV
- **D (Dealer)**: 3.0% per PV

## Differential Commission Rates (Binary Stock Page Only)
- **M transferring TO S**: 0.9% (not 1.7%)
- **C transferring TO M**: 0.9% (not 2.6%)
- **C transferring TO S**: 1.8% (not 2.6%)
- **D transferring TO C**: 0.4% (not 3.0%)
- **D transferring TO M**: 1.3% (not 3.0%)
- **D transferring TO S**: 2.2% (not 3.0%)

---

## Example Flows by Stockist Level

### Level S (Small Mobile) - 0.8% Base Rate

#### Scenario 1: My Stock Page - Transfer to Downline
**Action**: Level S stockist transfers 1,000 PV worth of stock to a downline member

**Commission Calculation**:
- **Seller Level**: S
- **Recipient Level**: Any (regular user or any stockist level)
- **Commission Mode**: `'base'` (My Stock Page)
- **Commission Rate**: 0.8% (base rate for S)
- **PV Transferred**: 1,000 PV
- **Commission Earned**: 1,000 × 0.8% = **$8.00**

**Result**: Level S earns $8.00 commission regardless of recipient's level.

---

#### Scenario 2: Binary Stock Page - Transfer to Downline
**Action**: Level S stockist transfers 1,000 PV worth of stock to a downline member

**Commission Calculation**:
- **Seller Level**: S
- **Recipient Level**: Any (regular user or any stockist level)
- **Commission Mode**: `'differential'` (Binary Stock Page)
- **Commission Rate**: 0.8% (S has no differential rates, always uses base)
- **PV Transferred**: 1,000 PV
- **Commission Earned**: 1,000 × 0.8% = **$8.00**

**Result**: Level S earns $8.00 commission (same as My Stock Page since S has no differential rates).

---

### Level M (Mobile) - 1.7% Base Rate

#### Scenario 1: My Stock Page - Transfer to Downline
**Action**: Level M stockist transfers 1,000 PV worth of stock to a downline member

**Commission Calculation**:
- **Seller Level**: M
- **Recipient Level**: Any (regular user, S, M, C, or D)
- **Commission Mode**: `'base'` (My Stock Page)
- **Commission Rate**: 1.7% (base rate for M)
- **PV Transferred**: 1,000 PV
- **Commission Earned**: 1,000 × 1.7% = **$17.00**

**Result**: Level M earns $17.00 commission regardless of recipient's level.

**Examples**:
- M → Regular User: $17.00
- M → S level: $17.00
- M → M level: $17.00 (if allowed)
- M → C level: $17.00 (if allowed)
- M → D level: $17.00 (if allowed)

---

#### Scenario 2: Binary Stock Page - Transfer to Different Recipients

**Example 2a: M transferring TO Regular User**
- **Commission Rate**: 1.7% (base rate - no stockist level recipient)
- **PV Transferred**: 1,000 PV
- **Commission Earned**: 1,000 × 1.7% = **$17.00**

**Example 2b: M transferring TO S level stockist**
- **Commission Rate**: 0.9% (differential rate for M→S)
- **PV Transferred**: 1,000 PV
- **Commission Earned**: 1,000 × 0.9% = **$9.00**

**Example 2c: M transferring TO M, C, or D level**
- **Commission Rate**: 0% (Photo 2: M cannot sell to C or D - "can't get any commission")
- **PV Transferred**: 1,000 PV
- **Commission Earned**: 1,000 × 0% = **$0.00** (NO COMMISSION)

**Summary for Level M**:
- My Stock Page: Always $17.00 (1.7%)
- Binary Stock Page → Regular User: $17.00 (1.7%)
- Binary Stock Page → S level: $9.00 (0.9%)
- Binary Stock Page → M/C/D level: $0.00 (0% - NO COMMISSION per Photo 2)

---

### Level C (Center) - 2.6% Base Rate

#### Scenario 1: My Stock Page - Transfer to Downline
**Action**: Level C stockist transfers 1,000 PV worth of stock to a downline member

**Commission Calculation**:
- **Seller Level**: C
- **Recipient Level**: Any (regular user, S, M, C, or D)
- **Commission Mode**: `'base'` (My Stock Page)
- **Commission Rate**: 2.6% (base rate for C)
- **PV Transferred**: 1,000 PV
- **Commission Earned**: 1,000 × 2.6% = **$26.00**

**Result**: Level C earns $26.00 commission regardless of recipient's level.

**Examples**:
- C → Regular User: $26.00
- C → S level: $26.00
- C → M level: $26.00
- C → C level: $26.00 (if allowed)
- C → D level: $26.00 (if allowed)

---

#### Scenario 2: Binary Stock Page - Transfer to Different Recipients

**Example 2a: C transferring TO Regular User**
- **Commission Rate**: 2.6% (base rate - no stockist level recipient)
- **PV Transferred**: 1,000 PV
- **Commission Earned**: 1,000 × 2.6% = **$26.00**

**Example 2b: C transferring TO S level stockist**
- **Commission Rate**: 1.8% (differential rate for C→S)
- **PV Transferred**: 1,000 PV
- **Commission Earned**: 1,000 × 1.8% = **$18.00**

**Example 2c: C transferring TO M level stockist**
- **Commission Rate**: 0.9% (differential rate for C→M)
- **PV Transferred**: 1,000 PV
- **Commission Earned**: 1,000 × 0.9% = **$9.00**

**Example 2d: C transferring TO C or D level**
- **Commission Rate**: 0% (Photo 2: C cannot sell to D - "can't get any commission")
- **PV Transferred**: 1,000 PV
- **Commission Earned**: 1,000 × 0% = **$0.00** (NO COMMISSION)

**Summary for Level C**:
- My Stock Page: Always $26.00 (2.6%)
- Binary Stock Page → Regular User: $26.00 (2.6%)
- Binary Stock Page → S level: $18.00 (1.8%)
- Binary Stock Page → M level: $9.00 (0.9%)
- Binary Stock Page → C/D level: $0.00 (0% - NO COMMISSION per Photo 2)

---

### Level D (Dealer) - 3.0% Base Rate

#### Scenario 1: My Stock Page - Transfer to Downline
**Action**: Level D stockist transfers 1,000 PV worth of stock to a downline member

**Commission Calculation**:
- **Seller Level**: D
- **Recipient Level**: Any (regular user, S, M, C, or D)
- **Commission Mode**: `'base'` (My Stock Page)
- **Commission Rate**: 3.0% (base rate for D)
- **PV Transferred**: 1,000 PV
- **Commission Earned**: 1,000 × 3.0% = **$30.00**

**Result**: Level D earns $30.00 commission regardless of recipient's level.

---

#### Scenario 2: Binary Stock Page - Transfer to Different Recipients

**Example 2a: D transferring TO Regular User**
- **Commission Rate**: 3.0% (base rate - no stockist level recipient)
- **PV Transferred**: 1,000 PV
- **Commission Earned**: 1,000 × 3.0% = **$30.00**

**Example 2b: D transferring TO S level stockist**
- **Commission Rate**: 2.2% (differential rate for D→S)
- **PV Transferred**: 1,000 PV
- **Commission Earned**: 1,000 × 2.2% = **$22.00**

**Example 2c: D transferring TO M level stockist**
- **Commission Rate**: 1.3% (differential rate for D→M)
- **PV Transferred**: 1,000 PV
- **Commission Earned**: 1,000 × 1.3% = **$13.00**

**Example 2d: D transferring TO C level stockist**
- **Commission Rate**: 0.4% (differential rate for D→C)
- **PV Transferred**: 1,000 PV
- **Commission Earned**: 1,000 × 0.4% = **$4.00**

**Example 2e: D transferring TO D level**
- **Commission Rate**: 3.0% (base rate - no differential rate defined)
- **PV Transferred**: 1,000 PV
- **Commission Earned**: 1,000 × 3.0% = **$30.00**

**Summary for Level D**:
- My Stock Page: Always $30.00 (3.0%)
- Binary Stock Page → Regular User: $30.00 (3.0%)
- Binary Stock Page → S level: $22.00 (2.2%)
- Binary Stock Page → M level: $13.00 (1.3%)
- Binary Stock Page → C level: $4.00 (0.4%)
- Binary Stock Page → D level: $30.00 (3.0%)

---

## Quick Reference Table

### My Stock Page (Base Rates - Always Same)
| Seller Level | Commission Rate | Example (1,000 PV) |
|--------------|----------------|-------------------|
| S            | 0.8%           | $8.00             |
| M            | 1.7%           | $17.00            |
| C            | 2.6%           | $26.00            |
| D            | 3.0%           | $30.00            |

### Binary Stock Page (Differential Rates - Photo 2 Rules)
| Seller → Recipient | Commission Rate | Example (1,000 PV) | Notes |
|-------------------|-----------------|-------------------|-------|
| S → Regular User  | 0.8%            | $8.00             | Base rate |
| S → M/C/D         | 0%              | $0.00             | **NO COMMISSION** (Photo 2) |
| M → Regular User  | 1.7%            | $17.00            | Base rate |
| M → S             | 0.9%            | $9.00             | Differential rate |
| M → M/C/D         | 0%              | $0.00             | **NO COMMISSION** (Photo 2: "can't sell to C or D") |
| C → Regular User  | 2.6%            | $26.00            | Base rate |
| C → S             | 1.8%            | $18.00            | Differential rate |
| C → M             | 0.9%            | $9.00             | Differential rate |
| C → C/D           | 0%              | $0.00             | **NO COMMISSION** (Photo 2: "can't sell to D") |
| D → Regular User  | 3.0%            | $30.00            | Base rate |
| D → S             | 2.2%            | $22.00            | Differential rate |
| D → M             | 1.3%            | $13.00            | Differential rate |
| D → C             | 0.4%            | $4.00             | Differential rate |
| D → D             | 0%              | $0.00             | **NO COMMISSION** (same level) |

---

## Transfer Restrictions

Remember: Lower-level stockists **cannot** transfer to higher-level stockists:
- **S** cannot transfer to M, C, or D
- **M** cannot transfer to C or D
- **C** cannot transfer to D
- **D** can transfer to anyone (highest level)

These restrictions are enforced by the `canTransferStock()` function.
