'use client';

import { useState, useEffect } from 'react';
import { SettingsService } from '@/services/settings/settings-service';
import { FormulaBuilder } from './FormulaBuilder';
import { SettingsPreview } from './SettingsPreview';
import { SettingsValidationEngine } from '@/services/settings/settings-validation';

interface SystemDefault {
  key: string;
  value: any;
  category: string;
  description?: string;
  isActive: boolean;
}

export function SystemDefaultsPanel() {
  const [settings, setSettings] = useState<SystemDefault[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [proposedChanges, setProposedChanges] = useState<Record<string, any>>({});
  const [validation, setValidation] = useState<any>(null);

  useEffect(() => {
    loadSystemDefaults();
  }, []);

  useEffect(() => {
    if (Object.keys(proposedChanges).length > 0) {
      validateChanges();
    }
  }, [proposedChanges]);

  const loadSystemDefaults = async () => {
    try {
      // This would call your API to get system defaults
      // For now, show placeholder data
      setSettings([
        {
          key: 'commission_rate',
          value: 0.08,
          category: 'commission_rules',
          description: 'Default commission rate for PV matching',
          isActive: true
        },
        {
          key: 'pv_matching_rules',
          value: {
            commission_rate: 0.08,
            matching_formula: "min(leftWaitingPV, rightWaitingPV)",
            post_match_adjustment: {
              larger_leg_formula: "larger - smaller",
              smaller_leg_formula: "0"
            }
          },
          category: 'pv_rules',
          description: 'Complete PV matching logic configuration',
          isActive: true
        },
        {
          key: 'matching_formula',
          value: "min(leftWaitingPV, rightWaitingPV)",
          category: 'pv_rules',
          description: 'Mathematical formula for calculating matched PV',
          isActive: true
        }
      ]);
    } catch (error) {
      console.error('Error loading system defaults:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateChanges = async () => {
    const validationResult = await SettingsValidationEngine.validateSettings('system', proposedChanges);
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
      for (const [key, value] of Object.entries(proposedChanges)) {
        await SettingsService.setSetting('system', key, value, {
          category: 'commission_rules', // This would be dynamic
          reason: 'Updated via advanced settings panel',
          performedBy: 'current_user@example.com' // This would come from auth
        });
      }

      setProposedChanges({});
      setValidation(null);
      setEditing(null);
      loadSystemDefaults();
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleCancel = () => {
    setProposedChanges({});
    setValidation(null);
    setEditing(null);
  };

  if (loading) {
    return <div className="text-center py-8">Loading system defaults...</div>;
  }

  return (
    <div className="space-y-6">
      {/* System Warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              System Defaults - Super Admin Only
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>Changes here affect all companies and users globally. Use extreme caution and test thoroughly before deploying.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Summary */}
      {validation && (
        <div className={`p-4 rounded-md border ${
          validation.isValid
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex">
            <div className="ml-3">
              <h3 className={`text-sm font-medium ${
                validation.isValid ? 'text-green-800' : 'text-red-800'
              }`}>
                {validation.isValid ? 'Validation Passed' : 'Validation Failed'}
              </h3>
              <div className="mt-2 text-sm">
                {validation.errors.length > 0 && (
                  <div className="text-red-700">
                    <strong>Errors ({validation.errors.length}):</strong>
                    <ul className="list-disc list-inside mt-1">
                      {validation.errors.map((error, index) => (
                        <li key={index}>{error.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {validation.warnings.length > 0 && (
                  <div className="text-yellow-700 mt-2">
                    <strong>Warnings ({validation.warnings.length}):</strong>
                    <ul className="list-disc list-inside mt-1">
                      {validation.warnings.map((warning, index) => (
                        <li key={index}>{warning.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
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
        <div key={setting.key} className="bg-gray-50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">{setting.key}</h3>
              <p className="text-sm text-gray-600">{setting.description}</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                {setting.category}
              </span>
            </div>
            <button
              onClick={() => setEditing(setting.key)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              disabled={editing !== null && editing !== setting.key}
            >
              {editing === setting.key ? 'Editing...' : 'Edit'}
            </button>
          </div>

          {editing === setting.key ? (
            <div className="space-y-4">
              {/* Different editors based on setting type */}
              {setting.key === 'matching_formula' || setting.key.includes('formula') ? (
                <FormulaBuilder
                  value={proposedChanges[setting.key] ?? setting.value}
                  onChange={(value) => handleValueChange(setting.key, value)}
                />
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Value (JSON)
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
                    rows={8}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter JSON value"
                  />
                </div>
              )}

              <div className="flex space-x-3 pt-4 border-t">
                <button
                  onClick={handleSave}
                  disabled={!validation?.isValid}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Changes
                </button>
                <button
                  onClick={handleCancel}
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
            </div>
          )}
        </div>
      ))}
    </div>
  );
}