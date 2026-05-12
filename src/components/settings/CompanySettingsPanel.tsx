'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { SettingsService } from '@/services/settings/settings-service';
import { SettingsPreview } from './SettingsPreview';
import { SettingsValidationEngine } from '@/services/settings/settings-validation';

interface CompanySetting {
  key: string;
  value: any;
  category: string;
  description?: string;
  isActive: boolean;
  overriddenFromGlobal: boolean;
}

export function CompanySettingsPanel() {
  const { data: session } = useSession();
  const [settings, setSettings] = useState<CompanySetting[]>([]);
  const [globalDefaults, setGlobalDefaults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [proposedChanges, setProposedChanges] = useState<Record<string, any>>({});
  const [validation, setValidation] = useState<any>(null);

  useEffect(() => {
    loadCompanySettings();
  }, [session]);

  useEffect(() => {
    if (Object.keys(proposedChanges).length > 0) {
      validateChanges();
    }
  }, [proposedChanges]);

  const loadCompanySettings = async () => {
    if (!session?.user?.id) return;

    try {
      // Get user's company
      const userResponse = await fetch('/api/user/company');
      const userData = await userResponse.json();

      if (!userData.companyId) {
        setLoading(false);
        return;
      }

      // Load company settings and global defaults
      const context = { companyId: userData.companyId, userId: session.user.id };

      const [companySettings, allResolved] = await Promise.all([
        SettingsService.getAllResolvedSettings(context),
        SettingsService.getAllResolvedSettings({}) // Global defaults
      ]);

      // Build settings list with override indicators
      const settingsList: CompanySetting[] = [];

      for (const [key, resolved] of Object.entries(companySettings)) {
        const globalValue = allResolved[key];
        const isOverride = resolved.source === 'company';

        settingsList.push({
          key,
          value: resolved.value,
          category: 'commission_rules', // This would come from metadata
          description: `Company setting for ${key}`,
          isActive: true,
          overriddenFromGlobal: isOverride
        });
      }

      setSettings(settingsList);
      setGlobalDefaults(allResolved);
    } catch (error) {
      console.error('Error loading company settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateChanges = async () => {
    if (!session?.user?.id) return;

    const userResponse = await fetch('/api/user/company');
    const userData = await userResponse.json();

    const validationResult = await SettingsValidationEngine.validateSettings(
      'company',
      proposedChanges,
      { companyId: userData.companyId, userId: session.user.id }
    );
    setValidation(validationResult);
  };

  const handleValueChange = (key: string, newValue: any) => {
    setProposedChanges(prev => ({
      ...prev,
      [key]: newValue
    }));
  };

  const handleSave = async () => {
    if (!validation?.isValid) {
      alert('Please fix validation errors before saving');
      return;
    }

    try {
      const userResponse = await fetch('/api/user/company');
      const userData = await userResponse.json();

      for (const [key, value] of Object.entries(proposedChanges)) {
        await SettingsService.setSetting('company', key, value, {
          category: 'commission_rules',
          reason: 'Updated via company settings panel',
          performedBy: session?.user?.email || 'unknown',
          companyId: userData.companyId
        });
      }

      setProposedChanges({});
      setValidation(null);
      setEditing(null);
      loadCompanySettings();
    } catch (error) {
      console.error('Error saving company settings:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading company settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Company Settings
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>Customize settings for your company. Changes override global defaults but stay within Super Admin boundaries.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Summary */}
      {validation && !validation.isValid && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Validation Errors
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc list-inside">
                  {validation.errors.map((error: any, index: number) => (
                    <li key={index}>{error.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Impact Preview */}
      {Object.keys(proposedChanges).length > 0 && (
        <SettingsPreview
          currentSettings={settings.reduce((acc, setting) => ({
            ...acc,
            [setting.key]: setting.value
          }), {})}
          proposedChanges={proposedChanges}
        />
      )}

      {/* Settings List */}
      {settings.map((setting) => (
        <div key={setting.key} className={`rounded-lg p-6 border-2 ${
          setting.overriddenFromGlobal
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{setting.key}</h3>
                <p className="text-sm text-gray-600">{setting.description}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    setting.overriddenFromGlobal
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {setting.overriddenFromGlobal ? 'Company Override' : 'Global Default'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setEditing(setting.key)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              disabled={editing !== null && editing !== setting.key}
            >
              {editing === setting.key ? 'Editing...' : 'Override'}
            </button>
          </div>

          {editing === setting.key ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Value (JSON)
                </label>
                <textarea
                  defaultValue={JSON.stringify(proposedChanges[setting.key] ?? setting.value, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      handleValueChange(setting.key, parsed);
                    } catch (error) {
                      // Allow invalid JSON during editing
                    }
                  }}
                  rows={6}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter JSON value"
                />
              </div>

              <div className="flex space-x-3 pt-4 border-t">
                <button
                  onClick={handleSave}
                  disabled={!validation?.isValid}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Override
                </button>
                <button
                  onClick={() => {
                    setProposedChanges({});
                    setValidation(null);
                    setEditing(null);
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white p-4 rounded border">
              <div className="text-sm text-gray-500 mb-1">Current Value:</div>
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(setting.value, null, 2)}
              </pre>
              {setting.overriddenFromGlobal && (
                <div className="mt-2 text-xs text-yellow-600">
                  Global default: {JSON.stringify(globalDefaults[setting.key]?.value)}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}