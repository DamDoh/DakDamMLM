// Corporate Ecosystem Database Migration
// Creates all tables for the shareholder and board of directors system

const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'dakdam_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function createCorporateTables() {
  try {
    console.log('Connecting to database for corporate migration...');
    await client.connect();

    console.log('Creating corporate ecosystem tables...');

    // Shareholders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shareholders (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "userId" TEXT NOT NULL,
        "companyId" TEXT NOT NULL,
        "membershipType" TEXT NOT NULL CHECK ("membershipType" IN ('network_enabled', 'standard')),
        "canBuildNetwork" BOOLEAN NOT NULL DEFAULT false,
        "sharePercentage" FLOAT NOT NULL DEFAULT 0,
        "totalShares" FLOAT NOT NULL DEFAULT 0,
        "investmentAmount" FLOAT NOT NULL DEFAULT 0,
        "acquisitionDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'terminated')),
        "votingRights" BOOLEAN NOT NULL DEFAULT true,
        "dividendEligible" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "networkSponsorId" TEXT,
        UNIQUE("userId", "companyId")
      );
    `);

    // Board Members table
    await client.query(`
      CREATE TABLE IF NOT EXISTS board_members (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "shareholderId" TEXT NOT NULL,
        "companyId" TEXT NOT NULL,
        position TEXT NOT NULL,
        "appointmentDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "termEndDate" TIMESTAMP WITH TIME ZONE,
        "votingPower" FLOAT NOT NULL DEFAULT 1,
        "executivePowers" BOOLEAN NOT NULL DEFAULT false,
        "committeeRoles" JSON,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resigned', 'removed')),
        compensation JSON,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    // Benefit Ledger table
    await client.query(`
      CREATE TABLE IF NOT EXISTS benefit_ledgers (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "shareholderId" TEXT NOT NULL,
        "companyId" TEXT NOT NULL,
        "transactionType" TEXT NOT NULL,
        amount FLOAT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        description TEXT NOT NULL,
        "distributionRule" TEXT NOT NULL,
        "referenceId" TEXT,
        "networkLevel" INTEGER,
        "isTaxable" BOOLEAN NOT NULL DEFAULT true,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'paid', 'cancelled')),
        "processedAt" TIMESTAMP WITH TIME ZONE,
        "paidAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    // Board Decisions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS board_decisions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "companyId" TEXT NOT NULL,
        "boardMemberId" TEXT NOT NULL,
        "decisionType" TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        "decisionData" JSON NOT NULL,
        "votingResults" JSON,
        "effectiveDate" TIMESTAMP WITH TIME ZONE,
        status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'rejected', 'implemented')),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    // Shareholder Audit Log
    await client.query(`
      CREATE TABLE IF NOT EXISTS shareholder_audit_logs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "shareholderId" TEXT NOT NULL,
        action TEXT NOT NULL,
        "oldValues" JSON,
        "newValues" JSON,
        reason TEXT,
        "performedBy" TEXT NOT NULL,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    // Board Audit Log
    await client.query(`
      CREATE TABLE IF NOT EXISTS board_audit_logs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "boardMemberId" TEXT NOT NULL,
        action TEXT NOT NULL,
        details JSON,
        "performedBy" TEXT NOT NULL,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    // Benefit Audit Log
    await client.query(`
      CREATE TABLE IF NOT EXISTS benefit_audit_logs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "benefitId" TEXT NOT NULL,
        action TEXT NOT NULL,
        "oldValues" JSON,
        "newValues" JSON,
        reason TEXT,
        "performedBy" TEXT NOT NULL,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    // Create indexes
    console.log('Creating indexes...');
    await client.query(`CREATE INDEX IF NOT EXISTS shareholders_userId_idx ON shareholders("userId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS shareholders_companyId_idx ON shareholders("companyId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS shareholders_membershipType_idx ON shareholders("membershipType");`);
    await client.query(`CREATE INDEX IF NOT EXISTS shareholders_canBuildNetwork_idx ON shareholders("canBuildNetwork");`);
    await client.query(`CREATE INDEX IF NOT EXISTS shareholders_status_idx ON shareholders("status");`);

    await client.query(`CREATE INDEX IF NOT EXISTS board_members_shareholderId_idx ON board_members("shareholderId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS board_members_companyId_idx ON board_members("companyId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS board_members_position_idx ON board_members("position");`);
    await client.query(`CREATE INDEX IF NOT EXISTS board_members_status_idx ON board_members("status");`);

    await client.query(`CREATE INDEX IF NOT EXISTS benefit_ledgers_shareholderId_idx ON benefit_ledgers("shareholderId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS benefit_ledgers_companyId_idx ON benefit_ledgers("companyId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS benefit_ledgers_transactionType_idx ON benefit_ledgers("transactionType");`);
    await client.query(`CREATE INDEX IF NOT EXISTS benefit_ledgers_status_idx ON benefit_ledgers("status");`);
    await client.query(`CREATE INDEX IF NOT EXISTS benefit_ledgers_createdAt_idx ON benefit_ledgers("createdAt");`);

    await client.query(`CREATE INDEX IF NOT EXISTS board_decisions_companyId_idx ON board_decisions("companyId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS board_decisions_boardMemberId_idx ON board_decisions("boardMemberId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS board_decisions_decisionType_idx ON board_decisions("decisionType");`);
    await client.query(`CREATE INDEX IF NOT EXISTS board_decisions_status_idx ON board_decisions("status");`);

    await client.query(`CREATE INDEX IF NOT EXISTS shareholder_audit_logs_shareholderId_idx ON shareholder_audit_logs("shareholderId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS shareholder_audit_logs_action_idx ON shareholder_audit_logs("action");`);
    await client.query(`CREATE INDEX IF NOT EXISTS shareholder_audit_logs_createdAt_idx ON shareholder_audit_logs("createdAt");`);

    await client.query(`CREATE INDEX IF NOT EXISTS board_audit_logs_boardMemberId_idx ON board_audit_logs("boardMemberId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS board_audit_logs_action_idx ON board_audit_logs("action");`);
    await client.query(`CREATE INDEX IF NOT EXISTS board_audit_logs_createdAt_idx ON board_audit_logs("createdAt");`);

    await client.query(`CREATE INDEX IF NOT EXISTS benefit_audit_logs_benefitId_idx ON benefit_audit_logs("benefitId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS benefit_audit_logs_action_idx ON benefit_audit_logs("action");`);
    await client.query(`CREATE INDEX IF NOT EXISTS benefit_audit_logs_createdAt_idx ON benefit_audit_logs("createdAt");`);

    // Insert sample data
    console.log('Inserting sample corporate data...');

    // Sample shareholders (you would replace with real user IDs)
    await client.query(`
      INSERT INTO shareholders ("userId", "companyId", "membershipType", "canBuildNetwork", "sharePercentage", "totalShares", "investmentAmount", "acquisitionDate")
      VALUES
        ('user_sample_1', 'company_sample', 'network_enabled', true, 25.0, 25000, 25000, NOW()),
        ('user_sample_2', 'company_sample', 'standard', false, 15.0, 15000, 15000, NOW()),
        ('user_sample_3', 'company_sample', 'network_enabled', true, 20.0, 20000, 20000, NOW())
      ON CONFLICT ("userId", "companyId") DO NOTHING;
    `);

    // Sample board members
    await client.query(`
      INSERT INTO board_members ("shareholderId", "companyId", position, "appointmentDate", "votingPower", "executivePowers")
      SELECT s.id, s."companyId", 'CEO', NOW(), 2.0, true
      FROM shareholders s
      WHERE s."userId" = 'user_sample_1' AND s."companyId" = 'company_sample'
      ON CONFLICT DO NOTHING;
    `);

    console.log('Corporate ecosystem tables created successfully!');
    console.log('Sample data inserted for testing!');
    console.log('Corporate migration completed!');

  } catch (error) {
    console.error('Corporate migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createCorporateTables();