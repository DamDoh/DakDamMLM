-- Add PV column to stock_items table
ALTER TABLE "stock_items" ADD COLUMN "pv" DOUBLE PRECISION NOT NULL DEFAULT 0;
