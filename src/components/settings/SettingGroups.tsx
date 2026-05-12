'use client';

import { useState, useEffect } from 'react';
import { SettingGroupsService } from '@/services/settings/setting-enhancements';

interface SettingGroupsProps {
  children: React.ReactNode;
}

export function SettingGroups({ children }: SettingGroupsProps) {
  const [groups, setGroups] = useState<any[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const data = await SettingGroupsService.getGroups();
      setGroups(data);
      // Expand all groups by default
      setExpandedGroups(new Set(data.map(g => g.name)));
    } catch (error) {
      console.error('Error loading setting groups:', error);
    }
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  };

  // Group children by category (this would need to be enhanced based on actual implementation)
  const groupedChildren = {
    'pv_rules': <div>PV Rules settings would go here</div>,
    'commission_rules': <div>Commission Rules settings would go here</div>,
    'bonus_rules': <div>Bonus Rules settings would go here</div>,
    'system_limits': <div>System Limits settings would go here</div>
  };

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.name} className="border border-gray-200 rounded-lg">
          <div
            className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
            onClick={() => toggleGroup(group.name)}
          >
            <div>
              <h3 className="text-lg font-medium text-gray-900">{group.displayName}</h3>
              {group.description && (
                <p className="text-sm text-gray-600">{group.description}</p>
              )}
            </div>
            <div className="flex items-center">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                group.category === 'pv_rules' ? 'bg-blue-100 text-blue-800' :
                group.category === 'commission_rules' ? 'bg-green-100 text-green-800' :
                group.category === 'bonus_rules' ? 'bg-purple-100 text-purple-800' :
                'bg-orange-100 text-orange-800'
              }`}>
                {group.category}
              </span>
              <svg
                className={`ml-2 h-5 w-5 transform transition-transform ${
                  expandedGroups.has(group.name) ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {expandedGroups.has(group.name) && (
            <div className="p-4 border-t border-gray-200">
              {groupedChildren[group.category as keyof typeof groupedChildren] || (
                <div className="text-center py-4 text-gray-500">
                  No settings in this group yet.
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {groups.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No setting groups configured.</p>
          <p className="text-sm mt-1">Groups help organize related settings for better management.</p>
        </div>
      )}
    </div>
  );
}