
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, MessageSquare, DollarSign } from 'lucide-react';
import { useGenealogyContext } from '@/context/genealogy-context';
import { getPendingFinancialControls, getActiveComplianceDocuments, getAllMemberAgreements } from '@/services/dashboard-actions';
import { compressTree } from '@/services/server-actions';
import { getKeyMetricsServer, getGrowthAnalyticsServer, getBusinessHealthScoreServer } from '@/services/analytics-service';
import CommissionDisputes from '@/components/commission-disputes';
import EcashTopUpRequests from '@/components/ecash/ecash-topup-requests';
import { KeyMetricsCards } from '@/components/admin/dashboard/key-metrics-cards';
import { MemberManagementTab } from '@/components/admin/dashboard/member-management-tab';
import { FinancialControlsTab } from '@/components/admin/dashboard/financial-controls-tab';
import { ComplianceTab } from '@/components/admin/dashboard/compliance-tab';
import { AdvancedAnalyticsTab } from '@/components/admin/dashboard/advanced-analytics-tab';
import { SystemAlertsTab } from '@/components/admin/dashboard/system-alerts-tab';
import type { Member, FinancialControl, ComplianceDocument, MemberAgreement } from '@/lib/types';
import { useI18n } from '@/lib/internationalization';
import { useToast } from '@/hooks/use-toast';

export default function AdminDashboardPage() {
  const { t } = useI18n();
  const context = useGenealogyContext();
  const members = context?.members || [];
  const { toast } = useToast();

  const [financialControls, setFinancialControls] = useState<FinancialControl[]>([]);
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocument[]>([]);
  const [agreements, setAgreements] = useState<MemberAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCompressing, setIsCompressing] = useState(false);

  // Advanced Analytics State
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [commissionAnalytics, setCommissionAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const loadBusinessData = useCallback(async () => {
    if (!context?.loading) {
      setLoading(true);
      try {
        const [controls, docs, memberAgreements] = await Promise.all([
          getPendingFinancialControls(),
          getActiveComplianceDocuments(),
          getAllMemberAgreements(undefined, undefined),
        ]);

        setFinancialControls(controls);
        setComplianceDocs(docs);
        setAgreements(memberAgreements);
      } catch (error: any) {
        console.error('Failed to load business data:', error);
        // Don't show toast for Firebase config errors - they're expected in development
        if (!error?.message?.includes('FIREBASE_SERVICE_ACCOUNT_JSON')) {
          toast({ variant: 'destructive', title: 'Error', description: 'Could not load business intelligence data.' });
        }
      } finally {
        setLoading(false);
      }
    }
  }, [context?.loading, toast]);

  const loadAdvancedAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const [keyMetrics, growthAnalytics, businessHealth] = await Promise.all([
        getKeyMetricsServer('month'),
        getGrowthAnalyticsServer('30d'),
        getBusinessHealthScoreServer(),
      ]);

      setAnalyticsData({
        keyMetrics,
        growthAnalytics,
        businessHealth,
      });

      // Calculate commission analytics
      const commissionBreakdown = await calculateCommissionAnalytics(members.filter((m: Member) => !m.isAdmin));
      setCommissionAnalytics(commissionBreakdown);

    } catch (error: any) {
      console.error('Failed to load advanced analytics:', error);
      // Don't show toast for Firebase config errors - they're expected in development
      if (!error?.message?.includes('FIREBASE_SERVICE_ACCOUNT_JSON') && !error?.message?.includes('FIREBASE_SERVICE_ACCOUNT_JSON')) {
        toast({ variant: 'destructive', title: 'Analytics Error', description: 'Could not load advanced analytics data.' });
      }
    } finally {
      setLoadingAnalytics(false);
    }
  }, [members, toast]);

  // Calculate detailed commission analytics
  const calculateCommissionAnalytics = async (memberList: Member[]) => {
    // For now, return empty analytics since commissions aren't available in context
    // This prevents the 500 errors while maintaining the UI structure
    return {
      commissionByType: {},
      avgCommissionPerMember: 0,
      topEarners: [],
      totalCommissions: 0,
      commissionCount: 0,
    };
  };

  useEffect(() => {
    loadBusinessData();
    loadAdvancedAnalytics();
  }, [loadBusinessData, loadAdvancedAnalytics]);

  const handleCompressTree = async () => {
    setIsCompressing(true);
    try {
      const result = await compressTree();
      if (result.errors > 0) {
        toast({
          variant: 'destructive',
          title: 'Compression Incomplete',
          description: `An error occurred. ${result.compressedCount} members were compressed, but ${result.errors} could not be.`,
        });
      } else {
        toast({
          title: 'Tree Compression Complete',
          description: `${result.compressedCount} inactive members have been compressed.`,
        });
      }
      // Data will refresh via context listener
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Compression Failed',
        description: 'An unexpected error occurred during tree compression.',
      });
    } finally {
      setIsCompressing(false);
    }
  };

  if (context?.loading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('nav.businessIntelligence')}</h1>
          <p className="text-muted-foreground">{t('admin.bi.description')}</p>
        </div>
        <Button onClick={() => { loadBusinessData(); loadAdvancedAnalytics(); }} variant="outline" icon={RefreshCw}>
          {t('admin.bi.refresh')}
        </Button>
      </div>

      {/* Key Metrics */}
      <KeyMetricsCards members={members} agreements={agreements} />

      {/* Detailed Analytics */}
      <Tabs defaultValue="analytics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analytics">Advanced Analytics</TabsTrigger>
          <TabsTrigger value="disputes" className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Commission Disputes</TabsTrigger>
          <TabsTrigger value="topup" className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> E-Cash Top-Ups</TabsTrigger>
          <TabsTrigger value="members">{t('admin.bi.tabMember')}</TabsTrigger>
          <TabsTrigger value="financial">{t('admin.bi.tabFinancial')}</TabsTrigger>
          <TabsTrigger value="compliance">{t('admin.bi.tabCompliance')}</TabsTrigger>
          <TabsTrigger value="alerts">{t('admin.bi.tabAlerts')}</TabsTrigger>
        </TabsList>

        <TabsContent value="topup">
          <EcashTopUpRequests />
        </TabsContent>
        
        <TabsContent value="members" className="space-y-4">
          <MemberManagementTab members={members} />
        </TabsContent>

        <TabsContent value="financial" className="space-y-4">
          <FinancialControlsTab financialControls={financialControls} />
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <ComplianceTab complianceDocs={complianceDocs} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <AdvancedAnalyticsTab
            loadingAnalytics={loadingAnalytics}
            analyticsData={analyticsData}
            commissionAnalytics={commissionAnalytics}
            members={members}
            onLoadAnalytics={loadAdvancedAnalytics}
          />
        </TabsContent>

        <TabsContent value="disputes" className="space-y-4">
          <CommissionDisputes isAdmin={true} />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <SystemAlertsTab
            members={members}
            financialControls={financialControls}
            agreements={agreements}
            isCompressing={isCompressing}
            onCompressTree={handleCompressTree}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
