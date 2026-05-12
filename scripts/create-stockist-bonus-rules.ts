/**
 * Script to create 4 stockist bonus rules
 * Run with: npx tsx scripts/create-stockist-bonus-rules.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const stockistBonusRules = [
  {
    name: 'District Stockist Bonus',
    description: '2% bonus on personal volume for District level stockists',
    type: 'stockist_bonus',
    category: 'bonus',
    priority: 180,
    isActive: true,
    conditions: [
      {
        type: 'account_type',
        operator: 'equals',
        value: 'Stockist'
      },
      {
        type: 'stockist_level',
        operator: 'equals',
        value: 'District',
        logicalOperator: 'AND'
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
      percentage: 2
    },
    applicableTo: ['stockist'],
    frequency: 'monthly',
    payoutTiming: 'end_of_period',
    tags: ['bonus', 'stockist', 'district'],
    createdBy: 'system'
  },
  {
    name: 'Provincial Stockist Bonus',
    description: '4% bonus on personal volume for Provincial level stockists',
    type: 'stockist_bonus',
    category: 'bonus',
    priority: 190,
    isActive: true,
    conditions: [
      {
        type: 'account_type',
        operator: 'equals',
        value: 'Stockist'
      },
      {
        type: 'stockist_level',
        operator: 'equals',
        value: 'Provincial',
        logicalOperator: 'AND'
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
      percentage: 4
    },
    applicableTo: ['stockist'],
    frequency: 'monthly',
    payoutTiming: 'end_of_period',
    tags: ['bonus', 'stockist', 'provincial'],
    createdBy: 'system'
  },
  {
    name: 'Regional Stockist Bonus',
    description: '6% bonus on personal volume for Regional level stockists',
    type: 'stockist_bonus',
    category: 'bonus',
    priority: 200,
    isActive: true,
    conditions: [
      {
        type: 'account_type',
        operator: 'equals',
        value: 'Stockist'
      },
      {
        type: 'stockist_level',
        operator: 'equals',
        value: 'Regional',
        logicalOperator: 'AND'
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
      percentage: 6
    },
    applicableTo: ['stockist'],
    frequency: 'monthly',
    payoutTiming: 'end_of_period',
    tags: ['bonus', 'stockist', 'regional'],
    createdBy: 'system'
  },
  {
    name: 'Commune Stockist Bonus',
    description: '8% bonus on personal volume for Commune level stockists',
    type: 'stockist_bonus',
    category: 'bonus',
    priority: 210,
    isActive: true,
    conditions: [
      {
        type: 'account_type',
        operator: 'equals',
        value: 'Stockist'
      },
      {
        type: 'stockist_level',
        operator: 'equals',
        value: 'Commune',
        logicalOperator: 'AND'
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
      percentage: 8
    },
    applicableTo: ['stockist'],
    frequency: 'monthly',
    payoutTiming: 'end_of_period',
    tags: ['bonus', 'stockist', 'commune'],
    createdBy: 'system'
  }
];

async function createStockistBonusRules() {
  try {
    console.log('Creating 4 stockist bonus rules...\n');

    for (const rule of stockistBonusRules) {
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

    console.log('\n✅ Stockist bonus rules creation completed!');
  } catch (error) {
    console.error('Error creating stockist bonus rules:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createStockistBonusRules();

