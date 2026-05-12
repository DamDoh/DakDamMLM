# Waiting PV Column Implementation

## Overview

Added `waitingPV` column to the `users` table to store carry-forward unmatched PV directly in the user record, replacing the separate `waiting_pv` table.

## Changes Made

### 1. Database Schema (`prisma/schema.prisma`)
- Added `waitingPV` JSON column to `User` model
- Default value: `{"leftWaitingPV":0,"rightWaitingPV":0,"lastUpdated":null}`

### 2. Migration SQL (`prisma/migrations/add_waiting_pv_to_users.sql`)
- Adds `waitingPV` JSONB column to `users` table
- Sets default values for existing users

### 3. Service Updates (`src/services/pv-matching-service.ts`)

#### `getCarryForwardWaitingPV()`
- Now reads from `user.waitingPV` JSON column
- Returns `{ leftWaitingPV, rightWaitingPV }` from stored data

#### `saveWaitingPVRecord()`
- Now saves to `user.waitingPV` JSON column
- Stores:
  - `leftWaitingPV`: Unmatched PV from left leg
  - `rightWaitingPV`: Unmatched PV from right leg
  - `lastUpdated`: ISO timestamp
  - `lastMatchDate`: Date string of last match
  - `lastMatchedPV`: PV matched in last transaction
  - `lastCommissionEarned`: Commission earned in last transaction

#### `getCurrentPeriodVolume()`
- Updated to use carry-forward waiting PV from `user.waitingPV`
- Calculates total PV as: `Live PV + Carry-Forward Waiting PV`

## Data Structure

The `waitingPV` JSON column stores:
```json
{
  "leftWaitingPV": 300,
  "rightWaitingPV": 0,
  "lastUpdated": "2024-01-15T10:30:00.000Z",
  "lastMatchDate": "2024-01-15",
  "lastMatchedPV": 1200,
  "lastCommissionEarned": 96
}
```

## How to Apply

### Step 1: Run the Migration
```bash
# Option 1: Using psql (if you have direct database access)
psql -U your_user -d your_database -f prisma/migrations/add_waiting_pv_to_users.sql

# Option 2: Using Prisma Studio or your database client
# Copy and paste the SQL from prisma/migrations/add_waiting_pv_to_users.sql
```

### Step 2: Regenerate Prisma Client
```bash
npx prisma generate
```

### Step 3: Restart Your Application
```bash
npm run dev
```

## Benefits

1. **Simpler Architecture**: No separate table to manage
2. **Better Performance**: Direct access to user's waiting PV
3. **Easier Queries**: All user data in one place
4. **Automatic Cleanup**: When user is deleted, waiting PV is deleted too

## How It Works

1. **When a Daily Match is calculated:**
   - System calculates matched PV from left and right legs
   - Calculates remaining (waiting) PV after matching
   - Saves waiting PV to `user.waitingPV` column

2. **On next match:**
   - System reads carry-forward waiting PV from `user.waitingPV`
   - Adds it to current live PV
   - Calculates new match with total PV (live + carry-forward)

3. **Example Flow:**
   ```
   Day 1:
   - Left Live: 1500 PV, Right Live: 1200 PV
   - Matched: 1200 PV
   - Left Waiting: 300 PV (saved to user.waitingPV)
   
   Day 2:
   - Left Live: 800 PV, Right Live: 1000 PV
   - Left Carry-Forward: 300 PV (from user.waitingPV)
   - Left Total: 800 + 300 = 1100 PV
   - Right Total: 1000 PV
   - Matched: 1000 PV (min of 1100 and 1000)
   - Left Waiting: 100 PV (saved to user.waitingPV)
   ```

## Testing

After applying the migration, test:
1. Calculate a daily match for a user
2. Check that `user.waitingPV` is updated correctly
3. Verify that carry-forward PV is included in next match calculation
4. Check the Current Period Volume dashboard shows correct waiting PV

## Notes

- The column uses JSONB for efficient querying
- Default values ensure existing users have valid data
- The migration is safe to run multiple times (uses `IF NOT EXISTS`)
- All existing users will have `waitingPV` initialized to zeros

