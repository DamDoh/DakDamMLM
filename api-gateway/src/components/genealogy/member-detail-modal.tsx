'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Member } from '@/lib/types';
import { useEffect, useState } from 'react';
import { Loader2, User, Calendar, Users, TrendingUp, Award, DollarSign, CheckCircle, XCircle, Mail, Phone, Briefcase, Store } from 'lucide-react';
import RankBadge from './rank-badge';

interface MemberDetailModalProps {
  member: Member | null;
  isOpen: boolean;
  onClose: () => void;
}

interface MemberDetails {
  member: Member;
  pvData: {
    oldPV: number;
    newPV: number;
    totalPV: number;
    walletBalance: number;
    weakPV: number;
    strongPV: number;
  };
  bonuses: {
    stockBonus: number;
    dailyMatchBonus: number;
    binaryBonus: number;
    matchingBonus: number;
    totalBonus: number;
  };
  team: {
    directRecruits: number;
    totalDownline: number;
    monthlyTeam: number;
  };
  maintainStatus: 'Maintain' | 'Not Maintain';
}

export default function MemberDetailModal({ member, isOpen, onClose }: MemberDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<MemberDetails | null>(null);

  useEffect(() => {
    if (member && isOpen) {
      fetchMemberDetails(member.id);
    }
  }, [member, isOpen]);

  const fetchMemberDetails = async (memberId: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/members/${memberId}/details`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDetails(data);
      }
    } catch (error) {
      console.error('Failed to fetch member details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!member) return null;

  const getRankBadge = (rank: string | null) => {
    const rankColors: Record<string, string> = {
      'Member': 'bg-gray-400',
      'Bronze': 'bg-orange-600',
      'Silver': 'bg-gray-300',
      'Gold': 'bg-yellow-500',
      'Diamond': 'bg-blue-400',
      'Super Diamond': 'bg-purple-500',
      'HALF STAR': 'bg-yellow-600',
      'Star': 'bg-yellow-400',
      'Supervisor': 'bg-green-500',
      'Manager': 'bg-green-600',
      'Director': 'bg-red-500',
      'President': 'bg-red-600',
      'Star Diamond': 'bg-cyan-400',
      'Crown Diamond': 'bg-purple-600',
      'Blue Diamond': 'bg-blue-600',
      'Double Blue Diamond': 'bg-indigo-600',
      'Expired': 'bg-red-700',
    };

    const color = rankColors[rank || 'Member'] || 'bg-gray-400';
    return <Badge className={`${color} text-white`}>{rank || 'Member'}</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Member Information</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Profile Header with Rank */}
            <div className="flex flex-col items-center gap-4 p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200">
              <div className="relative">
                {member.rank && member.rank !== 'Member' ? (
                  <div className="w-32 h-32 rounded-full overflow-hidden shadow-2xl ring-4 ring-white">
                    <RankBadge rank={member.rank} className="w-32 h-32" />
                  </div>
                ) : (
                  <Avatar className="w-32 h-32 border-4 border-white shadow-2xl">
                    <AvatarImage src={member.avatarUrl} alt={member.fullName} />
                    <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {member.firstName?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-800">{member.fullName}</h2>
                <p className="text-sm text-gray-600 mt-1">{member.memberId}</p>
                <div className="mt-3">
                  {getRankBadge(member.rank)}
                </div>
              </div>
            </div>

            {/* Basic Info */}
            <Card className="border-2 border-blue-100 shadow-lg">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <User className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Member ID</p>
                      <p className="font-bold text-gray-800">{member.memberId}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <User className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Member</p>
                      <p className="font-bold text-gray-800">{member.fullName}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
                    <Award className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Position</p>
                      <p className="font-bold text-blue-700">{member.rank || 'Member'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <Calendar className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Join Member</p>
                      <p className="font-bold text-gray-800">
                        {(member as any).createdAt ? new Date((member as any).createdAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <Users className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Invite</p>
                      <p className="font-bold text-gray-800">{member.sponsorId || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <Users className="h-5 w-5 text-indigo-600 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Upline</p>
                      <p className="font-bold text-gray-800">{member.placementParentId || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
                    <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Total PV</p>
                      <p className="font-bold text-blue-700">{Number(details?.pvData.walletBalance || 0).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <Calendar className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Topup date</p>
                      <p className="font-bold text-gray-800">
                        {(member as any).lastTopupDate ? new Date((member as any).lastTopupDate).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <Briefcase className="h-5 w-5 text-cyan-600 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Account Type</p>
                      <p className="font-bold text-gray-800">{(member as any).accountType || 'Customer'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <Store className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Stock Level</p>
                      <p className="font-bold text-gray-800">{(member as any).storeOwnerLevel || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <Phone className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Phone Number</p>
                      <p className="font-bold text-gray-800">{(member as any).phoneNumber || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <Mail className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                      <p className="font-bold text-gray-800">{(member as any).email || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bonuses */}
            <Card className="border-2 border-green-100 shadow-lg">
              <CardContent className="pt-6">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Bonuses & Performance
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 px-4 bg-white rounded-lg border border-gray-200 hover:border-green-300 transition-colors">
                    <span className="text-gray-700 font-medium">Stockist Bonus:</span>
                    <span className="font-bold text-gray-900 text-lg">${Number(details?.bonuses.stockBonus || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 px-4 bg-white rounded-lg border border-gray-200 hover:border-green-300 transition-colors">
                    <span className="text-gray-700 font-medium">Daily Match Bonus:</span>
                    <span className="font-bold text-gray-900 text-lg">${Number(details?.bonuses.dailyMatchBonus || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 px-4 bg-white rounded-lg border border-gray-200 hover:border-green-300 transition-colors">
                    <span className="text-gray-700 font-medium">Binary Bonus:</span>
                    <span className="font-bold text-gray-900 text-lg">${Number(details?.bonuses.binaryBonus || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 px-4 bg-white rounded-lg border border-gray-200 hover:border-green-300 transition-colors">
                    <span className="text-gray-700 font-medium">Matching Bonus:</span>
                    <span className="font-bold text-gray-900 text-lg">${Number(details?.bonuses.matchingBonus || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 px-4 bg-white rounded-lg border border-gray-200 hover:border-green-300 transition-colors">
                    <span className="text-gray-700 font-medium">Maintain Status:</span>
                    <span className={`font-bold text-lg ${details?.maintainStatus === 'Maintain' ? 'text-green-700' : 'text-red-600'}`}>
                      {details?.maintainStatus || 'Not Maintain'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 px-4 bg-white rounded-lg border border-gray-200 hover:border-green-300 transition-colors">
                    <span className="text-gray-700 font-medium">Team Monthly:</span>
                    <span className="font-bold text-gray-900 text-lg">{details?.team.monthlyTeam || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-4 px-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-300 mt-4">
                    <span className="text-green-800 font-bold text-lg">Total Bonus:</span>
                    <span className="text-2xl font-bold text-green-700">${Number(details?.bonuses.totalBonus || 0).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

