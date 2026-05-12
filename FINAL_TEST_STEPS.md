# Stock Request System - Final Testing Steps

## ✅ Everything is Ready!

All components have been implemented:
- ✅ Request Stock Dialog
- ✅ API Endpoints (POST, GET, PATCH)
- ✅ Product Page Integration
- ✅ Admin Approval with PV calculation
- ✅ Wallet Transaction creation
- ✅ Inventory deduction
- ✅ Label changed to "Quantity in Stock"

---

## 🚀 TESTING PROCEDURE

### STEP 1: Restart Dev Server
```bash
# Stop current server (Ctrl+C)
# Then run:
npm run dev
```

### STEP 2: Login as Stockist Member
1. Open browser: `http://localhost:3000/login`
2. Login with account that has **storeOwnerLevel** (S, M, C, or D)
3. If you don't have one, login as admin first and assign stockist level to a member

### STEP 3: Submit Stock Request
1. Go to: `http://localhost:3000/product`
2. You should see products with "Quantity in Stock: 150" (or similar)
3. Click **"Request Stock"** button on any product
4. A dialog will open
5. Enter quantity: `10`
6. Add notes (optional): `Test request`
7. Click **"Submit Request"**

**Expected:** Green success message appears

**If error appears:**
- Open browser console (F12 → Console)
- Copy the error message
- Tell me what it says

### STEP 4: Verify Request Created
1. Login as **Admin**
2. Go to: `http://localhost:3000/admin/binary-stock`
3. Click **"Stock Requests"** tab
4. You should see your pending request with:
   - Stockist name
   - Product name
   - Quantity requested
   - Status: "pending"

### STEP 5: Approve Request (Admin)
1. Click **"Approve"** button on the request
2. Confirm the approval

**Expected:** Status changes to "approved"

### STEP 6: Verify Results

#### A. Check PV Updated
1. Go to member details or binary tree
2. Stockist's PV should have increased
3. Formula: `PV = Product PV × Quantity`
   - Example: If product PV = 20 and quantity = 10
   - Then PV added = 200

#### B. Check Wallet Transaction
1. Go to: `http://localhost:3000/wallet` or E-Cash page
2. Look for transaction with type: "stock_purchase"
3. Should show:
   - Negative amount (deduction)
   - Description: "Stock request #xxxxx approved - X item(s)"
   - Status: completed

#### C. Check Product Inventory
1. Go to: `http://localhost:3000/admin/products`
2. Find the product you requested
3. Quantity should be decreased by the approved amount
   - Example: Was 150 → Now 140 (if you requested 10)

---

## 🐛 Troubleshooting

### "Request Stock" button not visible
**Cause:** Not logged in as stockist member
**Solution:** 
1. Login as admin
2. Go to member management
3. Assign storeOwnerLevel (S, M, C, or D) to a member
4. Logout and login as that member

### "Session Expired" error
**Cause:** Auth token expired
**Solution:** Logout and login again

### "429 Too Many Requests"
**Cause:** Rate limit hit
**Solution:** Wait 1 minute or restart dev server

### Dialog doesn't open
**Cause:** JavaScript error or cache issue
**Solution:**
1. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. Check browser console for errors
3. Clear browser cache

### Request not appearing in admin panel
**Cause:** Database not updated or wrong user
**Solution:**
1. Check if you're logged in as admin
2. Refresh the page
3. Check "Stock Requests" tab specifically

### Approval doesn't work
**Cause:** Permission issue or API error
**Solution:**
1. Make sure you're logged in as admin
2. Check browser console for errors
3. Check terminal for server errors

---

## 📊 Quick Verification Checklist

After approval, verify these 3 things:

1. **PV Increased?**
   - [ ] Yes → Working!
   - [ ] No → Check user PV field in database

2. **Transaction Created?**
   - [ ] Yes → Working!
   - [ ] No → Check wallet_transactions table

3. **Inventory Decreased?**
   - [ ] Yes → Working!
   - [ ] No → Check products table qty field

---

## 🎯 What to Tell Me If It Fails

Please provide:
1. **Which step failed?** (1-6)
2. **Exact error message** (screenshot or text from console)
3. **Are you logged in as stockist or admin?**
4. **What happens when you click the button?**

I'll fix it immediately once you tell me the specific issue!
