# Waiting PV Columns Flow - Following currentPeriodVolume

## Overview

The `leftWaitingPV` and `rightWaitingPV` columns in the `users` table are synchronized with the waiting PV values displayed in `currentPeriodVolume`. The values are calculated the same way and stored/retrieved consistently.

## Data Flow

### 1. **Display in currentPeriodVolume** (`getCurrentPeriodVolume`)

```typescript
// Step 1: Get live PV from downlines
leftLivePV = calculateLegPV(userId, 'left')
rightLivePV = calculateLegPV(userId, 'right')

// Step 2: Get carry-forward waiting PV from database columns
carryForward = getCarryForwardWaitingPV(userId) // Reads from leftWaitingPV, rightWaitingPV columns

// Step 3: Calculate total PV
leftTotalPV = leftLivePV + carryForward.leftWaitingPV
rightTotalPV = rightLivePV + carryForward.rightWaitingPV

// Step 4: Calculate waiting PV after match (what's displayed)
matchedPV = min(leftTotalPV, rightTotalPV)
leftWaitingAfterMatch = max(0, leftTotalPV - matchedPV)  // ← This is displayed
rightWaitingAfterMatch = max(0, rightTotalPV - matchedPV) // ← This is displayed
```

### 2. **Save to Database Columns** (`saveWaitingPVRecord`)

When a daily match is calculated (manual or auto), the waiting PV is saved:

```typescript
// After matching, calculate remaining waiting PV
leftAfterMatch = max(0, leftTotalPV - matchedPV)  // ← Same calculation as above
rightAfterMatch = max(0, rightTotalPV - matchedPV) // ← Same calculation as above

// Save to database columns
UPDATE users 
SET leftWaitingPV = leftAfterMatch,
    rightWaitingPV = rightAfterMatch
WHERE id = userId
```

### 3. **Read from Database Columns** (`getCarryForwardWaitingPV`)

On the next calculation, the saved values are read:

```typescript
SELECT leftWaitingPV, rightWaitingPV 
FROM users 
WHERE id = userId
```

## Calculation Consistency

The waiting PV values follow this formula consistently:

```
Waiting PV = max(0, Total PV - Matched PV)
```

Where:
- **Total PV** = Live PV + Carry-Forward Waiting PV
- **Matched PV** = min(Left Total PV, Right Total PV)

## Example Flow

### Day 1: Initial Match

**Initial State:**
- Left Live PV: 1,500
- Right Live PV: 1,200
- Left Waiting PV (from DB): 0
- Right Waiting PV (from DB): 0

**Calculation:**
```
Left Total PV = 1,500 + 0 = 1,500
Right Total PV = 1,200 + 0 = 1,200
Matched PV = min(1,500, 1,200) = 1,200
Left Waiting After Match = max(0, 1,500 - 1,200) = 300
Right Waiting After Match = max(0, 1,200 - 1,200) = 0
```

**Saved to Database:**
- `leftWaitingPV` = 300
- `rightWaitingPV` = 0

**Displayed in UI:**
- Left Waiting PV: 300
- Right Waiting PV: 0

### Day 2: Next Match (with Carry-Forward)

**Initial State:**
- Left Live PV: 800 (new downline activity)
- Right Live PV: 1,000
- Left Waiting PV (from DB): 300 ← **Carried forward from Day 1**
- Right Waiting PV (from DB): 0

**Calculation:**
```
Left Total PV = 800 + 300 = 1,100  ← Includes carry-forward
Right Total PV = 1,000 + 0 = 1,000
Matched PV = min(1,100, 1,000) = 1,000
Left Waiting After Match = max(0, 1,100 - 1,000) = 100
Right Waiting After Match = max(0, 1,000 - 1,000) = 0
```

**Saved to Database:**
- `leftWaitingPV` = 100
- `rightWaitingPV` = 0

**Displayed in UI:**
- Left Waiting PV: 100
- Right Waiting PV: 0

## Key Points

1. ✅ **Same Calculation**: The waiting PV shown in `currentPeriodVolume` uses the same formula as what's saved to the database
2. ✅ **Consistent Values**: What you see in the UI matches what's stored in `leftWaitingPV` and `rightWaitingPV` columns
3. ✅ **Carry-Forward**: Waiting PV from previous matches is automatically included in the next calculation
4. ✅ **Auto-Save**: Both manual and auto-triggered daily matches save waiting PV to the database columns

## Functions Involved

| Function | Purpose | Reads/Writes Columns |
|----------|---------|---------------------|
| `getCurrentPeriodVolume()` | Calculate and display PV data | Reads `leftWaitingPV`, `rightWaitingPV` |
| `getCarryForwardWaitingPV()` | Get saved waiting PV | Reads `leftWaitingPV`, `rightWaitingPV` |
| `saveWaitingPVRecord()` | Save waiting PV after match | Writes `leftWaitingPV`, `rightWaitingPV` |
| `performDailyMatching()` | Manual daily match | Calls `saveWaitingPVRecord()` |
| `checkAndTriggerDailyMatch()` | Auto daily match | Calls `saveWaitingPVRecord()` |

## Verification

To verify the columns are working correctly:

1. Check database: `SELECT id, "leftWaitingPV", "rightWaitingPV" FROM users`
2. Check UI: View `currentPeriodVolume` component
3. Compare: The waiting PV values should match between database and UI

The values in the database columns (`leftWaitingPV`, `rightWaitingPV`) will always match the "Waiting PV" values displayed in the `currentPeriodVolume` component.

