# Upline Cascade Auto-Match Flow

## ✅ How It Works

When a member joins **ANYWHERE** in the binary tree, their PV automatically flows up to **ALL upline sponsors** and triggers auto-match if both legs have PV.

---

## 📊 Example: Your Scenario

### Current State:
```
RiThy VoNg (ADMIN002) - Silver
├── Left: 0 PV
└── Right: 400 PV (waiting)

da da (ADMIN003) - Silver (LEFT child of RiThy)
└── (no downlines yet)
```

### When New Member Joins Under "da da":

**Step 1: New member "new member" (Silver rank) joins LEFT leg of "da da"**
```
da da (ADMIN003)
└── LEFT: "new member" (Silver = 100 PV)
```

**Step 2: PV Flows Up to ALL Upline Sponsors**

The system automatically:
1. Gets all upline sponsors: `["da da", "RiThy VoNg"]`
2. For each sponsor, determines which leg the new member is in
3. Adds 100 PV to that sponsor's waiting leg

**For "da da":**
- New member is in "da da's" LEFT leg
- Adds 100 PV to "da da's" leftWaitingPV

**For RiThy VoNg:**
- New member is in RiThy's LEFT leg (because "da da" is in RiThy's left)
- Adds 100 PV to RiThy's leftWaitingPV

**Step 3: Auto-Match Triggers for RiThy**

```
RiThy VoNg:
├── Left: 0 + 100 = 100 PV ✅
└── Right: 400 PV ✅

🔄 AUTO-TRIGGER FIRES:
├── Match: min(100, 400) = 100 PV
├── Commission: 100 × 8% = $8
├── Auto-paid to RiThy's wallet ✅
├── Left: 0 (consumed)
└── Right: 400 - 100 = 300 PV (waiting for next left member)
```

**Result:**
```
RiThy VoNg:
├── Left: 0 PV
└── Right: 300 PV (waiting)

Commission: $8 paid automatically ✅
```

---

## 🔄 Complete Flow Diagram

```
New Member Joins (Silver = 100 PV)
    ↓
triggerUplineRecalculation() called
    ↓
Get ALL upline sponsors (recursive up the tree)
    ↓
For each sponsor:
    ├── Determine which leg (left/right)
    ├── Add 100 PV to sponsor's waiting leg
    └── Check: Both legs > 0?
         ├── YES → checkAndTriggerDailyMatch()
         │    ├── Calculate match
         │    ├── Pay commission
         │    └── Update waiting PV
         └── NO → Continue (waiting for other leg)
```

---

## 📍 Code Flow

### 1. Member Joins/Upgrades
**Files:**
- `src/app/api/auth/register/route.ts`
- `src/app/api/register/admin/route.ts`
- `src/app/api/members/[id]/route.ts` (rank upgrade)
- `src/app/api/pv-topup-requests/route.ts`
- `src/app/api/ecash-topup-requests/route.ts`

**Calls:**
```typescript
// When member joins with rank OR rank upgrades
await PVMatchingService.handleRankChange(memberId, oldRank, newRank);
// OR
await triggerUplineCascade(memberId);
```

### 2. Upline Cascade
**File:** `src/services/pv-matching-service.ts`

**Function:** `triggerUplineRecalculation()`

**What it does:**
1. Gets all upline sponsors (walks up the tree)
2. For each sponsor:
   - Determines leg position (left/right)
   - Adds member's PV to sponsor's waiting leg
   - Checks if both legs have PV
   - If yes → triggers auto-match

### 3. Auto-Match
**File:** `src/services/daily-match-trigger.ts`

**Function:** `checkAndTriggerDailyMatch()`

**What it does:**
1. Validates eligibility (rank, maintenance, children)
2. Gets waiting PV from database
3. Calculates match: `min(left, right)`
4. Calculates commission: `matchedPV × 8%`
5. Applies daily cap
6. **Auto-pays** to wallet
7. Updates waiting PV

---

## ✅ Verification

### Test the Flow:

1. **Add a new member under "da da" (LEFT leg) with Silver rank:**
   ```bash
   # The system will automatically:
   # 1. Add 100 PV to RiThy's leftWaitingPV
   # 2. Check: Left=100, Right=400 → Both > 0
   # 3. Auto-trigger match
   # 4. Pay $8 to RiThy
   # 5. Update: Left=0, Right=300
   ```

2. **Check RiThy's waiting PV:**
   ```sql
   SELECT "leftWaitingPV", "rightWaitingPV" 
   FROM "users" 
   WHERE "memberId" = 'ADMIN002';
   ```
   Expected: `leftWaitingPV = 0`, `rightWaitingPV = 300`

3. **Check commission:**
   ```sql
   SELECT * FROM "commissions" 
   WHERE "userId" = 'rithy-id' 
     AND "type" = 'Daily Match' 
     AND "date" >= CURRENT_DATE;
   ```
   Expected: Commission record with $8

---

## 🎯 Key Points

1. **PV flows up to ALL upline sponsors** - not just direct parent
2. **Auto-match triggers immediately** - when both legs have PV
3. **Commission paid automatically** - no manual action needed
4. **Works for ANY level** - member can join at G2, G3, G4... and PV still flows up

---

## 🔍 Debugging

If auto-match doesn't trigger:

1. **Check waiting PV:**
   ```bash
   npx tsx scripts/test-upline-cascade-match.ts
   ```

2. **Check logs:**
   - Look for "Triggering upline PV addition"
   - Look for "Added new member PV to sponsor waiting"
   - Look for "Auto-created Daily Match"

3. **Manual trigger:**
   ```bash
   npx tsx scripts/trigger-daily-match-now.ts ADMIN002
   ```

---

## ✅ Status: FULLY AUTOMATED

The system automatically:
- ✅ Adds PV to all upline sponsors when member joins/upgrades
- ✅ Triggers auto-match when both legs have PV
- ✅ Pays commission automatically
- ✅ Updates waiting PV correctly

**No manual action needed!** 🎉

