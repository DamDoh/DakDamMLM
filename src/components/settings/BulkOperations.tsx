'use client';

import { useState } from 'react';
import { SettingsService } from '@/services/settings/settings-service';

interface BulkOperation {
  id: string;
  name: string;
  description: string;
  type: 'update_settings' | 'deploy_changes' | 'rollback';
  requiresConfirmation: boolean;
  affectedEntities: {
    companies: number;
    users: number;
  };
}

export function BulkOperations() {
  const [operations, setOperations] = useState<BulkOperation[]>([
    {
      id: 'commission_rate_update',
      name: 'Update Commission Rate',
      description: 'Apply new commission rate across all companies',
      type: 'update_settings',
      requiresConfirmation: true,
      affectedEntities: { companies: 25, users: 1250 }
    },
    {
      id: 'pv_rules_deployment',
      name: 'Deploy PV Rules',
      description: 'Roll out updated PV matching rules to all tenants',
      type: 'deploy_changes',
      requiresConfirmation: true,
      affectedEntities: { companies: 25, users: 1250 }
    },
    {
      id: 'emergency_rollback',
      name: 'Emergency Rollback',
      description: 'Revert all settings to previous stable state',
      type: 'rollback',
      requiresConfirmation: true,
      affectedEntities: { companies: 25, users: 1250 }
    }
  ]);

  const [selectedOperation, setSelectedOperation] = useState<BulkOperation | null>(null);
  const [executionStatus, setExecutionStatus] = useState<'idle' | 'confirming' | 'executing' | 'completed' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);

  const executeOperation = async (operation: BulkOperation) => {
    setExecutionStatus('executing');
    setProgress(0);

    try {
      // Simulate execution with progress updates
      for (let i = 0; i <= 100; i += 10) {
        setProgress(i);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setExecutionStatus('completed');

      // Log the operation
      console.log(`Bulk operation ${operation.name} completed successfully`);

    } catch (error) {
      setExecutionStatus('failed');
      console.error(`Bulk operation ${operation.name} failed:`, error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Bulk Operations</h3>
        <p className="text-gray-600 mb-6">
          Perform large-scale operations across all companies and users. Use with extreme caution.
        </p>

        {/* Operations List */}
        <div className="space-y-4">
          {operations.map((operation) => (
            <div key={operation.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-md font-medium text-gray-900">{operation.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{operation.description}</p>

                  <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                    <span>Affects {operation.affectedEntities.companies} companies</span>
                    <span>{operation.affectedEntities.users} users</span>
                    {operation.requiresConfirmation && (
                      <span className="text-orange-600">Requires confirmation</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedOperation(operation)}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm ml-4"
                  disabled={executionStatus === 'executing'}
                >
                  Execute
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Execution Modal */}
      {selectedOperation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Confirm Bulk Operation
            </h3>

            <div className="mb-6">
              <h4 className="font-medium text-gray-900">{selectedOperation.name}</h4>
              <p className="text-sm text-gray-600 mt-1">{selectedOperation.description}</p>

              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <div className="text-sm text-yellow-800">
                  <strong>Warning:</strong> This operation will affect {selectedOperation.affectedEntities.companies} companies
                  and {selectedOperation.affectedEntities.users} users. This action cannot be undone.
                </div>
              </div>
            </div>

            {executionStatus === 'executing' && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>Executing operation...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setSelectedOperation(null);
                  setExecutionStatus('idle');
                  setProgress(0);
                }}
                className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                disabled={executionStatus === 'executing'}
              >
                Cancel
              </button>

              {executionStatus === 'idle' && (
                <button
                  onClick={() => executeOperation(selectedOperation)}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                >
                  Confirm & Execute
                </button>
              )}

              {executionStatus === 'completed' && (
                <button
                  onClick={() => {
                    setSelectedOperation(null);
                    setExecutionStatus('idle');
                    setProgress(0);
                  }}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}