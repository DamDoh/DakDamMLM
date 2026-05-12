
'use client';

import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowUp, Home, Search, Loader2, ChevronsUpDown, ChevronRight, ChevronLeft, ShieldCheck } from 'lucide-react';
import { Label } from '@/components/ui/label';
import TeamPerformanceChart from './team-performance-chart';
import { Skeleton } from '../ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useGenealogyContext } from '@/context/genealogy-context';
import { useI18n } from '@/lib/internationalization';


const MemberInfoPanelSkeleton = () => (
    <div className="bg-background p-4">
        <Card>
          <div className="flex justify-end p-2">
              <Skeleton className="w-9 h-9" />
          </div>
          <div className="px-4 pb-4 animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="space-y-3">
                     <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-[140px]" />
                        <Skeleton className="h-5 w-[200px]" />
                    </div>
                     <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-[140px]" />
                        <div className="flex w-full">
                           <Skeleton className="h-10 w-full" />
                           <Skeleton className="h-10 w-12" />
                        </div>
                    </div>
                    <div className="flex flex-col items-center justify-center space-y-2 h-full pt-4 md:pt-2">
                        <Skeleton className="h-10 w-full max-w-xs" />
                        <Skeleton className="h-10 w-full max-w-xs" />
                    </div>
                </div>
                <div className="flex flex-col justify-between h-full">
                    <Skeleton className="h-[150px] w-full" />
                    <div className="flex items-center justify-between w-full p-2 bg-muted/50 rounded-lg mt-4">
                        <Skeleton className="h-12 w-1/2" />
                        <Skeleton className="h-12 w-1/2" />
                    </div>
                </div>
            </div>
          </div>
        </Card>
    </div>
)


export default function MemberInfoPanel() {
  const context = useGenealogyContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const { t } = useI18n();

  const {
    loading,
    rootMember,
    isSearching,
    leftTeamPV,
    rightTeamPV,
    handleSearch,
    handleGoUpline,
    handleGoToTop,
    handleNavigateLeft,
    handleNavigateRight
  } = context || {};


  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery || !handleSearch) return;
    handleSearch(searchQuery);
  };
  
  const loggedInUserIsAdmin = context?.members.find(m => m.id === context.userId)?.isAdmin || false;


  if (loading || !rootMember || !context) {
      return <MemberInfoPanelSkeleton />;
  }
  
  const fullName = `${rootMember.firstName} ${rootMember.surname}`;

  return (
    <div className="bg-background p-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="bg-card border-border">
          <CardHeader className="p-4 flex flex-row items-center justify-between">
             <div className="flex items-center gap-2">
                <Label htmlFor="current-member" className="font-bold shrink-0 text-muted-foreground">{t('genealogy.currentMember')}:</Label>
                <span id="current-member" className="text-sm font-medium truncate">{rootMember.memberId} - {fullName}</span>
             </div>
             <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-9 p-0">
                    <ChevronsUpDown className="h-4 w-4" />
                    <span className="sr-only">Toggle</span>
                </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <div className="px-4 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* Left Column: Member Info & Search */}
                  <div className="space-y-3">
                      {loggedInUserIsAdmin && (
                          <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 text-primary-foreground">
                              <ShieldCheck className="h-5 w-5 text-primary" />
                              <p className="text-sm font-semibold text-primary">Administrator View</p>
                          </div>
                      )}
                      
                      <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                        <Label htmlFor="search-ai" className="font-bold w-[140px] text-right shrink-0 text-muted-foreground">{t('genealogy.findMember')}:</Label>
                          <div className="flex w-full">
                              <Input
                                  id="search-ai"
                                  type="search"
                                  placeholder={t('genealogy.findPlaceholder')}
                                  className="rounded-r-none focus-visible:ring-offset-0"
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                              />
                              <Button type="submit" variant="outline" size="sm" className="rounded-l-none border-l-0" disabled={isSearching}>
                                  {isSearching ? <Loader2 className="animate-spin" /> : <Search className="h-4 w-4" />}
                              </Button>
                          </div>
                      </form>
                      <div className="flex flex-col items-center justify-center space-y-2 h-full pt-4 md:pt-2">
                          <Button variant="outline" onClick={handleGoUpline} disabled={!rootMember.placementParentId} className="w-full max-w-xs">
                              <ArrowUp className="mr-2 h-4 w-4" /> {t('genealogy.goUpline')}
                          </Button>
                          <Button variant="outline" onClick={handleGoToTop} className="w-full max-w-xs">
                              <Home className="mr-2 h-4 w-4" /> {t('genealogy.goToTop')}
                          </Button>
                      </div>
                  </div>

                  {/* Right Column: Chart and Team Info */}
                  <div className="flex flex-col justify-between h-full">
                      <TeamPerformanceChart leftData={leftTeamPV || 0} rightData={rightTeamPV || 0} />
                      <div className="flex items-center justify-between w-full p-2 bg-muted/50 rounded-lg mt-4">
                          <div className="flex items-center gap-2">
                              <Button variant="ghost" size="icon" onClick={handleNavigateLeft} disabled={!rootMember.children.left}><ChevronLeft className="h-8 w-8 text-primary" /></Button>
                              <div className="text-left">
                                  <p className="text-sm font-semibold text-muted-foreground">{t('genealogy.leftTeam')}</p>
                                  <p className="font-bold">{rootMember.teamSize.left} <span className="font-normal">{t('genealogy.members')}</span></p>
                                  <p className="text-sm font-semibold text-muted-foreground">{t('genealogy.pvLeft')}</p>
                                  <p className="font-bold">{(leftTeamPV || 0).toLocaleString()} <span className="font-normal">PV</span></p>
                              </div>
                          </div>
                          <div className="flex items-center gap-2">
                              <div className="text-right">
                                  <p className="text-sm font-semibold text-muted-foreground">{t('genealogy.rightTeam')}</p>
                                  <p className="font-bold">{rootMember.teamSize.right} <span className="font-normal">{t('genealogy.members')}</span></p>
                                  <p className="text-sm font-semibold text-muted-foreground">{t('genealogy.pvRight')}</p>
                                  <p className="font-bold">{(rightTeamPV || 0).toLocaleString()} <span className="font-normal">PV</span></p>
                              </div>
                              <Button variant="ghost" size="icon" onClick={handleNavigateRight} disabled={!rootMember.children.right}><ChevronRight className="h-8 w-8 text-primary" /></Button>
                          </div>
                      </div>
                  </div>
              </div>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
