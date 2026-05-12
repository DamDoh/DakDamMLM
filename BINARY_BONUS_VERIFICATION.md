# Binary Bonus - Complete Understanding & Examples

## ✅ How Binary Bonus Works - VERIFIED

### Formula Breakdown:

**G1 Binary Bonus:**
- Based on: **Direct downline's rank** (not sponsor's rank)
- Uses: Weaker leg PV × G1 rate
- G1 Rates: Bronze=8%, Silver=10%, Gold=14%, Diamond=17%

**G2 Binary Bonus (Manager+ only):**
- Based on: **Sponsor's rank** (Manager=1%, Director/President=3%)
- Uses: Weaker leg PV × G2 rate × Number of G2 downlines
- Only counts: G2 downlines with rank ≠ 'Member'

---

## 📝 Example: RiThy VoNg (Manager) Scenario

### Tree Structure:
```
            RiThy VoNg (Manager)
                 /         \
        Da Pheak (Bronze)  So ra (Silver)
           /    \            /    \
      MEM004  MEM005    MEM006  MEM007
     (Silver) (Gold)  (Bronze) (Silver)
```

### Given Data:
- Left Leg Total PV: 500 PV
- Right Leg Total PV: 300 PV  
- **Weaker Leg PV: 300 PV** (minimum)

### Calculation:

#### LEFT LEG:
- **G1 Downline**: Da Pheak (Bronze) → 8% rate
- **G2 Downlines**: MEM004 (Silver), MEM005 (Gold) → 2 downlines
- **Manager G2 Rate**: 1%

**Left Leg Calculation:**
- G1 Bonus: 300 PV × 8% = **$24.00**
- G2 Bonus: 300 PV × 1% × 2 downlines = **$6.00**
- **Left Leg Total: $30.00**

#### RIGHT LEG:
- **G1 Downline**: So ra (Silver) → 10% rate
- **G2 Downlines**: MEM006 (Bronze), MEM007 (Silver) → 2 downlines
- **Manager G2 Rate**: 1%

**Right Leg Calculation:**
- G1 Bonus: 300 PV × 10% = **$30.00**
- G2 Bonus: 300 PV × 1% × 2 downlines = **$6.00**
- **Right Leg Total: $36.00**

### 🎯 FINAL RESULT:
**Total Binary Bonus = $30.00 + $36.00 = $66.00**

---

## ✅ Implementation Verification

The code correctly implements:

1. ✅ **G1 Rate**: Uses `getCommissionRate(downlineRank)` - correct
2. ✅ **G2 Rate**: Uses sponsor rank from `g2Rates[member.rank]` - correct
3. ✅ **G2 Calculation**: Loops through G2 children and adds bonus for each non-Member - correct
4. ✅ **Separate Legs**: Calculates left and right independently - correct
5. ✅ **Weaker Leg**: Uses `Math.min(leftVolume, rightVolume)` - correct

---

## 📊 All Rate Examples:

| Sponsor Rank | G1 Downline | G2 Count | Weaker PV | G1 Bonus | G2 Bonus | Total |
|--------------|-------------|----------|-----------|----------|----------|-------|
| Silver | Bronze | 0 | 100 | $8.00 | $0 | $8.00 |
| Silver | Silver | 0 | 100 | $10.00 | $0 | $10.00 |
| Gold | Gold | 0 | 200 | $28.00 | $0 | $28.00 |
| Manager | Bronze | 2 | 500 | $40.00 | $10.00 | $50.00 |
| Director | Silver | 3 | 1000 | $100.00 | $90.00 | $190.00 |
| President | Diamond | 5 | 2000 | $340.00 | $300.00 | $640.00 |

---

## ✅ CONFIRMED: Implementation matches examples!
