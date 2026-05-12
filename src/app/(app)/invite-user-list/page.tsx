'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Users, Calendar, Award, UserCircle, GitBranch, TrendingUp, Activity, Eye, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/internationalization';
import { useAuthContext } from '@/context/auth-context';
import type { Member } from '@/lib/types';
import { cn } from '@/lib/utils';
import placeholderData from '@/lib/placeholder-images.json';
import RankBadge from '@/components/genealogy/rank-badge';
import MemberDetailModal from '@/components/genealogy/member-detail-modal';

const imageMap = new Map(placeholderData.images.map(img => [img.id, img]));

interface DownlineNode {
  id: string;
  memberId: string;
  fullName: string;
  avatarUrl?: string | null;
  rank: string;
  pv: number;
  joinDate: string;
  active: boolean;
  left: DownlineNode | null;
  right: DownlineNode | null;
  children: {
    left: string | null;
    right: string | null;
  };
}

export default function InviteUserListPage() {
  const { t } = useI18n();
  const { user: authUser } = useAuthContext();
  const [invitedMembers, setInvitedMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [downlineData, setDownlineData] = useState<Record<string, DownlineNode | null>>({});
  const [loadingDownlines, setLoadingDownlines] = useState<Set<string>>(new Set());
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberDetailModalOpen, setMemberDetailModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchInvitedMembers();
  }, []);

  const fetchInvitedMembers = async () => {
    try {
      setLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      
      if (!token) {
        console.error('No auth token found');
        return;
      }

      const response = await fetch('/api/invited-members', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setInvitedMembers(data.data || []);
      } else {
        console.error('Failed to fetch invited members');
      }
    } catch (error) {
      console.error('Error fetching invited members:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDownline = async (memberId: string) => {
    // If already loaded, don't fetch again
    if (downlineData[memberId] !== undefined) {
      return;
    }

    try {
      setLoadingDownlines(prev => new Set(prev).add(memberId));
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      
      if (!token) {
        console.error('No auth token found');
        return;
      }

      const response = await fetch(`/api/members/${memberId}/downline`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDownlineData(prev => ({
          ...prev,
          [memberId]: data.data,
        }));
      } else {
        console.error('Failed to fetch downline');
        setDownlineData(prev => ({
          ...prev,
          [memberId]: null,
        }));
      }
    } catch (error) {
      console.error('Error fetching downline:', error);
      setDownlineData(prev => ({
        ...prev,
        [memberId]: null,
      }));
    } finally {
      setLoadingDownlines(prev => {
        const newSet = new Set(prev);
        newSet.delete(memberId);
        return newSet;
      });
    }
  };

  const handleAccordionChange = (value: string) => {
    if (value) {
      // Extract member ID from accordion value
      const memberId = value;
      fetchDownline(memberId);
    }
  };

  const handleViewMemberDetails = (member: Member) => {
    setSelectedMember(member);
    setMemberDetailModalOpen(true);
  };

  const handleViewDownlineMemberDetails = (memberId: string) => {
    // Find the member in the downline data
    const findMemberInDownline = (node: DownlineNode | null): Member | null => {
      if (!node) return null;
      if (node.id === memberId) {
        return {
          id: node.id,
          memberId: node.memberId,
          fullName: node.fullName,
          firstName: node.fullName.split(' ')[0] || '',
          surname: node.fullName.split(' ').slice(1).join(' ') || '',
          rank: node.rank as any,
          joinDate: node.joinDate,
          active: node.active,
          pv: node.pv,
          email: null,
          phoneNumber: '',
          accountType: 'Distributor',
          avatarUrl: node.avatarUrl || '',
          storeOwnerLevel: null,
          addresses: [],
          teamSize: { left: 0, right: 0, total: 0 },
          sponsorId: null,
          placementParentId: null,
          position: null,
          children: { left: null, right: null },
        };
      }
      return findMemberInDownline(node.left) || findMemberInDownline(node.right);
    };

    // Search through all downline data
    for (const downline of Object.values(downlineData)) {
      if (downline) {
        const member = findMemberInDownline(downline);
        if (member) {
          setSelectedMember(member);
          setMemberDetailModalOpen(true);
          return;
        }
      }
    }
  };

  // Filter members based on search query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) {
      return invitedMembers;
    }

    const query = searchQuery.toLowerCase().trim();
    return invitedMembers.filter((member) => {
      return (
        member.memberId.toLowerCase().includes(query) ||
        member.fullName.toLowerCase().includes(query) ||
        (member.firstName && member.firstName.toLowerCase().includes(query)) ||
        (member.surname && member.surname.toLowerCase().includes(query)) ||
        (member.email && member.email.toLowerCase().includes(query)) ||
        (member.phoneNumber && member.phoneNumber.includes(query)) ||
        (member.rank && member.rank.toLowerCase().includes(query))
      );
    });
  }, [invitedMembers, searchQuery]);

  // Calculate statistics based on filtered members
  const stats = useMemo(() => {
    const totalInvited = filteredMembers.length;
    const activeMembers = filteredMembers.filter(m => m.active).length;
    const totalTeamMembers = filteredMembers.reduce((sum, m) => sum + (m.teamSize?.total || 0), 0);
    const averageTeamSize = totalInvited > 0 ? Math.round(totalTeamMembers / totalInvited) : 0;

    return {
      totalInvited,
      activeMembers,
      totalTeamMembers,
      averageTeamSize,
    };
  }, [filteredMembers]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const renderDownlineTree = (node: DownlineNode | null, level: number = 0): JSX.Element | null => {
    if (!node) return null;

    const hasChildren = node.left || node.right;
    const maxLevel = 3; // Limit depth for display

    if (level > maxLevel) {
      return (
        <div className="text-sm text-muted-foreground italic py-2 px-4">
          {t('inviteUserList.maxDepthReached') || 'Maximum depth reached'}
        </div>
      );
    }

    // Prefer explicit avatarUrl (same logic as invited members list)
    const avatarSrc =
      (node.avatarUrl
        ? imageMap.get(node.avatarUrl)?.imageUrl || node.avatarUrl
        : undefined) ||
      imageMap.get(node.id)?.imageUrl ||
      '';

    return (
      <div className="space-y-3">
        {/* Current Node */}
        <div className={cn(
          "flex items-center gap-3 p-4 rounded-lg border transition-all duration-200 group cursor-pointer",
          level === 0 
            ? "bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30 shadow-sm hover:shadow-md hover:border-primary/50" 
            : "bg-card/50 border-border/50 hover:bg-card hover:border-primary/30"
        )}
        onClick={() => handleViewDownlineMemberDetails(node.id)}
        >
          <Avatar className={cn("flex-shrink-0 transition-transform group-hover:scale-105", level === 0 ? "h-12 w-12 ring-2 ring-primary/20" : "h-10 w-10")}>
            <AvatarImage src={avatarSrc} alt={node.fullName} />
            <AvatarFallback className={level === 0 ? "text-lg" : ""}>{node.fullName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={cn("font-medium truncate group-hover:text-primary transition-colors", level === 0 ? "text-base" : "text-sm")}>
                {node.fullName}
              </p>
              <Badge variant="outline" className="text-xs font-mono">
                {node.memberId}
              </Badge>
              <RankBadge rank={node.rank as any} className="text-xs" />
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(node.joinDate)}
              </span>
              {node.pv > 0 && (
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {node.pv} PV
                </span>
              )}
              {!node.active && (
                <Badge variant="secondary" className="text-xs">Inactive</Badge>
              )}
            </div>
          </div>
          <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>

        {/* Children */}
        {hasChildren && (
          <div className={cn(
            "space-y-4 relative",
            level === 0 ? "ml-8 border-l-2 border-primary/30 pl-6" : "ml-6 border-l-2 border-border/30 pl-4"
          )}>
            {/* Left Leg */}
            {node.left && (
              <div className="relative">
                <div className="flex items-center gap-2 mb-3 sticky top-0 bg-background/80 backdrop-blur-sm py-1 z-10">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  <GitBranch className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-semibold text-blue-600">
                    {t('inviteUserList.leftLeg') || 'Left Leg'}
                  </span>
                </div>
                {renderDownlineTree(node.left, level + 1)}
              </div>
            )}

            {/* Right Leg */}
            {node.right && (
              <div className="relative">
                <div className="flex items-center gap-2 mb-3 sticky top-0 bg-background/80 backdrop-blur-sm py-1 z-10">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <GitBranch className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-semibold text-green-600">
                    {t('inviteUserList.rightLeg') || 'Right Leg'}
                  </span>
                </div>
                {renderDownlineTree(node.right, level + 1)}
              </div>
            )}
          </div>
        )}

        {/* Show message if no children */}
        {!hasChildren && level === 0 && (
          <div className="text-sm text-muted-foreground italic py-4 px-6 bg-muted/30 rounded-lg border border-dashed">
            {t('inviteUserList.noDownline') || 'No downline members yet'}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex-1 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 pt-6 md:p-8">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('inviteUserList.title') || 'Invite User List'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('inviteUserList.description') || 'View all members you have directly invited and their downline structures'}
          </p>
        </div>

        {/* Search Bar */}
        {invitedMembers.length > 0 && (
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={t('inviteUserList.searchPlaceholder') || 'Search by member ID, name, email, phone, or rank...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    title={t('inviteUserList.clearSearch') || 'Clear search'}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="text-sm text-muted-foreground mt-2">
                  {filteredMembers.length === 0 
                    ? t('inviteUserList.noResults') || 'No members found matching your search.'
                    : t('inviteUserList.searchResults', { count: filteredMembers.length.toString(), total: invitedMembers.length.toString() }) || 
                      `Found ${filteredMembers.length} of ${invitedMembers.length} members`}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Statistics Cards */}
        {filteredMembers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="hover:shadow-md transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('inviteUserList.totalInvited') || 'Total Invited'}
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalInvited}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.activeMembers} {t('inviteUserList.active') || 'active'}
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('inviteUserList.activeMembers') || 'Active Members'}
                </CardTitle>
                <Activity className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.activeMembers}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.totalInvited > 0 
                    ? Math.round((stats.activeMembers / stats.totalInvited) * 100) 
                    : 0}% {t('inviteUserList.activationRate') || 'activation rate'}
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('inviteUserList.totalTeamMembers') || 'Total Team Members'}
                </CardTitle>
                <UserCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalTeamMembers}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.averageTeamSize} {t('inviteUserList.avgPerMember') || 'avg per member'}
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('inviteUserList.teamGrowth') || 'Team Growth'}
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.averageTeamSize}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('inviteUserList.averageDownline') || 'average downline size'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {filteredMembers.length === 0 && invitedMembers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                {t('inviteUserList.noInvitedMembers') || 'No Invited Members Yet'}
              </p>
              <p className="text-sm text-muted-foreground text-center">
                {t('inviteUserList.noInvitedMembersDescription') || 'You haven\'t invited any members yet. Start inviting members to see them here.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {t('inviteUserList.invitedMembers') || 'Invited Members'} 
                <Badge variant="secondary" className="ml-2">
                  {searchQuery ? `${filteredMembers.length}/${invitedMembers.length}` : invitedMembers.length}
                </Badge>
              </CardTitle>
              <CardDescription>
                {searchQuery 
                  ? t('inviteUserList.filteredMembersDescription') || 'Filtered results - Click on a member to view their downline structure'
                  : t('inviteUserList.invitedMembersDescription') || 'Click on a member to view their downline structure'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredMembers.length === 0 && searchQuery ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Search className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">
                    {t('inviteUserList.noSearchResults') || 'No Members Found'}
                  </p>
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    {t('inviteUserList.noSearchResultsDescription', { query: searchQuery }) || `No members match "${searchQuery}". Try a different search term.`}
                  </p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-sm text-primary hover:underline"
                  >
                    {t('inviteUserList.clearSearchAndShowAll') || 'Clear search and show all members'}
                  </button>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full space-y-3" onValueChange={handleAccordionChange}>
                  {filteredMembers.map((member) => {
                  const avatarSrc = imageMap.get(member.avatarUrl)?.imageUrl || member.avatarUrl;
                  const isLoadingDownline = loadingDownlines.has(member.id);
                  const downline = downlineData[member.id];
                  const teamSize = member.teamSize?.total || 0;

                  return (
                    <AccordionItem 
                      key={member.id} 
                      value={member.id} 
                      className="border rounded-lg overflow-hidden hover:shadow-md transition-all duration-200 bg-card group"
                    >
                      <div className="flex items-center gap-2 px-6 py-4">
                        <AccordionTrigger className="hover:no-underline flex-1">
                          <div className="flex items-center gap-4 w-full">
                            <Avatar 
                              className="h-14 w-14 ring-2 ring-primary/20 flex-shrink-0 cursor-pointer hover:ring-primary/40 transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewMemberDetails(member);
                              }}
                            >
                              <AvatarImage src={avatarSrc} alt={member.fullName} />
                              <AvatarFallback className="text-lg font-semibold">
                                {member.firstName?.charAt(0) || member.fullName?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-left min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p 
                                  className="font-semibold text-base truncate hover:text-primary cursor-pointer transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewMemberDetails(member);
                                  }}
                                >
                                  {member.fullName}
                                </p>
                                <Badge variant="outline" className="text-xs font-mono flex-shrink-0">
                                  {member.memberId}
                                </Badge>
                                <RankBadge rank={member.rank as any} className="text-xs flex-shrink-0" />
                                {!member.active && (
                                  <Badge variant="secondary" className="text-xs">Inactive</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1.5">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {formatDate(member.joinDate)}
                                </span>
                                {teamSize > 0 && (
                                  <span className="flex items-center gap-1.5 text-primary font-medium">
                                    <UserCircle className="h-3.5 w-3.5" />
                                    {teamSize} {t('inviteUserList.teamMembers') || 'team members'}
                                  </span>
                                )}
                                {member.pv > 0 && (
                                  <span className="flex items-center gap-1.5">
                                    <TrendingUp className="h-3.5 w-3.5" />
                                    {member.pv} PV
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewMemberDetails(member);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-primary/10 rounded-lg flex-shrink-0"
                          title={t('inviteUserList.viewDetails') || 'View Details'}
                        >
                          <Eye className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                        </button>
                      </div>
                      <AccordionContent>
                        <div className="pt-4 pb-4 px-6 bg-muted/20 border-t">
                          {isLoadingDownline ? (
                            <div className="flex flex-col items-center justify-center py-12">
                              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                              <p className="text-sm text-muted-foreground">
                                {t('inviteUserList.loadingDownline') || 'Loading downline structure...'}
                              </p>
                            </div>
                          ) : downline ? (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="font-semibold text-base flex items-center gap-2">
                                  <GitBranch className="h-4 w-4 text-primary" />
                                  {t('inviteUserList.downlineStructure') || 'Downline Structure'}
                                </h4>
                              </div>
                              <div className="bg-background rounded-lg p-4 border">
                                {renderDownlineTree(downline)}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-12 text-muted-foreground">
                              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                              <p>{t('inviteUserList.failedToLoad') || 'Failed to load downline structure'}</p>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
                </Accordion>
              )}
            </CardContent>
          </Card>
        )}

        {/* Member Detail Modal */}
        <MemberDetailModal
          member={selectedMember}
          isOpen={memberDetailModalOpen}
          onClose={() => {
            setMemberDetailModalOpen(false);
            setSelectedMember(null);
          }}
        />
      </div>
    </div>
  );
}
