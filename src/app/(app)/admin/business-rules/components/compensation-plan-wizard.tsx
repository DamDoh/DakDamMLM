'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, ArrowLeft, CheckCircle, Binary, Layers, Grid, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import type { BusinessRule } from '@/lib/types';

interface CompensationPlanWizardProps {
  onComplete: (rules: BusinessRule[]) => void;
  onCancel: () => void;
}

type PlanType = 'binary' | 'unilevel' | 'matrix' | null;

export function CompensationPlanWizard({ onComplete, onCancel }: CompensationPlanWizardProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [planType, setPlanType] = useState<PlanType>(null);
  
  // Binary Plan Configuration
  const [binaryConfig, setBinaryConfig] = useState({
    commissionPercentage: 10,
    weakerLegPercentage: 10,
    matchingBonusPercentage: 5,
    matchingBonusMaxLevel: 5,
    rankAdvancementBonus: true,
    pvRequirement: 100
  });

  // Unilevel Plan Configuration
  const [unilevelConfig, setUnilevelConfig] = useState({
    maxLevels: 10,
    levelPercentages: [8, 5, 3, 2, 1, 0.5, 0.5, 0.5, 0.5, 0.5],
    rankBasedCaps: true,
    generationDepth: 10
  });

  // Matrix Plan Configuration
  const [matrixConfig, setMatrixConfig] = useState({
    width: 3,
    depth: 3,
    spilloverEnabled: true,
    compressionBonus: true,
    compressionPercentage: 5
  });

  const handleNext = () => {
    if (step === 1 && !planType) {
      toast({
        variant: 'destructive',
        title: t('businessRules.selectionRequired'),
        description: t('businessRules.selectCompensationPlanType'),
      });
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const generateBinaryRules = (): BusinessRule[] => {
    const rules: BusinessRule[] = [];

    // Binary Commission Rule
    rules.push({
      id: `binary-comm-${Date.now()}`,
      name: 'Binary Commission',
      description: `Binary commission at ${binaryConfig.commissionPercentage}% on weaker leg`,
      type: 'binary_bonus',
      category: 'commission',
      priority: 100,
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
        percentage: binaryConfig.commissionPercentage
      },
      applicableTo: ['distributor'],
      frequency: 'weekly',
      payoutTiming: 'end_of_period',
      tags: ['binary', 'commission'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      version: 1
    } as BusinessRule);

    // Matching Bonus
    if (binaryConfig.matchingBonusPercentage > 0) {
      rules.push({
        id: `binary-matching-${Date.now()}`,
        name: 'Binary Matching Bonus',
        description: `Matching bonus at ${binaryConfig.matchingBonusPercentage}% on downline commissions (up to ${binaryConfig.matchingBonusMaxLevel} levels)`,
        type: 'matching_bonus',
        category: 'bonus',
        priority: 200,
        isActive: true,
        conditions: [
          {
            type: 'rank',
            operator: 'greater_equal',
            value: 'Gold'
          }
        ],
        calculation: {
          type: 'tiered_percentage',
          tiers: Array.from({ length: binaryConfig.matchingBonusMaxLevel }, (_, i) => ({
            min: i + 1,
            max: i + 1,
            value: binaryConfig.matchingBonusPercentage - (i * 0.5)
          }))
        },
        applicableTo: ['distributor'],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        tags: ['binary', 'matching', 'bonus'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        version: 1
      } as BusinessRule);
    }

    // PV Qualification
    rules.push({
      id: `binary-pv-${Date.now()}`,
      name: 'PV Qualification Requirement',
      description: `Minimum ${binaryConfig.pvRequirement} PV required for binary commission eligibility`,
      type: 'rank_requirement',
      category: 'qualification',
      priority: 50,
      isActive: true,
      conditions: [
        {
          type: 'personal_volume',
          operator: 'greater_equal',
          value: binaryConfig.pvRequirement
        }
      ],
      calculation: {
        type: 'fixed_amount',
        baseValue: 0
      },
      applicableTo: ['distributor'],
      frequency: 'monthly',
      payoutTiming: 'end_of_period',
      tags: ['binary', 'qualification', 'pv'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      version: 1
    } as BusinessRule);

    return rules;
  };

  const generateUnilevelRules = (): BusinessRule[] => {
    const rules: BusinessRule[] = [];

    // Level-based commissions
    unilevelConfig.levelPercentages.forEach((percentage, index) => {
      if (percentage > 0) {
        rules.push({
          id: `unilevel-level-${index + 1}-${Date.now()}`,
          name: `Unilevel Level ${index + 1} Commission`,
          description: `${percentage}% commission on level ${index + 1} volume`,
          type: 'unilevel_bonus',
          category: 'commission',
          priority: 100 - index,
          isActive: true,
          conditions: [
            {
              type: 'unilevel_level',
              operator: 'equals',
              value: index + 1
            }
          ],
          calculation: {
            type: 'percentage',
            percentage: percentage
          },
          applicableTo: ['distributor'],
          frequency: 'monthly',
          payoutTiming: 'end_of_period',
          tags: ['unilevel', `level-${index + 1}`],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system',
          version: 1
        } as BusinessRule);
      }
    });

    return rules;
  };

  const generateMatrixRules = (): BusinessRule[] => {
    const rules: BusinessRule[] = [];

    // Matrix Commission
    rules.push({
      id: `matrix-comm-${Date.now()}`,
      name: `Matrix ${matrixConfig.width}x${matrixConfig.depth} Commission`,
      description: `Commission for ${matrixConfig.width}x${matrixConfig.depth} matrix structure`,
      type: 'matrix_bonus',
      category: 'commission',
      priority: 100,
      isActive: true,
      conditions: [
        {
          type: 'matrix_position',
          operator: 'in',
          value: Array.from({ length: matrixConfig.width * matrixConfig.depth }, (_, i) => i + 1)
        }
      ],
      calculation: {
        type: 'percentage',
        percentage: 10
      },
      applicableTo: ['distributor'],
      frequency: 'monthly',
      payoutTiming: 'end_of_period',
      tags: ['matrix', `${matrixConfig.width}x${matrixConfig.depth}`],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      version: 1
    } as BusinessRule);

    // Spillover Handling
    if (matrixConfig.spilloverEnabled) {
      rules.push({
        id: `matrix-spillover-${Date.now()}`,
        name: 'Matrix Spillover Bonus',
        description: 'Bonus for handling spillover in matrix structure',
        type: 'spillover_bonus',
        category: 'bonus',
        priority: 150,
        isActive: true,
        conditions: [
          {
            type: 'matrix_position',
            operator: 'greater_than',
            value: matrixConfig.width
          }
        ],
        calculation: {
          type: 'percentage',
          percentage: 5
        },
        applicableTo: ['distributor'],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        tags: ['matrix', 'spillover'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        version: 1
      } as BusinessRule);
    }

    // Compression Bonus
    if (matrixConfig.compressionBonus) {
      rules.push({
        id: `matrix-compression-${Date.now()}`,
        name: 'Matrix Compression Bonus',
        description: `Compression bonus at ${matrixConfig.compressionPercentage}% for filled matrices`,
        type: 'compression_bonus',
        category: 'bonus',
        priority: 200,
        isActive: true,
        conditions: [
          {
            type: 'matrix_position',
            operator: 'equals',
            value: matrixConfig.width * matrixConfig.depth
          }
        ],
        calculation: {
          type: 'percentage',
          percentage: matrixConfig.compressionPercentage
        },
        applicableTo: ['distributor'],
        frequency: 'monthly',
        payoutTiming: 'end_of_period',
        tags: ['matrix', 'compression'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        version: 1
      } as BusinessRule);
    }

    return rules;
  };

  const handleFinish = () => {
    let rules: BusinessRule[] = [];
    
    switch (planType) {
      case 'binary':
        rules = generateBinaryRules();
        break;
      case 'unilevel':
        rules = generateUnilevelRules();
        break;
      case 'matrix':
        rules = generateMatrixRules();
        break;
    }

    if (rules.length === 0) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('businessRules.noRulesGenerated'),
      });
      return;
    }

    // Don't show toast here - let the parent component handle it after rules are created
    onComplete(rules);
  };

  return (
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{t('businessRules.compensationPlanWizard')}</DialogTitle>
          <DialogDescription>
            {t('businessRules.stepOf', { step: step.toString(), total: (planType ? 3 : 2).toString() })}: {step === 1 ? t('businessRules.selectPlanType') : step === 2 ? t('businessRules.configurePlan') : t('businessRules.reviewAndCreate')}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-4">
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertDescription>
                {t('businessRules.selectCompensationPlanTypeDesc')}
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <Card 
                className={`cursor-pointer hover:border-primary ${planType === 'binary' ? 'border-primary bg-primary/5' : ''}`}
                onClick={() => setPlanType('binary')}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Binary className="h-5 w-5" />
                    {t('businessRules.binaryPlan')}
                  </CardTitle>
                  <CardDescription>
                    {t('businessRules.binaryPlanDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• {t('businessRules.binaryCommission')}</li>
                    <li>• {t('businessRules.matchingBonus')}</li>
                    <li>• {t('businessRules.rankAdvancement')}</li>
                    <li>• {t('businessRules.pvRequirements')}</li>
                  </ul>
                </CardContent>
              </Card>

              <Card 
                className={`cursor-pointer hover:border-primary ${planType === 'unilevel' ? 'border-primary bg-primary/5' : ''}`}
                onClick={() => setPlanType('unilevel')}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    {t('businessRules.unilevelPlan')}
                  </CardTitle>
                  <CardDescription>
                    {t('businessRules.unilevelPlanDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• {t('businessRules.levelBasedCommissions')}</li>
                    <li>• {t('businessRules.generationDepthLimits')}</li>
                    <li>• {t('businessRules.rankBasedCaps')}</li>
                    <li>• {t('businessRules.unlimitedWidth')}</li>
                  </ul>
                </CardContent>
              </Card>

              <Card 
                className={`cursor-pointer hover:border-primary ${planType === 'matrix' ? 'border-primary bg-primary/5' : ''}`}
                onClick={() => setPlanType('matrix')}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Grid className="h-5 w-5" />
                    {t('businessRules.matrixPlan')}
                  </CardTitle>
                  <CardDescription>
                    {t('businessRules.matrixPlanDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• {t('businessRules.forcedPositioning')}</li>
                    <li>• {t('businessRules.spilloverHandling')}</li>
                    <li>• {t('businessRules.compressionBonuses')}</li>
                    <li>• {t('businessRules.fixedWidthDepth')}</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 2 && planType === 'binary' && (
          <div className="space-y-4 py-4">
            <Alert>
              <Binary className="h-4 w-4" />
              <AlertDescription>
                {t('businessRules.configureBinaryPlan')}
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label>{t('businessRules.commissionPercentage')} (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={binaryConfig.commissionPercentage}
                  onChange={(e) => setBinaryConfig({ ...binaryConfig, commissionPercentage: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>{t('businessRules.weakerLegPercentage')} (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={binaryConfig.weakerLegPercentage}
                  onChange={(e) => setBinaryConfig({ ...binaryConfig, weakerLegPercentage: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>{t('businessRules.matchingBonusPercentage')} (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={binaryConfig.matchingBonusPercentage}
                  onChange={(e) => setBinaryConfig({ ...binaryConfig, matchingBonusPercentage: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>{t('businessRules.matchingBonusMaxLevels')}</Label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={binaryConfig.matchingBonusMaxLevel}
                  onChange={(e) => setBinaryConfig({ ...binaryConfig, matchingBonusMaxLevel: parseInt(e.target.value) || 5 })}
                />
              </div>
              <div>
                <Label>{t('businessRules.pvRequirement')}</Label>
                <Input
                  type="number"
                  min="0"
                  value={binaryConfig.pvRequirement}
                  onChange={(e) => setBinaryConfig({ ...binaryConfig, pvRequirement: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && planType === 'unilevel' && (
          <div className="space-y-4 py-4">
            <Alert>
              <Layers className="h-4 w-4" />
              <AlertDescription>
                {t('businessRules.configureUnilevelPlan')}
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <Label>{t('businessRules.maximumLevels')}</Label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={unilevelConfig.maxLevels}
                  onChange={(e) => {
                    const levels = parseInt(e.target.value) || 10;
                    const percentages = Array.from({ length: levels }, (_, i) => 
                      unilevelConfig.levelPercentages[i] || (i < 5 ? 8 - i : 0.5)
                    );
                    setUnilevelConfig({ ...unilevelConfig, maxLevels: levels, levelPercentages: percentages });
                  }}
                />
              </div>

              <div>
                <Label>{t('businessRules.levelPercentages')} (%)</Label>
                <div className="space-y-2 mt-2">
                  {unilevelConfig.levelPercentages.slice(0, unilevelConfig.maxLevels).map((percentage, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Label className="w-20 text-sm">{t('businessRules.level')} {index + 1}:</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={percentage}
                        onChange={(e) => {
                          const newPercentages = [...unilevelConfig.levelPercentages];
                          newPercentages[index] = parseFloat(e.target.value) || 0;
                          setUnilevelConfig({ ...unilevelConfig, levelPercentages: newPercentages });
                        }}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && planType === 'matrix' && (
          <div className="space-y-4 py-4">
            <Alert>
              <Grid className="h-4 w-4" />
              <AlertDescription>
                {t('businessRules.configureMatrixPlan')}
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label>{t('businessRules.matrixWidth')}</Label>
                <Input
                  type="number"
                  min="2"
                  max="10"
                  value={matrixConfig.width}
                  onChange={(e) => setMatrixConfig({ ...matrixConfig, width: parseInt(e.target.value) || 3 })}
                />
              </div>
              <div>
                <Label>{t('businessRules.matrixDepth')}</Label>
                <Input
                  type="number"
                  min="2"
                  max="10"
                  value={matrixConfig.depth}
                  onChange={(e) => setMatrixConfig({ ...matrixConfig, depth: parseInt(e.target.value) || 3 })}
                />
              </div>
              <div className="col-span-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="spillover"
                    checked={matrixConfig.spilloverEnabled}
                    onChange={(e) => setMatrixConfig({ ...matrixConfig, spilloverEnabled: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="spillover">{t('businessRules.enableSpilloverHandling')}</Label>
                </div>
              </div>
              <div className="col-span-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="compression"
                    checked={matrixConfig.compressionBonus}
                    onChange={(e) => setMatrixConfig({ ...matrixConfig, compressionBonus: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="compression">{t('businessRules.enableCompressionBonus')}</Label>
                </div>
              </div>
              {matrixConfig.compressionBonus && (
                <div>
                  <Label>{t('businessRules.compressionBonusPercentage')} (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={matrixConfig.compressionPercentage}
                    onChange={(e) => setMatrixConfig({ ...matrixConfig, compressionPercentage: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 py-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {planType ? t('businessRules.reviewRulesDesc', { planType: t(`businessRules.${planType}Plan`) }) : t('businessRules.reviewRulesDesc', { planType: '' })}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              {planType === 'binary' && (
                <div>
                  <h4 className="font-semibold mb-2">{t('businessRules.binaryPlanRules')}:</h4>
                  <ul className="space-y-1 text-sm">
                    <li>• {t('businessRules.binaryCommission')} ({binaryConfig.commissionPercentage}%)</li>
                    <li>• {t('businessRules.matchingBonus')} ({binaryConfig.matchingBonusPercentage}%, {binaryConfig.matchingBonusMaxLevel} {t('businessRules.levels')})</li>
                    <li>• {t('businessRules.pvQualification')} ({binaryConfig.pvRequirement} PV)</li>
                  </ul>
                </div>
              )}
              {planType === 'unilevel' && (
                <div>
                  <h4 className="font-semibold mb-2">{t('businessRules.unilevelPlanRules')}:</h4>
                  <ul className="space-y-1 text-sm">
                    {unilevelConfig.levelPercentages.slice(0, unilevelConfig.maxLevels).map((pct, idx) => (
                      pct > 0 && <li key={idx}>• {t('businessRules.level')} {idx + 1} {t('businessRules.commission')} ({pct}%)</li>
                    ))}
                  </ul>
                </div>
              )}
              {planType === 'matrix' && (
                <div>
                  <h4 className="font-semibold mb-2">{t('businessRules.matrixPlanRules')}:</h4>
                  <ul className="space-y-1 text-sm">
                    <li>• {t('businessRules.matrix')} {matrixConfig.width}x{matrixConfig.depth} {t('businessRules.commission')}</li>
                    {matrixConfig.spilloverEnabled && <li>• {t('businessRules.spilloverBonus')}</li>}
                    {matrixConfig.compressionBonus && <li>• {t('businessRules.compressionBonus')} ({matrixConfig.compressionPercentage}%)</li>}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row justify-between gap-2 pt-4 border-t">
          <Button variant="outline" onClick={step === 1 ? onCancel : handleBack} className="w-full sm:w-auto">
            {step === 1 ? t('common.cancel') : <><ArrowLeft className="h-4 w-4 mr-1" /> {t('common.previous')}</>}
          </Button>
          {step < (planType ? 3 : 2) ? (
            <Button onClick={handleNext} className="w-full sm:w-auto">
              {t('common.next')} <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleFinish} className="w-full sm:w-auto">
              <CheckCircle className="h-4 w-4 mr-1" /> {t('businessRules.createRules')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

