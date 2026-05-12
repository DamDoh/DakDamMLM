# Daily Match Commission - Binary MLM System

## Overview

Daily Match Commission is a binary matching bonus where **EVERY MEMBER** in the organization earns from their own binary tree. The commission is 8% of matched PV (Point Value) between their left and right legs. The payout is always in $8 increments, with daily caps based on rank.

## CORE PRINCIPLE: Every Member Earns Their Own Commissions

1. **Each member has their own binary tree** (left leg and right leg)
2. **Each member earns their own daily match bonus** from their direct downlines
3. **Each member has their own "Current Period Volume" dashboard** showing their waiting PV
4. **Member's `user.pv` field is NEVER modified** during matching - we track waiting PV separately
5. **PV accumulates upward** through the entire binary tree

---

## Key Rules

### Commission Rate
- **All ranks**: 8% of matched PV (fixed rate)
- **Payout**: Always $8 per match (increments)
- **Matching**: Uses the **lower PV** between left and right total legs

### Daily Match Caps by Rank
| Rank | Daily Match Cap | Maximum Daily Earnings |
|------|----------------|----------------------|
| Bronze | 1 match | $8 |
| Silver | 10 matches | $80 |
| Gold | 40 matches | $320 |
| Diamond | 80 matches | $640 |
| Manager | 100 matches | $800 |
| Director | 116 matches | $928 |
| President | 140 matches | $1,120 |
| Double President | 200 matches | $1,600 |

### Eligibility Requirements
1. ✅ Must have **both** left and right downlines (G1 children, not "Member" rank)
2. ✅ Must have paid monthly maintenance topup
3. ✅ Cannot be superadmin
4. ✅ Must have active downlines
5. ✅ Can only earn **once per day** (but can update if PV increases)
6. ✅ Must have PV > 0 on at least one side

---

## How PV is Calculated

### For Each Member's Dashboard:

1. **Live PV**: Fresh calculation from all downlines in each leg
   - Left Live PV = Sum of (G1 Left + all G2/G3/G4... descendants in left subtree) × their `user.pv`
   - Right Live PV = Sum of (G1 Right + all G2/G3/G4... descendants in right subtree) × their `user.pv`

2. **Waiting PV**: Carry-forward from previous matches (unmatched PV)
   - Stored in `waiting_pv` table per member per day
   - Never modifies `user.pv` field

3. **Total PV**: Live PV + Waiting PV
   - Left Total PV = Left Live PV + Left Waiting PV
   - Right Total PV = Right Live PV + Right Waiting PV

4. **Matched PV**: `min(Left Total PV, Right Total PV)`

5. **Remaining PV**: After matching, the smaller leg = 0, larger leg = (Total - Matched)

---

## Example: Binary Tree Structure

```
                    Admin User (ADMIN001)
                    ┌───────┴───────┐
               Left Leg         Right Leg
                    │               │
            RiThy VoNg          Chao Chao
            (Silver=100 PV)     (Gold=500 PV)
                │
            gay gf
            (Silver=100 PV)
```

### How Each Member's Match Works:

#### Admin User (Top Level)
- **Left Leg Total PV**: RiThy VoNg (100 PV) + gay gf (100 PV) = **200 PV**
- **Right Leg Total PV**: Chao Chao (500 PV) = **500 PV**
- **Matched PV**: min(200, 500) = **200 PV**
- **Commission**: 200 × 8% = **$16**
- **Remaining**: Left = 0 PV, Right = 300 PV (waiting)

#### RiThy VoNg (Second Level)
- **Left Leg Total PV**: gay gf (100 PV) = **100 PV**
- **Right Leg Total PV**: (none) = **0 PV**
- **Matched PV**: min(100, 0) = **0 PV** (cannot match yet)
- **Commission**: $0 (needs right leg member)
- When RiThy VoNg gets a right downline, they will earn their own commission

#### gay gf (Third Level)
- **Left Leg Total PV**: (none) = **0 PV**
- **Right Leg Total PV**: (none) = **0 PV**
- **Matched PV**: 0 (no downlines yet)
- When gay gf adds downlines, they will earn their own commission

---

## Cascading Effect (Upline Recalculation)

When a new member joins at ANY level, ALL upline sponsors recalculate their match:

### Example: gay gf joins under RiThy VoNg
1. **gay gf's PV (100)** is added to gay gf's own leg totals (as a sponsor for future downlines)
2. **RiThy VoNg's left leg** now has 100 PV (gay gf's contribution)
3. **Admin User's left leg** now has 200 PV total (RiThy VoNg's 100 + gay gf's 100)
4. **Admin User can now match**: 200 PV (left) vs 500 PV (right) = 200 PV matched

### Cascade Trigger Flow:
```
New Member Joins
      ↓
Direct Parent Notified (checkAndTriggerDailyMatch)
      ↓
Upline Cascade (triggerUplineCascade)
      ↓
All Upline Sponsors Recalculate Their Matches
```

---

## Data Structure

### `waiting_pv` Table (Per Member Per Day)
```sql
CREATE TABLE waiting_pv (
  user_id VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  
  left_live_pv NUMERIC(12, 2),      -- Fresh PV from downlines
  right_live_pv NUMERIC(12, 2),     -- Fresh PV from downlines
  left_waiting_pv NUMERIC(12, 2),   -- Carry-forward (unmatched)
  right_waiting_pv NUMERIC(12, 2),  -- Carry-forward (unmatched)
  left_total_pv NUMERIC(12, 2),     -- Live + Waiting
  right_total_pv NUMERIC(12, 2),    -- Live + Waiting
  matched_pv NUMERIC(12, 2),        -- PV matched today
  commission_earned NUMERIC(12, 2), -- Commission from today's match
  match_count INT,                  -- Number of matches today
  
  UNIQUE (user_id, date)
);
```

