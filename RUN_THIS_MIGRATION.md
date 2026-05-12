# Stock Items PV Field Migration

## The Problem
The stock items update is failing because the database doesn't have the `pv` (Point Value) column yet.

## Solution - Run These Commands

Open your terminal in the project directory and run:

```bash
# Step 1: Generate Prisma client with new PV field
npx prisma generate

# Step 2: Push schema changes to database
npx prisma db push

# Step 3: Restart your development server
# Press Ctrl+C to stop the current server, then:
npm run dev
```

## Alternative: Create a proper migration (recommended for production)

```bash
# Create a migration file
npx prisma migrate dev --name add_pv_to_stock_items

# This will:
# 1. Create a migration file
# 2. Apply it to your database
# 3. Generate the Prisma client
```

## After Running the Commands

1. The TypeScript errors will disappear
2. Stock item updates will work
3. You can create and edit stock items with PV values

## What Changed

- Added `pv` field to StockItem model in schema.prisma
- Updated Stock Items API to handle PV in POST and PATCH
- Updated Stock Items page to show PV column and input field
- Updated Edit dialog to allow editing all fields including PV
