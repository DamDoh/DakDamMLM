-- Migration: Add waitingPV column to users table
-- This stores waiting PV (carry-forward unmatched PV) as JSON in the user record

-- Add waitingPV column with default value
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "waitingPV" JSONB DEFAULT '{"leftWaitingPV":0,"rightWaitingPV":0,"lastUpdated":null}'::jsonb;

-- Update existing users to have default waitingPV if null
UPDATE "users" 
SET "waitingPV" = '{"leftWaitingPV":0,"rightWaitingPV":0,"lastUpdated":null}'::jsonb
WHERE "waitingPV" IS NULL;

