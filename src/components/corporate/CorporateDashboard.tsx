'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { CorporatePermissionService } from '@/services/corporate/permission-service';
import { FinancialDashboardService } from '@/services/corporate/financial-dashboard';

interface CorporateDashboardProps {
  companyId?: string;
}

export function CorporateDashboard({ companyId }: CorporateDashboardProps) {
  const { data: session } = useSession();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year'>('month');

  useEffect(() => {
    if (session?.user?.id && companyId) {
      loadDashboardData();
    }
  }, [session, companyId, timeRange]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await FinancialDashboardService.getFinancialDashboard(
        session!.user!.id,
        companyId,
        timeRange
      );
      setDashboardData(data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Corporate dashboard data not available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Corporate Dashboard</h1>
            <p className="text-gray-600">Financial overview and benefit tracking</p>
          </div>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Total Benefits"
          value={`$${dashboardData.totalAccumulatedBenefits.toLocaleString()}`}
          change={`+$${dashboardData.currentPeriodBenefits.toLocaleString()}`}
          changeLabel={`${timeRange} total`}
        />
        <MetricCard
          title="Network Bonuses"
          value={`$${dashboardData.incomeBreakdown.networkBonuses.toLocaleString()}`}
          subtitle={`${dashboardData.networkStats?.networkSize || 0} network members`}
        />
        <MetricCard
          title="Dividends"
          value={`$${dashboardData.incomeBreakdown.dividends.toLocaleString()}`}
          subtitle={`${dashboardData.shareholderId ? 'Active shareholder' : 'Not a shareholder'}`}
        />
        <MetricCard
          title="Governance Bonuses"
          value={`$${dashboardData.incomeBreakdown.governanceBonuses.toLocaleString()}`}
          subtitle="Board compensation"
        />
      </div>

      {/* Income Breakdown */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Income Breakdown</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <IncomeBreakdownItem
            label="Dividends"
            amount={dashboardData.incomeBreakdown.dividends}
            color="bg-blue-500"
          />
          <IncomeBreakdownItem
            label="Network Bonuses"
            amount={dashboardData.incomeBreakdown.networkBonuses}
            color="bg-green-500"
          />
          <IncomeBreakdownItem
            label="Governance"
            amount={dashboardData.incomeBreakdown.governanceBonuses}
            color="bg-purple-500"
          />
          <IncomeBreakdownItem
            label="Referrals"
            amount={dashboardData.incomeBreakdown.referralBonuses}
            color="bg-orange-500"
          />
          <IncomeBreakdownItem
            label="Direct Benefits"
            amount={dashboardData.incomeBreakdown.directBenefits}
            color="bg-red-500"
          />
        </div>
      </div>

      {/* Real-time Streams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Status</h2>
          <div className="space-y-3">
            <StatusItem
              label="Pending Payments"
              amount={dashboardData.realTimeStreams.pendingPayments}
              color="text-yellow-600"
            />
            <StatusItem
              label="Processing"
              amount={dashboardData.realTimeStreams.processingPayments}
              color="text-blue-600"
            />
            <StatusItem
              label="Recent Transactions"
              amount={dashboardData.realTimeStreams.recentTransactions.length}
              color="text-green-600"
              isCount={true}
            />
          </div>
        </div>

        {/* Network Stats */}
        {dashboardData.networkStats && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Network Performance</h2>
            <div className="space-y-3">
              <NetworkStat
                label="Network Size"
                value={dashboardData.networkStats.networkSize}
                rank={dashboardData.networkStats.performanceRank}
              />
              <NetworkStat
                label="Active Referrals"
                value={dashboardData.networkStats.activeReferrals}
              />
              <NetworkStat
                label="Network Level"
                value={dashboardData.networkStats.networkLevel}
              />
            </div>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h2>
        <div className="space-y-3">
          {dashboardData.realTimeStreams.recentTransactions.map((transaction: any, index: number) => (
            <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
              <div>
                <p className="font-medium text-gray-900">{transaction.type.replace('_', ' ')}</p>
                <p className="text-sm text-gray-600">{transaction.description}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">${transaction.amount.toLocaleString()}</p>
                <p className={`text-xs ${
                  transaction.status === 'paid' ? 'text-green-600' :
                  transaction.status === 'processed' ? 'text-blue-600' :
                  'text-yellow-600'
                }`}>
                  {transaction.status}
                </p>
              </div>
            </div>
          ))}
        </div>
        {dashboardData.realTimeStreams.recentTransactions.length === 0 && (
          <p className="text-gray-500 text-center py-4">No recent transactions</p>
        )}
      </div>
    </div>
  );
}

function MetricCard({ title, value, change, changeLabel, subtitle }: {
  title: string;
  value: string;
  change?: string;
  changeLabel?: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {change && (
            <p className="text-sm text-green-600">{change} {changeLabel}</p>
          )}
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function IncomeBreakdownItem({ label, amount, color }: {
  label: string;
  amount: number;
  color: string;
}) {
  return (
    <div className="text-center">
      <div className={`w-full h-2 ${color} rounded-full mb-2`}></div>
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="text-lg font-bold text-gray-900">${amount.toLocaleString()}</p>
    </div>
  );
}

function StatusItem({ label, amount, color, isCount = false }: {
  label: string;
  amount: number;
  color: string;
  isCount?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}</span>
      <span className={`font-semibold ${color}`}>
        {isCount ? amount : `$${amount.toLocaleString()}`}
      </span>
    </div>
  );
}

function NetworkStat({ label, value, rank }: {
  label: string;
  value: number;
  rank?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}</span>
      <div className="text-right">
        <span className="font-semibold text-gray-900">{value}</span>
        {rank && (
          <span className="text-xs text-blue-600 ml-2 px-2 py-1 bg-blue-100 rounded">
            {rank}
          </span>
        )}
      </div>
    </div>
  );
}