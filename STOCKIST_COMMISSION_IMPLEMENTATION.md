# Stockist Commission Implementation

## Overview
This document describes the implementation of automatic commission calculation for admin stockists when they sell or transfer stock to members.

## Commission Structure

Based on the admin stockist level, commissions are calculated as follows:

| Level | Name | Commission Rate | Example (on $1000 sale) |
|-------|------|----------------|------------------------|
| **S** | Small Mobile | 0.8% | $8.00 |
| **M** | Mobile | 1.7% | $17.00 |
| **C** | Center | 2.6% | $26.00 |
| **D** | Dealer | 3.0% | $30.00 |

## Implementation Details

### Location
`src/services/inventory-service.ts` - `transferStock()` function

### How It Works

1. **Trigger Condition**: Commission is calculated when:
   - An admin stockist (with `storeOwnerLevel` of S, M, C, or D) sells or transfers stock
   - The transfer is from a user to another user (not system transfers)
   - The seller is active and has a valid stockist level

2. **Calculation Process**:
   ```typescript
   // Calculate total sale amount
   totalSaleAmount = sum(item.quantity × item.unitPrice)
   
   // Get commission percentage based on stockist level
   commissionPercentage = stockistLevelCommissions[stockistLevel]
   
   // Calculate commission
   commissionAmount = totalSaleAmount × (commissionPercentage / 100)
   ```

3. **Commission Creation**:
   - Creates a commission record with type: `Stockist Bonus (S|M|C|D)`
   - Status: `Paid` (immediately paid)
   - Automatically credits the commission to the stockist's wallet

4. **Error Handling**:
   - If wallet credit fails, commission status is set back to `Pending`
   - Stock transfer still succeeds even if commission creation fails
   - All errors are logged for debugging

## Example Scenarios

### Scenario 1: Small Mobile Admin (S) sells $3,000 worth of stock
- Sale Amount: $3,000
- Commission Rate: 0.8%
- Commission: $3,000 × 0.008 = **$24.00**

### Scenario 2: Mobile Admin (M) transfers $15,000 worth of stock
- Sale Amount: $15,000
- Commission Rate: 1.7%
- Commission: $15,000 × 0.017 = **$255.00**

### Scenario 3: Center Admin (C) sells $30,000 worth of stock
- Sale Amount: $30,000
- Commission Rate: 2.6%
- Commission: $30,000 × 0.026 = **$780.00**

### Scenario 4: Dealer Admin (D) transfers $150,000 worth of stock
- Sale Amount: $150,000
- Commission Rate: 3.0%
- Commission: $150,000 × 0.03 = **$4,500.00**

## Functions Affected

### 1. `transferStock()` in `inventory-service.ts`
- Main function that handles stock transfers
- Now includes commission calculation logic
- Called by both `sellStockToDownline()` and `transferStock()` server actions

### 2. `sellStockToDownline()` in `server-actions.ts`
- Uses `transferStock()` internally
- Automatically triggers commission calculation

### 3. `transferStock()` in `server-actions.ts`
- Uses `transferStock()` from inventory-service
- Automatically triggers commission calculation

## Commission Record Details

Each commission record created includes:
- **userId**: The admin stockist's ID
- **amount**: Calculated commission amount
- **type**: `Stockist Bonus (S)` or `Stockist Bonus (M)` etc.
- **status**: `Paid` (immediately paid to wallet)
- **date**: Current date/time
- **companyId**: Associated company ID

## Wallet Integration

Commissions are automatically credited to the stockist's wallet using:
- `WalletService.creditWallet()`
- Transaction type: `commission`
- Description includes stockist level and percentage

## Important Notes

1. **System Transfers**: No commission is created for system-to-user transfers (admin inventory management)

2. **Self Transfers**: No commission is created if a user transfers stock to themselves

3. **Price Calculation**: If `unitPrice` is not provided or is 0, the system fetches the product price from the database

4. **Active Status**: Only active stockists receive commissions

5. **Validation**: Stockist level must be one of: S, M, C, or D

## Testing

To test the commission system:

1. Create an admin stockist with `storeOwnerLevel` set to 'S', 'M', 'C', or 'D'
2. Ensure the stockist has stock in their inventory
3. Transfer or sell stock to a member
4. Check that:
   - Commission record is created in the database
   - Commission amount matches: `saleAmount × commissionRate`
   - Commission is credited to stockist's wallet
   - Commission status is 'Paid'

## Database Schema

Commissions are stored in the `commissions` table:
- `userId`: Stockist ID
- `amount`: Commission amount
- `type`: Commission type (e.g., "Stockist Bonus (S)")
- `status`: Payment status
- `date`: Commission date
- `companyId`: Company association

## Future Enhancements

Potential improvements:
1. Commission history dashboard for stockists
2. Commission reports by level
3. Commission caps or limits
4. Commission tiers based on volume
5. Commission sharing between levels

