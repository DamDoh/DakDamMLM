# Binary Bonus Calculation Flow After Rank Upgrade

## Complete Flow Explanation

### Scenario: ADMIN003 receives +400 PV and upgrades from Silver → Gold

---

## Step-by-Step Flow:

### 1. **PV Transfer/Topup Occurs**
   - **Endpoint**: `/api/members/[id]/transfer-pv` (Admin transfer) or `/api/pv-topup-requests` (PV topup)
   - **Action**: 
     - Member's `user.pv` is updated: `100 → 500`
     - Rank is auto-updated: `Silver → Gold` (via `shouldUpdateRank()`)

### 2. **PV Change Handler Triggered**
   - **Function**: `PVMatchingService.handlePVChange(memberId, oldPV, newPV)`
   - **Action**:
     - Calculates PV difference: `500 - 100 = +400 PV`
     - Gets all upline sponsors (recursively up the tree)
     - For each sponsor, adds +400 PV to their waiting leg (left or right)
     - Updates sponsor's `leftWaitingPV` or `rightWaitingPV` in database
     - Triggers auto daily match if both legs have PV

### 3. **Binary Bonus Calculation Triggered**
   - **Condition**: `if (rankUpdated && newRank !== 'Member')`
   - **Function**: `calculateBinaryBonusOnRankChange(memberId)`
   - **Location**: Called from:
     - `/api/members/[id]/transfer-pv` ✅
     - `/api/pv-topup-requests` ✅
     - `/api/ecash-topup-requests` ✅
     - `/api/wallet/transfer-pv` ✅

### 4. **Binary Bonus Calculation Logic**

#### 4.1. **Validation Checks**
   ```
   ✓ Member exists
   ✓ Member has placementParentId (placed in binary tree)
   ✓ Member created within last 90 days
   ✓ Member rank is NOT "Member" (must be Bronze+)
   ✓ Sponsor exists and has valid rank (Bronze+)
   ```

#### 4.2. **Get PV Points & Commission Rate**
   ```
   Member Rank: Gold
   → getPVPointsByRank("Gold") = 500 PV
   
   Sponsor Rank: Silver (example)
   → getCommissionRateByRank("Silver") = 10% (0.10)
   
   Rank PV Values:
   - Bronze: 60 PV
   - Silver: 100 PV
   - Gold: 500 PV
   - Diamond/Manager+: 1000 PV
   ```

#### 4.3. **Check for Existing Commission**
   ```
   - Searches for Binary Bonus commissions for sponsor
   - Created after member was created
   - Matches by:
     * Description contains memberId, OR
     * Calculated PV matches a rank PV (60, 100, 500, 1000)
   ```

#### 4.4. **Two Scenarios:**

   **Scenario A: First Time (No Existing Commission)**
   ```
   - No existing commission found
   - Calculate: 500 PV × 10% = $50.00
   - Create commission record
   - Credit sponsor's wallet with $50.00
   ```

   **Scenario B: Rank Upgrade (Existing Commission Found)**
   ```
   Existing Commission:
   - Previous rank: Silver (100 PV)
   - Previous commission: 100 PV × 10% = $10.00
   
   New Calculation:
   - Current rank: Gold (500 PV)
   - New commission needed: 500 PV × 10% = $50.00
   - Difference: $50.00 - $10.00 = $40.00
   
   Action:
   - Create NEW commission for difference: $40.00
   - Description: "Binary Bonus: Member [ID] rank upgraded from 100 PV to 500 PV (difference: 400 PV) - 400 PV × 10%"
   - Credit sponsor's wallet with $40.00
   ```

### 5. **G2 Binary Bonus (If Applicable)**
   - **Function**: `autoCalculateG2BinaryBonus(grandparentId, memberId)`
   - **Condition**: If sponsor has Manager+ rank
   - **Action**: Calculates G2 bonus for grandparent (1-3% of G2 downline's PV)

---

## Example Calculation:

### Member: ADMIN003
- **Before**: Silver rank (100 PV rank value)
- **After**: Gold rank (500 PV rank value)
- **PV Difference**: +400 PV (rank-based)

### Sponsor: RiThy VoNg
- **Rank**: Silver
- **Commission Rate**: 10%

### Binary Bonus Calculation:
```
First Time (if no previous commission):
  Commission = 500 PV × 10% = $50.00
  → Full commission for Gold rank

Rank Upgrade (if previous commission exists):
  Previous: 100 PV × 10% = $10.00 (for Silver rank)
  New: 500 PV × 10% = $50.00 (for Gold rank)
  Difference: $40.00 (paid as new commission)
  → Only pays the difference, not the full amount again
```

---

## Endpoints That Trigger Binary Bonus:

1. ✅ **`/api/members/[id]/transfer-pv`** - Admin PV transfer
2. ✅ **`/api/pv-topup-requests`** - PV topup request approval
3. ✅ **`/api/ecash-topup-requests`** - E-cash topup request approval
4. ✅ **`/api/wallet/transfer-pv`** - Member-to-member PV transfer
5. ✅ **`/api/members/[id]` (PATCH)** - Direct rank update

---

## Key Functions:

1. **`calculateBinaryBonusOnRankChange(memberId)`**
   - Main function that calculates binary bonus
   - Handles both first-time and rank upgrade scenarios
   - Creates commission and credits wallet

2. **`handlePVChange(memberId, oldPV, newPV)`**
   - Updates waiting PV for all upline sponsors
   - Ensures "Current Period Volume" reflects new PV

3. **`handleRankChange(memberId, oldRank, newRank)`**
   - Adds PV to upline sponsors' waiting legs
   - Used when rank changes (separate from PV change)

---

## Verification Checklist:

✅ Binary bonus calculates when member first gets rank (Member → Bronze+)  
✅ Binary bonus calculates when member upgrades rank (Silver → Gold, etc.)  
✅ Creates new commission for PV difference on rank upgrades  
✅ All PV transfer/topup endpoints trigger binary bonus  
✅ Sponsor's wallet is credited automatically  
✅ Commission records are created with proper descriptions  
✅ G2 binary bonus is calculated for Manager+ sponsors  

---

## Notes:

- Binary bonus is calculated based on **member's rank PV** (not actual `user.pv`)
- Commission rate is based on **sponsor's rank**
- Only calculates for members created within last 90 days
- Only calculates if both member and sponsor have valid ranks (Bronze+)
- On rank upgrades, creates a NEW commission for the difference (doesn't modify existing)
