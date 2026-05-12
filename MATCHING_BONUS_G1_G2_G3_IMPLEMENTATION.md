# Matching Bonus G1, G2, G3 Implementation

## Overview
The Matching Bonus calculation has been updated to support **G1, G2, and G3** generations based on the genealogy structure shown in the image.

## Genealogy Structure (from Image)

```
                    Da Da (Silver)
                   /              \
            Mey Mey (Silver)    Nai Nai (Gold)
            /         \          /         \
      Mi Mi (Gold) Ma Ma (Gold) Ni Ni (Silver) Na Na (Gold)
```

### Commission Types
- **RED border** = Daily Match commission
- **BLUE border** = Matching Bonus earned

## Matching Bonus Rates by Rank

| Rank | Maintenance PV | G1 % | G2 % | G3 % | Total |
|------|---------------|------|------|------|-------|
| Bronze | 20 PV | 20% | 0% | 0% | 20% |
| Silver | 20 PV | 30% | 0% | 0% | 30% |
| Gold | 20 PV | 40% | 5% | 0% | 45% |
| Diamond | 20 PV | 50% | 10% | 0% | 60% |
| Manager | 40 PV | 60% | 10% | 5% | 75% |
| Director | 40 PV | 60% | 10% | 10% | 80% |
| President | 40 PV | 60% | 10% | 10% | 80% |
| Double President | 40 PV | 60% | 10% | 10% | 80% |

## How It Works

### 1. Generation Levels
- **G1 (Generation 1)**: Direct downlines (placementParentId = memberId)
- **G2 (Generation 2)**: Downlines of G1 members
- **G3 (Generation 3)**: Downlines of G2 members

### 2. Leg Position Inheritance
- **G1 members**: Have their own position (left/right) relative to the sponsor
- **G2 members**: Inherit the leg position from their G1 ancestor
- **G3 members**: Inherit the leg position from their G1 ancestor

**Example:**
- Da Da has Mey Mey (left) and Nai Nai (right) as G1
- All downlines under Mey Mey belong to Da Da's **left leg**
- All downlines under Nai Nai belong to Da Da's **right leg**

### 3. Calculation Process

1. **PV Qualification Check**
   - Bronze-Silver-Gold-Diamond: Requires 20 PV
   - Manager-Director-President-Double President: Requires 40 PV

2. **Get All Downlines (G1, G2, G3)**
   - Fetches all downlines across 3 generations
   - Tracks generation level and leg position for each

3. **Get Daily Match Commissions**
   - Finds all `daily_match_bonus` commissions for all downlines
   - Filters by date range and `status: 'Paid'`
   - Groups by user ID

4. **Calculate Matching Bonus by Generation and Leg**
   - For each downline:
     - Gets their total Daily Match commission
     - Determines generation (G1, G2, or G3)
     - Determines leg (left or right) from G1 ancestor
     - Applies appropriate rate based on sponsor's rank
     - Calculates: `matchingBonus = dailyMatch × rate`

5. **Group Results**
   - Groups by generation (G1, G2, G3)
   - Groups by leg (left, right)
   - Creates separate entries for each combination

## Example Calculation

### Scenario: Da Da (Silver) - 30% G1 rate

**Structure:**
```
Da Da (Silver)
├─ Mey Mey (Silver) - Left leg
│  ├─ Mi Mi (Gold) - Left leg (inherited)
│  └─ Ma Ma (Gold) - Left leg (inherited)
└─ Nai Nai (Gold) - Right leg
   ├─ Ni Ni (Silver) - Right leg (inherited)
   └─ Na Na (Gold) - Right leg (inherited)
```

**Daily Match Commissions:**
- Mey Mey: $100 Daily Match
- Nai Nai: $150 Daily Match
- Mi Mi: $50 Daily Match
- Ma Ma: $30 Daily Match
- Ni Ni: $40 Daily Match
- Na Na: $60 Daily Match

**Matching Bonus Calculation:**

**G1 (30% rate):**
- Left leg: Mey Mey $100 × 30% = $30.00
- Right leg: Nai Nai $150 × 30% = $45.00

**G2 (0% rate for Silver):**
- No G2 bonus for Silver rank

