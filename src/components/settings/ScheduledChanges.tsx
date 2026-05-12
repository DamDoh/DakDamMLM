'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ScheduledSettingsService } from '@/services/settings/setting-enhancements';

interface ScheduledChangesProps {
  onScheduleCreated?: () => void;
}

export function ScheduledChanges({ onScheduleCreated }: ScheduledChangesProps) {
  const [scheduledChanges, setScheduledChanges] = useState<any[]>([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadScheduledChanges();
  }, []);

  const loadScheduledChanges = async () => {
    try {
      // This would call an API to get scheduled changes
      // For now, simulate empty state
      setScheduledChanges([]);
    } catch (error) {
      console.error('Error loading scheduled changes:', error);
    }
  };

  const scheduleChange = async (changeData: {
    settingKey: string;
    settingType: string;
    newValue: any;
    scheduledAt: Date;
    reason?: string;
  }) => {
    setLoading(true);
    try {
      await ScheduledSettingsService.scheduleSettingChange({
        ...changeData,
        settingType: changeData.settingType as any,
        createdBy: 'current_user' // Get from auth
      });

      setShowScheduleForm(false);
      onScheduleCreated?.();
      loadScheduledChanges();
    } catch (error) {
      console.error('Error scheduling change:', error);
      alert('Error scheduling change');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Scheduled Changes</h3>
          <p className="text-sm text-gray-600">Plan setting changes for future execution</p>
        </div>
        <button
          onClick={() => setShowScheduleForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
        >
          Schedule Change
        </button>
      </div>

      {/* Scheduled Changes List */}
      <div className="space-y-4">
        {scheduledChanges.map((change) => (
          <div key={change.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">{change.settingKey}</h4>
                <p className="text-sm text-gray-600">
                  Scheduled for: {format(new Date(change.scheduledAt), 'PPpp')}
                </p>
                <div className="flex items-center space-x-2 mt-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    change.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    change.status === 'executed' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {change.status}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">
                  {change.reason && `Reason: ${change.reason}`}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {scheduledChanges.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No scheduled changes. Plan future setting updates above.
        </div>
      )}

      {/* Schedule Form Modal */}
      {showScheduleForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Schedule Setting Change</h3>

            <ScheduleForm
              onSubmit={scheduleChange}
              onCancel={() => setShowScheduleForm(false)}
              loading={loading}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface ScheduleFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  loading: boolean;
}

function ScheduleForm({ onSubmit, onCancel, loading }: ScheduleFormProps) {
  const [formData, setFormData] = useState({
    settingKey: '',
    settingType: 'company',
    newValue: '',
    scheduledAt: '',
    reason: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let parsedValue;
    try {
      parsedValue = JSON.parse(formData.newValue);
    } catch {
      parsedValue = formData.newValue;
    }

    onSubmit({
      ...formData,
      newValue: parsedValue,
      scheduledAt: new Date(formData.scheduledAt)
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Setting Key
        </label>
        <input
          type="text"
          value={formData.settingKey}
          onChange={(e) => setFormData(prev => ({ ...prev, settingKey: e.target.value }))}
          className="w-full border border-gray-300 rounded-md px-3 py-2"
          placeholder="e.g., commission_rate"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Setting Type
        </label>
        <select
          value={formData.settingType}
          onChange={(e) => setFormData(prev => ({ ...prev, settingType: e.target.value }))}
          className="w-full border border-gray-300 rounded-md px-3 py-2"
        >
          <option value="company">Company Setting</option>
          <option value="system">System Setting</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          New Value (JSON)
        </label>
        <textarea
          value={formData.newValue}
          onChange={(e) => setFormData(prev => ({ ...prev, newValue: e.target.value }))}
          rows={3}
          className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-sm"
          placeholder='{"commission_rate": 0.10}'
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Scheduled Date & Time
        </label>
        <input
          type="datetime-local"
          value={formData.scheduledAt}
          onChange={(e) => setFormData(prev => ({ ...prev, scheduledAt: e.target.value }))}
          className="w-full border border-gray-300 rounded-md px-3 py-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Reason (Optional)
        </label>
        <input
          type="text"
          value={formData.reason}
          onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
          className="w-full border border-gray-300 rounded-md px-3 py-2"
          placeholder="Why is this change scheduled?"
        />
      </div>

      <div className="flex space-x-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Scheduling...' : 'Schedule Change'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}