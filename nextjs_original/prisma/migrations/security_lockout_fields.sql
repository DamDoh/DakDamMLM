-- Migration: Add Account Lockout Security Fields
-- Date: 2025-10-19
-- Purpose: Support account lockout after failed login attempts

-- Add failed login tracking fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_failed_login TIMESTAMP;

-- Create index for efficient lockout queries
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until) WHERE locked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_failed_attempts ON users(failed_login_attempts) WHERE failed_login_attempts > 0;

-- Update existing users to have default values
UPDATE users SET failed_login_attempts = 0 WHERE failed_login_attempts IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.failed_login_attempts IS 'Counter for failed login attempts, reset on successful login';
COMMENT ON COLUMN users.locked_until IS 'Timestamp until which the account is locked, NULL if not locked';
COMMENT ON COLUMN users.last_failed_login IS 'Timestamp of the most recent failed login attempt';