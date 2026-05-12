'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useI18n } from '@/lib/internationalization';

interface CalculationEditorProps {
  calculation: any;
  onChange: (calculation: any) => void;
}

const calculationTypes = [
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'fixed_amount', label: 'Fixed Amount' },
  { value: 'per_unit', label: 'Per Unit' },
  { value: 'tiered_percentage', label: 'Tiered Percentage' },
  { value: 'tiered_fixed', label: 'Tiered Fixed' },
  { value: 'formula', label: 'Custom Formula' },
  { value: 'maximum_cap', label: 'Maximum Cap' },
  { value: 'capped_percentage', label: 'Capped Percentage' },
  { value: 'minimum_guarantee', label: 'Minimum Guarantee' }
];

export function CalculationEditor({ calculation, onChange }: CalculationEditorProps) {
  const { t } = useI18n();
  const [calcType, setCalcType] = useState<string>(calculation?.type || 'percentage');
  const [calcData, setCalcData] = useState<any>(calculation || {});

  useEffect(() => {
    if (calculation) {
      setCalcType(calculation.type || 'percentage');
      setCalcData(calculation);
    }
  }, [calculation]);

  const updateCalculation = (type: string, data: any) => {
    const newCalc = { type, ...data };
    setCalcType(type);
    setCalcData(newCalc);
    onChange(newCalc);
  };

  const renderPercentageEditor = () => (
    <div className="space-y-4">
      <div>
        <Label>{t('businessRules.percentage')}</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={calcData.percentage || 0}
          onChange={(e) => updateCalculation('percentage', {
            ...calcData,
            percentage: parseFloat(e.target.value) || 0
          })}
          placeholder="e.g., 10 for 10%"
        />
      </div>
      {calcData.cap !== undefined && (
        <div>
          <Label>{t('businessRules.capOptional')}</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={calcData.cap || ''}
            onChange={(e) => updateCalculation('percentage', {
              ...calcData,
              cap: e.target.value ? parseFloat(e.target.value) : undefined
            })}
            placeholder={t('businessRules.maximumAmountOptional')}
          />
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => updateCalculation('percentage', {
          ...calcData,
          cap: calcData.cap === undefined ? 0 : undefined
        })}
      >
        {calcData.cap === undefined ? t('businessRules.addCap') : t('businessRules.removeCap')}
      </Button>
    </div>
  );

  const renderFixedAmountEditor = () => (
    <div>
      <Label>{t('businessRules.fixedAmount')}</Label>
      <Input
        type="number"
        step="0.01"
        min="0"
        value={calcData.baseValue || calcData.amount || 0}
        onChange={(e) => updateCalculation('fixed_amount', {
          ...calcData,
          baseValue: parseFloat(e.target.value) || 0,
          amount: parseFloat(e.target.value) || 0
        })}
        placeholder="e.g., 100.00"
      />
    </div>
  );

  const renderPerUnitEditor = () => (
    <div>
      <Label>{t('businessRules.amountPerUnit')}</Label>
      <Input
        type="number"
        step="0.01"
        min="0"
        value={calcData.baseValue || calcData.perUnit || 0}
        onChange={(e) => updateCalculation('per_unit', {
          ...calcData,
          baseValue: parseFloat(e.target.value) || 0,
          perUnit: parseFloat(e.target.value) || 0
        })}
        placeholder="e.g., 0.50 per unit"
      />
    </div>
  );

  const renderTieredEditor = (isPercentage: boolean) => {
    const tiers = calcData.tiers || [{ min: 0, max: null, value: 0 }];

    const addTier = () => {
      const lastTier = tiers[tiers.length - 1];
      const newTier = {
        min: lastTier?.max ? lastTier.max + 1 : 0,
        max: null,
        value: 0
      };
      updateCalculation(isPercentage ? 'tiered_percentage' : 'tiered_fixed', {
        ...calcData,
        tiers: [...tiers, newTier]
      });
    };

    const updateTier = (index: number, field: string, value: any) => {
      const newTiers = [...tiers];
      newTiers[index] = { ...newTiers[index], [field]: value };
      updateCalculation(isPercentage ? 'tiered_percentage' : 'tiered_fixed', {
        ...calcData,
        tiers: newTiers
      });
    };

    const removeTier = (index: number) => {
      if (tiers.length === 1) return;
      const newTiers = tiers.filter((_: any, i: number) => i !== index);
      updateCalculation(isPercentage ? 'tiered_percentage' : 'tiered_fixed', {
        ...calcData,
        tiers: newTiers
      });
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>{t('businessRules.tiers')}</Label>
          <Button type="button" variant="outline" size="sm" onClick={addTier}>
            <Plus className="h-4 w-4 mr-1" />
            {t('businessRules.addTier')}
          </Button>
        </div>
        <div className="space-y-3">
          {tiers.map((tier: any, index: number) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="grid grid-cols-4 gap-3 items-end">
                  <div>
                    <Label className="text-xs">{t('businessRules.min')}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={tier.min || 0}
                      onChange={(e) => updateTier(index, 'min', parseFloat(e.target.value) || 0)}
                      disabled={index === 0}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t('businessRules.max')}</Label>
                    <Input
                      type="number"
                      min={tier.min || 0}
                      value={tier.max || ''}
                      onChange={(e) => updateTier(index, 'max', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder={t('businessRules.noLimit')}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{isPercentage ? t('businessRules.percentage') : t('businessRules.amount')}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={tier.value || 0}
                      onChange={(e) => updateTier(index, 'value', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    {tiers.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTier(index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {t('businessRules.tiersNote')}
          </AlertDescription>
        </Alert>
      </div>
    );
  };

  const renderFormulaEditor = () => (
    <div className="space-y-4">
      <div>
        <Label>{t('businessRules.formula')}</Label>
        <Input
          value={calcData.formula || ''}
          onChange={(e) => updateCalculation('formula', {
            ...calcData,
            formula: e.target.value
          })}
          placeholder="e.g., (personal_volume * 0.02) + (group_volume * 0.005)"
        />
      </div>
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          <strong>{t('businessRules.availableVariables')}</strong> personal_volume, group_volume, team_size, direct_recruits, rank, tenure
          <br />
          <strong>{t('businessRules.operators')}</strong> +, -, *, /, (, )
        </AlertDescription>
      </Alert>
    </div>
  );

  const renderMaximumCapEditor = () => (
    <div>
      <Label>Maximum Cap</Label>
      <Input
        type="number"
        step="0.01"
        min="0"
        value={calcData.maximum || calcData.cap || 0}
        onChange={(e) => updateCalculation('maximum_cap', {
          ...calcData,
          maximum: parseFloat(e.target.value) || 0,
          cap: parseFloat(e.target.value) || 0
        })}
        placeholder="e.g., 5000.00"
      />
    </div>
  );

  const renderCappedPercentageEditor = () => (
    <div className="space-y-4">
      <div>
        <Label>{t('businessRules.percentage')}</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={calcData.percentage || 0}
          onChange={(e) => updateCalculation('capped_percentage', {
            ...calcData,
            percentage: parseFloat(e.target.value) || 0
          })}
        />
      </div>
      <div>
        <Label>{t('businessRules.maximumCap')}</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={calcData.maximum || calcData.cap || 0}
          onChange={(e) => updateCalculation('capped_percentage', {
            ...calcData,
            maximum: parseFloat(e.target.value) || 0,
            cap: parseFloat(e.target.value) || 0
          })}
        />
      </div>
    </div>
  );

  const renderMinimumGuaranteeEditor = () => (
    <div>
      <Label>{t('businessRules.minimumGuaranteeAmount')}</Label>
      <Input
        type="number"
        step="0.01"
        min="0"
        value={calcData.minimum || calcData.guarantee || 0}
        onChange={(e) => updateCalculation('minimum_guarantee', {
          ...calcData,
          minimum: parseFloat(e.target.value) || 0,
          guarantee: parseFloat(e.target.value) || 0
        })}
        placeholder="e.g., 100.00"
      />
    </div>
  );

  const renderCalculationEditor = () => {
    switch (calcType) {
      case 'percentage':
        return renderPercentageEditor();
      case 'fixed_amount':
        return renderFixedAmountEditor();
      case 'per_unit':
        return renderPerUnitEditor();
      case 'tiered_percentage':
        return renderTieredEditor(true);
      case 'tiered_fixed':
        return renderTieredEditor(false);
      case 'formula':
        return renderFormulaEditor();
      case 'maximum_cap':
        return renderMaximumCapEditor();
      case 'capped_percentage':
        return renderCappedPercentageEditor();
      case 'minimum_guarantee':
        return renderMinimumGuaranteeEditor();
      default:
        return renderPercentageEditor();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>{t('businessRules.calculationType')}</Label>
        <Select value={calcType} onValueChange={(value) => {
          setCalcType(value);
          updateCalculation(value, { type: value });
        }}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {calculationTypes.map(type => (
              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {renderCalculationEditor()}
    </div>
  );
}

