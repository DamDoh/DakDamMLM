-- Migration: Drop waiting_pv table
-- This table has been removed from the codebase
-- Run this SQL manually in your database to drop the table

DROP TABLE IF EXISTS waiting_pv CASCADE;

-- Note: pv_match_transactions table is kept for historical records
-- If you also want to drop it, uncomment the line below:
-- DROP TABLE IF EXISTS pv_match_transactions CASCADE;

