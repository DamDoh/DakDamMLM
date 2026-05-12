-- Migration: Add Performance Indexes and Pagination Support
-- Date: 2026-05-12
-- Purpose: Fix critical performance issues and add missing indexes for MLM/E-commerce operations

BEGIN;

-- ============================================================
-- USER TABLE INDEXES (Critical for MLM tree operations)
-- ============================================================

-- Index on sponsorId for sponsor relationship lookups
CREATE INDEX IF NOT EXISTS idx_users_sponsor_id ON users(sponsor_id);

-- Index on placement_parent_id for binary tree operations
CREATE INDEX IF NOT EXISTS idx_users_placement_parent_id ON users(placement_parent_id);

-- Index on company_id for multi-tenant isolation
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);

-- Index on is_active + is_deleted for filtering
CREATE INDEX IF NOT EXISTS idx_users_active_deleted ON users(is_active, deleted);

-- Index on store_owner_level for stockist queries
CREATE INDEX IF NOT EXISTS idx_users_store_owner_level ON users(store_owner_level);

-- Index on rank_id for rank-based queries
CREATE INDEX IF NOT EXISTS idx_users_rank_id ON users(rank_id);

-- Index on member_id for lookups
CREATE INDEX IF NOT EXISTS idx_users_member_id ON users(member_id);

-- Composite index for tree traversal queries
CREATE INDEX IF NOT EXISTS idx_users_placement_active ON users(placement_parent_id, is_active, deleted);

-- ============================================================
-- ORDER TABLE INDEXES (Critical for order operations)
-- ============================================================

-- Composite index for status + date range queries
CREATE INDEX IF NOT EXISTS idx_orders_status_date ON orders(status, date);

-- Index on company_id for multi-tenant isolation
CREATE INDEX IF NOT EXISTS idx_orders_company_id ON orders(company_id);

-- ============================================================
-- COMMISSION TABLE INDEXES (Critical for commission calculations)
-- ============================================================

-- Index on type for commission type filtering
CREATE INDEX IF NOT EXISTS idx_commissions_type ON commissions(type);

-- Index on status for pending/paid filtering
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);

-- Composite index for user + type queries (common in commission calculations)
CREATE INDEX IF NOT EXISTS idx_commissions_user_type ON commissions(user_id, type);

-- Composite index for user + status queries
CREATE INDEX IF NOT EXISTS idx_commissions_user_status ON commissions(user_id, status);

-- ============================================================
-- WALLET TRANSACTION TABLE INDEXES (Critical for wallet operations)
-- ============================================================

-- Index on type for transaction type filtering
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type);

-- Composite index for wallet + type queries
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_type ON wallet_transactions(wallet_id, type);

-- Composite index for wallet + created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_date ON wallet_transactions(wallet_id, created_at);

-- ============================================================
-- STOCK REQUEST TABLE INDEXES
-- ============================================================

-- Index on status for pending/approved filtering
CREATE INDEX IF NOT EXISTS idx_stock_requests_status ON stock_requests(status);

-- ============================================================
-- ECASH WITHDRAWAL REQUEST TABLE INDEXES
-- ============================================================

-- Index on status for pending/approved filtering
CREATE INDEX IF NOT EXISTS idx_ecash_withdrawal_status ON ecash_withdrawal_requests(status);

-- Index on member_id for user lookups
CREATE INDEX IF NOT EXISTS idx_ecash_withdrawal_member ON ecash_withdrawal_requests(member_id);

-- ============================================================
-- INVENTORY TRANSACTION TABLE INDEXES
-- ============================================================

-- Index on product_id for inventory lookups
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product ON inventory_transactions(product_id);

-- Index on user_id for user inventory lookups
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_user ON inventory_transactions(user_id);

-- Index on company_id for multi-tenant isolation
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_company ON inventory_transactions(company_id);

-- Index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created ON inventory_transactions(created_at);

-- ============================================================
-- NOTIFICATION TABLE INDEXES
-- ============================================================

-- Index on member_id for user notification lookups
CREATE INDEX IF NOT EXISTS idx_notifications_member ON notifications(member_id);

-- Index on is_read for unread notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- ============================================================
-- PASSWORD RESET TOKEN TABLE INDEXES
-- ============================================================

-- Index on user_id for lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);

-- Index on token for verification lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);

-- ============================================================
-- AML ALERT TABLE INDEXES
-- ============================================================

-- Index on user_id for user alert lookups
CREATE INDEX IF NOT EXISTS idx_aml_alerts_user ON aml_alerts(user_id);

-- Index on status for alert filtering
CREATE INDEX IF NOT EXISTS idx_aml_alerts_status ON aml_alerts(status);

-- ============================================================
-- PENDING PV COLUMNS (Add missing columns if not present)
-- ============================================================

-- Add pv_expiry_days to company_rule_config if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'company_rule_configs' AND column_name = 'pv_expiry_days'
    ) THEN
        ALTER TABLE company_rule_configs ADD COLUMN pv_expiry_days INT DEFAULT 90;
    END IF;
END $$;

-- Add daily_match_last_run to company_rule_config if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'company_rule_configs' AND column_name = 'daily_match_last_run'
    ) THEN
        ALTER TABLE company_rule_configs ADD COLUMN daily_match_last_run TIMESTAMPTZ;
    END IF;
END $$;

-- ============================================================
-- PARTIAL INDEXES FOR ACTIVE DATA (Performance optimization)
-- ============================================================

-- Partial index for active users only (most queries only need active users)
CREATE INDEX IF NOT EXISTS idx_users_active ON users(member_id, placement_parent_id, sponsor_id) WHERE deleted = false AND is_active = true;

-- Partial index for active commissions only
CREATE INDEX IF NOT EXISTS idx_commissions_active ON commissions(user_id, type, amount) WHERE status = 'Paid';

-- Partial index for pending stock requests only
CREATE INDEX IF NOT EXISTS idx_stock_requests_pending ON stock_requests(stockist_id, status) WHERE status = 'pending';

-- Partial index for pending withdrawal requests
CREATE INDEX IF NOT EXISTS idx_withdrawal_pending ON ecash_withdrawal_requests(member_id, status) WHERE status = 'pending';

COMMIT;