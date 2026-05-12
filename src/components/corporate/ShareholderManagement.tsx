'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { CorporatePermissionService } from '@/services/corporate/permission-service';

interface Shareholder {
  id: string;
  userId: string;
  membershipType: 'network_enabled' | 'standard';
  canBuildNetwork: boolean;
  sharePercentage: number;
  totalShares: number;
  investmentAmount: number;
  status: string;
  votingRights: boolean;
  networkReferrals: { id: string }[];
  boardMemberships: any[];
}

interface ShareholderManagementProps {
  companyId: string;
}

export function ShareholderManagement({ companyId }: ShareholderManagementProps) {
  const { data: session } = useSession();
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [governance, setGovernance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedShareholder, setSelectedShareholder] = useState<Shareholder | null>(null);

  useEffect(() => {
    if (companyId) {
      loadShareholderData();
    }
  }, [companyId]);

  const loadShareholderData = async () => {
    try {
      setLoading(true);

      // Load shareholders (this would be an API call)
      const shareholdersData = await fetch(`/api/corporate/shareholders?companyId=${companyId}`)
        .then(res => res.json())
        .then(data => data.data || []);

      setShareholders(shareholdersData);

      // Load governance structure
      const governanceData = await CorporatePermissionService.getCompanyGovernance(companyId);
      setGovernance(governanceData);

    } catch (error) {
      console.error('Error loading shareholder data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMembershipBadge = (type: string, canBuild: boolean) => {
    if (type === 'network_enabled') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Network Enabled {canBuild && '✓'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        Standard Member
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shareholder Management</h1>
            <p className="text-gray-600">Manage company shareholders and ownership structure</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">Total Shareholders</p>
              <p className="text-2xl font-bold text-gray-900">{governance?.shareholderStats?.totalShareholders || 0}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Board Members</p>
              <p className="text-2xl font-bold text-gray-900">{governance?.boardMembers?.length || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Governance Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Board of Directors</h3>
          <div className="space-y-3">
            {governance?.boardMembers?.map((member: any, index: number) => (
              <div key={index} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{member.shareholder.user.firstName} {member.shareholder.user.lastName}</p>
                  <p className="text-sm text-gray-600">{member.position}</p>
                </div>
                <span className="text-sm font-medium text-blue-600">
                  {member.votingPower}x votes
                </span>
              </div>
            )) || (
              <p className="text-gray-500">No board members</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Membership Breakdown</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Network Enabled</span>
              <span className="font-semibold">{governance?.shareholderStats?.networkEnabledCount || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Standard Members</span>
              <span className="font-semibold">{governance?.shareholderStats?.standardCount || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Ownership</span>
              <span className="font-semibold">{governance?.shareholderStats?.totalSharePercentage?.toFixed(1) || 0}%</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Network Statistics</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Network Size</span>
              <span className="font-semibold">{governance?.shareholderStats?.averageNetworkSize?.toFixed(1) || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Active Networks</span>
              <span className="font-semibold">{shareholders.filter(s => s.membershipType === 'network_enabled').length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Shareholders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Shareholders</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Shareholder
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Membership
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ownership
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Network
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {shareholders.map((shareholder) => (
                <tr key={shareholder.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          Shareholder {shareholder.id.slice(-8)}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {shareholder.userId.slice(-8)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getMembershipBadge(shareholder.membershipType, shareholder.canBuildNetwork)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{shareholder.sharePercentage}%</div>
                    <div className="text-sm text-gray-500">${shareholder.investmentAmount.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{shareholder.networkReferrals.length} referrals</div>
                    {shareholder.membershipType === 'network_enabled' && (
                      <div className="text-sm text-blue-600">Active network</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      shareholder.status === 'active' ? 'bg-green-100 text-green-800' :
                      shareholder.status === 'suspended' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {shareholder.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => setSelectedShareholder(shareholder)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      View Details
                    </button>
                    {shareholder.boardMemberships.length > 0 && (
                      <span className="text-purple-600">Board Member</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {shareholders.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No shareholders found for this company.
          </div>
        )}
      </div>

      {/* Shareholder Detail Modal */}
      {selectedShareholder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Shareholder Details</h3>
              <button
                onClick={() => setSelectedShareholder(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Basic Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shareholder ID:</span>
                    <span className="font-medium">{selectedShareholder.id.slice(-8)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">User ID:</span>
                    <span className="font-medium">{selectedShareholder.userId.slice(-8)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Membership Type:</span>
                    <span className="font-medium">{selectedShareholder.membershipType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Can Build Network:</span>
                    <span className="font-medium">{selectedShareholder.canBuildNetwork ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className="font-medium">{selectedShareholder.status}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3">Ownership & Network</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Share Percentage:</span>
                    <span className="font-medium">{selectedShareholder.sharePercentage}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Shares:</span>
                    <span className="font-medium">{selectedShareholder.totalShares.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Investment:</span>
                    <span className="font-medium">${selectedShareholder.investmentAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Network Referrals:</span>
                    <span className="font-medium">{selectedShareholder.networkReferrals.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Voting Rights:</span>
                    <span className="font-medium">{selectedShareholder.votingRights ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>
            </div>

            {selectedShareholder.boardMemberships.length > 0 && (
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-3">Board Membership</h4>
                <div className="bg-purple-50 p-4 rounded-lg">
                  {selectedShareholder.boardMemberships.map((membership, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-purple-900">{membership.position}</span>
                        <span className="text-sm text-purple-700 ml-2">
                          {membership.votingPower}x voting power
                          {membership.executivePowers && ' • Executive powers'}
                        </span>
                      </div>
                      <span className="text-sm text-purple-600">
                        {membership.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}