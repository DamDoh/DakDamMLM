'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Play, Save, CheckCircle, Trash2, Plus } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { BusinessRule, RuleCondition, RuleCalculation, RuleCalculationType } from '@/lib/types';
import { customFunctionEngine, type CustomFunction } from '@/lib/custom-functions';
import { ruleValidationEngine } from '@/lib/rule-validation-engine';
import { useToast } from '@/hooks/use-toast';

interface EnhancedRuleBuilderProps {
  companyId?: string;
  initialRule?: Partial<BusinessRule>;
  onSave?: (rule: BusinessRule) => void;
  onCancel?: () => void;
}

export function EnhancedRuleBuilder({
  companyId,
  initialRule,
  onSave,
  onCancel
}: EnhancedRuleBuilderProps) {
  const [rule, setRule] = useState<Partial<BusinessRule>>({
    name: '',
    description: '',
    type: 'custom_bonus',
    category: 'bonus',
    priority: 100,
    isActive: true,
    conditions: [],
    calculation: {
      type: 'fixed_amount',
      baseValue: 0
    },
    applicableTo: ['distributor'],
    frequency: 'monthly',
    payoutTiming: 'end_of_period',
    tags: [],
    ...initialRule
  });

  const [customFunctions, setCustomFunctions] = useState<CustomFunction[]>([]);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadCustomFunctions();
  }, [companyId]);

  const loadCustomFunctions = () => {
    const functions = customFunctionEngine.getFunctions(companyId);
    setCustomFunctions(functions);
  };

  const updateRule = (field: keyof BusinessRule, value: any) => {
    setRule({ ...rule, [field]: value });
  };

  const addCondition = () => {
    const newCondition: RuleCondition = {
      type: 'rank',
      operator: 'equals',
      value: 'Bronze'
    };
    setRule({
      ...rule,
      conditions: [...(rule.conditions || []), newCondition]
    });
  };

  const updateCondition = (index: number, field: keyof RuleCondition, value: any) => {
    const updatedConditions = [...(rule.conditions || [])];
    updatedConditions[index] = { ...updatedConditions[index], [field]: value };
    setRule({ ...rule, conditions: updatedConditions });
  };

  const removeCondition = (index: number) => {
    const updatedConditions = (rule.conditions || []).filter((_, i) => i !== index);
    setRule({ ...rule, conditions: updatedConditions });
  };

  const updateCalculation = (field: keyof RuleCalculation, value: any) => {
    const updatedCalculation = { ...(rule.calculation || {}), [field]: value };
    if (field === 'type' && value) {
      updatedCalculation.type = value as RuleCalculationType;
    }
    setRule({
      ...rule,
      calculation: updatedCalculation as RuleCalculation
    });
  };

  const validateRule = () => {
    if (!rule.name || !rule.calculation) return;

    const fullRule: BusinessRule = {
      id: rule.id || `rule-${Date.now()}`,
      name: rule.name,
      description: rule.description || '',
      type: rule.type || 'custom_bonus',
      category: rule.category || 'bonus',
      priority: rule.priority || 100,
      isActive: rule.isActive || true,
      conditions: rule.conditions || [],
      calculation: rule.calculation,
      applicableTo: rule.applicableTo || ['distributor'],
      frequency: rule.frequency || 'monthly',
      payoutTiming: rule.payoutTiming || 'end_of_period',
      companyId,
      createdAt: rule.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: rule.createdBy || 'admin',
      version: rule.version || 1,
      tags: rule.tags || []
    };

    const result = ruleValidationEngine.validateRule(fullRule);
    setValidationResult(result);
    return result;
  };

  const testRule = async () => {
    setIsTesting(true);
    try {
      // Create mock context for testing
      const mockContext = {
        memberId: 'test-member',
        period: { start: '2024-01-01', end: '2024-01-31' },
        volumes: { personal: 1000, group: 5000, left: 2500, right: 2500 },
        ranks: { current: 'Gold', paidAs: 'Gold', qualifiedFor: ['Gold', 'Diamond'] },
        team: { directRecruits: 5, totalDownline: 50, activeMembers: 35, qualifiedLegs: 2 },
        genealogy: { generation: 1, upline: [], downline: [], sponsor: 'sponsor-id', placement: 'placement-id' },
        products: { purchased: [] },
        previousPeriods: [],
        customData: {}
      };

      // For now, return mock results
      setTestResults({
        amount: 125.50,
        breakdown: [{
          component: 'Test Bonus',
          amount: 125.50,
          description: 'Test execution result'
        }],
        metadata: {
          conditionsMet: true,
          ruleType: rule.type,
          category: rule.category
        }
      });
    } catch (error) {
      setTestResults({ error: error instanceof Error ? error.message : 'Test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const validation = validateRule();
    if (!validation?.isValid) {
      toast({
        title: 'Validation Failed',
        description: 'Please fix the validation errors before saving',
        variant: 'destructive'
      });
      return;
    }

    const fullRule: BusinessRule = {
      id: rule.id || `rule-${Date.now()}`,
      name: rule.name || '',
      description: rule.description || '',
      type: rule.type || 'custom_bonus',
      category: rule.category || 'bonus',
      priority: rule.priority || 100,
      isActive: rule.isActive || true,
      conditions: rule.conditions || [],
      calculation: rule.calculation!,
      applicableTo: rule.applicableTo || ['distributor'],
      frequency: rule.frequency || 'monthly',
      payoutTiming: rule.payoutTiming || 'end_of_period',
      companyId,
      createdAt: rule.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: rule.createdBy || 'admin',
      version: rule.version || 1,
      tags: rule.tags || []
    };

    onSave?.(fullRule);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Enhanced Rule Builder</h2>
          <p className="text-muted-foreground">
            Create advanced business rules with custom functions and limitless customization
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={testRule} disabled={isTesting}>
            <Play className="w-4 h-4 mr-2" />
            {isTesting ? 'Testing...' : 'Test Rule'}
          </Button>
          <Button variant="outline" onClick={validateRule}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Validate
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Save Rule
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {validationResult && (
        <Alert variant={validationResult.isValid ? 'default' : 'destructive'}>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              {validationResult.errors.length > 0 && (
                <div>
                  <strong>Errors:</strong>
                  <ul className="list-disc list-inside">
                    {validationResult.errors.map((error: string, i: number) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              {validationResult.warnings.length > 0 && (
                <div>
                  <strong>Warnings:</strong>
                  <ul className="list-disc list-inside">
                    {validationResult.warnings.map((warning: string, i: number) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic Settings</TabsTrigger>
          <TabsTrigger value="conditions">Conditions</TabsTrigger>
          <TabsTrigger value="calculation">Calculation</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Configure the fundamental properties of your rule</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Rule Name</Label>
                  <Input
                    id="name"
                    value={rule.name}
                    onChange={(e) => updateRule('name', e.target.value)}
                    placeholder="e.g., Advanced Leadership Bonus"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Rule Type</Label>
                  <Select value={rule.type} onValueChange={(value) => updateRule('type', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom_bonus">Custom Bonus</SelectItem>
                      <SelectItem value="binary_bonus">Binary Bonus</SelectItem>
                      <SelectItem value="unilevel_bonus">Unilevel Bonus</SelectItem>
                      <SelectItem value="matrix_bonus">Matrix Bonus</SelectItem>
                      <SelectItem value="generation_bonus">Generation Bonus</SelectItem>
                      <SelectItem value="matching_bonus">Matching Bonus</SelectItem>
                      <SelectItem value="leadership_bonus">Leadership Bonus</SelectItem>
                      <SelectItem value="referral_bonus">Referral Bonus</SelectItem>
                      <SelectItem value="rank_achievement_bonus">Rank Achievement Bonus</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={rule.description}
                  onChange={(e) => updateRule('description', e.target.value)}
                  placeholder="Describe what this rule does and when it applies..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={rule.category} onValueChange={(value) => updateRule('category', value)}>
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
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={rule.priority}
                    onChange={(e) => updateRule('priority', parseInt(e.target.value))}
                    min="0"
                    max="1000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Active</Label>
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={(checked) => updateRule('isActive', checked)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conditions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rule Conditions</CardTitle>
              <CardDescription>Define when this rule should apply</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Conditions determine when the rule is eligible to execute
                </p>
                <Button onClick={addCondition}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Condition
                </Button>
              </div>

              {(rule.conditions || []).map((condition, index) => (
                <ConditionBuilder
                  key={index}
                  condition={condition}
                  onUpdate={(field, value) => updateCondition(index, field, value)}
                  onRemove={() => removeCondition(index)}
                  customFunctions={customFunctions}
                />
              ))}

              {(rule.conditions || []).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No conditions defined. Rule will apply to all eligible members.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calculation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Calculation Method</CardTitle>
              <CardDescription>Define how amounts are calculated when the rule executes</CardDescription>
            </CardHeader>
            <CardContent>
              <CalculationBuilder
                calculation={rule.calculation || { type: 'fixed_amount', baseValue: 0 }}
                onUpdate={updateCalculation}
                customFunctions={customFunctions}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>Configure timing, applicability, and other advanced options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select value={rule.frequency} onValueChange={(value) => updateRule('frequency', value)}>
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
                <div className="space-y-2">
                  <Label>Payout Timing</Label>
                  <Select value={rule.payoutTiming} onValueChange={(value) => updateRule('payoutTiming', value)}>
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
              </div>

              <div className="space-y-2">
                <Label>Applicable To</Label>
                <div className="flex gap-2">
                  {['distributor', 'stockist', 'customer'].map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={type}
                        checked={(rule.applicableTo || []).includes(type as any)}
                        onChange={(e) => {
                          const current = rule.applicableTo || [];
                          if (e.target.checked) {
                            updateRule('applicableTo', [...current, type]);
                          } else {
                            updateRule('applicableTo', current.filter(t => t !== type));
                          }
                        }}
                      />
                      <Label htmlFor={type} className="capitalize">{type}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {testResults && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm bg-muted p-4 rounded">
              {JSON.stringify(testResults, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ConditionBuilderProps {
  condition: RuleCondition;
  onUpdate: (field: keyof RuleCondition, value: any) => void;
  onRemove: () => void;
  customFunctions: CustomFunction[];
}

function ConditionBuilder({ condition, onUpdate, onRemove, customFunctions }: ConditionBuilderProps) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <Label>Type</Label>
            <Select value={condition.type} onValueChange={(value) => onUpdate('type', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rank">Rank</SelectItem>
                <SelectItem value="pv">Personal Volume</SelectItem>
                <SelectItem value="gv">Group Volume</SelectItem>
                <SelectItem value="direct_recruits">Direct Recruits</SelectItem>
                <SelectItem value="total_recruits">Total Recruits</SelectItem>
                <SelectItem value="active_members">Active Members</SelectItem>
                <SelectItem value="qualified_legs">Qualified Legs</SelectItem>
                <SelectItem value="custom_condition">Custom Function</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Operator</Label>
            <Select value={condition.operator} onValueChange={(value) => onUpdate('operator', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">Equals</SelectItem>
                <SelectItem value="not_equals">Not Equals</SelectItem>
                <SelectItem value="greater_than">Greater Than</SelectItem>
                <SelectItem value="less_than">Less Than</SelectItem>
                <SelectItem value="greater_equal">Greater Equal</SelectItem>
                <SelectItem value="less_equal">Less Equal</SelectItem>
                <SelectItem value="in">In</SelectItem>
                <SelectItem value="contains">Contains</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Value</Label>
            {condition.type === 'custom_condition' ? (
              <Select value={condition.value} onValueChange={(value) => onUpdate('value', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {customFunctions.map((func) => (
                    <SelectItem key={func.id} value={func.id}>
                      {func.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={condition.value}
                onChange={(e) => onUpdate('value', e.target.value)}
                placeholder="Enter value"
              />
            )}
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={onRemove}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface CalculationBuilderProps {
  calculation: RuleCalculation;
  onUpdate: (field: keyof RuleCalculation, value: any) => void;
  customFunctions: CustomFunction[];
}

function CalculationBuilder({ calculation, onUpdate, customFunctions }: CalculationBuilderProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Calculation Type</Label>
          <Select value={calculation.type} onValueChange={(value) => onUpdate('type', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
              <SelectItem value="percentage">Percentage</SelectItem>
              <SelectItem value="per_unit">Per Unit</SelectItem>
              <SelectItem value="tiered_percentage">Tiered Percentage</SelectItem>
              <SelectItem value="tiered_fixed">Tiered Fixed</SelectItem>
              <SelectItem value="formula">Formula</SelectItem>
              <SelectItem value="lookup_table">Lookup Table</SelectItem>
              <SelectItem value="custom_calculation">Custom Function</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Base Value</Label>
          <Input
            type="number"
            value={calculation.baseValue || 0}
            onChange={(e) => onUpdate('baseValue', parseFloat(e.target.value))}
          />
        </div>
      </div>

      {calculation.type === 'percentage' && (
        <div className="space-y-2">
          <Label>Percentage</Label>
          <Input
            type="number"
            value={calculation.percentage || 0}
            onChange={(e) => onUpdate('percentage', parseFloat(e.target.value))}
            min="0"
            max="100"
          />
        </div>
      )}

      {calculation.type === 'custom_calculation' && (
        <div className="space-y-2">
          <Label>Custom Function</Label>
          <Select value={calculation.customFunction} onValueChange={(value) => onUpdate('customFunction', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {customFunctions.map((func) => (
                <SelectItem key={func.id} value={func.id}>
                  {func.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {calculation.type === 'formula' && (
        <div className="space-y-2">
          <Label>Formula</Label>
          <Textarea
            value={calculation.formula || ''}
            onChange={(e) => onUpdate('formula', e.target.value)}
            placeholder="e.g., PV * 0.1 + GV * 0.05"
            rows={3}
          />
        </div>
      )}

      {(calculation.type === 'tiered_percentage' || calculation.type === 'tiered_fixed') && (
        <div className="space-y-2">
          <Label>Tiers</Label>
          <div className="text-sm text-muted-foreground">
            Tier configuration would go here
          </div>
        </div>
      )}
    </div>
  );
}