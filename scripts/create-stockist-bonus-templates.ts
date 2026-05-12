/**
 * Script to create stockist bonus rule templates
 * Run with: npx tsx scripts/create-stockist-bonus-templates.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createStockistBonusTemplates() {
  try {
    console.log('Creating stockist bonus templates...\n');

    // First, get all stockist bonus rules
    const stockistRules = await prisma.businessRule.findMany({
      where: {
        type: 'stockist_bonus',
        isActive: true
      },
      orderBy: {
        priority: 'asc'
      }
    });

    if (stockistRules.length === 0) {
      console.log('⚠️  No stockist bonus rules found. Please create stockist bonus rules first.');
      return;
    }

    console.log(`Found ${stockistRules.length} stockist bonus rules\n`);

    // Create template with all stockist bonus rules
    const templateRules = stockistRules.map(rule => {
      const { id, createdAt, updatedAt, createdBy, version, companyId, ...ruleData } = rule;
      return ruleData;
    });

      const template = {
        name: 'Stockist Bonus System',
        description: 'Complete stockist bonus system with all 4 levels: District (2%), Provincial (4%), Regional (6%), and Commune (8%) bonuses on personal volume',
        category: 'bonus',
        isDefault: false,
        applicableMarkets: ['Global'],
        isSystemTemplate: true,
        rules: templateRules
      };

    try {
      // Check if template already exists
      const existing = await prisma.ruleTemplate.findFirst({
        where: {
          name: template.name
        }
      });

      if (existing) {
        // Update existing template
        await prisma.ruleTemplate.update({
          where: { id: existing.id },
          data: {
            ...template,
            updatedAt: new Date()
          }
        });
        console.log(`✅ Updated: ${template.name}`);
      } else {
        // Create new template
        await prisma.ruleTemplate.create({
          data: template as any
        });
        console.log(`✅ Created: ${template.name}`);
      }

      // Also create individual level templates
      const levelTemplates = [
        {
          name: 'District Stockist Bonus Template',
          description: 'Template for District level stockist bonus (2% on PV)',
          category: 'bonus',
          rules: stockistRules.filter(r => r.name.includes('District')).map(rule => {
            const { id, createdAt, updatedAt, createdBy, version, companyId, ...ruleData } = rule;
            return ruleData;
          })
        },
        {
          name: 'Provincial Stockist Bonus Template',
          description: 'Template for Provincial level stockist bonus (4% on PV)',
          category: 'bonus',
          rules: stockistRules.filter(r => r.name.includes('Provincial')).map(rule => {
            const { id, createdAt, updatedAt, createdBy, version, companyId, ...ruleData } = rule;
            return ruleData;
          })
        },
        {
          name: 'Regional Stockist Bonus Template',
          description: 'Template for Regional level stockist bonus (6% on PV)',
          category: 'bonus',
          rules: stockistRules.filter(r => r.name.includes('Regional')).map(rule => {
            const { id, createdAt, updatedAt, createdBy, version, companyId, ...ruleData } = rule;
            return ruleData;
          })
        },
        {
          name: 'Commune Stockist Bonus Template',
          description: 'Template for Commune level stockist bonus (8% on PV)',
          category: 'bonus',
          rules: stockistRules.filter(r => r.name.includes('Commune')).map(rule => {
            const { id, createdAt, updatedAt, createdBy, version, companyId, ...ruleData } = rule;
            return ruleData;
          })
        }
      ];

      for (const levelTemplate of levelTemplates) {
        if (levelTemplate.rules.length > 0) {
          try {
            const existing = await prisma.ruleTemplate.findFirst({
              where: {
                name: levelTemplate.name
              }
            });

            if (existing) {
              await prisma.ruleTemplate.update({
                where: { id: existing.id },
                data: {
                  ...levelTemplate,
                  isDefault: false,
                  applicableMarkets: ['Global'],
                  isSystemTemplate: true
                } as any
              });
              console.log(`✅ Updated: ${levelTemplate.name}`);
            } else {
              await prisma.ruleTemplate.create({
                data: {
                  ...levelTemplate,
                  isDefault: false,
                  applicableMarkets: ['Global'],
                  isSystemTemplate: true
                } as any
              });
              console.log(`✅ Created: ${levelTemplate.name}`);
            }
          } catch (error: any) {
            console.error(`❌ Failed: ${levelTemplate.name} - ${error.message}`);
          }
        }
      }

      console.log('\n✅ Stockist bonus templates creation completed!');
    } catch (error: any) {
      console.error(`❌ Failed to create template: ${error.message}`);
    }
  } catch (error) {
    console.error('Error creating stockist bonus templates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createStockistBonusTemplates();

