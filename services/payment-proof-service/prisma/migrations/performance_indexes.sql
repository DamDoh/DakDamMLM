-- Performance indexes for payment-proof-service
-- Run this migration after the main schema is created

-- Payment Proofs indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_proofs_status_created ON payment_proofs(status, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_proofs_user_status ON payment_proofs(user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_proofs_order_id ON payment_proofs(order_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_proofs_file_hash ON payment_proofs(file_hash);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_proofs_reviewed_by ON payment_proofs(reviewed_by_id) WHERE reviewed_by_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_proofs_created_at ON payment_proofs(created_at DESC);

-- Transactions indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_proof_id ON transactions(proof_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_action ON transactions(action);

-- Audit Logs indexes (critical for performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Fraud Alerts indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fraud_alerts_type_severity ON fraud_alerts(type, severity);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fraud_alerts_proof_id ON fraud_alerts(proof_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fraud_alerts_user_id ON fraud_alerts(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fraud_alerts_created_at ON fraud_alerts(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fraud_alerts_status ON fraud_alerts(status);

-- Disputes indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disputes_proof_id ON disputes(proof_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disputes_user_id ON disputes(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disputes_created_at ON disputes(created_at DESC);

-- QR Codes indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qr_codes_user_id ON qr_codes(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qr_codes_is_active ON qr_codes(is_active) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qr_codes_expires_at ON qr_codes(expires_at) WHERE expires_at IS NOT NULL;

-- Notification Queue indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_queue_user_id ON notification_queue(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_queue_priority ON notification_queue(priority DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_queue_next_retry ON notification_queue(next_retry_at) WHERE next_retry_at IS NOT NULL;

-- System Metrics indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_metrics_metric ON system_metrics(metric);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp DESC);

-- File Encryption indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_file_encryption_proof_id ON file_encryption(proof_id);

-- Orders indexes (for cross-service queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_id_status ON orders(user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Users indexes (for role-based queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_upline_id ON users(upline_id) WHERE upline_id IS NOT NULL;

-- Composite indexes for complex queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_proofs_user_status_created ON payment_proofs(user_id, status, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_entity_created ON audit_logs(user_id, entity, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fraud_alerts_type_status_created ON fraud_alerts(type, status, created_at DESC);

-- Partial indexes for active records
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_proofs_active ON payment_proofs(id) WHERE status IN ('uploaded', 'approved');
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disputes_active ON disputes(id) WHERE status IN ('pending', 'escalated');
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qr_codes_active_not_expired ON qr_codes(id)
WHERE is_active = true AND (expires_at IS NULL OR expires_at > NOW());

-- Text search indexes (if using PostgreSQL full-text search)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_proofs_ocr_search ON payment_proofs USING gin(to_tsvector('english', ocr_data::text));

-- Comments for documentation
COMMENT ON INDEX idx_payment_proofs_status_created IS 'Optimizes pending proofs dashboard queries';
COMMENT ON INDEX idx_audit_logs_created_at IS 'Critical for audit log pagination and retention cleanup';
COMMENT ON INDEX idx_fraud_alerts_type_severity IS 'Optimizes fraud monitoring dashboard';
COMMENT ON INDEX idx_notification_queue_priority IS 'Ensures high-priority notifications are processed first';