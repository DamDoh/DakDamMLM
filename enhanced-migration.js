// Enhanced Settings System Migration
// Creates additional tables for advanced features

const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'dakdam_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function createEnhancedTables() {
  try {
    console.log('Connecting to database for enhancements...');
    await client.connect();

    console.log('Creating enhanced settings tables...');

    // Setting Templates
    await client.query(`
      CREATE TABLE IF NOT EXISTS setting_templates (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        settings JSONB NOT NULL,
        "isPublic" BOOLEAN NOT NULL DEFAULT true,
        "createdBy" TEXT NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    // Scheduled Settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS scheduled_settings (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "settingKey" TEXT NOT NULL,
        "settingType" TEXT NOT NULL,
        "newValue" JSONB NOT NULL,
        "scheduledAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "executedAt" TIMESTAMP WITH TIME ZONE,
        status TEXT NOT NULL DEFAULT 'pending',
        reason TEXT,
        "createdBy" TEXT NOT NULL,
        "companyId" TEXT,
        "userId" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    // Setting Analytics
    await client.query(`
      CREATE TABLE IF NOT EXISTS setting_analytics (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "settingKey" TEXT NOT NULL,
        "settingType" TEXT NOT NULL,
        "companyId" TEXT,
        "userId" TEXT,
        "accessCount" INTEGER NOT NULL DEFAULT 0,
        "changeCount" INTEGER NOT NULL DEFAULT 0,
        "lastAccessed" TIMESTAMP WITH TIME ZONE,
        "lastChanged" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE("settingKey", "settingType", "companyId", "userId")
      );
    `);

    // Setting Groups
    await client.query(`
      CREATE TABLE IF NOT EXISTS setting_groups (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT UNIQUE NOT NULL,
        "displayName" TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        "order" INTEGER NOT NULL DEFAULT 0,
        "isExpanded" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS scheduled_settings_settingKey_idx ON scheduled_settings("settingKey");`);
    await client.query(`CREATE INDEX IF NOT EXISTS scheduled_settings_settingType_idx ON scheduled_settings("settingType");`);
    await client.query(`CREATE INDEX IF NOT EXISTS scheduled_settings_scheduledAt_idx ON scheduled_settings("scheduledAt");`);
    await client.query(`CREATE INDEX IF NOT EXISTS scheduled_settings_status_idx ON scheduled_settings("status");`);
    await client.query(`CREATE INDEX IF NOT EXISTS setting_analytics_settingKey_idx ON setting_analytics("settingKey");`);
    await client.query(`CREATE INDEX IF NOT EXISTS setting_analytics_settingType_idx ON setting_analytics("settingType");`);

    // Insert sample templates
    console.log('Inserting sample setting templates...');

    await client.query(`
      INSERT INTO setting_templates (name, description, category, settings, "createdBy")
      VALUES
        ('Standard Commission Structure', 'Basic 8% commission with standard PV rules', 'commission_rules', '{
          "commission_rate": 0.08,
          "pv_matching_rules": {
            "matching_formula": "min(leftWaitingPV, rightWaitingPV)",
            "post_match_adjustment": {
              "larger_leg_formula": "larger - smaller",
              "smaller_leg_formula": "0"
            }
          }
        }', 'system'),
        ('High Performance Bonus', 'Enhanced commission structure for top performers', 'bonus_rules', '{
          "commission_rate": 0.10,
          "performance_bonus": 0.02,
          "leadership_bonus": 0.05
        }', 'system'),
        ('Conservative Limits', 'Lower risk settings with strict limits', 'system_limits', '{
          "max_daily_matches": 50,
          "max_commission_per_day": 1000,
          "require_approval_for_changes": true
        }', 'system')
      ON CONFLICT (name) DO NOTHING;
    `);

    // Insert default setting groups
    console.log('Inserting default setting groups...');

    await client.query(`
      INSERT INTO setting_groups (name, "displayName", description, category, "order")
      VALUES
        ('pv_matching', 'PV Matching', 'Core personal volume matching and commission calculation', 'pv_rules', 1),
        ('commissions', 'Commissions', 'Commission rates and payout structures', 'commission_rules', 2),
        ('bonuses', 'Bonuses', 'Performance and leadership bonuses', 'bonus_rules', 3),
        ('limits', 'System Limits', 'Safety limits and constraints', 'system_limits', 4)
      ON CONFLICT (name) DO NOTHING;
    `);

    console.log('Enhanced settings tables created successfully!');
    console.log('Sample templates and groups inserted!');
    console.log('Settings enhancement migration completed!');

  } catch (error) {
    console.error('Enhanced migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createEnhancedTables();