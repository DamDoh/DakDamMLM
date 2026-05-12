'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { SettingsService } from '@/services/settings/settings-service';

interface UserPreference {
  key: string;
  value: any;
  category: string;
  description?: string;
}

export function UserSettingsPanel() {
  const { data: session } = useSession();
  const [preferences, setPreferences] = useState<UserPreference[]>([
    {
      key: 'dashboard_theme',
      value: 'light',
      category: 'ui',
      description: 'Preferred dashboard theme'
    },
    {
      key: 'notification_email',
      value: true,
      category: 'notifications',
      description: 'Receive email notifications'
    },
    {
      key: 'notification_push',
      value: false,
      category: 'notifications',
      description: 'Receive push notifications'
    },
    {
      key: 'reports_auto_refresh',
      value: 30,
      category: 'reports',
      description: 'Auto-refresh interval for reports (seconds)'
    }
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUserPreferences();
  }, [session]);

  const loadUserPreferences = async () => {
    if (!session?.user?.id) return;

    try {
      const context = { userId: session.user.id };
      const userSettings = await SettingsService.getAllResolvedSettings(context);

      // Merge with default preferences
      const mergedPrefs = preferences.map(pref => ({
        ...pref,
        value: userSettings[pref.key]?.value ?? pref.value
      }));

      setPreferences(mergedPrefs);
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  };

  const handlePreferenceChange = async (key: string, value: any) => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);

      await SettingsService.setSetting('user', key, value, {
        category: 'user_preferences',
        reason: 'Updated via user settings panel',
        performedBy: session.user.email || 'unknown',
        userId: session.user.id
      });

      // Update local state
      setPreferences(prev => prev.map(pref =>
        pref.key === key ? { ...pref, value } : pref
      ));
    } catch (error) {
      console.error('Error updating preference:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderPreferenceControl = (pref: UserPreference) => {
    switch (typeof pref.value) {
      case 'boolean':
        return (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={pref.value}
              onChange={(e) => handlePreferenceChange(pref.key, e.target.checked)}
              disabled={loading}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Enabled</span>
          </label>
        );

      case 'number':
        return (
          <input
            type="number"
            value={pref.value}
            onChange={(e) => handlePreferenceChange(pref.key, parseInt(e.target.value) || 0)}
            disabled={loading}
            className="w-24 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        );

      case 'string':
        if (pref.key.includes('theme') || pref.key.includes('format')) {
          const options = pref.key.includes('theme')
            ? ['light', 'dark', 'auto']
            : ['USD', 'EUR', 'GBP', 'JPY'];

          return (
            <select
              value={pref.value}
              onChange={(e) => handlePreferenceChange(pref.key, e.target.value)}
              disabled={loading}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {options.map(option => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
          );
        }

        return (
          <input
            type="text"
            value={pref.value}
            onChange={(e) => handlePreferenceChange(pref.key, e.target.value)}
            disabled={loading}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        );

      default:
        return (
          <span className="text-sm text-gray-500">Complex setting - use API</span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">
              Personal Preferences
            </h3>
            <div className="mt-2 text-sm text-green-700">
              <p>Customize your personal experience. These settings only affect your account.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {preferences.map((pref) => (
          <div key={pref.key} className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="text-md font-medium text-gray-900 capitalize">
                  {pref.key.replace(/_/g, ' ')}
                </h4>
                <p className="text-sm text-gray-600 mt-1">{pref.description}</p>
              </div>
            </div>

            <div className="mt-4">
              {renderPreferenceControl(pref)}
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="text-center py-4">
          <div className="inline-flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Saving preference...
          </div>
        </div>
      )}
    </div>
  );
}