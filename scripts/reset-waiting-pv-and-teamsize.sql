-- Reset waiting PV and teamSize columns for all users
-- Run this SQL script directly in your database

-- Reset all users' waiting PV and teamSize
UPDATE "users"
SET 
  "leftWaitingPV" = 0,
  "rightWaitingPV" = 0,
  "teamSize" = '{"left":0,"right":0,"total":0}'::jsonb,
  "updatedAt" = NOW()
WHERE "deleted" = false;

-- Verify the reset
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN "leftWaitingPV" != 0 THEN 1 END) as users_with_left_pv,
  COUNT(CASE WHEN "rightWaitingPV" != 0 THEN 1 END) as users_with_right_pv,
  COUNT(CASE WHEN "teamSize"::text != '{"left":0,"right":0,"total":0}' THEN 1 END) as users_with_team_size
FROM "users"
WHERE "deleted" = false;

-- Show any users that still have non-zero values (for debugging)
SELECT 
  "id",
  "memberId",
  "fullName",
  "leftWaitingPV",
  "rightWaitingPV",
  "teamSize"
FROM "users"
WHERE "deleted" = false
  AND (
    "leftWaitingPV" != 0 
    OR "rightWaitingPV" != 0
    OR "teamSize"::text != '{"left":0,"right":0,"total":0}'
  );

