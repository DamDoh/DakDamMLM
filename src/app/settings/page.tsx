'use client';

import { SettingsManagement } from '@/components/settings/SettingsManagement';

export default function SettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings Management</h1>
        <p className="text-gray-600 mt-2">
          Manage system-wide defaults, company overrides, and personal preferences
        </p>
      </div>

      <SettingsManagement />
    </div>
  );
}