'use client';

import { useState, useEffect, useCallback } from 'react';
import { SettingsService } from '@/services/settings/settings-service';

interface SettingsPreviewProps {
  currentSettings: Record<string, any>;
  proposedChanges: Record<string, any>;
  context?: { companyId?: string; userId?: string };
}

interface ImpactAnalysis {
  affectedUsers: number;
  affectedCompanies: number;
  revenueImpact: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  conflicts: string[];
  recommendations: string[];
}

export function SettingsPreview({
  currentSettings,
  proposedChanges,
  context
}: SettingsPreviewProps) {
  const [impact, setImpact] = useState<ImpactAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  const calculateImpact = useCallback(async () => {
    setLoading(true);
    try {
      // This would call a backend API to analyze the impact
      // For now, simulate analysis
      const analysis: ImpactAnalysis = {
        affectedUsers: Math.floor(Math.random() * 1000) + 100,
        affectedCompanies: Math.floor(Math.random() * 50) + 5,
        revenueImpact: (Math.random() - 0.5) * 10000, // +/- $10k
        riskLevel: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as any,
        conflicts: [
          'Commission rate change may affect existing contracts',
          'PV matching rules could impact team balancing'
        ].slice(0, Math.floor(Math.random() * 3)),
        recommendations: [
          'Consider gradual rollout over 30 days',
          'Notify affected users in advance',
          'Monitor system performance closely'
        ].slice(0, Math.floor(Math.random() * 4))
      };

      setImpact(analysis);

      // Generate preview data
      const preview = await generatePreviewData(currentSettings, proposedChanges, context);
      setPreviewData(preview);

    } catch (error) {
      console.error('Error calculating impact:', error);
    } finally {
      setLoading(false);
    }
  }, [currentSettings, proposedChanges, context]);

  useEffect(() => {
    if (Object.keys(proposedChanges).length > 0) {
      calculateImpact();
    }
  }, [proposedChanges, calculateImpact]);

  if (Object.keys(proposedChanges).length === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="text-center text-blue-700">
          <p>Make changes to settings above to see impact preview</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gray-50 border rounded-md p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-6 space-y-6">
      <div className="flex items-center">
        <h3 className="text-lg font-medium text-gray-900">Impact Analysis</h3>
        <span className={`ml-auto px-2 py-1 rounded-full text-xs font-medium ${
          impact?.riskLevel === 'low' ? 'bg-green-100 text-green-800' :
          impact?.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
          impact?.riskLevel === 'high' ? 'bg-orange-100 text-orange-800' :
          'bg-red-100 text-red-800'
        }`}>
          {impact?.riskLevel.toUpperCase()} RISK
        </span>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">
            {impact?.affectedUsers.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Affected Users</div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {impact?.affectedCompanies}
          </div>
          <div className="text-sm text-gray-600">Affected Companies</div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className={`text-2xl font-bold ${
            (impact?.revenueImpact || 0) >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {impact?.revenueImpact ?
              `${impact.revenueImpact >= 0 ? '+' : ''}$${Math.abs(impact.revenueImpact).toLocaleString()}` :
              '$0'
            }
          </div>
          <div className="text-sm text-gray-600">Revenue Impact (30d)</div>
        </div>
      </div>

      {/* Conflicts and Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {impact?.conflicts && impact.conflicts.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
              <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
              Potential Conflicts
            </h4>
            <ul className="space-y-1">
              {impact.conflicts.map((conflict, index) => (
                <li key={index} className="text-sm text-gray-600 flex items-start">
                  <span className="text-red-500 mr-2">•</span>
                  {conflict}
                </li>
              ))}
            </ul>
          </div>
        )}

        {impact?.recommendations && impact.recommendations.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              Recommendations
            </h4>
            <ul className="space-y-1">
              {impact.recommendations.map((rec, index) => (
                <li key={index} className="text-sm text-gray-600 flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Preview Data */}
      {previewData && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Sample Calculations</h4>
          <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm">
            <pre>{JSON.stringify(previewData, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to generate preview calculations
async function generatePreviewData(
  current: Record<string, any>,
  changes: Record<string, any>,
  context?: { companyId?: string; userId?: string }
): Promise<any> {
  // Simulate preview calculations
  const sampleData = {
    currentCommissionRate: current.commission_rate || 0.08,
    proposedCommissionRate: changes.commission_rate || current.commission_rate || 0.08,
    sampleMatch: {
      leftWaitingPV: 200,
      rightWaitingPV: 150,
      matchedPV: 150,
      currentCommission: 150 * (current.commission_rate || 0.08),
      proposedCommission: 150 * (changes.commission_rate || current.commission_rate || 0.08)
    }
  };

  return sampleData;
}