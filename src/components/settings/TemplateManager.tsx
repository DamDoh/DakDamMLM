'use client';

import { useState, useEffect } from 'react';
import { SettingTemplatesService } from '@/services/settings/setting-enhancements';
import { SettingsService } from '@/services/settings/settings-service';

interface TemplateManagerProps {
  onTemplateApplied?: () => void;
}

export function TemplateManager({ onTemplateApplied }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  useEffect(() => {
    loadTemplates();
  }, [selectedCategory]);

  const loadTemplates = async () => {
    try {
      const data = await SettingTemplatesService.getTemplates(
        selectedCategory || undefined
      );
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const applyTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to apply this template? It will override existing settings.')) {
      return;
    }

    setLoading(true);
    try {
      await SettingTemplatesService.applyTemplate(templateId, {
        level: 'company', // Adjust based on context
        performedBy: 'current_user' // Get from auth
      });

      alert('Template applied successfully!');
      onTemplateApplied?.();
    } catch (error) {
      console.error('Error applying template:', error);
      alert('Error applying template');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Setting Templates</h3>
          <p className="text-sm text-gray-600">Apply pre-configured setting collections</p>
        </div>
        <button
          onClick={loadTemplates}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Category Filter */}
      <div className="mb-4">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">All Categories</option>
          <option value="pv_rules">PV Rules</option>
          <option value="commission_rules">Commission Rules</option>
          <option value="bonus_rules">Bonus Rules</option>
          <option value="system_limits">System Limits</option>
        </select>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{template.name}</h4>
                <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-2">
                  {template.category}
                </span>
              </div>
            </div>

            <div className="text-xs text-gray-500 mb-3">
              {Object.keys(template.settings).length} settings included
            </div>

            <button
              onClick={() => applyTemplate(template.id)}
              disabled={loading}
              className="w-full bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 text-sm disabled:opacity-50"
            >
              {loading ? 'Applying...' : 'Apply Template'}
            </button>
          </div>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No templates available for the selected category.
        </div>
      )}
    </div>
  );
}