**G3 (0% rate for Silver):**
- No G3 bonus for Silver rank

**Total Matching Bonus: $75.00**

### Scenario: Manager Rank - 60% G1, 10% G2, 5% G3

**Daily Match Commissions:**
- G1 Left: $200
- G1 Right: $300
- G2 Left: $100
- G2 Right: $150
- G3 Left: $50
- G3 Right: $80

**Matching Bonus Calculation:**

**G1 (60% rate):**
- Left: $200 × 60% = $120.00
- Right: $300 × 60% = $180.00

**G2 (10% rate):**
- Left: $100 × 10% = $10.00
- Right: $150 × 10% = $15.00

**G3 (5% rate):**
- Left: $50 × 5% = $2.50
- Right: $80 × 5% = $4.00

**Total Matching Bonus: $531.50**

## Output Structure

The function returns `CommissionBreakdown[]` with entries like:

```typescript
[
  {
    type: 'matching_bonus',
    amount: 531.50,  // Total
    description: 'Total Matching Bonus (Manager: G1 60%, G2 10%, G3 5%)',
    metadata: {
      totalGenerations: 3,
      g1Rate: 0.60,
      g2Rate: 0.10,
      g3Rate: 0.05,
      totalRate: 0.75,
      memberPV: 45
    }
  },
  {
    type: 'matching_bonus',
    amount: 120.00,
    description: 'G1 Matching Bonus from left leg (1 downlines, 60% rate)',
    metadata: {
      leg: 'left',
      generation: 1,
      downlineCount: 1,
      downlineMemberIds: ['MM1456'],
      rate: 0.60
    }
  },
  {
    type: 'matching_bonus',
    amount: 180.00,
    description: 'G1 Matching Bonus from right leg (1 downlines, 60% rate)',
    metadata: {
      leg: 'right',
      generation: 1,
      downlineCount: 1,
      downlineMemberIds: ['NN3456'],
      rate: 0.60
    }
  },
  // ... G2 and G3 entries
]
```

## Key Features

1. **Multi-Generation Support**: Calculates G1, G2, and G3 matching bonuses
2. **Leg-Based Grouping**: Groups bonuses by left/right leg for each generation
3. **Rate by Rank**: Different rates for each generation based on sponsor's rank
4. **Leg Inheritance**: G2 and G3 inherit leg position from G1 ancestor
5. **Detailed Breakdown**: Separate entries for each generation and leg combination
6. **Summary Entry**: Total matching bonus with all generation rates

## Database Storage

When saved to database:
- **Type**: `'Matching Bonus'` (converted from `'matching_bonus'`)
- **Description**: Includes generation, leg, downline count, and rate
- **Metadata**: Stores generation, leg, downline IDs, rates, etc.

## Display in Commission List

Each generation and leg combination appears as a separate row:

| Date | Type | Status | Amount | Description |
|------|------|--------|--------|-------------|
| 1/5/2026 | Matching Bonus | Paid | $531.50 | Total Matching Bonus (Manager: G1 60%, G2 10%, G3 5%) |
| 1/5/2026 | Matching Bonus | Paid | $120.00 | G1 Matching Bonus from left leg (1 downlines, 60% rate) |
| 1/5/2026 | Matching Bonus | Paid | $180.00 | G1 Matching Bonus from right leg (1 downlines, 60% rate) |
| 1/5/2026 | Matching Bonus | Paid | $10.00 | G2 Matching Bonus from left leg (1 downlines, 10% rate) |
| 1/5/2026 | Matching Bonus | Paid | $15.00 | G2 Matching Bonus from right leg (1 downlines, 10% rate) |
| 1/5/2026 | Matching Bonus | Paid | $2.50 | G3 Matching Bonus from left leg (1 downlines, 5% rate) |
| 1/5/2026 | Matching Bonus | Paid | $4.00 | G3 Matching Bonus from right leg (1 downlines, 5% rate) |

## Notes

- Only **Paid** Daily Match commissions are considered
- Commission must be within the specified date range
- G2 and G3 rates are 0% for Bronze and Silver ranks
- Leg position is determined by G1 ancestor, not the member's own position
- Each generation and leg combination creates a separate commission record


