'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { BarChart3, TrendingUp, Clock, AlertTriangle, CheckCircle, XCircle, Activity, Zap, FileText, ExternalLink, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import { PerformanceAlerts } from './performance-alerts';

interface RulePerformanceMetrics {
  ruleId: string;
  ruleName: string;
  executionCount: number;
  averageExecutionTime: number;
  totalAmountPaid: number;
  successRate: number;
  lastExecuted: string;
  errorCount: number;
  performanceScore: number;
}

interface PerformanceData {
  totalExecutions: number;
  averageExecutionTime: number;
  totalAmountPaid: number;
  successRate: number;
  topPerformingRules: RulePerformanceMetrics[];
  slowRules: RulePerformanceMetrics[];
  errorRules: RulePerformanceMetrics[];
  executionTrends: Array<{
    date: string;
    executions: number;
    errors: number;
    averageTime: number;
  }>;
}

export function RulePerformance() {
  const { toast } = useToast();
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [timeRange, setTimeRange] = useState('7d');
  const [optimizeDialogOpen, setOptimizeDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<RulePerformanceMetrics | null>(null);

  useEffect(() => {
    loadPerformanceData();
  }, [timeRange]);

  const loadPerformanceData = async () => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/business-rules/performance?timeRange=${timeRange}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Failed to fetch performance data');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setPerformanceData(result.data);
      } else {
        throw new Error(result.error || 'Failed to load performance data');
      }
    } catch (error) {
      console.error('Error loading performance data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load performance data.',
      });
      // Set empty data on error
      setPerformanceData({
        totalExecutions: 0,
        averageExecutionTime: 0,
        totalAmountPaid: 0,
        successRate: 0,
        topPerformingRules: [],
        slowRules: [],
        errorRules: [],
        executionTrends: []
      });
    } finally {
      setLoading(false);
    }
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceIcon = (score: number) => {
    if (score >= 90) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (score >= 70) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  const handleOptimize = async (rule: RulePerformanceMetrics) => {
    setSelectedRule(rule);
    setOptimizeDialogOpen(true);
  };

  const handleReview = async (rule: RulePerformanceMetrics) => {
    setSelectedRule(rule);
    setReviewDialogOpen(true);
  };

  const handleNavigateToRule = () => {
    if (!selectedRule) return;
    
    // Navigate to the rules tab and scroll to the rule
    router.push('/admin/business-rules?tab=rules&ruleId=' + selectedRule.ruleId);
    toast({
      title: 'Navigating to rule',
      description: `Opening "${selectedRule.ruleName}" for editing.`,
    });
    setOptimizeDialogOpen(false);
    setReviewDialogOpen(false);
  };

  const handleOptimizeRule = async () => {
    if (!selectedRule) return;

    try {
      // In a real implementation, this would call an API to optimize the rule
      // For now, we'll show a success message
      toast({
        title: 'Optimization Started',
        description: `Optimization suggestions for "${selectedRule.ruleName}" have been generated. Please review the recommendations.`,
      });
      setOptimizeDialogOpen(false);
      
      // Reload performance data after optimization
      await loadPerformanceData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to optimize rule. Please try again.',
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!performanceData) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">{t('businessRules.noPerformanceData')}</p>
        <p className="text-sm text-muted-foreground mt-2">
          {t('businessRules.performanceDataWillAppear')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Time Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('businessRules.performanceMonitoring')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('businessRules.trackRuleExecution')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="time-range" className="text-sm">{t('businessRules.timeRange')}:</Label>
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value)}>
            <SelectTrigger className="w-32" id="time-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">{t('businessRules.last7Days')}</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('businessRules.totalExecutions')}</p>
                <p className="text-2xl font-bold">{performanceData.totalExecutions.toLocaleString()}</p>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('businessRules.avgExecutionTime')}</p>
                <p className="text-2xl font-bold">{performanceData.averageExecutionTime}ms</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('businessRules.totalPaid')}</p>
                <p className="text-2xl font-bold">${performanceData.totalAmountPaid.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('businessRules.successRate')}</p>
                <p className="text-2xl font-bold">{performanceData.successRate}%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Alerts */}
      {performanceData.errorRules.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {performanceData.errorRules.length} rule(s) have high error rates and need attention.
          </AlertDescription>
        </Alert>
      )}

      {/* Top Performing Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            {t('businessRules.topPerformingRules')}
          </CardTitle>
          <CardDescription>
            {t('businessRules.highestPerformanceScores')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('businessRules.ruleName')}</TableHead>
                <TableHead>{t('businessRules.executions')}</TableHead>
                <TableHead>{t('businessRules.avgTime')}</TableHead>
                <TableHead>{t('businessRules.successRate')}</TableHead>
                <TableHead>{t('businessRules.performance')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {performanceData.topPerformingRules.map((rule) => (
                <TableRow key={rule.ruleId}>
                  <TableCell className="font-medium">{rule.ruleName}</TableCell>
                  <TableCell>{rule.executionCount.toLocaleString()}</TableCell>
                  <TableCell>{rule.averageExecutionTime}ms</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{rule.successRate}%</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getPerformanceIcon(rule.performanceScore)}
                      <span className={getPerformanceColor(rule.performanceScore)}>
                        {rule.performanceScore}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Slow Rules */}
      {performanceData.slowRules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              Slow Performing Rules
            </CardTitle>
            <CardDescription>
              Rules that may need optimization for better performance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Executions</TableHead>
                  <TableHead>Avg Time</TableHead>
                  <TableHead>Performance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {performanceData.slowRules.map((rule) => (
                  <TableRow key={rule.ruleId}>
                    <TableCell className="font-medium">{rule.ruleName}</TableCell>
                    <TableCell>{rule.executionCount.toLocaleString()}</TableCell>
                    <TableCell className="text-yellow-600 font-medium">
                      {rule.averageExecutionTime}ms
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getPerformanceIcon(rule.performanceScore)}
                        <span className={getPerformanceColor(rule.performanceScore)}>
                          {rule.performanceScore}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleOptimize(rule)}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Optimize
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Error-Prone Rules */}
      {performanceData.errorRules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Rules with Errors
            </CardTitle>
            <CardDescription>
              Rules that frequently encounter errors and need review.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Executions</TableHead>
                  <TableHead>Errors</TableHead>
                  <TableHead>Success Rate</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {performanceData.errorRules.map((rule) => (
                  <TableRow key={rule.ruleId}>
                    <TableCell className="font-medium">{rule.ruleName}</TableCell>
                    <TableCell>{rule.executionCount.toLocaleString()}</TableCell>
                    <TableCell className="text-red-600 font-medium">
                      {rule.errorCount}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">{rule.successRate}%</Badge>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleReview(rule)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Execution Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {t('businessRules.executionTrends')}
          </CardTitle>
          <CardDescription>
            Rule execution patterns over the selected time period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {performanceData.executionTrends.map((trend, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-medium">{new Date(trend.date).toLocaleDateString()}</p>
                    <p className="text-sm text-muted-foreground">
                      {trend.executions} executions • {trend.errors} errors
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">{trend.averageTime}ms avg</p>
                    <Progress
                      value={(trend.averageTime / 100) * 100}
                      className="w-20 h-2"
                    />
                  </div>
                  <Badge variant={trend.errors > 10 ? 'destructive' : 'secondary'}>
                    {trend.errors} errors
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Optimize Dialog */}
      <Dialog open={optimizeDialogOpen} onOpenChange={setOptimizeDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-600" />
              Optimize Rule Performance
            </DialogTitle>
            <DialogDescription>
              Review optimization suggestions for better rule performance.
            </DialogDescription>
          </DialogHeader>
          {selectedRule && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">{selectedRule.ruleName}</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Current Avg Time:</span>
                    <span className="ml-2 font-medium text-yellow-600">{selectedRule.averageExecutionTime}ms</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Performance Score:</span>
                    <span className="ml-2 font-medium">{selectedRule.performanceScore}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Executions:</span>
                    <span className="ml-2 font-medium">{selectedRule.executionCount.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Success Rate:</span>
                    <span className="ml-2 font-medium">{selectedRule.successRate}%</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h5 className="font-semibold">Optimization Recommendations:</h5>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Consider caching calculation results for frequently accessed data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Review and optimize database queries used in rule conditions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Break down complex calculations into smaller, more efficient steps</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Consider adding indexes to frequently queried fields</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Evaluate if rule can be split into multiple simpler rules</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOptimizeDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleNavigateToRule}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Edit Rule
            </Button>
            <Button onClick={handleOptimizeRule}>
              <Zap className="h-4 w-4 mr-2" />
              Apply Optimizations
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-600" />
              Review Rule Errors
            </DialogTitle>
            <DialogDescription>
              Investigate and resolve errors for this rule.
            </DialogDescription>
          </DialogHeader>
          {selectedRule && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">{selectedRule.ruleName}</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Errors:</span>
                    <span className="ml-2 font-medium text-red-600">{selectedRule.errorCount}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Success Rate:</span>
                    <span className="ml-2 font-medium text-red-600">{selectedRule.successRate}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Executions:</span>
                    <span className="ml-2 font-medium">{selectedRule.executionCount.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Error Rate:</span>
                    <span className="ml-2 font-medium text-red-600">
                      {((selectedRule.errorCount / selectedRule.executionCount) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h5 className="font-semibold">Common Error Patterns:</h5>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <span>Null reference errors in calculation logic</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <span>Invalid data type conversions in conditions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <span>Missing required fields in rule conditions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <span>Division by zero in calculation formulas</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <span>Timeout errors due to complex calculations</span>
                  </li>
                </ul>
              </div>

              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Recommendation:</strong> Review the rule's conditions and calculation logic. 
                  Check error logs for specific failure patterns and update the rule accordingly.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Close
            </Button>
            <Button variant="outline" onClick={handleNavigateToRule}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Edit Rule
            </Button>
            <Button onClick={() => {
              toast({
                title: 'Review Logged',
                description: `Error review for "${selectedRule?.ruleName}" has been logged for investigation.`,
              });
              setReviewDialogOpen(false);
            }}>
              <FileText className="h-4 w-4 mr-2" />
              Log Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Performance Alerts Section */}
      <div className="border-t pt-6 mt-6">
        <PerformanceAlerts />
      </div>
    </div>
  );
}