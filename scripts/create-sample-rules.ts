/**
 * Script to create 10 sample business rules
 * Run with: npx tsx scripts/create-sample-rules.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sampleRules = [
  {
    name: 'Standard Commission Rate',
    description: 'Base commission rate of 10% on all personal volume for Bronze rank and above',
    type: 'commission_rate',
    category: 'commission',
    priority: 100,
    isActive: true,
    conditions: [
      {
        type: 'rank',
        operator: 'greater_equal',
        value: 'Bronze'
      },
      {
        type: 'personal_volume',
        operator: 'greater_than',
        value: 0,
        logicalOperator: 'AND'
      }
    ],
    calculation: {
      type: 'percentage',
      percentage: 10
    },
    applicableTo: ['distributor'],
    frequency: 'monthly',
    payoutTiming: 'end_of_period',
    tags: ['commission', 'standard', 'bronze'],
    createdBy: 'system'
  },
  {
    name: 'Tiered Volume Bonus',
    description: 'Tiered bonus structure based on personal volume achievement',
    type: 'volume_bonus',
    category: 'bonus',
    priority: 150,
    isActive: true,
    conditions: [
      {
        type: 'personal_volume',
        operator: 'greater_than',
        value: 0
      }
    ],
    calculation: {
      type: 'tiered_percentage',
      tiers: [
        { min: 0, max: 1000, value: 5 },
        { min: 1001, max: 5000, value: 8 },
        { min: 5001, max: 10000, value: 12 },
        { min: 10001, value: 15 }
      ]
    },
    applicableTo: ['distributor'],
    frequency: 'monthly',
    payoutTiming: 'end_of_period',
    tags: ['bonus', 'volume', 'tiered'],
    createdBy: 'system'
  },
  {
    name: 'Fast Start Bonus',
    description: '15% bonus for new members in their first 30 days with minimum 500 PV',
    type: 'fast_start_bonus',
    category: 'bonus',
    priority: 200,
    isActive: true,
    conditions: [
      {
        type: 'tenure',
        operator: 'less_equal',
        value: 30
      },
      {
        type: 'personal_volume',
        operator: 'greater_equal',
        value: 500,
        logicalOperator: 'AND'
      }
    ],
    calculation: {
      type: 'percentage',
      percentage: 15,
      cap: 1000
    },
    applicableTo: ['distributor'],
    frequency: 'one_time',
    payoutTiming: 'achievement_date',
    tags: ['bonus', 'fast-start', 'new-member'],
    createdBy: 'system'
  },
  {
    name: 'Matching Bonus - Gold Rank',
    description: '5-10% matching bonus on downline commissions for Gold rank distributors',
    type: 'matching_bonus',
    category: 'bonus',
    priority: 250,
    isActive: true,
    conditions: [
      {
        type: 'rank',
        operator: 'equals',
        value: 'Gold'
      },
      {
        type: 'direct_recruits',
        operator: 'greater_equal',
        value: 2,
        logicalOperator: 'AND'
      }
    ],
    calculation: {
      type: 'tiered_percentage',
      tiers: [
        { min: 1, max: 5, value: 5 },
        { min: 6, max: 10, value: 7 },
        { min: 11, value: 10 }
      ]
    },
    applicableTo: ['distributor'],
    frequency: 'monthly',
    payoutTiming: 'end_of_period',
    tags: ['bonus', 'matching', 'gold', 'leadership'],
    createdBy: 'system'
  },
  {
    name: 'PV Qualification Requirement',
    description: 'Minimum 100 PV required monthly to maintain active status and commission eligibility',
    type: 'rank_requirement',
    category: 'qualification',
    priority: 50,
    isActive: true,
    conditions: [
      {
        type: 'personal_volume',
        operator: 'greater_equal',
        value: 100
      },
      {
        type: 'consecutive_months',
        operator: 'greater_equal',
        value: 3,
        logicalOperator: 'AND'
      }
    ],
    calculation: {
      type: 'fixed_amount',
      baseValue: 0
    },
    applicableTo: ['distributor'],
    frequency: 'monthly',
    payoutTiming: 'end_of_period',
    tags: ['qualification', 'pv', 'maintenance'],
    createdBy: 'system'
  },
  {
    name: 'Binary Commission',
    description: '10% commission on weaker leg volume in binary structure',
    type: 'binary_bonus',
    category: 'commission',
    priority: 120,
    isActive: true,
    conditions: [
      {
        type: 'qualified_legs',
        operator: 'greater_equal',
        value: 1
      },
      {
        type: 'rank',
        operator: 'greater_equal',
        value: 'Bronze',
        logicalOperator: 'AND'
      }
    ],
    calculation: {
      type: 'percentage',
      percentage: 10
    },
    applicableTo: ['distributor'],
    frequency: 'weekly',
    payoutTiming: 'end_of_period',
    tags: ['binary', 'commission', 'weekly'],
    createdBy: 'system'
  },
  {
    name: 'Rank Achievement Bonus - Silver',
    description: 'One-time bonus of $500 for achieving Silver rank',
    type: 'rank_achievement_bonus',
    category: 'bonus',
    priority: 300,
    isActive: true,
    conditions: [
      {
        type: 'rank',
        operator: 'equals',
        value: 'Silver'
      }
    ],
    calculation: {
      type: 'fixed_amount',
      baseValue: 500
    },
    applicableTo: ['distributor'],
    frequency: 'one_time',
    payoutTiming: 'achievement_date',
    tags: ['bonus', 'rank', 'achievement', 'silver'],
    createdBy: 'system'
  },
  {
    name: 'Team Building Bonus',
    description: 'Bonus for building a team of 10+ active members',
    type: 'team_building_bonus',
    category: 'bonus',
    priority: 180,
    isActive: true,
    conditions: [
      {
        type: 'team_size',
        operator: 'greater_equal',
        value: 10
      },
      {
        type: 'active_members',
        operator: 'greater_equal',
        value: 10,
        logicalOperator: 'AND'
      }
    ],
    calculation: {
      type: 'fixed_amount',
      baseValue: 250
    },
    applicableTo: ['distributor'],
    frequency: 'monthly',
    payoutTiming: 'end_of_period',
    tags: ['bonus', 'team-building', 'recruitment'],
    createdBy: 'system'
  },
  {
    name: 'Diamond Rank Commission Cap',
    description: 'Maximum commission cap of $5,000 per month for Diamond rank',
    type: 'commission_cap',
    category: 'commission',
    priority: 50,
    isActive: true,
    conditions: [
      {
        type: 'rank',
        operator: 'equals',
        value: 'Diamond'
      }
    ],
    calculation: {
      type: 'maximum_cap',
      maximum: 5000
    },
    applicableTo: ['distributor'],
    frequency: 'monthly',
    payoutTiming: 'end_of_period',
    tags: ['cap', 'diamond', 'commission-limit'],
    createdBy: 'system'
  },
  {
    name: 'Referral Bonus',
    description: '$25 bonus for each direct referral who makes their first purchase',
    type: 'referral_bonus',
    category: 'bonus',
    priority: 220,
    isActive: true,
    conditions: [
      {
        type: 'direct_recruits',
        operator: 'greater_than',
        value: 0
      }
    ],
    calculation: {
      type: 'per_unit',
      baseValue: 25
    },
    applicableTo: ['distributor'],
    frequency: 'one_time',
    payoutTiming: 'achievement_date',
    tags: ['bonus', 'referral', 'recruitment'],
    createdBy: 'system'
  }
];

async function createSampleRules() {
  try {
    console.log('Creating 10 sample business rules...\n');

    for (const rule of sampleRules) {
      try {
        const created = await prisma.businessRule.create({
          data: {
            name: rule.name,
            description: rule.description,
            type: rule.type,
            category: rule.category,
            priority: rule.priority,
            isActive: rule.isActive,
            conditions: rule.conditions as any,
            calculation: rule.calculation as any,
            applicableTo: rule.applicableTo as any,
            frequency: rule.frequency as any,
            payoutTiming: rule.payoutTiming as any,
            tags: rule.tags as any,
            createdBy: rule.createdBy,
            version: 1
          }
        });
        console.log(`✅ Created: ${created.name}`);
      } catch (error: any) {
        if (error.code === 'P2002') {
          console.log(`⏭️  Skipped: ${rule.name} (already exists)`);
        } else {
          console.error(`❌ Failed: ${rule.name} - ${error.message}`);
        }
      }
    }

    console.log('\n✅ Sample rules creation completed!');
  } catch (error) {
    console.error('Error creating sample rules:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSampleRules();

