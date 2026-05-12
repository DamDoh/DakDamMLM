'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { MLMDashboard } from './MLMDashboard';
import { GenealogyService } from '@/services/mlm/genealogy-service';
import { RankAdvancementEngine } from '@/services/mlm/rank-advancement-engine';
import { CorporatePermissionService } from '@/services/corporate/permission-service';

type MLMTabType = 'dashboard' | 'genealogy' | 'commissions' | 'training' | 'contests' | 'products';

export default function MLMPortal() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<MLMTabType>('dashboard');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [genealogyTree, setGenealogyTree] = useState<any>(null);
  const [rankAdvancement, setRankAdvancement] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.id) {
      loadUserProfile();
    }
  }, [session]);

  const loadUserProfile = async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);

      // Load user corporate profile
      const profile = await CorporatePermissionService.getUserCorporateProfile(
        session.user.id,
        'company_sample' // In real app, this would be dynamic
      );

      setUserProfile(profile);

      // Load genealogy tree if user can build network
      if (profile?.permissions?.buildNetwork) {
        const tree = await GenealogyService.buildGenealogyTree(session.user.id, 3);
        setGenealogyTree(tree);
      }

      // Load rank advancement info
      const advancement = await RankAdvancementEngine.checkRankAdvancement(session.user.id);
      setRankAdvancement(advancement);

    } catch (error) {
      console.error('Error loading MLM profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'dashboard' as MLMTabType, label: 'Dashboard', icon: '📊' },
    { id: 'genealogy' as MLMTabType, label: 'Genealogy', icon: '🌳', requiresNetwork: true },
    { id: 'commissions' as MLMTabType, label: 'Commissions', icon: '💰' },
    { id: 'training' as MLMTabType, label: 'Training', icon: '📚' },
    { id: 'contests' as MLMTabType, label: 'Contests', icon: '🏆' },
    { id: 'products' as MLMTabType, label: 'Products', icon: '🛍️' }
  ];

  const availableTabs = tabs.filter(tab => {
    if (tab.requiresNetwork && !userProfile?.permissions?.buildNetwork) {
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h1>
          <p className="text-gray-600 mb-6">
            You need an active MLM membership to access the portal.
          </p>
          <div className="text-sm text-gray-500">
            Contact support to activate your network marketing account.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-white">MLM Portal</h1>
              <span className="ml-4 px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm text-white">
                {userProfile.membershipType === 'network_enabled' ? 'Network Builder' : 'Standard Member'}
              </span>
            </div>

            <div className="flex items-center space-x-6">
              {/* User Status */}
              <div className="text-right text-white">
                <div className="text-sm opacity-90">Welcome back</div>
                <div className="font-semibold">{session?.user?.name || 'User'}</div>
              </div>

              {/* Rank Badge */}
              <div className="bg-white bg-opacity-20 rounded-lg px-3 py-2 text-white">
                <div className="text-xs opacity-90">Current Rank</div>
                <div className="font-semibold">{rankAdvancement?.currentRank || 'Member'}</div>
              </div>

              {/* Network Size (if applicable) */}
              {userProfile.permissions?.buildNetwork && (
                <div className="bg-white bg-opacity-20 rounded-lg px-3 py-2 text-white">
                  <div className="text-xs opacity-90">Network Size</div>
                  <div className="font-semibold">{genealogyTree ? 'Calculating...' : '0'}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <MLMDashboard companyId="company_sample" />
        )}

        {activeTab === 'genealogy' && userProfile.permissions?.buildNetwork && (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-center">
              <div className="text-6xl mb-4">🌳</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Genealogy Tree</h2>
              <p className="text-gray-600 mb-6">Visual representation of your network structure</p>
              <div className="bg-gray-100 rounded-lg p-8">
                <p className="text-gray-500">Genealogy visualization component would go here</p>
                <p className="text-sm text-gray-400 mt-2">
                  Shows your downline structure with interactive tree view
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'commissions' && (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-center">
              <div className="text-6xl mb-4">💰</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Commission Center</h2>
              <p className="text-gray-600 mb-6">Track all your earnings and commission history</p>
              <div className="bg-gray-100 rounded-lg p-8">
                <p className="text-gray-500">Commission tracking and history component would go here</p>
                <p className="text-sm text-gray-400 mt-2">
                  Shows direct commissions, unilevel bonuses, binary payouts, etc.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'training' && (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-center">
              <div className="text-6xl mb-4">📚</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Training Center</h2>
              <p className="text-gray-600 mb-6">Access educational resources and training materials</p>
              <div className="bg-gray-100 rounded-lg p-8">
                <p className="text-gray-500">Training resources and completion tracking would go here</p>
                <p className="text-sm text-gray-400 mt-2">
                  Videos, documents, webinars, and certification courses
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'contests' && (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-center">
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Contest Center</h2>
              <p className="text-gray-600 mb-6">Participate in promotional contests and competitions</p>
              <div className="bg-gray-100 rounded-lg p-8">
                <p className="text-gray-500">Active contests and leaderboards would go here</p>
                <p className="text-sm text-gray-400 mt-2">
                  Recruitment contests, volume challenges, rank races
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-center">
              <div className="text-6xl mb-4">🛍️</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Catalog</h2>
              <p className="text-gray-600 mb-6">Browse and purchase products with volume benefits</p>
              <div className="bg-gray-100 rounded-lg p-8">
                <p className="text-gray-500">Product catalog and ordering system would go here</p>
                <p className="text-sm text-gray-400 mt-2">
                  MLM products with PV/BV values and subscription options
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              MLM Portal - Build your network, earn commissions, achieve success
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>Need help?</span>
              <button className="text-blue-600 hover:text-blue-800">Contact Support</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}