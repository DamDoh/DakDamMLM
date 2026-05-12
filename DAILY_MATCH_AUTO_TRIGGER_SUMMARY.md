# Daily Match Auto-Trigger System - Complete Guide

## ✅ Auto-Trigger is Active for ALL Users

The system automatically triggers daily match bonus when:
1. **New member joins** with rank (Bronze+)
2. **Member rank upgrades** (Member → Bronze/Silver/etc.)
3. **PV is added** through topups/orders

---

## 🔄 Auto-Trigger Flow

### Step 1: PV Added to Waiting Leg
When a new member joins or rank upgrades:
- Member's rank PV (100 PV) is added to **ALL upline sponsors' waiting legs**
- Left leg members → added to sponsor's `leftWaitingPV`
- Right leg members → added to sponsor's `rightWaitingPV`

### Step 2: Check for Match
After PV is added, system checks:
- ✅ Both `leftWaitingPV > 0` AND `rightWaitingPV > 0`?
- ✅ Sponsor has valid rank (Bronze+)?
- ✅ Sponsor has both G1 children (not 'Member' rank)?
- ✅ Maintenance paid?
- ✅ Daily cap not reached?

### Step 3: Auto-Process Match
If all conditions met:
- Calculate: `matchedPV = min(leftWaitingPV, rightWaitingPV)`
- Calculate: `commission = matchedPV × 8%`
- Apply daily cap based on sponsor's rank
- **Auto-pay** commission to sponsor's wallet
- Update waiting PV: larger leg keeps difference, smaller = 0

---

## 📍 Trigger Points (All Active)

### 1. New Member Registration
**Files:**
- `src/app/api/auth/register/route.ts` (line 460-468)
- `src/app/api/register/admin/route.ts` (line 317-323)

**Flow:**
```typescript
// When new member joins
1. Member created with rank "Member" (pv = 0)
2. If member later gets rank upgrade → handleRankChange() called
3. Rank PV added to upline sponsors' waiting legs
4. Auto-trigger checks if sponsor qualifies
5. If yes → daily match processed automatically
```

### 2. Rank Upgrade
**Files:**
- `src/app/api/members/[id]/route.ts` (line 329)
- `src/app/api/pv-topup-requests/route.ts` (line 287)
- `src/app/api/ecash-topup-requests/route.ts` (line 642)

**Flow:**
```typescript
// When member rank upgrades (Member → Bronze/Silver/etc.)
1. handleRankChange() called
2. Only processes if: Member → Real Rank (Bronze+)
3. Adds 100 PV to ALL upline sponsors' waiting legs
4. Auto-trigger checks if sponsor qualifies
5. If yes → daily match processed automatically
```

### 3. Order Placement
**File:**
- `src/app/api/orders/route.ts` (line 828-829)

**Flow:**
```typescript
// When member places order and gets PV
1. Order processed, PV added to member
2. Rank may upgrade
3. triggerUplineCascade() called
4. PV added to upline sponsors' waiting legs
5. Auto-trigger checks if sponsor qualifies
6. If yes → daily match processed automatically
```

---

## 🎯 Example Scenarios

### Scenario 1: New Member Joins
```
Sponsor: Silver (ADMIN002)
├── Left: 0 PV
└── Right: 0 PV

New member "da da" (Silver) joins LEFT leg:
├── Left: 0 + 100 = 100 PV ✅
└── Right: 0 PV

New member "mo mo" (Gold) joins RIGHT leg:
├── Left: 100 PV
└── Right: 0 + 100 = 100 PV ✅

🔄 AUTO-TRIGGER FIRES:
├── Match: min(100, 100) = 100 PV
├── Commission: 100 × 8% = $8
├── Auto-paid to sponsor wallet ✅
├── Left: 0 (consumed)
└── Right: 0 (consumed)
```

### Scenario 2: Rank Upgrade
```
Sponsor: Silver (ADMIN002)
├── Left: 0 PV
└── Right: 400 PV (waiting)

Member "new member" (Member rank) joins LEFT leg:
├── Left: 0 PV (Member has 0 PV)
└── Right: 400 PV

Later, "new member" upgrades to Bronze:
├── handleRankChange() called
├── Left: 0 + 100 = 100 PV ✅
└── Right: 400 PV

🔄 AUTO-TRIGGER FIRES:
├── Match: min(100, 400) = 100 PV
├── Commission: 100 × 8% = $8
├── Auto-paid to sponsor wallet ✅
├── Left: 0 (consumed)
└── Right: 400 - 100 = 300 PV (waiting)
```

---

## ⚙️ Configuration

### Daily Match Caps by Rank
| Rank | Max Matches/Day | Max $/Day |
|------|----------------|-----------|
| Bronze | 1 | $8 |
| Silver | 10 | $80 |
| Gold | 40 | $320 |
| Diamond | 80 | $640 |
| Manager | 100 | $800 |
| Director | 116 | $928 |
| President | 140 | $1,120 |
| Double President | 200 | $1,600 |

### Commission Rate
- **8%** of matched PV
- Paid in **$8 increments** (1 match = 100 PV = $8)

---

## 🔍 Verification

### Check if Auto-Trigger is Working

1. **Check Waiting PV:**
   ```sql
   SELECT "memberId", "leftWaitingPV", "rightWaitingPV" 
   FROM "users" 
   WHERE "memberId" = 'ADMIN002';
   ```

2. **Check Commission Records:**
   ```sql
   SELECT * FROM "commissions" 
   WHERE "userId" = 'sponsor-id' 
     AND "type" = 'Daily Match' 
     AND "date" >= CURRENT_DATE
   ORDER BY "createdAt" DESC;
   ```

3. **Check Wallet Transactions:**
   ```sql
   SELECT * FROM "wallet_transactions" 
   WHERE "referenceType" = 'daily_match' 
     AND "createdAt" >= CURRENT_DATE
   ORDER BY "createdAt" DESC;
   ```

---

## 🛠️ Troubleshooting

### Issue: Auto-trigger not firing

**Check:**
1. ✅ Both legs have waiting PV > 0?
2. ✅ Sponsor has valid rank (Bronze+)?
3. ✅ Sponsor has both G1 children (not 'Member' rank)?
4. ✅ Maintenance paid?
5. ✅ Daily cap not reached?

**Manual Trigger:**
```bash
npx tsx scripts/trigger-daily-match-now.ts ADMIN002
```

### Issue: Waiting PV not updating

**Check:**
1. ✅ Member has valid rank (Bronze+)?
2. ✅ Member's rank PV is 100?

**Recalculate:**
```bash
npx tsx scripts/recalculate-waiting-pv.ts ADMIN002
```

---

## 📝 Notes

- **Auto-trigger works for ALL users** - no manual action needed
- **Multiple matches per day** - up to daily cap
- **Waiting PV persists** - unmatched PV carries forward
- **Commission paid immediately** - credited to wallet automatically

---

## ✅ Status: FULLY AUTOMATED

The system is now fully automated. When members join or upgrade ranks, their PV is automatically added to upline sponsors' waiting legs, and if both legs have PV, the daily match is automatically processed and paid.

