# Safety Rules Implementation Guide

## Overview

This document describes the implementation of the three safety rules for the MLM platform.

## Implementation Status

### ✅ 1. Flush-out (Burn-out) Policy - IMPLEMENTED
### ✅ 2. Carry Forward Policy - IMPLEMENTED  
### ✅ 3. Wallet Split Policy - ALREADY IMPLEMENTED (No changes needed)

---

## Files Created/Modified

### New Files:
1. **`src/services/daily-flush-service.ts`**
   - Flushes excess waiting PV that exceeds daily matching limits
   - Runs at 1:00 AM daily via cron job
   - Calculates max matchable PV based on rank's daily cap

2. **`src/services/waiting-pv-expiration-service.ts`**
   - Expires waiting PV older than 12 months
   - Runs monthly on the 1st at 2:00 AM
   - Resets expired waiting PV to 0

3. **`src/services/safety-rules-scheduler.ts`**
   - Initializes and manages scheduled jobs
   - Called during application startup

4. **`src/instrumentation.ts`**
   - Next.js instrumentation hook
   - Automatically initializes scheduled jobs on server start

5. **`prisma/migrations/add_waiting_pv_timestamps.sql`**
   - Database migration to add timestamp columns
   - Tracks when waiting PV was created

### Modified Files:
1. **`src/services/pv-matching-service.ts`**
   - Updated `updateWaitingPV()` to track timestamps
   - Sets timestamp when PV is added, preserves when reduced

2. **`next.config.js`**
   - Enabled `instrumentationHook: true` for scheduled jobs

---

## Database Migration

### Step 1: Run the Migration

```bash
# Option 1: Run SQL directly
psql -U your_user -d your_database -f prisma/migrations/add_waiting_pv_timestamps.sql

# Option 2: Use Prisma (if you prefer)
# Note: This is a manual migration, so add it to your migration workflow
```

### Migration Details:
- Adds `leftWaitingPVCreatedAt` column (TIMESTAMP, nullable)
- Adds `rightWaitingPVCreatedAt` column (TIMESTAMP, nullable)
- Creates indexes for efficient expiration queries
- Sets initial timestamps for existing waiting PV

---

## How It Works

### 1. Daily Flush Service (1:00 AM Daily)

**Purpose:** Delete excess points that exceed daily matching limits

**Process:**
1. Runs automatically at 1:00 AM every day
2. For each eligible user:
   - Calculates max matchable PV based on rank's daily cap
   - Formula: `maxMatchablePV = dailyCapAmount / 0.08`
   - Flushes excess: `excess = max(0, waitingPV - maxMatchablePV)`
   - Updates waiting PV to capped value
3. Logs all flush operations

**Example:**
- Bronze user with $8 daily cap
- Max matchable PV = $8 / 0.08 = 100 PV
- If leftWaitingPV = 150 PV → Flush 50 PV → leftWaitingPV = 100 PV

### 2. Waiting PV Expiration Service (Monthly on 1st at 2:00 AM)

**Purpose:** Expire waiting PV older than 12 months

**Process:**
1. Runs automatically on the 1st of each month at 2:00 AM
2. For each user with waiting PV:
   - Checks if `leftWaitingPVCreatedAt` or `rightWaitingPVCreatedAt` is older than 12 months
   - If expired, resets waiting PV to 0
   - Resets timestamp to NULL
3. Logs all expiration operations

**Example:**
- User has leftWaitingPV = 500 PV
- leftWaitingPVCreatedAt = 2023-01-01 (13 months ago)
- → Expired → leftWaitingPV = 0, leftWaitingPVCreatedAt = NULL

### 3. Timestamp Tracking

**When Waiting PV is Updated:**
- **PV Added:** Timestamp set to NOW()
- **PV Reduced:** Timestamp preserved (unchanged)
- **PV Reset to 0:** Timestamp set to NULL

**Implementation:**
- Handled in `PVMatchingService.updateWaitingPV()`
- Uses SQL CASE statements for conditional timestamp updates

---

## Scheduled Jobs

### Job 1: Daily Flush
- **Schedule:** `0 1 * * *` (1:00 AM daily)
- **Timezone:** UTC (configurable)
- **Function:** `flushExcessPoints()`

### Job 2: Waiting PV Expiration
- **Schedule:** `0 2 1 * *` (2:00 AM on 1st of each month)
- **Timezone:** UTC (configurable)
- **Function:** `expireOldWaitingPV()`

---

## Manual Execution

### Run Daily Flush Manually:
```typescript
import { flushExcessPoints } from '@/services/daily-flush-service';

const result = await flushExcessPoints();
console.log(result);
```

### Run Expiration Manually:
```typescript
import { expireOldWaitingPV } from '@/services/waiting-pv-expiration-service';

const result = await expireOldWaitingPV();
console.log(result);
```

---

## Testing

### Test Daily Flush:
1. Create a user with rank (e.g., Bronze)
2. Set waiting PV above daily limit (e.g., 150 PV for Bronze)
3. Run `flushExcessPoints()` manually
4. Verify waiting PV is capped at max matchable PV

### Test Expiration:
1. Create a user with waiting PV
2. Set timestamp to 13 months ago
3. Run `expireOldWaitingPV()` manually
4. Verify waiting PV is reset to 0

---

## Monitoring

### Logs:
- All flush operations are logged with user details
- All expiration operations are logged with user details
- Errors are logged with full context

### Check Job Status:
```typescript
import { isSafetyRulesSchedulerInitialized } from '@/services/safety-rules-scheduler';

const status = isSafetyRulesSchedulerInitialized();
console.log(status); // { flushJob: true, expirationJob: true }
```

---

## Configuration

### Adjust Timezone:
Edit `src/services/daily-flush-service.ts` and `src/services/waiting-pv-expiration-service.ts`:
```typescript
timezone: 'UTC', // Change to your timezone, e.g., 'America/New_York'
```

### Adjust Expiration Period:
Edit `src/services/waiting-pv-expiration-service.ts`:
```typescript
const EXPIRATION_MONTHS = 12; // Change to desired months
```

---

## Troubleshooting

### Jobs Not Running:
1. Check if `instrumentationHook: true` is enabled in `next.config.js`
2. Verify `src/instrumentation.ts` exists and is correct
3. Check server logs for initialization errors
4. Verify `node-cron` is installed: `npm list node-cron`

### Timestamp Columns Missing:
1. Run the migration: `prisma/migrations/add_waiting_pv_timestamps.sql`
2. Check database schema for `leftWaitingPVCreatedAt` and `rightWaitingPVCreatedAt`

### Flush Not Working:
1. Check user rank is eligible (Bronze+)
2. Verify daily cap configuration in `BONUS_CONFIG`
3. Check logs for errors

---

## Next Steps

1. **Run Database Migration:**
   ```bash
   psql -U your_user -d your_database -f prisma/migrations/add_waiting_pv_timestamps.sql
   ```

2. **Restart Application:**
   - Scheduled jobs will initialize automatically on startup

3. **Monitor Logs:**
   - Check for initialization messages
   - Verify jobs are scheduled correctly

4. **Test Manually:**
   - Run flush and expiration functions manually to verify they work

---

## Summary

✅ **All safety rules are now implemented:**
- Daily flush of excess points at 1:00 AM
- 12-month expiration of waiting PV
- 100% withdrawal allowed (already implemented)

The system will automatically protect against:
- Unlimited point accumulation
- Long-term storage of expired points
- Financial exposure from excess points
