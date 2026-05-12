'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface AuditEntry {
  id: string;
  settingId: string;
  settingType: 'system_default' | 'company_setting' | 'user_setting';
  key: string;
  oldValue: any;
  newValue: any;
  category: string;
  action: string;
  reason?: string;
  companyId?: string;
  userId?: string;
  performedBy: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

interface AuditFilters {
  dateRange: { start: Date; end: Date } | null;
  settingType: string[];
  category: string[];
  performedBy: string[];
  action: string[];
  companyId?: string;
}

export function AdvancedAuditTrail({ companyId }: { companyId?: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AuditFilters>({
    dateRange: null,
    settingType: [],
    category: [],
    performedBy: [],
    action: [],
    companyId
  });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadAuditEntries();
  }, [filters, page]);

  const loadAuditEntries = async () => {
    setLoading(true);
    try {
      // This would call your API to fetch audit entries
      // For now, simulate data
      const mockEntries: AuditEntry[] = [
        {
          id: '1',
          settingId: 'sys_001',
          settingType: 'system_default',
          key: 'commission_rate',
          oldValue: 0.08,
          newValue: 0.10,
          category: 'commission_rules',
          action: 'update',
          reason: 'Competitive adjustment for Q2',
          performedBy: 'super_admin@example.com',
          createdAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
        },
        {
          id: '2',
          settingId: 'comp_001',
          settingType: 'company_setting',
          key: 'pv_matching_rules',
          oldValue: { commission_rate: 0.08 },
          newValue: { commission_rate: 0.09 },
          category: 'pv_rules',
          action: 'update',
          reason: 'Company-specific commission adjustment',
          companyId: 'comp_123',
          performedBy: 'admin@company.com',
          createdAt: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
        }
      ];

      setEntries(mockEntries);
      setHasMore(page < 5); // Simulate pagination
    } catch (error) {
      console.error('Error loading audit entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'bg-green-100 text-green-800';
      case 'update': return 'bg-blue-100 text-blue-800';
      case 'delete': return 'bg-red-100 text-red-800';
      case 'activate': return 'bg-green-100 text-green-800';
      case 'deactivate': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'system_default': return 'bg-purple-100 text-purple-800';
      case 'company_setting': return 'bg-blue-100 text-blue-800';
      case 'user_setting': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Setting Type
            </label>
            <select
              multiple
              value={filters.settingType}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions, option => option.value);
                setFilters(prev => ({ ...prev, settingType: values }));
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="system_default">System Default</option>
              <option value="company_setting">Company Setting</option>
              <option value="user_setting">User Setting</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              multiple
              value={filters.category}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions, option => option.value);
                setFilters(prev => ({ ...prev, category: values }));
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="pv_rules">PV Rules</option>
              <option value="commission_rules">Commission Rules</option>
              <option value="bonus_rules">Bonus Rules</option>
              <option value="system_limits">System Limits</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Action
            </label>
            <select
              multiple
              value={filters.action}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions, option => option.value);
                setFilters(prev => ({ ...prev, action: values }));
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="activate">Activate</option>
              <option value="deactivate">Deactivate</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Entries */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Change History</h3>
        </div>

        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-6 text-center text-gray-500">
              Loading audit entries...
            </div>
          ) : entries.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No audit entries found
            </div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(entry.settingType)}`}>
                        {entry.settingType.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(entry.action)}`}>
                        {entry.action}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    <div className="mb-2">
                      <span className="font-medium text-gray-900">{entry.key}</span>
                      <span className="text-sm text-gray-500 ml-2">({entry.category})</span>
                    </div>

                    {entry.reason && (
                      <p className="text-sm text-gray-600 mb-3">{entry.reason}</p>
                    )}

                    <div className="text-xs text-gray-500">
                      <span>By: {entry.performedBy}</span>
                      {entry.companyId && <span className="ml-4">Company: {entry.companyId}</span>}
                      {entry.ipAddress && <span className="ml-4">IP: {entry.ipAddress}</span>}
                    </div>
                  </div>

                  <div className="ml-6 flex-shrink-0">
                    <button className="text-blue-600 hover:text-blue-800 text-sm">
                      View Details
                    </button>
                  </div>
                </div>

                {/* Value Changes */}
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1">Previous Value</div>
                    <div className="bg-red-50 p-2 rounded text-xs font-mono text-red-800 max-h-20 overflow-y-auto">
                      {entry.oldValue ? JSON.stringify(entry.oldValue, null, 2) : 'null'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1">New Value</div>
                    <div className="bg-green-50 p-2 rounded text-xs font-mono text-green-800 max-h-20 overflow-y-auto">
                      {JSON.stringify(entry.newValue, null, 2)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {hasMore && (
          <div className="px-6 py-4 border-t border-gray-200 text-center">
            <button
              onClick={() => setPage(prev => prev + 1)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
              disabled={loading}
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}