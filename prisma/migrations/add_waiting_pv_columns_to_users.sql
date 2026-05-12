-- Migration: Add leftWaitingPV and rightWaitingPV columns to users table
-- This stores waiting PV (carry-forward unmatched PV) as separate columns

-- Drop the JSON waitingPV column if it exists
ALTER TABLE "users" 
DROP COLUMN IF EXISTS "waitingPV";

-- Add separate columns for left and right waiting PV
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "leftWaitingPV" DOUBLE PRECISION DEFAULT 0;

ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "rightWaitingPV" DOUBLE PRECISION DEFAULT 0;

-- Update existing users to have default values if null
UPDATE "users" 
SET "leftWaitingPV" = 0
WHERE "leftWaitingPV" IS NULL;

UPDATE "users" 
SET "rightWaitingPV" = 0
WHERE "rightWaitingPV" IS NULL;

