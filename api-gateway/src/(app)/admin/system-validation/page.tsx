
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Shield,
  Database,
  Users,
  Calculator,
  Zap,
  HardDrive,
  TestTube2,
} from 'lucide-react';
import { useI18n } from '@/lib/internationalization';
import { scheduleAutomaticBackup, testDisasterRecovery, runValidationSuite } from '@/services/system-actions';
import { useToast } from '@/hooks/use-toast';

interface ValidationTest {
  id: string;
  name: string;
  category: string;
  status: 'pending' | 'running' | 'pass' | 'fail' | 'error';
  duration: number;
  message: string;
  icon: any;
}

export default function SystemValidationPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [tests, setTests] = useState<ValidationTest[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);

  const testCategories = [
    {
      id: 'authentication',
      name: t('admin.validation.categoryAuth'),
      icon: Shield,
    },
    {
      id: 'business-logic',
      name: t('admin.validation.categoryBusiness'),
      icon: Calculator,
    },
    {
      id: 'data-management',
      name: t('admin.validation.categoryData'),
      icon: Database,
    },
    {
      id: 'user-experience',
      name: t('admin.validation.categoryUx'),
      icon: Users,
    },
    {
      id: 'performance',
      name: t('admin.validation.categoryPerf'),
      icon: Zap,
    }
  ];
  
  const initializeTests = async () => {
    // This could fetch tests from a server in a real app
    const initialTests = testCategories.flatMap(category => 
        [
            { id: `${category.id}-test-1`, name: `Primary ${category.name} Test`, category: category.id, status: 'pending', duration: 0, message: 'Not run', icon: category.icon },
            { id: `${category.id}-test-2`, name: `Secondary ${category.name} Test`, category: category.id, status: 'pending', duration: 0, message: 'Not run', icon: category.icon }
        ] as ValidationTest[]
    );
    setTests(initialTests);
  };


  useEffect(() => {
    initializeTests();
  }, [t]);

  const runAllTests = async () => {
    setIsRunning(true);
    setOverallProgress(0);
    
    // Reset tests to pending before running
    const pendingTests = tests.map(t => ({ ...t, status: 'pending' as const, duration: 0, message: 'Not run' }));
    setTests(pendingTests);

    const testResults = await runValidationSuite();
    let currentProgress = 0;

    for (const result of testResults) {
        setTests(prev => prev.map(t =>
            t.id === result.id ? { ...t, ...result, status: result.status } : t
        ));
        currentProgress++;
        setOverallProgress((currentProgress / testResults.length) * 100);
        // Add a small delay for visual feedback
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    setIsRunning(false);
  };

  const getTestStats = () => {
    const total = tests.length;
    const passed = tests.filter(t => t.status === 'pass').length;
    const failed = tests.filter(t => t.status === 'fail').length;
    const errors = tests.filter(t => t.status === 'error').length;
    const running = tests.filter(t => t.status === 'running').length;
    const pending = total - passed - failed - errors - running;

    return { total, passed, failed, errors, running, pending };
  };

  const getStatusColor = (status: ValidationTest['status']) => {
    switch (status) {
      case 'pass': return 'text-green-600';
      case 'fail': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      case 'running': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: ValidationTest['status']) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-4 w-4" />;
      case 'fail': return <AlertTriangle className="h-4 w-4" />;
      case 'error': return <XCircle className="h-4 w-4" />;
      case 'running': return <Clock className="h-4 w-4 animate-spin" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };
  
  const handleRunBackup = async () => {
    toast({ title: 'Backup Started', description: 'A manual system backup is now in progress.' });
    const success = await scheduleAutomaticBackup();
    if (success) {
      toast({ title: 'Backup Complete', description: 'System backup was successfully created and stored.' });
    } else {
      toast({ variant: 'destructive', title: 'Backup Failed', description: 'An error occurred during the backup process.' });
    }
  };
  
  const handleTestRecovery = async () => {
    toast({ title: 'Recovery Test Started', description: 'Simulating a disaster recovery scenario...' });
    const result = await testDisasterRecovery();
    if (result.success) {
      toast({ title: 'Recovery Test Successful', description: `Simulation completed in ${result.duration / 1000}s.` });
    } else {
      toast({ variant: 'destructive', title: 'Recovery Test Failed', description: 'The disaster recovery simulation failed.' });
    }
  };

  const stats = getTestStats();

  const getFinalAssessment = () => {
      if (isRunning) {
        return <div className="text-muted-foreground">{t('admin.validation.running')}</div>;
      }
      if (stats.errors > 0) {
        return <div className="text-red-700" dangerouslySetInnerHTML={{ __html: t('admin.validation.assessmentNotReady') }} />
      }
      if (stats.failed > 0) {
        return <div className="text-yellow-700" dangerouslySetInnerHTML={{ __html: t('admin.validation.assessmentNearly') }} />
      }
      if (stats.passed > 0 && stats.passed === stats.total) {
        return <div className="text-green-700" dangerouslySetInnerHTML={{ __html: t('admin.validation.assessmentReady') }} />
      }
       return <div className="text-muted-foreground">{t('admin.validation.assessmentRunTests')}</div>
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><TestTube2 className="h-8 w-8" /> {t('nav.systemValidation')}</h1>
          <p className="text-muted-foreground">{t('admin.validation.description')}</p>
        </div>
        <Button
          onClick={runAllTests}
          disabled={isRunning}
          size="lg"
          className="min-w-40"
          icon={isRunning ? "loading" : "play"}
        >
          {isRunning ? t('admin.validation.running') : t('admin.validation.runAll')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.validation.progressTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={overallProgress} className="h-3" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-2 rounded-lg bg-green-50 border border-green-200">
                <div className="text-2xl font-bold text-green-600">{stats.passed}</div>
                <div className="text-sm font-medium text-green-700">{t('admin.validation.passed')}</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-yellow-50 border border-yellow-200">
                <div className="text-2xl font-bold text-yellow-600">{stats.failed}</div>
                <div className="text-sm font-medium text-yellow-700">{t('admin.validation.failed')}</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-red-50 border border-red-200">
                <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
                <div className="text-sm font-medium text-red-700">{t('admin.validation.errors')}</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-blue-50 border border-blue-200">
                <div className="text-2xl font-bold text-blue-600">{stats.running}</div>
                <div className="text-sm font-medium text-blue-700">{t('admin.validation.runningStat')}</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-gray-50 border border-gray-200">
                <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
                <div className="text-sm font-medium text-gray-700">{t('admin.validation.pendingStat')}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Tabs defaultValue="authentication" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
            {testCategories.map(category => (
              <TabsTrigger key={category.id} value={category.id} className="flex items-center gap-2">
                <category.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{category.name}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {testCategories.map(category => (
            <TabsContent key={category.id} value={category.id} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <category.icon className="h-5 w-5" />
                    {category.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {tests
                      .filter(test => test.category === category.id)
                      .map(test => (
                        <div key={test.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                          <div className="flex items-center gap-3">
                            <div className={getStatusColor(test.status)}>
                              {getStatusIcon(test.status)}
                            </div>
                            <div>
                              <p className="font-medium">{t(`admin.validation.${test.name.toLowerCase().replace(/ /g, '')}`)}</p>
                              <p className="text-sm text-muted-foreground">{test.message}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={test.status === 'pass' ? 'default' : test.status === 'fail' || test.status === 'error' ? 'destructive' : 'secondary'}>
                              {t(`admin.validation.status${test.status.charAt(0).toUpperCase() + test.status.slice(1)}`)}
                            </Badge>
                            {test.duration > 0 &&
                              <p className="text-xs text-muted-foreground mt-1">
                                  {test.duration.toFixed(0)}ms
                              </p>
                            }
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
        
        <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><HardDrive />{t('admin.validation.backupTitle')}</CardTitle>
                <CardDescription>{t('admin.validation.backupDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button variant="outline" icon={HardDrive} onClick={handleRunBackup}>{t('admin.validation.runBackup')}</Button>
                <Button variant="outline" icon={TestTube2} onClick={handleTestRecovery}>{t('admin.validation.testRecovery')}</Button>
              </CardContent>
            </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('admin.validation.readinessTitle')}</CardTitle>
              <CardDescription>{t('admin.validation.readinessDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 border rounded-lg">
                  <div className={`text-3xl font-bold ${stats.errors === 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.errors === 0 ? '✅' : '❌'}
                  </div>
                  <h3 className="font-semibold mt-2">{t('admin.validation.criticalIssues')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {stats.errors === 0 ? t('admin.validation.noCritical') : t('admin.validation.criticalCount', { count: String(stats.errors) })}
                  </p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className={`text-3xl font-bold ${stats.failed === 0 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {stats.failed === 0 ? '✅' : '⚠️'}
                  </div>
                  <h3 className="font-semibold mt-2">{t('admin.validation.testFailures')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {stats.failed === 0 ? t('admin.validation.allTestsPassing') : t('admin.validation.failuresCount', { count: String(stats.failed) })}
                  </p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className={`text-3xl font-bold ${stats.passed >= stats.total * 0.9 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {stats.passed >= stats.total * 0.9 ? '🚀' : '⚠️'}
                  </div>
                  <h3 className="font-semibold mt-2">{t('admin.validation.successRate')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('admin.validation.successRateValue', { rate: stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : "0.0" })}
                  </p>
                </div>
              </div>
              <div className="mt-6 p-4 border rounded-lg bg-muted/50">
                <h3 className="font-semibold mb-2">{t('admin.validation.finalAssessment')}:</h3>
                {getFinalAssessment()}
              </div>
            </CardContent>
          </Card>
        </div>
       </div>
    </div>
  );
}
