'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { GenealogyService } from '@/services/mlm/genealogy-service';
import { RankAdvancementEngine } from '@/services/mlm/rank-advancement-engine';
import { FinancialDashboardService } from '@/services/corporate/financial-dashboard';
import { TrainingEngine, NotificationEngine } from '@/services/mlm/training-notification-engine';
import { SubscriptionEngine } from '@/services/mlm/product-subscription-engine';

interface MLMDashboardProps {
  companyId?: string;
}

export function MLMDashboard({ companyId }: MLMDashboardProps) {
  const { data: session } = useSession();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [genealogyStats, setGenealogyStats] = useState<any>(null);
  const [rankInfo, setRankInfo] = useState<any>(null);
  const [trainingProgress, setTrainingProgress] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.id) {
      loadDashboardData();
    }
  }, [session, companyId]);

  const loadDashboardData = async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);

      // Load financial dashboard
      const financialData = await FinancialDashboardService.getFinancialDashboard(
        session.user.id,
        companyId
      );

      // Load genealogy statistics
      const genealogyData = await GenealogyService.calculateNetworkStats(session.user.id);

      // Load rank information
      const rankAdvancement = await RankAdvancementEngine.checkRankAdvancement(session.user.id);

      // Load training progress
      const trainingData = await TrainingEngine.getRequiredTrainingForUser(session.user.id);

      // Load subscriptions
      const subscriptionData = await SubscriptionEngine.getUserSubscriptions(session.user.id);

      // Load recent notifications
      const notificationData = await NotificationEngine.getUserNotifications(session.user.id, {
        limit: 5
      });

      setDashboardData(financialData);
      setGenealogyStats(genealogyData);
      setRankInfo(rankAdvancement);
      setTrainingProgress(trainingData);
      setSubscriptions(subscriptionData);
      setNotifications(notificationData);

    } catch (error) {
      console.error('Error loading MLM dashboard:', error);
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
        <p className="text-gray-600">MLM dashboard data not available.</p>
        <p className="text-sm text-gray-500 mt-2">Please ensure you have an active membership.</p>
      </div>
    );
  }

  const incompleteTraining = trainingProgress.filter(t => !t.isCompleted);
  const unreadNotifications = notifications.filter(n => !n.isRead);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">MLM Dashboard</h1>
            <p className="text-blue-100">Your network marketing performance overview</p>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-90">Current Rank</div>
            <div className="text-xl font-bold">{rankInfo?.currentRank || 'Member'}</div>
            {rankInfo?.qualified && (
              <div className="text-sm bg-yellow-500 text-yellow-900 px-2 py-1 rounded mt-1">
                Ready for {rankInfo.newRank} advancement!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Network Size"
          value={genealogyStats?.totalMembers?.toString() || '0'}
          subtitle="Active members"
          icon="👥"
          color="bg-blue-500"
        />
        <MetricCard
          title="Total Volume"
          value={`$${(genealogyStats?.totalVolume || 0).toLocaleString()}`}
          subtitle="Personal volume"
          icon="📈"
          color="bg-green-500"
        />
        <MetricCard
          title="Monthly Earnings"
          value={`$${dashboardData?.incomeBreakdown?.dividends?.toLocaleString() || '0'}`}
          subtitle="From commissions"
          icon="💰"
          color="bg-purple-500"
        />
        <MetricCard
          title="Training Progress"
          value={`${trainingProgress.filter(t => t.isCompleted).length}/${trainingProgress.length}`}
          subtitle={`${incompleteTraining.length} remaining`}
          icon="📚"
          color={incompleteTraining.length > 0 ? "bg-yellow-500" : "bg-green-500"}
        />
      </MetricCard>

      {/* Network Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Network Performance</h2>
          <div className="space-y-4">
            <NetworkMetric
              label="Active Referrals"
              value={genealogyStats?.activeMembers || 0}
              target={10}
            />
            <NetworkMetric
              label="Network Depth"
              value={genealogyStats?.depth || 0}
              target={5}
            />
            <NetworkMetric
              label="Balance Ratio"
              value={Math.round((genealogyStats?.balanceRatio || 0) * 100)}
              target={80}
              suffix="%"
            />
            <NetworkMetric
              label="Growth Rate"
              value={Math.round(genealogyStats?.growthRate || 0)}
              target={20}
              suffix="%"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Rank Progression</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Current Rank:</span>
              <span className="font-semibold text-gray-900">{rankInfo?.currentRank}</span>
            </div>
            {rankInfo?.qualified && (
              <div className="bg-green-50 border border-green-200 rounded p-3">
                <div className="text-sm text-green-800">
                  <strong>Advancement Available!</strong><br />
                  Ready to advance to {rankInfo.newRank}
                </div>
              </div>
            )}
            <div className="text-sm text-gray-600">
              <div>Requirements check: {rankInfo?.requirements?.met?.length || 0} met, {rankInfo?.requirements?.unmet?.length || 0} remaining</div>
            </div>
          </div>

          {/* Training Status */}
          <div className="mt-6">
            <h3 className="text-md font-medium text-gray-900 mb-3">Required Training</h3>
            <div className="space-y-2">
              {trainingProgress.slice(0, 3).map((training: any, index: number) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 truncate">{training.title}</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    training.isCompleted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {training.isCompleted ? 'Completed' : 'Pending'}
                  </span>
                </div>
              ))}
              {trainingProgress.length > 3 && (
                <div className="text-sm text-gray-500 text-center pt-2">
                  +{trainingProgress.length - 3} more courses
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Active Subscriptions */}
      {subscriptions.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Subscriptions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subscriptions.map((sub: any) => (
              <div key={sub.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-gray-900">{sub.product.name}</h3>
                    <p className="text-sm text-gray-600">{sub.frequency} subscription</p>
                  </div>
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                    Active
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Next billing:</span>
                    <span>{new Date(sub.nextBilling).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount:</span>
                    <span>${sub.amount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Notifications */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Notifications</h2>
          {unreadNotifications.length > 0 && (
            <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
              {unreadNotifications.length} unread
            </span>
          )}
        </div>
        <div className="space-y-3">
          {notifications.slice(0, 5).map((notification: any) => (
            <div key={notification.id} className={`p-3 rounded-lg border ${
              !notification.isRead ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{notification.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(notification.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {!notification.isRead && (
                  <div className="w-2 h-2 bg-blue-600 rounded-full ml-3 mt-2"></div>
                )}
              </div>
            </div>
          ))}
          {notifications.length === 0 && (
            <p className="text-gray-500 text-center py-4">No notifications yet</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickAction
            title="View Genealogy"
            description="Explore your network tree"
            icon="🌳"
            action={() => {/* Navigate to genealogy */}}
          />
          <QuickAction
            title="Training Center"
            description="Access learning resources"
            icon="📚"
            badge={incompleteTraining.length > 0 ? incompleteTraining.length.toString() : undefined}
            action={() => {/* Navigate to training */}}
          />
          <QuickAction
            title="Commission History"
            description="View detailed earnings"
            icon="💰"
            action={() => {/* Navigate to commissions */}}
          />
          <QuickAction
            title="Rank Advancement"
            description="Check qualification status"
            icon="⭐"
            action={() => {/* Navigate to rank info */}}
          />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon, color }: {
  title: string;
  value: string;
  subtitle?: string;
  icon: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`${color} rounded-lg p-3 mr-4`}>
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function NetworkMetric({ label, value, target, suffix = '' }: {
  label: string;
  value: number;
  target: number;
  suffix?: string;
}) {
  const percentage = Math.min((value / target) * 100, 100);
  const isGood = value >= target;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className={`text-sm font-semibold ${isGood ? 'text-green-600' : 'text-yellow-600'}`}>
          {value}{suffix}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${isGood ? 'bg-green-600' : 'bg-yellow-600'}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        Target: {target}{suffix}
      </div>
    </div>
  );
}

function QuickAction({ title, description, icon, badge, action }: {
  title: string;
  description: string;
  icon: string;
  badge?: string;
  action: () => void;
}) {
  return (
    <button
      onClick={action}
      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left relative"
    >
      {badge && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {badge}
        </span>
      )}
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-medium text-gray-900 text-sm">{title}</h3>
      <p className="text-xs text-gray-600 mt-1">{description}</p>
    </button>
  );
}