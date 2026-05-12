'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, FileText, Copy, RefreshCw, BookOpen, Code, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { BusinessRule, RuleTemplate } from '@/lib/types';

interface RuleDocumentationProps {
  rules: BusinessRule[];
  templates: RuleTemplate[];
}

export function RuleDocumentation({ rules, templates }: RuleDocumentationProps) {
  const { toast } = useToast();
  const [documentation, setDocumentation] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    generateDocumentation();
  }, [rules, templates]);

  const generateDocumentation = async () => {
    setLoading(true);
    try {
      const docs = await generateRuleDocumentation(rules, templates);
      setDocumentation(docs);
    } catch (error) {
      console.error('Error generating documentation:', error);
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: 'Failed to generate rule documentation.',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateRuleDocumentation = async (rules: BusinessRule[], templates: RuleTemplate[]): Promise<string> => {
    const sections = [];

    // Title and Overview
    sections.push('# Business Rules Documentation\n');
    sections.push(`Generated on: ${new Date().toLocaleString()}\n`);
    sections.push(`Total Rules: ${rules.length}\n`);
    sections.push(`Active Rules: ${rules.filter(r => r.isActive).length}\n`);
    sections.push(`Available Templates: ${templates.length}\n\n`);

    // Executive Summary
    sections.push('## Executive Summary\n');
    sections.push('This document provides comprehensive documentation of the business rules engine, including all active compensation rules, calculation methods, and validation logic.\n\n');

    // Rule Categories Overview
    sections.push('## Rule Categories Overview\n\n');
    const categories = rules.reduce((acc, rule) => {
      acc[rule.category] = (acc[rule.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(categories).forEach(([category, count]) => {
      sections.push(`- **${category}**: ${count} rules\n`);
    });
    sections.push('\n');

    // Rule Types Overview
    sections.push('## Rule Types Distribution\n\n');
    const types = rules.reduce((acc, rule) => {
      acc[rule.type] = (acc[rule.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(types).forEach(([type, count]) => {
      sections.push(`- **${type.replace('_', ' ')}**: ${count} rules\n`);
    });
    sections.push('\n');

    // Detailed Rules Documentation
    sections.push('## Detailed Rules Documentation\n\n');

    const categoriesOrder = ['commission', 'bonus', 'qualification', 'maintenance', 'incentive', 'penalty'];

    categoriesOrder.forEach(category => {
      const categoryRules = rules.filter(r => r.category === category && r.isActive);
      if (categoryRules.length === 0) return;

      sections.push(`### ${category.charAt(0).toUpperCase() + category.slice(1)} Rules\n\n`);

      categoryRules.forEach(rule => {
        sections.push(`#### ${rule.name}\n\n`);
        sections.push(`**ID**: ${rule.id}\n`);
        sections.push(`**Type**: ${rule.type.replace('_', ' ')}\n`);
        sections.push(`**Priority**: ${rule.priority}\n`);
        sections.push(`**Frequency**: ${rule.frequency}\n`);
        sections.push(`**Payout Timing**: ${rule.payoutTiming}\n`);
        sections.push(`**Applicable To**: ${rule.applicableTo.join(', ')}\n\n`);

        if (rule.description) {
          sections.push(`**Description**: ${rule.description}\n\n`);
        }

        // Conditions
        if (rule.conditions && rule.conditions.length > 0) {
          sections.push('**Conditions**:\n');
          rule.conditions.forEach((condition) => {
            sections.push(`- ${condition.type} ${condition.operator} ${JSON.stringify(condition.value)}\n`);
          });
          sections.push('\n');
        }

        // Calculation
        if (rule.calculation) {
          sections.push('**Calculation**:\n');
          sections.push(`- Type: ${rule.calculation.type}\n`);
          if (rule.calculation.percentage) {
            sections.push(`- Percentage: ${rule.calculation.percentage}%\n`);
          }
          if (rule.calculation.baseValue) {
            sections.push(`- Base Value: ${rule.calculation.baseValue}\n`);
          }
          if (rule.calculation.tiers && rule.calculation.tiers.length > 0) {
            sections.push('- Tiers:\n');
            rule.calculation.tiers.forEach(tier => {
              sections.push(`  - Min: ${tier.min}, Value: ${tier.value}${tier.type === 'percentage' ? '%' : ''}\n`);
            });
          }
          sections.push('\n');
        }

        sections.push('---\n\n');
      });
    });

    // Templates Documentation
    if (templates.length > 0) {
      sections.push('## Compensation Plan Templates\n\n');

      templates.forEach(template => {
        sections.push(`### ${template.name}\n\n`);
        sections.push(`**ID**: ${template.id}\n`);
        sections.push(`**Category**: ${template.category}\n`);
        sections.push(`**Applicable Markets**: ${template.applicableMarkets.join(', ')}\n\n`);

        if (template.description) {
          sections.push(`**Description**: ${template.description}\n\n`);
        }

        sections.push(`**Rules Included**: ${template.rules.length}\n\n`);

        // Template rules summary
        const templateCategories = template.rules.reduce((acc, rule) => {
          acc[rule.category] = (acc[rule.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        sections.push('**Rule Categories**:\n');
        Object.entries(templateCategories).forEach(([cat, count]) => {
          sections.push(`- ${cat}: ${count} rules\n`);
        });
        sections.push('\n---\n\n');
      });
    }

    // Technical Specifications
    sections.push('## Technical Specifications\n\n');
    sections.push('### Rule Engine Architecture\n\n');
    sections.push('- **Execution Order**: Priority-based (lower numbers execute first)\n');
    sections.push('- **Condition Evaluation**: AND/OR logic with nested conditions\n');
    sections.push('- **Calculation Types**: Percentage, Fixed, Tiered, Formula-based\n');
    sections.push('- **Caching**: In-memory rule caching for performance\n');
    sections.push('- **Error Handling**: Graceful failure with detailed logging\n\n');

    sections.push('### Supported Rule Types\n\n');
    const allRuleTypes = [
      'commission_rate', 'commission_cap', 'rank_requirement', 'stockist_bonus',
      'matching_bonus', 'referral_bonus', 'leadership_bonus', 'pool_bonus',
      'fast_start_bonus', 'retail_profit', 'override_bonus', 'generation_bonus',
      'breakaway_bonus', 'infinity_bonus', 'unilevel_bonus', 'matrix_bonus',
      'binary_bonus', 'stair_step_bonus', 'rank_achievement_bonus', 'loyalty_bonus',
      'performance_bonus', 'team_building_bonus', 'mentorship_bonus', 'qualification_bonus',
      'maintenance_bonus', 'activity_bonus', 'productivity_bonus', 'volume_bonus',
      'growth_bonus', 'retention_bonus', 'recruitment_bonus', 'placement_bonus',
      'sponsorship_bonus', 'upline_bonus', 'downline_bonus', 'pairing_bonus',
      'cycling_bonus', 'spillover_bonus', 'compression_bonus', 'travel_bonus',
      'car_bonus', 'house_bonus', 'vacation_bonus', 'club_bonus', 'elite_bonus',
      'royalty_bonus', 'residual_bonus', 'passive_bonus', 'automated_bonus', 'custom_bonus'
    ];

    allRuleTypes.forEach(type => {
      const count = rules.filter(r => r.type === type).length;
      if (count > 0) {
        sections.push(`- **${type.replace('_', ' ')}**: ${count} active rules\n`);
      }
    });
    sections.push('\n');

    // Validation Rules
    sections.push('### Validation Rules\n\n');
    sections.push('- **Priority Range**: 0-1000 (recommended: 0-100)\n');
    sections.push('- **Required Fields**: name, type, category, calculation\n');
    sections.push('- **Condition Limits**: Maximum 10 conditions per rule\n');
    sections.push('- **Performance Threshold**: < 100ms average execution time\n\n');

    // API Reference
    sections.push('## API Reference\n\n');
    sections.push('### Rule Management Endpoints\n\n');
    sections.push('- `GET /api/rules` - List all rules\n');
    sections.push('- `POST /api/rules` - Create new rule\n');
    sections.push('- `PUT /api/rules/:id` - Update rule\n');
    sections.push('- `DELETE /api/rules/:id` - Delete rule\n');
    sections.push('- `POST /api/rules/simulate` - Simulate rule execution\n');
    sections.push('- `GET /api/rules/conflicts` - Check for conflicts\n\n');

    sections.push('### Template Management\n\n');
    sections.push('- `GET /api/templates` - List templates\n');
    sections.push('- `POST /api/templates` - Create template\n');
    sections.push('- `POST /api/templates/:id/apply` - Apply template\n\n');

    return sections.join('');
  };

  const downloadDocumentation = () => {
    if (!documentation) return;

    const blob = new Blob([documentation], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `business-rules-documentation-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Download Started',
      description: 'Documentation has been downloaded.',
    });
  };

  const copyToClipboard = async () => {
    if (!documentation) return;

    try {
      await navigator.clipboard.writeText(documentation);
      toast({
        title: 'Copied to Clipboard',
        description: 'Documentation has been copied to clipboard.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Copy Failed',
        description: 'Failed to copy documentation to clipboard.',
      });
    }
  };

  const getRuleStats = () => {
    const activeRules = rules.filter(r => r.isActive);
    const categories = activeRules.reduce((acc, rule) => {
      acc[rule.category] = (acc[rule.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: rules.length,
      active: activeRules.length,
      categories: Object.entries(categories)
    };
  };

  const stats = getRuleStats();

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Rule Documentation Generator
              </CardTitle>
              <CardDescription>
                Generate comprehensive documentation for all business rules and compensation plans.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={generateDocumentation} disabled={loading} variant="outline" icon={loading ? "loading" : RefreshCw}>
                {loading ? 'Generating...' : 'Regenerate'}
              </Button>
              {documentation && (
                <>
                  <Button onClick={downloadDocumentation} variant="outline" icon={Download}>
                    Download
                  </Button>
                  <Button onClick={copyToClipboard} variant="outline" icon={Copy}>
                    Copy
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Rules</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Rules</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <Code className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Categories</p>
                <p className="text-2xl font-bold">{stats.categories.length}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Templates</p>
                <p className="text-2xl font-bold">{templates.length}</p>
              </div>
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="full-docs">Full Documentation</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rules by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Active Rules</TableHead>
                    <TableHead>Total Rules</TableHead>
                    <TableHead>Percentage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.categories.map(([category, count]) => {
                    const totalInCategory = rules.filter(r => r.category === category).length;
                    const percentage = ((count / stats.active) * 100).toFixed(1);
                    return (
                      <TableRow key={category}>
                        <TableCell className="font-medium capitalize">{category}</TableCell>
                        <TableCell>{count}</TableCell>
                        <TableCell>{totalInCategory}</TableCell>
                        <TableCell>{percentage}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          {stats.categories.map(([category, count]) => {
            const categoryRules = rules.filter(r => r.category === category && r.isActive);
            return (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="capitalize">{category} Rules ({count})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryRules.map(rule => (
                      <div key={rule.id} className="p-4 border rounded-lg">
                        <h4 className="font-medium">{rule.name}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline">{rule.type.replace('_', ' ')}</Badge>
                          <Badge variant="secondary">Priority: {rule.priority}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          {templates.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Templates Available</h3>
                <p className="text-muted-foreground">
                  Create rule templates to organize and reuse compensation plan configurations.
                </p>
              </CardContent>
            </Card>
          ) : (
            templates.map(template => (
              <Card key={template.id}>
                <CardHeader>
                  <CardTitle>{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Category</Label>
                      <p className="font-medium">{template.category}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Rules</Label>
                      <p className="font-medium">{template.rules.length}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Markets</Label>
                      <p className="font-medium">{template.applicableMarkets.join(', ')}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Default</Label>
                      <Badge variant={template.isDefault ? 'default' : 'secondary'}>
                        {template.isDefault ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="full-docs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Complete Documentation</CardTitle>
              <CardDescription>
                Full markdown documentation of all rules, templates, and technical specifications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-96">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : documentation ? (
                <Textarea
                  value={documentation}
                  readOnly
                  className="min-h-[600px] font-mono text-sm"
                  placeholder="Documentation will appear here..."
                />
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Click &quot;Regenerate&quot; to generate documentation.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}