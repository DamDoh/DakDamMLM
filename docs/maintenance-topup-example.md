# Maintenance Topup System - Example Flow

## Scenario: Silver Rank Member "John Doe" (Member ID: MEM123)

### Step 1: User Opens E-Cash Page
- John navigates to the **E-Cash** page
- Sees two buttons:
  - **"Request PV Points Top-Up"** (for regular PV topup)
  - **"Account Maintenance Top-Up"** (for monthly maintenance) ← Click this

### Step 2: Maintenance Topup Dialog Opens
When John clicks "Account Maintenance Top-Up", the dialog shows:

```
┌─────────────────────────────────────────────┐
│ Account Maintenance Top-Up                  │
├─────────────────────────────────────────────┤
│                                             │
│ ⚠️ Monthly maintenance payment is required │
│    to receive commission and matching bonus.│
│    If not paid, bonuses will be disabled    │
│    for this month.                          │
│                                             │
│ Maintenance Amount (Minimum: 20 PV)         │
│ [20] ← Auto-filled based on Silver rank    │
│ Required maintenance topup for your rank:   │
│ 20 PV per month                             │
│                                             │
│ Proof of Payment                            │
│ [Upload screenshot]                         │
│                                             │
│ Remark (Optional)                           │
│ [Add any notes for the admin here...]      │
│                                             │
│ [Submit Maintenance Request]                │
└─────────────────────────────────────────────┘
```

**What happens:**
- System detects John's rank is **Silver**
- Auto-fills minimum required amount: **20 PV**
- John can enter 20 PV or more (e.g., 25 PV, 30 PV)
- If John tries to enter 15 PV → Error: "Minimum maintenance topup amount for Silver rank is 20 PV. You entered 15 PV."

### Step 3: User Submits Request
John:
1. Enters amount: **20 PV** (or higher)
2. Uploads payment proof (screenshot of bank transfer)
3. Adds remark: "Payment for January 2025 maintenance"
4. Clicks **"Submit Maintenance Request"**

**API validates:**
- ✅ Amount ≥ 20 PV (minimum for Silver) → Valid
- ✅ Month format: "2025-01" → Valid
- ✅ Proof uploaded → Valid
- ✅ No existing approved request for January → Valid

**Database record created:**
```json
{
  "id": "req_abc123",
  "memberId": "MEM123",
  "memberName": "John Doe",
  "amount": 20,
  "month": "2025-01",
  "status": "pending",
  "proofUrl": "data:image/png;base64...",
  "remark": "Payment for January 2025 maintenance",
  "createdDate": "2025-01-15T10:30:00Z"
}
```

### Step 4: Admin Approves Request
Admin logs into admin panel:
- Sees pending maintenance request from John Doe
- Reviews payment proof
- Approves the request

**Database updated:**
```json
{
  "status": "approved",
  "processedBy": "admin_user_id",
  "processedDate": "2025-01-15T14:00:00Z"
}
```

### Step 5: Maintain Status Updates
When John (or anyone) views John's profile:

**Before Approval:**
```
Maintain Status: Not Maintain ❌ (red text)
```

**After Approval:**
```
Maintain Status: Maintain ✅ (green text)
```

The system checks:
- Month: "2025-01" (current month)
- Status: "approved" or "completed"
- ✅ Found → Status = "Maintain"

### Step 6: Matching Bonuses Work

**Scenario A: Maintenance Paid ✅**

**January 15, 2025 - Daily Match Bonus Calculation:**
1. System checks: "Does MEM123 have approved maintenance for 2025-01?"
   - ✅ Yes (approved on Jan 15)
2. System calculates Daily Match Bonus:
   - Left leg: 100 PV
   - Right leg: 150 PV
   - Matched: 100 PV
   - Bonus: 100 PV × 8% = $8.00
3. ✅ **Bonus is paid** - Wallet credited $8.00

**January 15, 2025 - Binary Bonus Calculation:**
1. System checks: "Does MEM123 have approved maintenance for 2025-01?"
   - ✅ Yes
2. System calculates Binary Bonus:
   - Left leg volume: 100 PV
   - Right leg volume: 150 PV
   - Binary Bonus: (100 PV + 150 PV) × 10% (Silver rate) = $25.00
3. ✅ **Bonus is paid** - Commission created $25.00

**Scenario B: Maintenance NOT Paid ❌**

