'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { SystemDefaultsPanel } from './SystemDefaultsPanel';
import { CompanySettingsPanel } from './CompanySettingsPanel';
import { UserSettingsPanel } from './UserSettingsPanel';
import { AdvancedAuditTrail } from './AdvancedAuditTrail';
import { BulkOperations } from './BulkOperations';
import { TemplateManager } from './TemplateManager';
import { ScheduledChanges } from './ScheduledChanges';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { BulkImportExport } from './BulkImportExport';
import { SettingGroups } from './SettingGroups';

type TabType = 'system' | 'company' | 'user' | 'audit' | 'bulk' | 'templates' | 'scheduled' | 'analytics' | 'import' | 'groups';

export function SettingsManagement() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<TabType>('system');
  const [userRole, setUserRole] = useState<'super_admin' | 'admin' | 'user'>('user');

  useEffect(() => {
    // Determine user role - this would come from your auth system
    // For now, default to user, but in real implementation check permissions
    setUserRole('user');
  }, [session]);

  const tabs = [
    { id: 'system' as TabType, label: 'System Defaults', roles: ['super_admin'] },
    { id: 'company' as TabType, label: 'Company Settings', roles: ['super_admin', 'admin'] },
    { id: 'user' as TabType, label: 'User Preferences', roles: ['super_admin', 'admin', 'user'] },
    { id: 'audit' as TabType, label: 'Change History', roles: ['super_admin', 'admin'] },
    { id: 'bulk' as TabType, label: 'Bulk Operations', roles: ['super_admin'] },
    { id: 'templates' as TabType, label: 'Templates', roles: ['super_admin', 'admin'] },
    { id: 'scheduled' as TabType, label: 'Scheduled Changes', roles: ['super_admin', 'admin'] },
    { id: 'analytics' as TabType, label: 'Analytics', roles: ['super_admin', 'admin'] },
    { id: 'import' as TabType, label: 'Import/Export', roles: ['super_admin', 'admin'] },
    { id: 'groups' as TabType, label: 'Setting Groups', roles: ['super_admin', 'admin'] }
  ];

  const visibleTabs = tabs.filter(tab => tab.roles.includes(userRole));

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 px-6 overflow-x-auto">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'system' && userRole === 'super_admin' && (
          <SystemDefaultsPanel />
        )}
        {activeTab === 'company' && ['super_admin', 'admin'].includes(userRole) && (
          <CompanySettingsPanel />
        )}
        {activeTab === 'user' && (
          <UserSettingsPanel />
        )}
        {activeTab === 'audit' && ['super_admin', 'admin'].includes(userRole) && (
          <AdvancedAuditTrail />
        )}
        {activeTab === 'bulk' && userRole === 'super_admin' && (
          <BulkOperations />
        )}
        {activeTab === 'templates' && ['super_admin', 'admin'].includes(userRole) && (
          <TemplateManager />
        )}
        {activeTab === 'scheduled' && ['super_admin', 'admin'].includes(userRole) && (
          <ScheduledChanges />
        )}
        {activeTab === 'analytics' && ['super_admin', 'admin'].includes(userRole) && (
          <AnalyticsDashboard />
        )}
        {activeTab === 'import' && ['super_admin', 'admin'].includes(userRole) && (
          <BulkImportExport />
        )}
        {activeTab === 'groups' && ['super_admin', 'admin'].includes(userRole) && (
          <SettingGroups>
            {/* Settings content would be passed here */}
            <div>Setting groups content</div>
          </SettingGroups>
        )}
      </div>
    </div>
  );
}