### `pv_match_transactions` Table (History)
```sql
CREATE TABLE pv_match_transactions (
  user_id VARCHAR(255) NOT NULL,
  left_pv_used NUMERIC(12, 2),
  right_pv_used NUMERIC(12, 2),
  matched_pv NUMERIC(12, 2),
  left_waiting_after NUMERIC(12, 2),
  right_waiting_after NUMERIC(12, 2),
  commission_rate NUMERIC(5, 4),
  commission_earned NUMERIC(12, 2),
  member_rank VARCHAR(50),
  trigger_type VARCHAR(50),         -- 'manual', 'auto', 'new_member_join'
  trigger_member_id VARCHAR(255),   -- ID of member who caused recalculation
  created_at TIMESTAMP
);
```

---

## Step-by-Step Flow Example

### Scenario: John (Silver rank) claims Daily Match

**Initial State:**
- Left Leg Live PV: 1,500 PV
- Left Leg Waiting PV: 0 PV (no previous match)
- Right Leg Live PV: 1,200 PV
- Right Leg Waiting PV: 0 PV

### Step 1: Calculate Total PV
```
Left Total PV = 1,500 + 0 = 1,500 PV
Right Total PV = 1,200 + 0 = 1,200 PV
```

### Step 2: Calculate Matched PV
```
Matched PV = min(1,500, 1,200) = 1,200 PV
```

### Step 3: Calculate Commission
```
Raw Commission = 1,200 × 8% = $96
Daily Cap (Silver) = 10 matches × $8 = $80
Capped Commission = min($96, $80) = $80
Matches = floor($80 / $8) = 10 matches
Actual Payout = 10 × $8 = $80
```

### Step 4: Calculate Remaining (Waiting) PV
```
Left Remaining = 1,500 - 1,200 = 300 PV (waiting)
Right Remaining = 1,200 - 1,200 = 0 PV
```

### Step 5: Save Waiting PV (NOT modifying user.pv)
```javascript
await PVMatchingService.saveWaitingPVRecord(johnId, today, {
  leftLivePV: 1500,
  rightLivePV: 1200,
  leftWaitingPV: 300,    // Carry-forward
  rightWaitingPV: 0,
  matchedPV: 1200,
  commissionEarned: 80
});
```

### Step 6: Credit Wallet
```javascript
await WalletServiceEnhanced.creditWallet(johnId, 80, 'Daily Match', referenceId, 'daily_match');
```

### Result:
- ✅ John receives $80
- ✅ John's waiting PV: Left = 300, Right = 0
- ✅ John's `user.pv` is **NOT modified** (stays as their rank PV)
- ✅ Next match will include the 300 PV carry-forward on left leg

---

## Current Period Volume Dashboard

Each member's dashboard shows:

| Field | Description |
|-------|-------------|
| Left Live PV | Fresh PV from left leg downlines |
| Right Live PV | Fresh PV from right leg downlines |
| Left Waiting PV | Carry-forward from previous matches |
| Right Waiting PV | Carry-forward from previous matches |
| Left Total PV | Live + Waiting |
| Right Total PV | Live + Waiting |
| Matchable PV | min(Left Total, Right Total) |
| Potential Commission | Matchable × 8% |
| Matched Today | PV matched in today's match |

---

## API Endpoints

### POST `/api/bonus/daily-match`
Claim daily match bonus for authenticated user.

**Response:**
```json
{
  "success": true,
  "message": "Bonus calculated successfully",
  "commission": {
    "amount": 80,
    "rate": 8,
    "matchedPV": 1200,
    "matches": 10,
    "perMatch": 8,
    "teamPV": {
      "left": 1500,
      "right": 1200,
      "leftLive": 1500,
      "rightLive": 1200,
      "leftWaiting": 0,
      "rightWaiting": 0,
      "remainingLeft": 300,
      "remainingRight": 0
    }
  },
  "waitingPV": {
    "left": 300,
    "right": 0
  },
  "dailyCap": 10
}
```

### GET `/api/pv-matching/current-period`
Get current period volume for authenticated user's dashboard.

**Response:**
```json
{
  "success": true,
  "data": {
    "leftPV": 1500,
    "rightPV": 1200,
    "leftWaitingPV": 300,
    "rightWaitingPV": 0,
    "leftTotalPV": 1800,
    "rightTotalPV": 1200,
    "matchedPV": 0,
    "leftMembers": 15,
    "rightMembers": 12
  }
}
```

---

## Key Implementation Files

| File | Purpose |
|------|---------|
| `src/services/pv-matching-service.ts` | Core PV calculation and waiting PV management |
| `src/services/daily-match-trigger.ts` | Auto-trigger and upline cascade |
| `src/app/api/bonus/daily-match/route.ts` | Daily match API endpoint |
| `src/app/api/pv-matching/current-period/route.ts` | Current period volume API |
| `src/components/pv-matching/current-period-volume.tsx` | Dashboard UI component |
| `prisma/migrations/enhanced_waiting_pv_table.sql` | Database tables |

---

## Important Notes

1. **Member's `user.pv` is NEVER modified** during matching - it represents their rank-based PV
2. **Waiting PV is tracked separately** in the `waiting_pv` table per member per day
3. **Each member sees only THEIR OWN** earnings and waiting PV
4. **Upline cascade** ensures all sponsors above a new member recalculate their matches
5. **Commission is paid to the CORRECT member** (the one who owns the matching legs)
6. **Daily cap prevents over-payment** based on member's rank
7. **$8 increments** ensure clean, whole-number payouts
