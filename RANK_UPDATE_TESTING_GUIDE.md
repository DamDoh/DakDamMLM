# How to Practice/Test Automatic Rank Updates

## Overview
The automatic rank update system promotes users to higher ranks when their Personal Volume (PV) reaches the required thresholds after placing orders.

## Rank Thresholds
- **Member**: 0 PV (default)
- **Bronze**: 1,000 PV
- **Silver**: 5,000 PV
- **Gold**: 10,000 PV
- **Diamond**: 50,000 PV
- **Manager**: 100,000 PV
- **Director**: 500,000 PV
- **President**: 1,000,000 PV
- **Double President**: 5,000,000 PV

## How to Test

### Method 1: Create Orders via UI
1. **Login** as a test user (or create a new member via admin registration)
2. **Check Current Rank & PV**:
   - Go to Profile or Dashboard
   - Note the current rank (e.g., "Member") and current PV (e.g., 0)
3. **Create an Order**:
   - Go to Products page
   - Add products to cart (check product PV values)
   - Place an order
4. **Verify Rank Update**:
   - Check user profile/dashboard again
   - Rank should automatically update if PV threshold is reached
   - Example: If user had 0 PV and order adds 1,000+ PV → rank changes to "Bronze"

### Method 2: Test with Specific PV Values

#### Test Case 1: Member → Bronze (1,000 PV)
```
Current PV: 0
Order PV: 1,000
Expected Result: Rank changes from "Member" to "Bronze"
```

#### Test Case 2: Bronze → Silver (5,000 PV)
```
Current PV: 1,000
Order PV: 4,000 (total becomes 5,000)
Expected Result: Rank changes from "Bronze" to "Silver"
```

#### Test Case 3: Multiple Ranks in One Order
```
Current PV: 0
Order PV: 10,000
Expected Result: Rank jumps directly to "Gold" (skips Bronze and Silver)
```

### Method 3: Check Logs
After creating an order, check the server logs for:
- `Rank automatically updated` - Shows successful promotion
- `Rank update check` - Shows why rank wasn't updated (if no change needed)

### Method 4: Database Check
Query the database to verify:
```sql
SELECT id, "memberId", "fullName", pv, rank, "pvDate"
FROM users
WHERE id = 'user-id-here';
```

## Testing Checklist

- [ ] User starts as "Member" with 0 PV
- [ ] Create order with 1,000+ PV → Rank becomes "Bronze"
- [ ] Create order with 5,000+ PV → Rank becomes "Silver"
- [ ] Create order with 10,000+ PV → Rank becomes "Gold"
- [ ] Create order that jumps multiple ranks → Rank updates correctly
- [ ] Check logs show rank update messages
- [ ] Verify rank doesn't auto-demote (if PV decreases)

## Important Notes

1. **Auto-Promotion Only**: The system only auto-promotes. It does NOT auto-demote users if their PV decreases.

2. **Real-time Updates**: Rank updates happen immediately when the order is created (in the same database transaction).

3. **PV Calculation**: Each product has a PV value. Order PV = sum of (product PV × quantity) for all items.

4. **No Manual Intervention**: Once an order is placed, rank updates automatically - no admin action needed.

## Troubleshooting

**Rank not updating?**
- Check if order was successfully created
- Verify product PV values are correct
- Check server logs for errors
- Ensure user's PV actually increased

**Wrong rank?**
- Verify PV calculation is correct
- Check rank thresholds in `src/lib/rank.ts`
- Ensure database transaction completed successfully

