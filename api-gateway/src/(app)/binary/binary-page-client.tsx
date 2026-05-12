
'use client';

import GenealogyTree from '@/components/genealogy/genealogy-tree';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Member } from '@/lib/types';
import RankLegend from '@/components/genealogy/rank-legend';
import { useGenealogyContext } from '@/context/genealogy-context';
import { useI18n } from '@/lib/internationalization';

interface BinaryPageClientProps {
  onAddMember: (parentId: string, position: 'left' | 'right') => void;
  onEditMember: (member: Member) => void;
  onMemberDetail?: (member: Member) => void;
}

export default function BinaryPageClient({ onAddMember, onEditMember, onMemberDetail }: BinaryPageClientProps) {
  const { t } = useI18n();
  const context = useGenealogyContext();

  if (!context) {
    return (
      <div className="flex items-center justify-center h-full">
        {t('common.loading')}
      </div>
    );
  }

  const { loading, tree, allMembersMap, handleSetRoot, rootMember } = context;
  const isAdmin = rootMember?.isAdmin || false;

  const displayTree = loading ? null : tree;

  return (
    <>
      <div className="flex-1 min-h-0 flex flex-col">
        <ScrollArea className="h-full">
          <GenealogyTree
            node={displayTree}
            onNodeClick={handleSetRoot}
            allMembers={allMembersMap}
            onAddMember={onAddMember}
            onEditMember={isAdmin ? onEditMember : undefined}
            onMemberDetail={onMemberDetail}
            isLoading={loading}
          />
        </ScrollArea>
      </div>
      <div className="fixed bottom-20 md:bottom-4 right-4 z-10">
        <RankLegend />
      </div>
    </>
  );
}
