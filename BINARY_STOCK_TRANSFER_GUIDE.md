# Binary Stock Transfer System - Complete Guide

## Overview
The binary stock transfer system is fully integrated with the new stock items structure, allowing admins and stockists to transfer stock to their downline members in the binary tree.

## How It Works

### 1. Stock Items Structure
Each stock item now contains:
- **Stock Name**: e.g., "L (Long stock)"
- **Quantity**: Number of sets (e.g., 5 sets)
- **Products**: List of products in each set
- **Total Price**: Combined price of all products
- **Total PV**: Combined PV of all products

### 2. Transfer Process

#### Step 1: Select Recipient
- Navigate to Binary Stock page
- Click on a node in the binary tree
- Click "Transfer Stock" button

#### Step 2: Select Stock Items
- System shows available stock items from admin's inventory
- Each stock item displays:
  - Stock name
  - Available quantity (number of sets)
  - Products contained in the stock

#### Step 3: Choose Quantity
- Select how many sets to transfer
- Example: If stock has 10 sets, you can transfer 1-10 sets

#### Step 4: Confirm Transfer
- Click "Confirm Transfer"
- System processes the transfer:
  1. Deducts quantity from admin's stock
  2. Creates inventory transaction for recipient
  3. Credits recipient's e-cash with PV value
  4. Updates binary tree display

### 3. What Gets Transferred

**Example Transfer:**
- Stock: "L (Long stock)"
- Contains: Super Chitin Powder (10), Organic Fertilizer Green (20), Organic Fertilizer Orange (15)
- Transfer Quantity: 3 sets
- Total PV per set: 2,400 PV

**Result:**
- Admin's stock: Reduced by 3 sets (e.g., 10 → 7 sets)
- Recipient receives:
  - Inventory transaction record
  - E-cash credit: 7,200 PV (2,400 × 3)
  - Stock tracking in their inventory

### 4. PV Calculation

The system automatically calculates PV:
```
Total PV Credited = (Stock PV per set) × (Quantity transferred)
```

**Example:**
- Stock PV: 2,400 PV per set
- Transfer: 3 sets
- **Total PV Credited: 7,200 PV**

### 5. Inventory Tracking

**For Admin (Sender):**
- Stock quantity decremented in Stock Items table
- Can view remaining stock in admin/stock-items

**For Recipient (Admin Stockist):**
- Inventory transaction created
- Can view received stock in their inventory
- E-cash wallet credited with PV value
- Stock appears in binary tree view

### 6. Permissions

**Who Can Transfer:**
- ✅ Admins (can transfer to anyone)
- ✅ Stockists (can transfer to direct downline only)
- ❌ Regular members (cannot transfer)

### 7. Stock Display in Binary Tree

Each node shows:
- Member name and ID
- Stock level (color-coded)
- Number of stock items
- Transfer button (if authorized)

**Color Coding:**
- 🟢 Green: Stock > 100
- 🟡 Yellow: Stock 50-100
- 🔴 Red: Stock < 50

## Benefits

1. **Simplified Management**: Stock items group products together
2. **Automatic PV Credit**: Recipients get e-cash automatically
3. **Quantity Control**: Transfer specific number of sets
4. **Audit Trail**: All transfers tracked in inventory transactions
5. **Binary Tree Integration**: Visual representation of stock distribution

## Example Workflow

### Creating Stock for Transfer

1. **Create Stock Item** (admin/stock-items)
   - Name: "Starter Package"
   - Add products:
     - Super Chitin Powder: 5 units
     - Organic Fertilizer Green: 10 units
   - Stock Quantity: 20 sets
   - Total PV: 500 per set

2. **Transfer to Stockist**
   - Go to Binary Stock page
   - Select stockist node
   - Click "Transfer Stock"
   - Select "Starter Package"
   - Transfer: 5 sets
   - Stockist receives: 2,500 PV (500 × 5)

3. **Stockist Can Re-transfer**
   - Stockist now has 5 sets in inventory
   - Can transfer to their downline
   - Same process repeats

## Technical Details

### API Endpoint
`POST /api/binary-stock/transfer`

### Request Format
```json
{
  "toUserId": "recipient-user-id",
  "items": [
    {
      "productId": "stock-item-id",
      "productName": "Stock Name",
      "quantity": 3
    }
  ]
}
```

### Response
```json
{
  "success": true,
  "transferId": "STOCK-TRANSFER-1234567890",
  "message": "Successfully transferred stock to John Doe (Left leg)",
  "leg": "left"
}
```

## Best Practices

1. **Stock Organization**: Create logical stock packages (e.g., "Starter", "Premium", "Dealer")
2. **Quantity Management**: Keep track of available sets before transferring
3. **PV Monitoring**: Check recipient's e-cash to verify PV credit
4. **Regular Updates**: Review binary tree to see stock distribution
5. **Audit Checks**: Use inventory transactions to track all transfers

## Troubleshooting

**Issue**: Transfer fails with "Insufficient stock"
- **Solution**: Check available quantity in Stock Items table

**Issue**: PV not credited
- **Solution**: Check inventory transactions and e-cash wallet logs

**Issue**: Cannot transfer to member
- **Solution**: Verify binary relationship (must be direct downline for stockists)

---

**The binary stock transfer system is now fully integrated with the new stock items structure and ready to use!**
