
'use client';

import GenealogyTree from '@/components/genealogy/genealogy-tree';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import type { Member } from '@/lib/types';
import RankLegend from '@/components/genealogy/rank-legend';
import { useGenealogyContext } from '@/context/genealogy-context';
import { useAuthContext } from '@/context/auth-context';
import { useI18n } from '@/lib/internationalization';
import { ArrowUp } from 'lucide-react';

interface BinaryPageClientProps {
  onAddMember: (parentId: string, position: 'left' | 'right') => void;
  onEditMember: (member: Member) => void;
  onMemberDetail: (member: Member) => void;
  onSetRoot?: (id: string) => void;
}

export default function BinaryPageClient({ onAddMember, onEditMember, onMemberDetail, onSetRoot }: BinaryPageClientProps) {
  const { t } = useI18n();
  const context = useGenealogyContext();
  const { user: authUser } = useAuthContext();

  if (!context) {
    return (
      <div className="flex items-center justify-center h-full">
        {t('common.loading')}
      </div>
    );
  }

  const { loading, tree, allMembersMap, handleSetRoot: contextHandleSetRoot, rootMember } = context;
  const handleSetRoot = onSetRoot || contextHandleSetRoot;
  // Use authenticated user's admin status, not rootMember (which changes when viewing member downlines)
  const isAdmin = authUser?.isAdmin || false;
  // All members can now add new members to their downline (not just admin/stockist)
  const canAddMember = true; // All authenticated users can add members

  const displayTree = loading ? null : tree;

  const { handleGoUpline } = context;
  const hasParent = rootMember?.placementParentId;

  return (
    <>
      <div className="flex-1 min-h-0 flex flex-col" key={rootMember?.id || 'no-root'}>
        <ScrollArea className="h-full">
          <GenealogyTree
            key={`tree-${rootMember?.id || 'loading'}`}
            node={displayTree}
            onNodeClick={handleSetRoot}
            allMembers={allMembersMap}
            onAddMember={canAddMember ? onAddMember : undefined}
            onEditMember={isAdmin ? onEditMember : undefined}
            onMemberDetail={onMemberDetail}
            isLoading={loading}
          />
        </ScrollArea>
      </div>
      <div className="fixed bottom-20 md:bottom-4 right-4 z-10 flex flex-col gap-2 items-end">
        <RankLegend />
      </div>
    </>
  );
}
