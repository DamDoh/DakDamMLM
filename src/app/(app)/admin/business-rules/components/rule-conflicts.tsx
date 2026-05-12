'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Shield, Zap, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import type { BusinessRule, RuleConflict, ConflictSummary, RuleValidationResult } from '@/lib/types';
import { ruleConflictDetector } from '@/lib/rule-conflict-detector';

interface RuleConflictsProps {
  rules: BusinessRule[];
  onRulesUpdate?: () => void;
}

export function RuleConflicts({ rules }: RuleConflictsProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [conflicts, setConflicts] = useState<RuleConflict[]>([]);
  const [summary, setSummary] = useState<ConflictSummary | null>(null);
  const [validations, setValidations] = useState<Record<string, RuleValidationResult>>({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('conflicts');

  const analyzeRules = useCallback(async () => {
    if (rules.length === 0) {
      setConflicts([]);
      setSummary({
        total: 0,
        bySeverity: { high: 0, medium: 0, low: 0 },
        byType: {}
      });
      setValidations({});
      return;
    }

    setLoading(true);
    try {
      // Normalize rules data to ensure arrays are properly formatted
      const normalizedRules = rules.map(rule => ({
        ...rule,
        conditions: Array.isArray(rule.conditions) ? rule.conditions : [],
        applicableTo: (Array.isArray(rule.applicableTo) ? rule.applicableTo : ['distributor']) as ('distributor' | 'stockist' | 'customer')[],
        calculation: rule.calculation || null,
        tags: Array.isArray(rule.tags) ? rule.tags : []
      }));

      // Load rules into conflict detector
      ruleConflictDetector.loadRules(normalizedRules);

      // Analyze conflicts
      const detectedConflicts = ruleConflictDetector.analyzeConflicts();
      setConflicts(detectedConflicts);

      // Get summary
      const conflictSummary = ruleConflictDetector.getConflictSummary(detectedConflicts);
      setSummary(conflictSummary);

      // Validate individual rules
      const ruleValidations: Record<string, RuleValidationResult> = {};
      normalizedRules.forEach(rule => {
        try {
        ruleValidations[rule.id] = ruleConflictDetector.validateRule(rule);
        } catch (error) {
          console.error(`Error validating rule ${rule.id}:`, error);
          ruleValidations[rule.id] = {
            isValid: false,
            errors: ['Validation error occurred'],
            warnings: [],
            suggestions: []
          };
        }
      });
      setValidations(ruleValidations);

      toast({
        title: t('businessRules.analysisComplete'),
        description: t('businessRules.analysisCompleteDesc', { count: detectedConflicts.length.toString(), ruleCount: normalizedRules.length.toString() }),
      });

    } catch (error) {
      console.error('Error analyzing rules:', error);
      toast({
        variant: 'destructive',
        title: t('businessRules.analysisFailed'),
        description: error instanceof Error ? error.message : t('businessRules.analysisFailedDesc'),
      });
    } finally {
      setLoading(false);
    }
  }, [rules, toast]);

  useEffect(() => {
    // Analyze rules on initial load when rules are available
    if (rules.length > 0) {
      analyzeRules();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount to avoid regenerating on every rules change

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'medium': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'low': return <CheckCircle className="h-4 w-4 text-blue-600" />;
      default: return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getConflictTypeDescription = (type: string) => {
    const descriptions: Record<string, string> = {
      calculation_conflict: t('businessRules.conflictingCalculationMethods'),
      condition_conflict: t('businessRules.conflictingConditions'),
      frequency_mismatch: t('businessRules.differentPayoutFrequencies'),
      mutually_exclusive_conditions: t('businessRules.mutuallyExclusiveConditions'),
      redundant_conditions: t('businessRules.redundantConditions'),
      duplicate_priorities: t('businessRules.duplicatePriorities'),
      priority_gap: t('businessRules.priorityGaps'),
      overlapping_conditions: t('businessRules.overlappingConditions')
    };
    return descriptions[type] || type;
  };

  const getValidationStatus = (validation: RuleValidationResult) => {
    if (!validation.isValid) return { status: 'error', icon: XCircle, color: 'text-red-600' };
    if (validation.warnings.length > 0) return { status: 'warning', icon: AlertTriangle, color: 'text-yellow-600' };
    return { status: 'valid', icon: CheckCircle, color: 'text-green-600' };
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('businessRules.totalConflicts')}</p>
                  <p className="text-2xl font-bold">{summary.total}</p>
                </div>
                <Shield className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('businessRules.highSeverity')}</p>
                  <p className="text-2xl font-bold text-red-600">{summary.bySeverity.high}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('businessRules.mediumSeverity')}</p>
                  <p className="text-2xl font-bold text-yellow-600">{summary.bySeverity.medium}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('businessRules.lowSeverity')}</p>
                  <p className="text-2xl font-bold text-blue-600">{summary.bySeverity.low}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analysis Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('businessRules.ruleAnalysis')}</CardTitle>
              <CardDescription>
                {t('businessRules.analyzeRulesForConflicts')}
              </CardDescription>
            </div>
            <Button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                analyzeRules();
              }} 
              disabled={loading} 
              variant="outline"
              type="button"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('businessRules.reAnalyzeRules')}
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Analysis Results */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="conflicts">{t('businessRules.conflictsTab')} ({conflicts.length})</TabsTrigger>
          <TabsTrigger value="validation">{t('businessRules.validationTab')} ({Object.keys(validations).length})</TabsTrigger>
          <TabsTrigger value="summary">{t('businessRules.summaryTab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="conflicts" className="space-y-4">
          {conflicts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Conflicts Detected</h3>
                <p className="text-muted-foreground">
                  All rules are properly configured with no conflicts detected.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{t('businessRules.detectedConflicts')}</CardTitle>
                <CardDescription>
                  {t('businessRules.reviewAndResolve')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('businessRules.typeCol')}</TableHead>
                      <TableHead>{t('businessRules.severity')}</TableHead>
                      <TableHead>{t('businessRules.rulesInvolved')}</TableHead>
                      <TableHead>{t('businessRules.descriptionCol')}</TableHead>
                      <TableHead>{t('businessRules.suggestion')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conflicts.map((conflict, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Badge variant="outline">
                            {getConflictTypeDescription(conflict.type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getSeverityColor(conflict.severity)}>
                            {getSeverityIcon(conflict.severity)}
                            <span className="ml-1 capitalize">{conflict.severity}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {conflict.rules.map(ruleId => {
                              const rule = rules.find(r => r.id === ruleId);
                              return rule?.name || ruleId;
                            }).join(', ')}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="text-sm">{conflict.description}</p>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="text-sm text-muted-foreground">{conflict.suggestion}</p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="validation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('businessRules.ruleValidationResults')}</CardTitle>
              <CardDescription>
                {t('businessRules.individualValidationStatus')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('businessRules.ruleName')}</TableHead>
                    <TableHead>{t('businessRules.status')}</TableHead>
                    <TableHead>{t('businessRules.errors')}</TableHead>
                    <TableHead>{t('businessRules.warnings')}</TableHead>
                    <TableHead>{t('businessRules.suggestions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(validations).map(([ruleId, validation]) => {
                    const rule = rules.find(r => r.id === ruleId);
                    const status = getValidationStatus(validation);
                    const StatusIcon = status.icon;

                    return (
                      <TableRow key={ruleId}>
                        <TableCell className="font-medium">
                          {rule?.name || ruleId}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <StatusIcon className={`h-4 w-4 ${status.color}`} />
                            <span className="capitalize text-sm">{status.status}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {validation.errors.length > 0 ? (
                            <div className="text-red-600 text-sm">
                              {validation.errors.map((error, i) => (
                                <div key={i}>• {error}</div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">{t('businessRules.none')}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {validation.warnings.length > 0 ? (
                            <div className="text-yellow-600 text-sm">
                              {validation.warnings.map((warning, i) => (
                                <div key={i}>• {warning}</div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">{t('businessRules.none')}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {validation.suggestions.length > 0 ? (
                            <div className="text-blue-600 text-sm">
                              {validation.suggestions.map((suggestion, i) => (
                                <div key={i}>• {suggestion}</div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">{t('businessRules.none')}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Conflict Summary by Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(summary.byType).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center">
                        <span className="text-sm capitalize">
                          {getConflictTypeDescription(type).toLowerCase()}
                        </span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Health</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Overall Health</span>
                      <span>{summary.bySeverity.high === 0 ? 'Good' : 'Needs Attention'}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          summary.bySeverity.high === 0 ? 'bg-green-600' : 'bg-red-600'
                        }`}
                        style={{
                          width: `${summary.bySeverity.high === 0 ? 100 : Math.max(10, 100 - summary.total * 10)}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  <Alert>
                    <Zap className="h-4 w-4" />
                    <AlertDescription>
                      {summary.bySeverity.high === 0
                        ? 'All rules are properly configured with no critical conflicts.'
                        : `${summary.bySeverity.high} critical conflict(s) need immediate attention.`
                      }
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}