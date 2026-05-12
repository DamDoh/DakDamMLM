'use client';

import { useState, useRef } from 'react';
import { SettingsService } from '@/services/settings/settings-service';

export function BulkImportExport() {
  const [importData, setImportData] = useState('');
  const [exportData, setExportData] = useState('');
  const [loading, setLoading] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setLoading(true);
    try {
      // Get all settings for current context
      const settings = await SettingsService.getAllResolvedSettings({
        // Add context as needed
      });

      const exportFormat = {
        metadata: {
          exportedAt: new Date().toISOString(),
          version: '1.0',
          totalSettings: Object.keys(settings).length
        },
        settings: Object.entries(settings).map(([key, setting]) => ({
          key,
          value: setting.value,
          category: 'exported', // Will be overridden during import
          type: setting.source
        }))
      };

      setExportData(JSON.stringify(exportFormat, null, 2));
    } catch (error) {
      console.error('Error exporting settings:', error);
      alert('Error exporting settings');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importData.trim()) {
      alert('Please provide import data');
      return;
    }

    try {
      const parsedData = JSON.parse(importData);
      if (!parsedData.settings || !Array.isArray(parsedData.settings)) {
        throw new Error('Invalid import format');
      }

      setLoading(true);
      const results = {
        total: parsedData.settings.length,
        successful: 0,
        failed: 0,
        errors: [] as string[]
      };

      for (const setting of parsedData.settings) {
        try {
          await SettingsService.setSetting('company', setting.key, setting.value, {
            category: setting.category || 'imported',
            reason: 'Bulk import',
            performedBy: 'current_user' // Get from auth
          });
          results.successful++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`${setting.key}: ${error.message}`);
        }
      }

      setImportResults(results);
      alert(`Import completed: ${results.successful} successful, ${results.failed} failed`);

      if (results.failed > 0) {
        console.log('Import errors:', results.errors);
      }

    } catch (error: any) {
      alert(`Import failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setImportData(content);
    };
    reader.readAsText(file);
  };

  const downloadExport = () => {
    if (!exportData) return;

    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `settings-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900">Bulk Import/Export</h3>
        <p className="text-sm text-gray-600">Import or export settings in bulk</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Export Section */}
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-4">Export Settings</h4>
          <p className="text-sm text-gray-600 mb-4">
            Export all current settings to a JSON file for backup or transfer.
          </p>

          <button
            onClick={handleExport}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 mr-2"
          >
            {loading ? 'Exporting...' : 'Export Settings'}
          </button>

          {exportData && (
            <button
              onClick={downloadExport}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
            >
              Download JSON
            </button>
          )}

          {exportData && (
            <div className="mt-4">
              <textarea
                value={exportData}
                readOnly
                rows={10}
                className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-xs"
                placeholder="Export data will appear here..."
              />
            </div>
          )}
        </div>

        {/* Import Section */}
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-4">Import Settings</h4>
          <p className="text-sm text-gray-600 mb-4">
            Import settings from a JSON file. This will override existing settings.
          </p>

          <div className="space-y-4">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 mr-2"
              >
                Choose File
              </button>
              <span className="text-sm text-gray-500">
                {importData ? 'File loaded' : 'No file selected'}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Or paste JSON data directly:
              </label>
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                rows={8}
                className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-xs"
                placeholder="Paste exported JSON data here..."
              />
            </div>

            <button
              onClick={handleImport}
              disabled={loading || !importData.trim()}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Importing...' : 'Import Settings'}
            </button>
          </div>

          {/* Import Results */}
          {importResults && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
              <h5 className="font-medium text-blue-900">Import Results</h5>
              <div className="text-sm text-blue-800 mt-2">
                <p>Total: {importResults.total}</p>
                <p>Successful: {importResults.successful}</p>
                <p>Failed: {importResults.failed}</p>
                {importResults.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer">View Errors</summary>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      {importResults.errors.map((error: string, index: number) => (
                        <li key={index} className="text-red-600">{error}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}