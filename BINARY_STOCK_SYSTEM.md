# Binary Stock Management System

## Overview
The Binary Stock Management system allows admins and stockists to manage and track stock distribution across the binary tree structure. This integrates your existing Binary Tree genealogy with Stock Management.

---

## 🎯 Features

### **Admin Features**
1. **Binary Tree Stock Visualization**
   - View binary tree with stock levels for each member
   - See stock distribution by left/right legs
   - Track stock balance across binary network
   - Search for any member's binary tree

2. **Stock Distribution Tracking**
   - Total stock in left leg
   - Total stock in right leg
   - Balance difference between legs
   - Stock levels per member

3. **Stock Transfer**
   - Transfer stock to binary downline (left/right)
   - Track stock movement through binary tree
   - Automatic Stockist Bonus on transfers

### **Member Features**
1. **View Binary Stock Tree**
   - See their own binary tree with stock levels
   - View stock available from upline
   - Track stock in their downline

2. **Stock Inventory**
   - View current stock items
   - See stock quantities by product
   - Track stock movement

---

## 📊 How It Works

### **Binary Stock Flow**
```
Admin/Stockist (Root)
    ├── Left Leg Member (100 units)
    │   ├── Left-Left (50 units)
    │   └── Left-Right (30 units)
    └── Right Leg Member (80 units)
        ├── Right-Left (40 units)
        └── Right-Right (25 units)
```

### **Stock Distribution Calculation**
- **Left Leg Total**: Sum of all stock in left leg (recursive)
- **Right Leg Total**: Sum of all stock in right leg (recursive)
- **Balance**: Absolute difference between left and right
- **Total Network Stock**: Left + Right + Root stock

---

## 🔧 Technical Implementation

### **API Endpoints**

#### **GET /api/binary-stock**
Get binary tree with stock levels

