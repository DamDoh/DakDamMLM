import { prisma } from '../src/lib/database';
import bcrypt from 'bcrypt';

/**
 * Super Admin Database Seeding
 * 
 * Creates initial Super Admin roles and assigns them to the configured super admin user.
 * Run with: tsx prisma/seed-super-admin.ts
 */

async function seedSuperAdmin() {
  console.log('🌱 Seeding Super Admin data...\n');

  // 1. Create Super Admin Roles
  console.log('Creating Super Admin roles...');
  
  const roleLevel1 = await prisma.superAdminRole.upsert({
    where: { level: 1 },
    update: {},
    create: {
      id: 'role-superadmin-1',
      name: 'Super Admin',
      level: 1,
      description: 'Full system access with all permissions',
      permissions: [
        { resource: '*', actions: ['*'] } // wildcard for all
      ],
      restrictions: [],
      isActive: true
    }
  });

  const roleLevel2 = await prisma.superAdminRole.upsert({
    where: { level: 2 },
    update: {},
    create: {
      id: 'role-senioradmin-2',
      name: 'Senior Admin',
      level: 2,
      description: 'Multi-tenant management with limited global config',
      permissions: [
        { resource: 'tenants', actions: ['read', 'update'] },
        { resource: 'users', actions: ['read', 'update'] },
        { resource: 'monitoring', actions: ['read'] }
      ],
      restrictions: [{ type: 'read_only', scope: 'config' }],
      isActive: true
    }
  });

  console.log(`✓ Created roles: ${roleLevel1.name}, ${roleLevel2.name}`);

  // 2. Find the super admin user by email
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@dakdam.com';
  
  const adminUser = await prisma.user.findFirst({
    where: { 
      email: superAdminEmail 
    }
  });

  if (!adminUser) {
    console.warn(`⚠ Super admin user with email ${superAdminEmail} not found. Skipping SuperAdminUser creation.`);
    console.log('   Create a user with this email first (e.g., via registration or seeding).');
  } else {
    // 3. Create SuperAdminUser record linking to the user
    const superAdminUser = await prisma.superAdminUser.upsert({
      where: { userId: adminUser.id },
      update: {},
      create: {
        id: `sa-${adminUser.id.slice(0, 8)}`,
        userId: adminUser.id,
        roleId: roleLevel1.id,
        isActive: true,
        mfaEnabled: true,
        sessionTimeout: 3600,
        ipRestrictions: []
      }
    });

    console.log(`✓ Created SuperAdminUser profile for ${adminUser.email} (${superAdminUser.id})`);

    // 4. Create MFA config for super admin
    await prisma.superAdminMFAConfig.upsert({
      where: { superAdminId: superAdminUser.id },
      update: {},
      create: {
        id: `mfa-${superAdminUser.id.slice(0, 8)}`,
        superAdminId: superAdminUser.id,
        isEnabled: true,
        methods: ['totp', 'sms'],
        backupCodes: [],
        gracePeriod: 0
      }
    });

    console.log('✓ Created MFA configuration');
  }

  // 5. Create default global configurations
  const defaultConfigs = [
    {
      key: 'system_maintenance_mode',
      value: { enabled: false },
      type: 'boolean',
      category: 'system',
      description: 'Global maintenance mode flag'
    },
    {
      key: 'max_tenants',
      value: { limit: 1000 },
      type: 'number',
      category: 'system_limits',
      description: 'Maximum number of allowed tenants'
    },
    {
      key: 'feature_ai_insights',
      value: { enabled: true },
      type: 'boolean',
      category: 'feature_flags',
      description: 'Enable AI-powered insights dashboard'
    },
    {
      key: 'feature_quantum_encryption',
      value: { enabled: false },
      type: 'boolean',
      category: 'feature_flags',
      description: 'Enable quantum-safe encryption (future)'
    },
    {
      key: 'compliance_auto_reports',
      value: { enabled: true, schedule: 'monthly' },
      type: 'json',
      category: 'compliance',
      description: 'Automated compliance report generation'
    }
  ];

  for (const config of defaultConfigs) {
    await prisma.globalConfig.upsert({
      where: { key: config.key },
      update: {},
      create: {
        ...config,
        createdBy: 'seed',
        isActive: true,
        effectiveDate: new Date()
      }
    });
  }

  console.log(`✓ Created ${defaultConfigs.length} global configurations`);

  // 6. Create sample anomaly detection rules
  const anomalyRules = [
    {
      name: 'High API Latency',
      description: 'Detects when API response time exceeds 2 seconds',
      metricType: 'api_latency',
      condition: 'threshold',
      threshold: { operator: 'gt', value: 2000 },
      severity: 'high',
      alertChannels: ['email', 'slack']
    },
    {
      name: 'Failed Login Spike',
      description: 'Detects unusual number of failed login attempts',
      metricType: 'failed_logins',
      condition: 'pattern',
      threshold: { operator: 'gt', value: 100, window: '1m' },
      severity: 'critical',
      alertChannels: ['email', 'pager_duty']
    },
    {
      name: 'Low Disk Space',
      description: 'Warns when disk usage exceeds 90%',
      metricType: 'disk_usage',
      condition: 'threshold',
      threshold: { operator: 'gte', value: 90 },
      severity: 'medium',
      alertChannels: ['email']
    }
  ];

  for (const rule of anomalyRules) {
    await prisma.anomalyRule.upsert({
      where: { name: rule.name },
      update: {},
      create: rule
    });
  }

  console.log(`✓ Created ${anomalyRules.length} anomaly detection rules`);

  // 7. Create basic governance rules
  const governanceRules = [
    {
      name: 'Auto-lock inactive accounts',
      description: 'Lock accounts that have been inactive for 90 days',
      ruleType: 'security',
      condition: {
        type: 'user_inactivity',
        threshold: 90,
        unit: 'days'
      },
      action: {
        type: 'lock_account',
        duration: '24h'
      },
      severity: 'low'
    },
    {
      name: 'High-value transaction review',
      description: 'Flag transactions above $10,000 for review',
      ruleType: 'compliance',
      condition: {
        type: 'transaction_amount',
        threshold: 10000,
        currency: 'USD'
      },
      action: {
        type: 'create_alert',
        assignee: 'compliance_team'
      },
      severity: 'high'
    }
  ];

  for (const rule of governanceRules) {
    await prisma.governanceRule.upsert({
      where: { name: rule.name },
      update: {},
      create: rule
    });
  }

  console.log(`✓ Created ${governanceRules.length} governance rules`);

  console.log('\n✅ Super Admin seeding complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Configure SUPER_ADMIN_EMAIL environment variable if not set');
  console.log('   2. Ensure a user account exists for that email address');
  console.log('   3. Run `npx prisma db push` to apply migrations if not already applied');
  console.log('   4. Access super admin endpoints with that user\'s JWT token');
}

// Run seed
seedSuperAdmin().catch(async (error) => {
  console.error('❌ Super Admin seed failed:', error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
