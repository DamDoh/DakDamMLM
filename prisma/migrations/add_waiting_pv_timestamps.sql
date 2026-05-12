-- Migration: Add timestamp columns for waiting PV expiration tracking
-- Safety Rule #2: Carry Forward Policy - Track when waiting PV was created
-- These timestamps are used to expire waiting PV older than 12 months

-- Add timestamp columns to track when waiting PV was created
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "leftWaitingPVCreatedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "rightWaitingPVCreatedAt" TIMESTAMP;

-- Set initial timestamps for existing waiting PV
-- If user has waiting PV, set timestamp to current time
UPDATE "users"
SET 
  "leftWaitingPVCreatedAt" = CASE 
    WHEN "leftWaitingPV" > 0 THEN NOW()
    ELSE NULL
  END,
  "rightWaitingPVCreatedAt" = CASE 
    WHEN "rightWaitingPV" > 0 THEN NOW()
    ELSE NULL
  END
WHERE "leftWaitingPV" > 0 OR "rightWaitingPV" > 0;

-- Add index for efficient expiration queries
CREATE INDEX IF NOT EXISTS "idx_users_left_waiting_pv_created_at" 
ON "users"("leftWaitingPVCreatedAt") 
WHERE "leftWaitingPV" > 0;

CREATE INDEX IF NOT EXISTS "idx_users_right_waiting_pv_created_at" 
ON "users"("rightWaitingPVCreatedAt") 
WHERE "rightWaitingPV" > 0;