**Query Parameters:**
- `userId` (optional) - User ID to view (defaults to current user)
- `depth` (optional) - Tree depth to load (default: 3)

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user123",
      "fullName": "John Doe",
      "memberId": "MEM001",
      "storeOwnerLevel": "S",
      "stockInventory": {
        "items": [...],
        "totalStock": 150,
        "productCount": 5
      }
    },
    "binaryTree": {
      "id": "user123",
      "fullName": "John Doe",
      "stockLevel": 150,
      "left": {...},
      "right": {...}
    },
    "stockDistribution": {
      "left": 180,
      "right": 120,
      "total": 300,
      "balance": 60
    }
  }
}
```

#### **POST /api/binary-stock/transfer**
Transfer stock through binary tree

**Request Body:**
```json
{
  "toUserId": "recipient123",
  "items": [
    {
      "productId": "prod123",
      "productName": "Product A",
      "quantity": 10,
      "unitPrice": 100
    }
  ],
  "leg": "left" // or "right"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transferId": "TRANSFER-123456",
    "message": "Successfully transferred stock to John Doe (Left leg)",
    "leg": "left"
  }
}
```

---

## 🎨 UI Components

### **Admin Page: `/admin/binary-stock`**

**Features:**
1. **Search Bar** - Search by Member ID
2. **Summary Cards:**
   - Current User Info
   - Total Stock
   - Left Leg Stock
   - Right Leg Stock
3. **Stock Distribution Balance** - Shows left/right balance
4. **Binary Tree Visualization** - Interactive tree with stock levels
5. **Current Stock Inventory** - List of available stock items

**Visual Elements:**
- Color-coded stock levels:
  - Green: > 100 units
  - Yellow: 50-100 units
  - Red: < 50 units
- Click on any node to transfer stock
- Stockist level badges (S/M/C/D)

---

## 💰 Stockist Bonus Integration

When stock is transferred through the binary tree:
1. **Stockist Bonus is calculated** based on transferred PV
2. **Formula**: `Transferred PV × Stockist Rate`
3. **Rates:**
   - S (Small Mobile): 0.8%
   - M (Mobile): 1.7%
   - C (Center): 2.6%
   - D (Dealer): 3.0%

**Example:**
- Admin S transfers 1,000 PV to left leg member
- Stockist Bonus = 1,000 × 0.8% = $8.00
- Admin receives $8.00 commission

---

## 🔐 Permissions

### **Who Can Access:**
- ✅ **Super Admin** - Full access to all binary trees
- ✅ **Admin** - Access to their company's binary trees
- ✅ **Stockist (S/M/C/D)** - Access to their own binary tree
- ❌ **Regular User** - View only (no transfer)

### **Transfer Permissions:**
- **Admin** - Can transfer to any member in binary tree
- **Stockist** - Can transfer to direct downline only (left/right children)
- **Regular User** - Cannot transfer

---

## 📈 Business Benefits

1. **Better Stock Distribution**
   - Track stock flow through binary network
   - Balance stock between left/right legs
   - Identify stock shortages by leg

2. **Improved Inventory Management**
   - See stock levels at each binary position
   - Plan stock transfers strategically
   - Optimize stock distribution

3. **Enhanced Team Support**
   - Help downline members with stock needs
   - Transfer stock to active legs
   - Support team growth with inventory

4. **Performance Tracking**
   - Monitor stock movement
   - Track which legs are more active
   - Identify top-performing branches

---

## 🚀 Usage Guide

### **For Admins:**

1. **View Binary Stock Tree**
   - Go to `/admin/binary-stock`
   - See your binary tree with stock levels
   - View stock distribution by leg

2. **Search for Member**
   - Enter Member ID in search bar
   - Click "Search"
   - View that member's binary tree

3. **Transfer Stock**
   - Click on any member in the tree
   - Transfer dialog will open (coming soon)
   - Select products and quantities
   - Confirm transfer

### **For Stockists:**

1. **View Your Tree**
   - Access binary stock page
   - See your downline stock levels
   - Check left/right leg balance

2. **Transfer to Downline**
   - Click on left or right child
   - Transfer stock as needed
   - Earn Stockist Bonus on transfer

---

## 🔄 Integration with Existing Systems

### **Binary Tree System**
- Uses existing `children` field (left/right)
- Integrates with genealogy structure
- Maintains binary tree integrity

### **Stock Management**
- Uses existing `InventoryTransaction` model
- Integrates with `transferStock()` function
- Maintains stock inventory tracking

### **Commission System**
- Triggers Stockist Bonus on transfers
- Uses existing commission calculation
- Credits wallet automatically

---

## 📝 Database Schema

**No new tables required!** Uses existing:
- `User` - Binary tree structure (children field)
- `InventoryTransaction` - Stock tracking
- `Product` - Product information
- `Commission` - Stockist Bonus records

---

## 🎯 Future Enhancements

1. **Stock Request System**
   - Members can request stock from upline
   - Upline approves/rejects requests
   - Automated stock allocation

2. **Stock Transfer Dialog**
   - Select products from inventory
   - Set quantities
   - Preview Stockist Bonus
   - Confirm transfer

3. **Stock Reports**
   - Stock movement history
   - Distribution analytics
   - Performance metrics by leg

4. **Stock Alerts**
   - Low stock warnings
   - Imbalance notifications
   - Transfer suggestions

---

## ✅ Testing Checklist

- [ ] Admin can view binary stock tree
- [ ] Search by Member ID works
- [ ] Stock levels display correctly
- [ ] Left/right leg totals are accurate
- [ ] Stock distribution balance calculates correctly
- [ ] Tree visualization renders properly
- [ ] Current inventory displays
- [ ] Click on node opens transfer dialog
- [ ] Permissions work correctly (admin vs stockist vs user)
- [ ] API endpoints return correct data

---

## 🐛 Troubleshooting

**Issue: Stock levels not showing**
- Check if `InventoryTransaction` records exist
- Verify product data is available
- Ensure user has stock inventory

**Issue: Binary tree not loading**
- Check if user has children (left/right)
- Verify depth parameter (default: 3)
- Check API response for errors

**Issue: Transfer not working**
- Verify user has permission (admin/stockist)
- Check if recipient is in binary downline
- Ensure sufficient stock available

---

## 📞 Support

For issues or questions:
1. Check API logs for errors
2. Verify database records
3. Test with different users
4. Review permission settings

---

*Created: December 31, 2025*
*Version: 1.0*
