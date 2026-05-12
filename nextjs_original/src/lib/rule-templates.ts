import type { RuleTemplate, BusinessRule } from './types';

/**
 * Pre-configured rule templates for different MLM compensation plans
 */
export const ruleTemplates: RuleTemplate[] = [
  {
    id: 'binary-basic',
    name: 'Basic Binary Plan',
    description: 'Simple binary compensation with weekly payouts',
    category: 'binary',
    isDefault: false,
    applicableMarkets: ['global'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rules: [
      {
        name: 'Binary Commission',
        description: '10% commission on the weaker leg volume',
        type: 'binary_bonus',
        category: 'commission',
        priority: 100,
        isActive: true,
        conditions: [
          {
            type: 'account_type',
            operator: 'equals',
            value: 'distributor'
          },
          {
            type: 'personal_volume',
            operator: 'greater_than',
            value: 50
          }
        ],
        calculation: {
          type: 'percentage',
          percentage: 10
        },
        applicableTo: ['distributor'],
        frequency: 'weekly',
        payoutTiming: 'end_of_period',
        tags: ['binary', 'commission', 'weekly']
      },
      {
        name: 'Rank Achievement Bonus',
        description: 'Bonus for achieving higher ranks',
        type: 'rank_achievement_bonus',
        category: 'bonus',
        priority: 90,
        isActive: true,
        conditions: [
          {
            type: 'account_type',
            operator: 'equals',
            value: 'distributor'
          }
        ],
        calculation: {
          type: 'lookup_table',
          lookupTable: {
            'Bronze': 100,
            'Silver': 250,
            'Gold': 500,
            'Diamond': 1000
          }
        },
        applicableTo: ['distributor'],
        frequency: 'one_time',
        payoutTiming: 'achievement_date',
        tags: ['rank', 'bonus', 'achievement']
      }
    ]
  },
  {
    id: 'unilevel-standard',
    name: 'Standard Unilevel Plan',
    description: 'Traditional unilevel compensation with generation bonuses',
    category: 'unilevel',
    isDefault: false,
    applicableMarkets: ['global'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rules: [
      {
        name: 'Level 1 Commission',
        description: '15% on first level downline purchases',
        type: 'generation_bonus',
        category: 'commission',
        priority: 100,
        isActive: true,
        conditions: [
          {
            type: 'account_type',
            operator: 'equals',
            value: 'distributor'
          },
          {
            type: 'generation_depth',
            operator: 'equals',
            value: 1
          }
        ],
        calculation: {
          type: 'percentage',
          percentage: 15
        },
        applicableTo: ['distributor'],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        tags: ['unilevel', 'generation', 'level1']
      },
      {
        name: 'Level 2 Commission',
        description: '10% on second level downline purchases',
        type: 'generation_bonus',
        category: 'commission',
        priority: 95,
        isActive: true,
        conditions: [
          {
            type: 'account_type',
            operator: 'equals',
            value: 'distributor'
          },
          {
            type: 'generation_depth',
            operator: 'equals',
            value: 2
          }
        ],
        calculation: {
          type: 'percentage',
          percentage: 10
        },
        applicableTo: ['distributor'],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        tags: ['unilevel', 'generation', 'level2']
      },
      {
        name: 'Level 3 Commission',
        description: '5% on third level downline purchases',
        type: 'generation_bonus',
        category: 'commission',
        priority: 90,
        isActive: true,
        conditions: [
          {
            type: 'account_type',
            operator: 'equals',
            value: 'distributor'
          },
          {
            type: 'generation_depth',
            operator: 'equals',
            value: 3
          }
        ],
        calculation: {
          type: 'percentage',
          percentage: 5
        },
        applicableTo: ['distributor'],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        tags: ['unilevel', 'generation', 'level3']
      }
    ]
  },
  {
    id: 'matrix-forced-3x3',
    name: '3x3 Forced Matrix',
    description: '3x3 forced matrix with spillover and completion bonuses',
    category: 'matrix',
    isDefault: false,
    applicableMarkets: ['global'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rules: [
      {
        name: 'Matrix Completion Bonus',
        description: 'Bonus for filling all positions in matrix level',
        type: 'matrix_bonus',
        category: 'bonus',
        priority: 100,
        isActive: true,
        conditions: [
          {
            type: 'account_type',
            operator: 'equals',
            value: 'distributor'
          },
          {
            type: 'matrix_position',
            operator: 'equals',
            value: 'completed'
          }
        ],
        calculation: {
          type: 'tiered_fixed',
          tiers: [
            { min: 1, max: 1, value: 50, type: 'fixed' },
            { min: 2, max: 2, value: 100, type: 'fixed' },
            { min: 3, max: 3, value: 200, type: 'fixed' }
          ]
        },
        applicableTo: ['distributor'],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        tags: ['matrix', 'completion', 'forced']
      },
      {
        name: 'Spillover Commission',
        description: 'Commission on spillover placements',
        type: 'spillover_bonus',
        category: 'commission',
        priority: 95,
        isActive: true,
        conditions: [
          {
            type: 'account_type',
            operator: 'equals',
            value: 'distributor'
          }
        ],
        calculation: {
          type: 'percentage',
          percentage: 5
        },
        applicableTo: ['distributor'],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        tags: ['matrix', 'spillover']
      }
    ]
  },
  {
    id: 'sustainable-hybrid-binary-unilevel',
    name: 'Sustainable Hybrid Binary + Unilevel Plan',
    description: 'Balanced compensation plan designed for long-term business sustainability with conservative payout rates and qualification requirements',
    category: 'hybrid',
    isDefault: true,
    applicableMarkets: ['global'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rules: [
      {
        name: 'Sustainable Binary Commission',
        description: '8% commission on weaker leg volume with 100 PV minimum qualification',
        type: 'binary_bonus',
        category: 'commission',
        priority: 100,
        isActive: true,
        conditions: [
          {
            type: 'account_type',
            operator: 'equals',
            value: 'distributor'
          },
          {
            type: 'personal_volume',
            operator: 'greater_equal',
            value: 100
          },
          {
            type: 'time_in_rank',
            operator: 'greater_equal',
            value: 30
          }
        ],
        calculation: {
          type: 'percentage',
          percentage: 8
        },
        applicableTo: ['distributor'],
        frequency: 'weekly',
        payoutTiming: 'end_of_period',
        tags: ['binary', 'sustainable', 'commission']
      },
      {
        name: 'Generation Bonus Level 1',
        description: '6% on first generation downline purchases',
        type: 'generation_bonus',
        category: 'commission',
        priority: 95,
        isActive: true,
        conditions: [
          {
            type: 'account_type',
            operator: 'equals',
            value: 'distributor'
          },
          {
            type: 'generation_depth',
            operator: 'equals',
            value: 1
          },
          {
            type: 'personal_volume',
            operator: 'greater_equal',
            value: 100
          }
        ],
        calculation: {
          type: 'percentage',
          percentage: 6
        },
        applicableTo: ['distributor'],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        tags: ['generation', 'unilevel', 'sustainable']
      },
      {
        name: 'Generation Bonus Level 2',
        description: '4% on second generation downline purchases',
        type: 'generation_bonus',
        category: 'commission',
        priority: 90,
        isActive: true,
        conditions: [
          {
            type: 'account_type',
            operator: 'equals',
            value: 'distributor'
          },
          {
            type: 'generation_depth',
            operator: 'equals',
            value: 2
          },
          {
            type: 'personal_volume',
            operator: 'greater_equal',
            value: 100
          }
        ],
        calculation: {
          type: 'percentage',
          percentage: 4
        },
        applicableTo: ['distributor'],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        tags: ['generation', 'unilevel', 'sustainable']
      },
      {
        name: 'Generation Bonus Level 3',
        description: '2% on third generation downline purchases',
        type: 'generation_bonus',
        category: 'commission',
        priority: 85,
        isActive: true,
        conditions: [
          {
            type: 'account_type',
            operator: 'equals',
            value: 'distributor'
          },
          {
            type: 'generation_depth',
            operator: 'equals',
            value: 3
          },
          {
            type: 'personal_volume',
            operator: 'greater_equal',
            value: 100
          }
        ],
        calculation: {
          type: 'percentage',
          percentage: 2
        },
        applicableTo: ['distributor'],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        tags: ['generation', 'unilevel', 'sustainable']
      },
      {
        name: 'Direct Referral Bonus',
        description: 'Sustainable referral bonus with team building focus',
        type: 'referral_bonus',
        category: 'bonus',
        priority: 80,
        isActive: true,
        conditions: [
          {
            type: 'account_type',
            operator: 'equals',
            value: 'distributor'
          },
          {
            type: 'direct_recruits',
            operator: 'greater_than',
            value: 0
          }
        ],
        calculation: {
          type: 'per_unit',
          baseValue: 15
        },
        applicableTo: ['distributor'],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        tags: ['referral', 'sustainable', 'bonus']
      },
      {
        name: 'Rank Achievement Bonus',
        description: 'One-time bonus for rank advancement with sustainable amounts',
        type: 'rank_achievement_bonus',
        category: 'bonus',
        priority: 75,
        isActive: true,
        conditions: [
          {
            type: 'account_type',
            operator: 'equals',
            value: 'distributor'
          }
        ],
        calculation: {
          type: 'lookup_table',
          lookupTable: {
            'Bronze': 150,
            'Silver': 300,
            'Gold': 600,
            'Diamond': 1200,
            'Super Diamond': 2500,
            'Blue Diamond': 5000
          }
        },
        applicableTo: ['distributor'],
        frequency: 'one_time',
        payoutTiming: 'achievement_date',
        tags: ['rank', 'achievement', 'sustainable']
      },
      {
        name: 'Leadership Development Bonus',
        description: 'Monthly bonus for leaders with substantial teams and retention',
        type: 'leadership_bonus',
        category: 'bonus',
        priority: 70,
        isActive: true,
        conditions: [
          {
            type: 'account_type',
            operator: 'equals',
            value: 'distributor'
          },
          {
            type: 'rank',
            operator: 'in',
            value: ['Diamond', 'Super Diamond', 'Blue Diamond', 'Black Diamond']
          },
          {
            type: 'team_size',
            operator: 'greater_equal',
            value: 50
          },
          {
            type: 'active_members',
            operator: 'greater_equal',
            value: 35
          }
        ],
        calculation: {
          type: 'percentage',
          percentage: 3
        },
        applicableTo: ['distributor'],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        tags: ['leadership', 'retention', 'sustainable']
      }
    ]
  },
  {
    id: 'stairstep-breakaway',
    name: 'Stairstep Breakaway',
    description: 'Traditional stairstep with breakaway mechanics',
    category: 'stairstep',
    isDefault: false,
    applicableMarkets: ['global'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rules: [
      {
        name: 'Stairstep Commission',
        description: 'Increasing commission rates based on volume levels',
        type: 'stair_step_bonus',
        category: 'commission',
        priority: 100,
        isActive: true,
        conditions: [
          {
            type: 'account_type',
            operator: 'equals',
            value: 'distributor'
          }
        ],
        calculation: {
          type: 'tiered_percentage',
          tiers: [
            { min: 0, max: 1000, value: 5, type: 'percentage' },
            { min: 1001, max: 3000, value: 10, type: 'percentage' },
            { min: 3001, max: 5000, value: 15, type: 'percentage' },
            { min: 5001, max: 10000, value: 20, type: 'percentage' },
            { min: 10001, value: 25, type: 'percentage' }
          ]
        },
        applicableTo: ['distributor'],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        tags: ['stairstep', 'breakaway', 'commission']
      },
      {
        name: 'Breakaway Bonus',
        description: 'Bonus when group breaks away',
        type: 'breakaway_bonus',
        category: 'bonus',
        priority: 95,
        isActive: true,
        conditions: [
          {
            type: 'account_type',
            operator: 'equals',
            value: 'distributor'
          }
        ],
        calculation: {
          type: 'percentage',
          percentage: 5
        },
        applicableTo: ['distributor'],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        tags: ['breakaway', 'bonus']
      }
    ]
  }
];

/**
 * Get template by ID
 */
export function getTemplateById(id: string): RuleTemplate | undefined {
  return ruleTemplates.find(template => template.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): RuleTemplate[] {
  return ruleTemplates.filter(template => template.category === category);
}

/**
 * Get default templates
 */
export function getDefaultTemplates(): RuleTemplate[] {
  return ruleTemplates.filter(template => template.isDefault);
}

/**
 * Get templates applicable to a market
 */
export function getTemplatesForMarket(market: string): RuleTemplate[] {
  return ruleTemplates.filter(template =>
    template.applicableMarkets.includes(market) || template.applicableMarkets.includes('global')
  );
}

/**
 * Convert template rules to business rules
 */
export function instantiateTemplate(template: RuleTemplate, createdBy: string): BusinessRule[] {
  return template.rules.map(rule => ({
    ...rule,
    id: `${template.id}-${rule.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy,
    version: 1
  }));
}