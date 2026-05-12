'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { ProfitDistributionEngine } from '@/services/corporate/profit-distribution-engine';
import { CorporatePermissionService } from '@/services/corporate/permission-service';

interface ProfitDistributionProps {
  companyId: string;
}

export function ProfitDistribution({ companyId }: ProfitDistributionProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [distributionResults, setDistributionResults] = useState<any>(null);
  const [formData, setFormData] = useState({
    totalProfits: '',
    periodStart: '',
    periodEnd: '',
    customRules: {
      shareholderDividendPercentage: 0.6,
      networkBonusPercentage: 0.2,
      governanceBonusPercentage: 0.1,
      reservePercentage: 0.1
    }
  });

  const handleDistributeProfits = async () => {
    if (!session?.user?.id || !companyId) return;

    // Check permissions
    const permission = await CorporatePermissionService.checkPermission({
      userId: session.user.id,
      companyId,
      action: 'manage_company'
    });

    if (!permission.allowed) {
      alert('You do not have permission to distribute profits.');
      return;
    }

    setLoading(true);
    try {
      const context = {
        companyId,
        totalProfits: parseFloat(formData.totalProfits),
        periodStart: new Date(formData.periodStart),
        periodEnd: new Date(formData.periodEnd),
        distributionRules: formData.customRules
      };

      const results = await ProfitDistributionEngine.distributeCompanyProfits(context);
      setDistributionResults(results);

    } catch (error) {
      console.error('Error distributing profits:', error);
      alert('Error distributing profits. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateRule = (key: string, value: number) => {
    const total = Object.values({ ...formData.customRules, [key]: value }).reduce((sum: number, val: number) => sum + val, 0);

    if (total > 1) {
      alert('Total distribution cannot exceed 100%');
      return;
    }

    setFormData(prev => ({
      ...prev,
      customRules: {
        ...prev.customRules,
        [key]: value
      }
    }));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Profit Distribution</h1>
            <p className="text-gray-600">Distribute company profits to shareholders and stakeholders</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">
              <strong>Executive Action Required</strong><br />
              Only board members with executive powers can perform profit distribution.
            </p>
          </div>
        </div>
      </div>

      {/* Distribution Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Distribution Parameters</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Total Company Profits
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">$</span>
              <input
                type="number"
                value={formData.totalProfits}
                onChange={(e) => setFormData(prev => ({ ...prev, totalProfits: e.target.value }))}
                className="pl-8 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="100000"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Distribution Period
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={formData.periodStart}
                onChange={(e) => setFormData(prev => ({ ...prev, periodStart: e.target.value }))}
                className="border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="date"
                value={formData.periodEnd}
                onChange={(e) => setFormData(prev => ({ ...prev, periodEnd: e.target.value }))}
                className="border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Distribution Rules */}
        <div>
          <h3 className="text-md font-medium text-gray-900 mb-4">Distribution Rules</h3>
          <div className="space-y-4">
            <DistributionRule
              label="Shareholder Dividends"
              description="Pro-rata distribution to all shareholders"
              value={formData.customRules.shareholderDividendPercentage}
              onChange={(value) => updateRule('shareholderDividendPercentage', value)}
              color="bg-blue-500"
            />
            <DistributionRule
              label="Network Bonuses"
              description="Performance-based bonuses for Network-Enabled members"
              value={formData.customRules.networkBonusPercentage}
              onChange={(value) => updateRule('networkBonusPercentage', value)}
              color="bg-green-500"
            />
            <DistributionRule
              label="Governance Bonuses"
              description="Compensation for board members"
              value={formData.customRules.governanceBonusPercentage}
              onChange={(value) => updateRule('governanceBonusPercentage', value)}
              color="bg-purple-500"
            />
            <DistributionRule
              label="Company Reserves"
              description="Retained earnings for future use"
              value={formData.customRules.reservePercentage}
              onChange={(value) => updateRule('reservePercentage', value)}
              color="bg-orange-500"
            />
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Total Distribution:</span>
              <span className={`font-medium ${
                (formData.customRules.shareholderDividendPercentage +
                 formData.customRules.networkBonusPercentage +
                 formData.customRules.governanceBonusPercentage +
                 formData.customRules.reservePercentage) === 1
                  ? 'text-green-600' : 'text-red-600'
              }`}>
                {((formData.customRules.shareholderDividendPercentage +
                   formData.customRules.networkBonusPercentage +
                   formData.customRules.governanceBonusPercentage +
                   formData.customRules.reservePercentage) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-8 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            This action will distribute profits according to the rules above and create audit trails.
          </div>
          <button
            onClick={handleDistributeProfits}
            disabled={loading || !formData.totalProfits || !formData.periodStart || !formData.periodEnd}
            className="bg-red-600 text-white px-6 py-3 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Distributing Profits...' : 'Distribute Profits'}
          </button>
        </div>
      </div>

      {/* Distribution Results */}
      {distributionResults && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Distribution Results</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <ResultCard
              title="Total Distributed"
              value={`$${distributionResults.totalDistributed.toLocaleString()}`}
              color="bg-green-500"
            />
            <ResultCard
              title="Shareholder Dividends"
              value={`$${distributionResults.shareholderDividends.toLocaleString()}`}
              color="bg-blue-500"
            />
            <ResultCard
              title="Network Bonuses"
              value={`$${distributionResults.networkBonuses.toLocaleString()}`}
              color="bg-green-500"
            />
            <ResultCard
              title="Governance Bonuses"
              value={`$${distributionResults.governanceBonuses.toLocaleString()}`}
              color="bg-purple-500"
            />
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Distribution Summary</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>• {distributionResults.transactionsCreated} benefit transactions created</p>
              <p>• {distributionResults.auditEntries} audit entries logged</p>
              <p>• Reserves allocated: ${distributionResults.reserves.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DistributionRule({ label, description, value, onChange, color }: {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
      <div className="flex-1">
        <div className="flex items-center space-x-3">
          <div className={`w-4 h-4 ${color} rounded-full`}></div>
          <div>
            <h4 className="font-medium text-gray-900">{label}</h4>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-3">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-24"
        />
        <input
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center"
        />
        <span className="text-sm font-medium text-gray-900 w-12">
          {(value * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function ResultCard({ title, value, color }: {
  title: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center space-x-3">
        <div className={`w-3 h-3 ${color} rounded-full`}></div>
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-lg font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}