**February 1, 2025 - No Maintenance Payment:**
1. System checks: "Does MEM123 have approved maintenance for 2025-02?"
   - ❌ No (no request found)
2. Daily Match Bonus attempt:
   - Left leg: 100 PV
   - Right leg: 150 PV
   - Matched: 100 PV
   - Calculation: 100 PV × 8% = $8.00
   - **BLOCKED** ❌
   - Response: "Monthly maintenance topup not paid - matching bonus is disabled. Please pay maintenance topup to receive bonuses."
3. Binary Bonus attempt:
   - **BLOCKED** ❌
   - Log: "⚠️ Binary Bonus skipped for MEM123: Monthly maintenance topup not paid"
   - Returns: `{ totalCommission: 0, reason: 'Monthly maintenance topup not paid - bonuses disabled' }`

### Step 7: Different Ranks, Different Requirements

**Example 1: Gold Member (20 PV required)**
- Opens dialog → Auto-fills: **20 PV**
- Can pay 20, 25, 30 PV, etc.
- Cannot pay less than 20 PV

**Example 2: Manager Member (40 PV required)**
- Opens dialog → Auto-fills: **40 PV**
- Can pay 40, 50, 60 PV, etc.
- Cannot pay less than 40 PV

**Example 3: Bronze Member (20 PV required)**
- Opens dialog → Auto-fills: **20 PV**
- Can pay 20 PV or more
- Cannot pay less than 20 PV

### Complete Flow Summary

```
┌─────────────────────────────────────────────────────────┐
│ 1. User Clicks "Account Maintenance Top-Up"            │
│    ↓                                                    │
│ 2. Dialog Opens - Shows Required Amount (20 PV/Silver) │
│    ↓                                                    │
│ 3. User Enters Amount ≥ 20 PV + Uploads Proof          │
│    ↓                                                    │
│ 4. API Validates: Amount ≥ Minimum? ✅                 │
│    ↓                                                    │
│ 5. Request Created (status: "pending")                 │
│    ↓                                                    │
│ 6. Admin Approves Request                              │
│    ↓                                                    │
│ 7. Maintain Status → "Maintain" (green) ✅             │
│    ↓                                                    │
│ 8. Matching Bonuses Work Normally ✅                   │
│    - Daily Match Bonus: ✅ Paid                        │
│    - Binary Bonus: ✅ Paid                             │
│    - Matching Bonus: ✅ Paid                           │
│                                                         │
│ IF NO MAINTENANCE:                                     │
│    ↓                                                    │
│ 9. Maintain Status → "Not Maintain" (red) ❌          │
│    ↓                                                    │
│ 10. All Matching Bonuses BLOCKED ❌                    │
│     - Daily Match Bonus: ❌ Blocked                    │
│     - Binary Bonus: ❌ Blocked                         │
│     - Matching Bonus: ❌ Blocked                       │
└─────────────────────────────────────────────────────────┘
```

### Real-World Example Timeline

**January 1, 2025:**
- John (Silver) hasn't paid maintenance yet
- Maintain Status: **"Not Maintain"** ❌
- Tries to trigger Daily Match → **BLOCKED** ❌

**January 5, 2025:**
- John pays 20 PV maintenance topup
- Submits request with proof
- Status: **"pending"**
- Maintain Status: Still **"Not Maintain"** ❌ (not approved yet)
- Bonuses still blocked

**January 6, 2025:**
- Admin approves request
- Status: **"approved"**
- Maintain Status: **"Maintain"** ✅
- John triggers Daily Match → **PAID** ✅ $8.00
- Binary Bonus calculated → **PAID** ✅ $25.00

**February 1, 2025:**
- New month starts
- John hasn't paid February maintenance yet
- Maintain Status: **"Not Maintain"** ❌ (no approved request for 2025-02)
- Bonuses blocked again until February maintenance is paid

**February 10, 2025:**
- John pays 20 PV for February
- Admin approves
- Maintain Status: **"Maintain"** ✅
- Bonuses work again for February ✅

---

## Key Points:

1. **Monthly Requirement**: Must pay maintenance each month to keep bonuses working
2. **Rank-Based**: Different ranks have different minimum requirements
3. **Real-Time**: Status updates immediately after admin approval
4. **Bonus Protection**: All matching bonuses are blocked if maintenance not paid
5. **User-Friendly**: Dialog auto-fills required amount based on rank

