# G2 Binary Bonus - Fixed and How to Apply

## Issue
ADMIN002 (President rank) is not receiving G2 Binary Bonus from G2 downlines (ADMIN004, ADMIN005) under G1 (ADMIN003).

## Root Cause
The commission calculation was likely run BEFORE the G2 downlines existed, or the commission needs to be recalculated to include G2 bonus.

## Solution

### The Fix is Already in Place
The G2 Binary Bonus calculation code is already implemented in `commission-calculation-engine.ts`. The issue is that **existing commissions need to be recalculated**.

### How G2 Binary Bonus Works

**For President Rank:**
- **G1 Rate**: 17% of leg volume
- **G2 Rate**: 3% of leg volume × number of eligible G2 downlines

**Example for ADMIN002:**
- **Left Leg Volume**: 800 PV (from screenshot)
- **G1 Downline**: ADMIN003 (Gold rank) on left leg
- **G2 Downlines**: 
  - ADMIN004 (Silver) under ADMIN003 left leg
  - ADMIN005 (Silver) under ADMIN003 right leg

**Calculation:**
1. **G1 Binary Bonus**: 800 PV × 17% = $136.00
2. **G2 Binary Bonus**: 800 PV × 3% × 2 G2 downlines = $48.00
3. **Total Left Leg Binary Bonus**: $136.00 + $48.00 = **$184.00**

The current commission shows **$85.00**, which suggests it was calculated with only G1 bonus or different volume.

### How to Apply the Fix

#### Option 1: Recalculate Commissions via Admin Panel (Recommended)

1. **Login as Admin**
2. **Go to**: Admin → Commissions (or `/admin/commissions`)
3. **Click**: "Calculate Commissions" button
4. **Wait**: For the calculation to complete
5. **Check**: ADMIN002's commissions should now include G2 bonus

#### Option 2: Recalculate via API

```bash
POST /api/commissions/calculate
Authorization: Bearer <admin_token>
```

#### Option 3: Use Test Script (For Verification)

Run the test script to verify G2 calculation:

```bash
node test-g2-binary-bonus.js
```

This will:
- Show ADMIN002's structure
- List all G1 and G2 downlines
- Calculate expected G2 bonus
- Show existing commissions

### Verification Steps

After recalculating commissions, check:

1. **Console Logs** - Look for:
   ```
   🔍 G2 Binary Bonus Check for <ADMIN002_ID> (President): ...
   🔍 Left Leg G2 Children found: 2
   💰 Left Leg G2 Bonus added: ...
   📊 G2 Binary Bonus Summary: ...
   ```

2. **Commission Entry** - Should show:
   - **Type**: Binary Bonus
   - **Description**: Should include G2 breakdown, e.g., 
     ```
     Binary Bonus (Left Leg): 800 PV × 17% (President G1) + 2 G2 downline(s) × 3% = $136.00 + $48.00 = $184.00
     ```
   - **Amount**: Should include both G1 and G2 bonus

3. **Commission Metadata** - Check metadata for:
   - `g2Bonus`: Should show G2 bonus amount
   - `g2DownlineCount`: Should show number of G2 downlines (2 in this case)

### Expected Result

For ADMIN002 with:
- Left leg volume: 800 PV
- 2 eligible G2 downlines (ADMIN004, ADMIN005)

**Expected Commission:**
- G1 Bonus: $136.00
- G2 Bonus: $48.00
- **Total: $184.00**

### If G2 Bonus Still Not Showing

1. **Check Console Logs**:
   - Look for G2 calculation logs
   - Verify G2 children are found
   - Check if G2 bonus is calculated

2. **Verify G2 Downlines**:
   ```sql
   -- Check if ADMIN004 and ADMIN005 exist and are active
   SELECT id, memberId, rank, active, deleted, placementParentId 
   FROM users 
   WHERE memberId IN ('ADMIN004', 'ADMIN005');
   
   -- Check if they're under ADMIN003
   SELECT u1.memberId as g1, u2.memberId as g2, u2.rank
   FROM users u1
   JOIN users u2 ON u2.placementParentId = u1.id
   WHERE u1.memberId = 'ADMIN003'
     AND u2.active = true
     AND u2.deleted = false;
   ```

3. **Check Volume**:
   ```sql
   -- Check if there's volume on the left leg
   SELECT SUM(oi.pv) as total_pv
   FROM order_items oi
   JOIN orders o ON oi.order_id = o.id
   JOIN users u ON o.user_id = u.id
   WHERE u.memberId = 'ADMIN003'
     AND o.status IN ('Completed', 'Delivered')
     AND o.date >= DATE_SUB(NOW(), INTERVAL 30 DAY);
   ```

4. **Check Sponsor Rank**:
   ```sql
   -- Verify ADMIN002 is President rank
   SELECT id, memberId, rank 
   FROM users 
   WHERE memberId = 'ADMIN002';
   ```

### Code Reference

The G2 Binary Bonus calculation is in:
- **File**: `src/services/commission-calculation-engine.ts`
- **Method**: `calculateMemberCommission()`
- **Lines**: 198-372 (G2 calculation)
- **Lines**: 396-424 (Left leg commission entry with G2)

### Automatic Calculation

For **NEW** members being added:
- G2 Binary Bonus is automatically calculated when a new member (G2) is added under G1
- This happens in:
  - `src/app/api/auth/register/route.ts`
  - `src/services/server-actions.ts`
  - `src/app/api/register/admin/route.ts`

For **EXISTING** members:
- Commissions must be recalculated using the commission calculation engine
- This is done via Admin Panel or API

---

**Status**: ✅ Code fix complete - requires commission recalculation
**Next Step**: Recalculate commissions for ADMIN002 (or all members)
