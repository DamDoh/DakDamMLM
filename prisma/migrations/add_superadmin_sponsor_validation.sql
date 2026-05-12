-- Migration: Prevent superadmin from being a sponsor
-- This script ensures no member has superadmin as their placementParentId

-- Step 1: Get superadmin user IDs (isAdmin = true AND email matches SUPER_ADMIN_EMAIL from env)
-- Note: We can't access env vars in SQL, so we'll do this in application code
-- This SQL file is for reference - the actual fix will be done via application code

-- Step 2: Set placementParentId to NULL for any members that have superadmin as placementParentId
-- This will be done via a Node.js script that can access the SUPER_ADMIN_EMAIL env var

