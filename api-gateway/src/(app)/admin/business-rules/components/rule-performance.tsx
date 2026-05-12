'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart3, TrendingUp, Clock, AlertTriangle, CheckCircle, XCircle, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const [loading, setLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [timeRange] = useState('7d');

  useEffect(() => {
    loadPerformanceData();
  }, [timeRange]);

  const loadPerformanceData = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would fetch from an API
      // For now, we'll use mock data
      const mockData: PerformanceData = {
        totalExecutions: 15420,
        averageExecutionTime: 45.2,
        totalAmountPaid: 285430.50,
        successRate: 98.7,
        topPerformingRules: [
          {
            ruleId: 'binary-commission-001',
            ruleName: 'Binary Commission',
            executionCount: 5200,
            averageExecutionTime: 12.3,
            totalAmountPaid: 125430.25,
            successRate: 99.8,
            lastExecuted: new Date().toISOString(),
            errorCount: 10,
            performanceScore: 95
          },
          {
            ruleId: 'rank-bonus-002',
            ruleName: 'Rank Achievement Bonus',
            executionCount: 1200,
            averageExecutionTime: 8.7,
            totalAmountPaid: 45680.00,
            successRate: 100,
            lastExecuted: new Date().toISOString(),
            errorCount: 0,
            performanceScore: 98
          }
        ],
        slowRules: [
          {
            ruleId: 'complex-calculation-003',
            ruleName: 'Complex Matrix Calculation',
            executionCount: 800,
            averageExecutionTime: 245.8,
            totalAmountPaid: 89320.75,
            successRate: 97.2,
            lastExecuted: new Date().toISOString(),
            errorCount: 22,
            performanceScore: 72
          }
        ],
        errorRules: [
          {
            ruleId: 'problematic-rule-004',
            ruleName: 'Problematic Custom Rule',
            executionCount: 450,
            averageExecutionTime: 89.3,
            totalAmountPaid: 12340.50,
            successRate: 85.6,
            lastExecuted: new Date().toISOString(),
            errorCount: 65,
            performanceScore: 45
          }
        ],
        executionTrends: [
          { date: '2024-01-01', executions: 1200, errors: 12, averageTime: 42.1 },
          { date: '2024-01-02', executions: 1350, errors: 8, averageTime: 38.9 },
          { date: '2024-01-03', executions: 1180, errors: 15, averageTime: 46.2 }
        ]
      };

      setPerformanceData(mockData);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load performance data.',
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
        <p className="text-muted-foreground">No performance data available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Executions</p>
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
                <p className="text-sm font-medium text-muted-foreground">Avg Execution Time</p>
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
                <p className="text-sm font-medium text-muted-foreground">Total Paid</p>
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
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
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
            Top Performing Rules
          </CardTitle>
          <CardDescription>
            Rules with the highest performance scores and reliability.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule Name</TableHead>
                <TableHead>Executions</TableHead>
                <TableHead>Avg Time</TableHead>
                <TableHead>Success Rate</TableHead>
                <TableHead>Performance</TableHead>
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
                      <Button variant="outline" size="sm">
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
                      <Button variant="outline" size="sm">
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
            Execution Trends
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
    </div>
  );
}