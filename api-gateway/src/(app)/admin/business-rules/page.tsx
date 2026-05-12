'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Copy, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { BusinessRule, RuleSet, RuleTemplate, RuleType } from '@/lib/types';
import { RuleSimulator } from './components/rule-simulator';
import { RulePerformance } from './components/rule-performance';
import { RuleConflicts } from './components/rule-conflicts';
import { BulkOperations } from './components/bulk-operations';
import { RuleDocumentation } from './components/rule-documentation';
import { RuleVersioning } from './components/rule-versioning';

export default function BusinessRulesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('rules');
  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<BusinessRule | null>(null);
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);

  // Rule form state
  const [ruleForm, setRuleForm] = useState({
    name: '',
    description: '',
    type: 'commission_rate' as RuleType,
    category: 'commission' as 'commission' | 'bonus' | 'qualification' | 'maintenance' | 'incentive' | 'penalty',
    priority: 0,
    isActive: true,
    conditions: [] as any[],
    calculation: {} as any,
    applicableTo: ['distributor'] as ('distributor' | 'stockist' | 'customer')[],
    frequency: 'monthly' as 'weekly' | 'monthly' | 'quarterly' | 'annually' | 'one_time' | 'continuous',
    payoutTiming: 'end_of_period' as 'immediate' | 'end_of_period' | 'achievement_date' | 'qualification_date',
    tags: [] as string[]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load rules, rule sets, and templates
      // This would be API calls in a real implementation
      setRules([]);
      setRuleSets([]);
      setTemplates([]);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load business rules data.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = () => {
    setSelectedRule(null);
    setRuleForm({
      name: '',
      description: '',
      type: 'commission_rate',
      category: 'commission',
      priority: 0,
      isActive: true,
      conditions: [],
      calculation: {},
      applicableTo: ['distributor'],
      frequency: 'monthly',
      payoutTiming: 'end_of_period',
      tags: []
    });
    setIsRuleDialogOpen(true);
  };

  const handleEditRule = (rule: BusinessRule) => {
    setSelectedRule(rule);
    setRuleForm({
      name: rule.name,
      description: rule.description,
      type: rule.type,
      category: rule.category,
      priority: rule.priority,
      isActive: rule.isActive,
      conditions: rule.conditions,
      calculation: rule.calculation,
      applicableTo: rule.applicableTo,
      frequency: rule.frequency,
      payoutTiming: rule.payoutTiming,
      tags: rule.tags
    });
    setIsRuleDialogOpen(true);
  };

  const handleSaveRule = async () => {
    try {
      // Save rule logic here
      toast({
        title: 'Success',
        description: `Rule ${selectedRule ? 'updated' : 'created'} successfully.`,
      });
      setIsRuleDialogOpen(false);
      loadData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save rule.',
      });
    }
  };

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    try {
      // Toggle rule active status
      toast({
        title: 'Success',
        description: `Rule ${isActive ? 'activated' : 'deactivated'} successfully.`,
      });
      loadData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update rule status.',
      });
    }
  };

  const getRuleTypeColor = (type: RuleType) => {
    const colors: Record<string, string> = {
      commission_rate: 'bg-blue-100 text-blue-800',
      commission_cap: 'bg-red-100 text-red-800',
      rank_requirement: 'bg-green-100 text-green-800',
      stockist_bonus: 'bg-purple-100 text-purple-800',
      matching_bonus: 'bg-yellow-100 text-yellow-800',
      referral_bonus: 'bg-indigo-100 text-indigo-800',
      leadership_bonus: 'bg-pink-100 text-pink-800',
      custom_bonus: 'bg-gray-100 text-gray-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      commission: 'bg-blue-100 text-blue-800',
      bonus: 'bg-green-100 text-green-800',
      qualification: 'bg-yellow-100 text-yellow-800',
      maintenance: 'bg-orange-100 text-orange-800',
      incentive: 'bg-purple-100 text-purple-800',
      penalty: 'bg-red-100 text-red-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Business Rules Management</h1>
          <p className="text-muted-foreground">
            Configure and manage all compensation rules, bonuses, and business logic for your MLM network.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCreateRule} icon={Plus}>
            Create Rule
          </Button>
          <Button variant="outline" icon={Settings}>
            Rule Templates
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="rule-sets">Rule Sets</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="simulation">Simulation</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="bulk-ops">Bulk Ops</TabsTrigger>
          <TabsTrigger value="versioning">Versioning</TabsTrigger>
          <TabsTrigger value="docs">Documentation</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Rules</CardTitle>
              <CardDescription>
                Manage individual rules that govern commissions, bonuses, and qualifications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{rule.name}</p>
                            <p className="text-sm text-muted-foreground">{rule.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getRuleTypeColor(rule.type)}>
                            {rule.type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getCategoryColor(rule.category)}>
                            {rule.category}
                          </Badge>
                        </TableCell>
                        <TableCell>{rule.priority}</TableCell>
                        <TableCell>
                          <Switch
                            checked={rule.isActive}
                            onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditRule(rule)}
                              icon={Edit}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              icon={Copy}
                            >
                              Clone
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              icon={Trash2}
                              className="text-red-600 hover:text-red-700"
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {rules.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <div className="flex flex-col items-center gap-2">
                            <Settings className="h-12 w-12 text-muted-foreground" />
                            <p className="text-muted-foreground">No rules configured yet.</p>
                            <Button onClick={handleCreateRule} icon={Plus}>
                              Create Your First Rule
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rule-sets" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Rule Sets</CardTitle>
              <CardDescription>
                Group related rules together and manage their activation periods.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Rule Sets management coming soon.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Rule Templates</CardTitle>
              <CardDescription>
                Pre-configured rule sets for different compensation plans and markets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Rule Templates management coming soon.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <RulePerformance />
        </TabsContent>

        <TabsContent value="bulk-ops" className="space-y-6">
          <BulkOperations rules={rules} onRulesUpdate={loadData} />
        </TabsContent>

        <TabsContent value="versioning" className="space-y-6">
          <RuleVersioning onVersionRestore={loadData} />
        </TabsContent>

        <TabsContent value="docs" className="space-y-6">
          <RuleDocumentation rules={rules} templates={[]} />
        </TabsContent>

        <TabsContent value="validation" className="space-y-6">
          <RuleConflicts rules={rules} onRulesUpdate={loadData} />
        </TabsContent>

        <TabsContent value="simulation" className="space-y-6">
          <RuleSimulator rules={rules} />
        </TabsContent>
      </Tabs>

      {/* Rule Creation/Edit Dialog */}
      <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedRule ? 'Edit Rule' : 'Create New Rule'}
            </DialogTitle>
            <DialogDescription>
              Configure the business rule parameters and conditions.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="rule-name">Rule Name</Label>
                <Input
                  id="rule-name"
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  placeholder="e.g., Binary Commission Rate"
                />
              </div>

              <div>
                <Label htmlFor="rule-description">Description</Label>
                <Textarea
                  id="rule-description"
                  value={ruleForm.description}
                  onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                  placeholder="Describe what this rule does..."
                />
              </div>

              <div>
                <Label htmlFor="rule-type">Rule Type</Label>
                <Select
                  value={ruleForm.type}
                  onValueChange={(value) => setRuleForm({ ...ruleForm, type: value as RuleType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="commission_rate">Commission Rate</SelectItem>
                    <SelectItem value="commission_cap">Commission Cap</SelectItem>
                    <SelectItem value="rank_requirement">Rank Requirement</SelectItem>
                    <SelectItem value="stockist_bonus">Stockist Bonus</SelectItem>
                    <SelectItem value="matching_bonus">Matching Bonus</SelectItem>
                    <SelectItem value="referral_bonus">Referral Bonus</SelectItem>
                    <SelectItem value="leadership_bonus">Leadership Bonus</SelectItem>
                    <SelectItem value="custom_bonus">Custom Bonus</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="rule-category">Category</Label>
                <Select
                  value={ruleForm.category}
                  onValueChange={(value) => setRuleForm({ ...ruleForm, category: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="commission">Commission</SelectItem>
                    <SelectItem value="bonus">Bonus</SelectItem>
                    <SelectItem value="qualification">Qualification</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="incentive">Incentive</SelectItem>
                    <SelectItem value="penalty">Penalty</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="rule-priority">Priority</Label>
                <Input
                  id="rule-priority"
                  type="number"
                  value={ruleForm.priority}
                  onChange={(e) => setRuleForm({ ...ruleForm, priority: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="rule-active"
                  checked={ruleForm.isActive}
                  onCheckedChange={(checked) => setRuleForm({ ...ruleForm, isActive: checked })}
                />
                <Label htmlFor="rule-active">Active</Label>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Applicable To</Label>
                <div className="flex gap-2 mt-2">
                  {(['distributor', 'stockist', 'customer'] as const).map((type) => (
                    <Button
                      key={type}
                      variant={ruleForm.applicableTo.includes(type) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        const newApplicableTo = ruleForm.applicableTo.includes(type)
                          ? ruleForm.applicableTo.filter(t => t !== type)
                          : [...ruleForm.applicableTo, type];
                        setRuleForm({ ...ruleForm, applicableTo: newApplicableTo });
                      }}
                    >
                      {type}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="rule-frequency">Frequency</Label>
                <Select
                  value={ruleForm.frequency}
                  onValueChange={(value) => setRuleForm({ ...ruleForm, frequency: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                    <SelectItem value="one_time">One Time</SelectItem>
                    <SelectItem value="continuous">Continuous</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="rule-payout-timing">Payout Timing</Label>
                <Select
                  value={ruleForm.payoutTiming}
                  onValueChange={(value) => setRuleForm({ ...ruleForm, payoutTiming: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="end_of_period">End of Period</SelectItem>
                    <SelectItem value="achievement_date">Achievement Date</SelectItem>
                    <SelectItem value="qualification_date">Qualification Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="rule-tags">Tags (comma-separated)</Label>
                <Input
                  id="rule-tags"
                  value={ruleForm.tags.join(', ')}
                  onChange={(e) => setRuleForm({ ...ruleForm, tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) })}
                  placeholder="e.g., binary, commission, volume"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsRuleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRule}>
              {selectedRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}