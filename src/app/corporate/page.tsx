'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { CorporateDashboard } from './CorporateDashboard';
import { ShareholderManagement } from './ShareholderManagement';
import { ProfitDistribution } from './ProfitDistribution';
import { TransactionHistory } from './TransactionHistory';
import { CorporatePermissionService } from '@/services/corporate/permission-service';

type CorporateTabType = 'dashboard' | 'shareholders' | 'distribution' | 'transactions';

export default function CorporatePage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<CorporateTabType>('dashboard');
  const [companyId, setCompanyId] = useState<string>('');
  const [userPermissions, setUserPermissions] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.id) {
      loadUserPermissions();
    }
  }, [session]);

  const loadUserPermissions = async () => {
    if (!session?.user?.id) return;

    try {
      // Get user's primary company (in a real app, this might be selected from a dropdown)
      setCompanyId('company_sample'); // Using sample company for demo

      // Get user corporate profile
      const profile = await CorporatePermissionService.getUserCorporateProfile(
        session.user.id,
        'company_sample'
      );

      setUserPermissions(profile);
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTabVisibility = (tab: CorporateTabType): boolean => {
    if (!userPermissions) return false;

    switch (tab) {
      case 'dashboard':
        return userPermissions.isShareholder || userPermissions.permissions.viewFinancials;
      case 'shareholders':
        return userPermissions.permissions.viewFinancials;
      case 'distribution':
        return userPermissions.permissions.manageCompany;
      case 'transactions':
        return userPermissions.permissions.viewFinancials;
      default:
        return false;
    }
  };

  const tabs = [
    { id: 'dashboard' as CorporateTabType, label: 'Dashboard', icon: '📊' },
    { id: 'shareholders' as CorporateTabType, label: 'Shareholders', icon: '👥' },
    { id: 'distribution' as CorporateTabType, label: 'Profit Distribution', icon: '💰' },
    { id: 'transactions' as CorporateTabType, label: 'Transactions', icon: '📋' }
  ];

  const visibleTabs = tabs.filter(tab => getTabVisibility(tab.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!userPermissions?.isShareholder && !userPermissions?.permissions.viewFinancials) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
          <div className="text-6xl mb-4">🏢</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Corporate Access Required</h1>
          <p className="text-gray-600 mb-6">
            You need to be a shareholder or have corporate permissions to access this section.
          </p>
          <div className="text-sm text-gray-500">
            Contact your company administrator to request corporate access.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Corporate Portal</h1>
              {userPermissions?.membershipType && (
                <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  userPermissions.membershipType === 'network_enabled'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {userPermissions.membershipType === 'network_enabled' ? 'Network Enabled' : 'Standard Member'}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {userPermissions?.boardRoles && userPermissions.boardRoles.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Board:</span>
                  {userPermissions.boardRoles.map((role: any, index: number) => (
                    <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {role.position}
                    </span>
                  ))}
                </div>
              )}

              <div className="text-sm text-gray-600">
                Company ID: {companyId.slice(-8)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
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
          <CorporateDashboard companyId={companyId} />
        )}

        {activeTab === 'shareholders' && (
          <ShareholderManagement companyId={companyId} />
        )}

        {activeTab === 'distribution' && userPermissions?.permissions.manageCompany && (
          <ProfitDistribution companyId={companyId} />
        )}

        {activeTab === 'transactions' && (
          <TransactionHistory companyId={companyId} />
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-sm text-gray-500 text-center">
            Corporate Portal - All transactions are audited and compliant with regulatory standards.
          </div>
        </div>
      </div>
    </div>
  );
}