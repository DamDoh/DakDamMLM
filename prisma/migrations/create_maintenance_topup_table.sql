-- Create maintenance_topup_requests table
CREATE TABLE IF NOT EXISTS maintenance_topup_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  remark TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  month TEXT NOT NULL, -- YYYY-MM format
  created_date TIMESTAMP DEFAULT NOW(),
  processed_date TIMESTAMP,
  processed_by TEXT REFERENCES users(id),
  proof_url TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_topup_member_id ON maintenance_topup_requests(member_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_topup_status ON maintenance_topup_requests(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_topup_month ON maintenance_topup_requests(month);
CREATE INDEX IF NOT EXISTS idx_maintenance_topup_created_date ON maintenance_topup_requests(created_date);

-- Add foreign key constraints if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'maintenance_topup_requests_processed_by_fkey'
  ) THEN
    ALTER TABLE maintenance_topup_requests 
    ADD CONSTRAINT maintenance_topup_requests_processed_by_fkey 
    FOREIGN KEY (processed_by) REFERENCES users(id);
  END IF;
END $$;

