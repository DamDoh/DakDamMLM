# Stock Request Feature - Testing Guide

## Current Status
✅ Request Stock Dialog - Created
✅ API Endpoint - Configured  
✅ Product Page Integration - Complete
✅ Admin Approval Flow - Implemented
✅ PV Calculation - Added
✅ Wallet Transaction - Added
✅ Inventory Deduction - Added

## Step-by-Step Testing

### Step 1: Login
1. Go to http://localhost:3000/login
2. Login with your account (must be a stockist member with storeOwnerLevel)

### Step 2: Submit Stock Request
1. Go to http://localhost:3000/product
2. Find any product with "Request Stock" button
3. Click "Request Stock"
4. Enter quantity (e.g., 5)
5. Add optional notes
6. Click "Submit Request"

**Expected Result:** Success message appears

**If you see an error:**
- Check browser console (F12 → Console tab)
- Look for the error message
- Common issues:
  - "Session Expired" → Log out and log back in
  - "Too Many Requests" → Wait 1 minute
  - "Authentication Required" → Clear cookies and login again

### Step 3: Verify Request Created (Admin)
1. Login as admin
2. Go to http://localhost:3000/admin/binary-stock
3. Click "Stock Requests" tab
4. You should see your pending request

### Step 4: Approve Request (Admin)
1. Click "Approve" button on the request
2. Confirm approval

**Expected Results:**
✅ Request status changes to "approved"
✅ Stockist's PV increases
✅ Product quantity decreases
✅ Wallet transaction created

### Step 5: Verify Results
1. **Check PV:** Go to member details → PV should be increased
2. **Check Wallet:** Go to E-Cash page → Should see "stock_purchase" transaction
3. **Check Inventory:** Go to Products admin → Product qty should be decreased

## Troubleshooting

### Error: "Invalid or expired token"
**Solution:** Log out and log back in to get fresh token

### Error: "429 Too Many Requests"  
**Solution:** Wait 15 minutes or restart dev server

### Error: "500 Internal Server Error"
**Solution:** 
1. Check terminal for error logs
2. Restart dev server: `npm run dev`
3. Regenerate Prisma client: `npx prisma generate`

### Request Stock button not visible
**Solution:** Make sure you're logged in as a stockist member (storeOwnerLevel: S, M, C, or D)

### Dialog doesn't open
**Solution:**
1. Hard refresh page (Cmd+Shift+R or Ctrl+Shift+R)
2. Clear browser cache
3. Check browser console for errors

## API Endpoints

- **POST** `/api/stock-requests` - Create new request
- **GET** `/api/stock-requests` - List requests
- **PATCH** `/api/stock-requests` - Approve/reject request

## Database Tables Affected

1. `stock_requests` - Stores request data
2. `stock_request_items` - Stores requested products
3. `users` - PV updated
4. `wallets` - Balance updated
5. `wallet_transactions` - Transaction record created
6. `products` - Quantity decreased

## Quick Test Command

Run this in browser console after logging in:
```javascript
// Get auth token
const token = localStorage.getItem('auth_token');
console.log('Token exists:', !!token);

// Test API endpoint
fetch('/api/stock-requests', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(d => console.log('API Response:', d))
.catch(e => console.error('API Error:', e));
```

## Need Help?

If nothing works:
1. Share the exact error message from browser console
2. Share the terminal output where dev server is running
3. Tell me which step is failing
