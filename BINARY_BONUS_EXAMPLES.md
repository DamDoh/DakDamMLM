# Binary Bonus Calculation Examples

## How Binary Bonus Works

Binary Bonus is calculated **separately for each leg** (left and right), using:
1. **G1 Rate**: Based on the **direct downline's rank** in that leg
2. **G2 Rate**: Additional bonus for **Manager+ ranks** from second-generation downlines

## Binary Bonus Rates Table

| Rank | G1 Rate | G2 Rate | Total |
|------|---------|---------|-------|
| Bronze | 8% | - | 8% |
| Silver | 10% | - | 10% |
| Gold | 14% | - | 14% |
| Diamond | 17% | - | 17% |
| Manager | 17% | 1% | 18% |
| Director | 17% | 3% | 20% |
| President | 17% | 3% | 20% |
| Double President | 17% | 3% | 20% |

---

## Example 1: Silver Sponsor with Bronze Downlines

**Scenario:**
- **Sponsor**: RiThy VoNg (Silver rank)
- **Left Leg**: Da Pheak (Bronze rank, direct downline)
- **Right Leg**: So ra (Bronze rank, direct downline)
- **Weaker Leg PV**: 100 PV (left and right both have ≥100 PV)

**Calculation:**

**Left Leg Binary Bonus:**
- G1 Rate: 8% (Bronze downline rate)
- G2 Rate: 0% (Silver rank doesn't get G2)
- Calculation: 100 PV × 8% = **$8.00**

**Right Leg Binary Bonus:**
- G1 Rate: 8% (Bronze downline rate)
- G2 Rate: 0% (Silver rank doesn't get G2)
- Calculation: 100 PV × 8% = **$8.00**

**Total Binary Bonus**: $8.00 (Left) + $8.00 (Right) = **$16.00**

---

## Example 2: Gold Sponsor with Mixed Downlines

**Scenario:**
- **Sponsor**: Gold rank
- **Left Leg**: Silver downline (G1)
- **Right Leg**: Bronze downline (G1)
- **Weaker Leg PV**: 200 PV

**Calculation:**

**Left Leg Binary Bonus:**
- G1 Rate: 10% (Silver downline rate)
- G2 Rate: 0% (Gold rank doesn't get G2)
- Calculation: 200 PV × 10% = **$20.00**

**Right Leg Binary Bonus:**
- G1 Rate: 8% (Bronze downline rate)
- G2 Rate: 0% (Gold rank doesn't get G2)
- Calculation: 200 PV × 8% = **$16.00**

**Total Binary Bonus**: $20.00 (Left) + $16.00 (Right) = **$36.00**

---

## Example 3: Manager Sponsor with G2 Downlines

**Scenario:**
- **Sponsor**: Manager rank
- **Left Leg**: 
  - G1: Bronze downline (Da Pheak)
  - G2: 2 Silver downlines (Da Pheak's downlines)
- **Right Leg**: 
  - G1: Silver downline (So ra)
  - G2: 1 Gold downline (So ra's downline)
- **Weaker Leg PV**: 500 PV

**Calculation:**

**Left Leg Binary Bonus:**
- **G1 Bonus**: 500 PV × 8% (Bronze rate) = $40.00
- **G2 Bonus**: 500 PV × 1% (Manager G2 rate) × 2 downlines = $10.00
- **Total**: $40.00 + $10.00 = **$50.00**

**Right Leg Binary Bonus:**
- **G1 Bonus**: 500 PV × 10% (Silver rate) = $50.00
- **G2 Bonus**: 500 PV × 1% (Manager G2 rate) × 1 downline = $5.00
- **Total**: $50.00 + $5.00 = **$55.00**

**Total Binary Bonus**: $50.00 (Left) + $55.00 (Right) = **$105.00**

---

## Example 4: Director Sponsor with Multiple G2 Downlines

**Scenario:**
- **Sponsor**: Director rank
- **Left Leg**: 
  - G1: Gold downline
  - G2: 3 downlines (Bronze, Silver, Gold)
- **Right Leg**: 
  - G1: Diamond downline
  - G2: 5 downlines (various ranks)
- **Weaker Leg PV**: 1000 PV

**Calculation:**

**Left Leg Binary Bonus:**
- **G1 Bonus**: 1000 PV × 14% (Gold rate) = $140.00
- **G2 Bonus**: 1000 PV × 3% (Director G2 rate) × 3 downlines = $90.00
- **Total**: $140.00 + $90.00 = **$230.00**

**Right Leg Binary Bonus:**
- **G1 Bonus**: 1000 PV × 17% (Diamond rate) = $170.00
- **G2 Bonus**: 1000 PV × 3% (Director G2 rate) × 5 downlines = $150.00
- **Total**: $170.00 + $150.00 = **$320.00**

**Total Binary Bonus**: $230.00 (Left) + $320.00 (Right) = **$550.00**

---

## Example 5: President with Complex Structure

**Scenario:**
- **Sponsor**: President rank
- **Left Leg**: 
  - G1: Silver downline
  - G2: 4 downlines (all ranks count)
- **Right Leg**: 
  - G1: Manager downline
  - G2: 7 downlines
- **Weaker Leg PV**: 2000 PV

**Calculation:**

**Left Leg Binary Bonus:**
- **G1 Bonus**: 2000 PV × 10% (Silver rate) = $200.00
- **G2 Bonus**: 2000 PV × 3% (President G2 rate) × 4 downlines = $240.00
- **Total**: $200.00 + $240.00 = **$440.00**

**Right Leg Binary Bonus:**
- **G1 Bonus**: 2000 PV × 17% (Manager rate) = $340.00
- **G2 Bonus**: 2000 PV × 3% (President G2 rate) × 7 downlines = $420.00
- **Total**: $340.00 + $420.00 = **$760.00**

**Total Binary Bonus**: $440.00 (Left) + $760.00 (Right) = **$1,200.00**

---

## Key Points

1. **Weaker Leg PV**: Always uses the minimum of left and right leg volumes
2. **G1 Rate**: Based on **direct downline's rank** in each leg (not sponsor's rank)
3. **G2 Rate**: Only for Manager+ ranks, based on **sponsor's rank** and number of G2 downlines
4. **Separate Legs**: Left and right legs calculated independently
5. **G2 Downlines**: Only count downlines with rank ≠ 'Member'

## Formula Summary

**For Bronze-Silver-Gold-Diamond:**
```
Binary Bonus = Weaker Leg PV × G1 Rate (based on downline's rank)
```

**For Manager+:**
```
Binary Bonus = (Weaker Leg PV × G1 Rate) + (Weaker Leg PV × G2 Rate × Number of G2 Downlines)
```

**Per Leg:**
```
Left Leg Bonus = G1 Bonus + G2 Bonus (if applicable)
Right Leg Bonus = G1 Bonus + G2 Bonus (if applicable)
Total Binary Bonus = Left Leg Bonus + Right Leg Bonus
```
