'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, X } from 'lucide-react';
import type { RuleCondition, StockistLevel, AccountType } from '@/lib/types';
import { stockistLevels, accountTypes } from '@/lib/types';
import { useI18n } from '@/lib/internationalization';

interface ConditionsEditorProps {
  conditions: RuleCondition[];
  onChange: (conditions: RuleCondition[]) => void;
}

const conditionTypes = [
  { value: 'rank', label: 'Rank' },
  { value: 'pv', label: 'Personal Volume (PV)' },
  { value: 'gv', label: 'Group Volume (GV)' },
  { value: 'personal_volume', label: 'Personal Volume' },
  { value: 'group_volume', label: 'Group Volume' },
  { value: 'team_size', label: 'Team Size' },
  { value: 'direct_recruits', label: 'Direct Recruits' },
  { value: 'active_members', label: 'Active Members' },
  { value: 'consecutive_months', label: 'Consecutive Months' },
  { value: 'tenure', label: 'Tenure (Days)' },
  { value: 'qualified_legs', label: 'Qualified Legs' },
  { value: 'binary_legs', label: 'Binary Legs' },
  { value: 'matrix_position', label: 'Matrix Position' },
  { value: 'unilevel_level', label: 'Unilevel Level' },
  { value: 'account_type', label: 'Account Type' },
  { value: 'stockist_level', label: 'Stockist Level' },
  { value: 'custom_condition', label: 'Custom Condition' }
];

const operators = [
  { value: 'equals', label: 'Equals (=)' },
  { value: 'not_equals', label: 'Not Equals (≠)' },
  { value: 'greater_than', label: 'Greater Than (>)' },
  { value: 'greater_equal', label: 'Greater or Equal (≥)' },
  { value: 'less_than', label: 'Less Than (<)' },
  { value: 'less_equal', label: 'Less or Equal (≤)' },
  { value: 'in', label: 'In (List)' },
  { value: 'not_in', label: 'Not In (List)' },
  { value: 'contains', label: 'Contains' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'ends_with', label: 'Ends With' }
];

const logicalOperators = [
  { value: 'AND', label: 'AND' },
  { value: 'OR', label: 'OR' }
];

const rankValues = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Manager', 'Director', 'President', 'Double President'];
const stockistLevelValues: StockistLevel[] = stockistLevels;
const accountTypeValues: AccountType[] = [...accountTypes];

export function ConditionsEditor({ conditions, onChange }: ConditionsEditorProps) {
  const { t } = useI18n();
  const [localConditions, setLocalConditions] = useState<RuleCondition[]>(conditions || []);

  const updateConditions = (newConditions: RuleCondition[]) => {
    setLocalConditions(newConditions);
    onChange(newConditions);
  };

  const addCondition = () => {
    const newCondition: RuleCondition = {
      type: 'rank',
      operator: 'equals',
      value: '',
      logicalOperator: localConditions.length > 0 ? 'AND' : undefined
    };
    updateConditions([...localConditions, newCondition]);
  };

  const removeCondition = (index: number) => {
    const newConditions = localConditions.filter((_, i) => i !== index);
    updateConditions(newConditions);
  };

  const updateCondition = (index: number, field: keyof RuleCondition, value: any) => {
    const newConditions = [...localConditions];
    newConditions[index] = { ...newConditions[index], [field]: value };
    updateConditions(newConditions);
  };

  const getValueInput = (condition: RuleCondition, index: number) => {
    if (condition.type === 'rank') {
      return (
        <Select
          value={condition.value as string || ''}
          onValueChange={(value) => updateCondition(index, 'value', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('businessRules.selectRank')} />
          </SelectTrigger>
          <SelectContent>
            {rankValues.map(rank => (
              <SelectItem key={rank} value={rank}>{rank}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (condition.type === 'stockist_level') {
      return (
        <Select
          value={condition.value as string || ''}
          onValueChange={(value) => updateCondition(index, 'value', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('businessRules.selectStockistLevel')} />
          </SelectTrigger>
          <SelectContent>
            {stockistLevelValues.map(level => (
              <SelectItem key={level} value={level}>{level}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (condition.type === 'account_type') {
      return (
        <Select
          value={condition.value as string || ''}
          onValueChange={(value) => updateCondition(index, 'value', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('businessRules.selectAccountType')} />
          </SelectTrigger>
          <SelectContent>
            {accountTypeValues.map(type => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (condition.operator === 'in' || condition.operator === 'not_in') {
      return (
        <Input
          placeholder="Comma-separated values (e.g., Bronze,Silver,Gold)"
          value={Array.isArray(condition.value) ? condition.value.join(',') : condition.value as string || ''}
          onChange={(e) => {
            const values = e.target.value.split(',').map(v => v.trim()).filter(v => v);
            updateCondition(index, 'value', values);
          }}
        />
      );
    }

    return (
      <Input
        type={condition.type.includes('volume') || condition.type.includes('size') || condition.type === 'tenure' || condition.type === 'consecutive_months' ? 'number' : 'text'}
        placeholder={condition.type.includes('volume') || condition.type.includes('size') ? 'Enter number' : 'Enter value'}
        value={condition.value as string || ''}
        onChange={(e) => updateCondition(index, 'value', condition.type.includes('volume') || condition.type.includes('size') || condition.type === 'tenure' || condition.type === 'consecutive_months' ? parseFloat(e.target.value) || 0 : e.target.value)}
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>{t('businessRules.conditions')}</Label>
        <Button type="button" variant="outline" size="sm" onClick={addCondition}>
          <Plus className="h-4 w-4 mr-1" />
          {t('businessRules.addCondition')}
        </Button>
      </div>

      {localConditions.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('businessRules.noConditionsAdded')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {localConditions.map((condition, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {index > 0 && (
                    <div className="pt-2">
                      <Select
                        value={condition.logicalOperator || 'AND'}
                        onValueChange={(value) => updateCondition(index, 'logicalOperator', value)}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {logicalOperators.map(op => (
                            <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">{t('businessRules.conditionType')}</Label>
                      <Select
                        value={condition.type}
                        onValueChange={(value) => updateCondition(index, 'type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {conditionTypes.map(type => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs">{t('businessRules.operator')}</Label>
                      <Select
                        value={condition.operator}
                        onValueChange={(value) => updateCondition(index, 'operator', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {operators.map(op => (
                            <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="md:col-span-2">
                      <Label className="text-xs">{t('businessRules.value')}</Label>
                      {getValueInput(condition, index)}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCondition(index)}
                    className="mt-6"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {localConditions.length > 0 && (
        <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
          {t('businessRules.conditionsNote')}
        </div>
      )}
    </div>
  );
}

