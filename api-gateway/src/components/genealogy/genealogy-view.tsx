
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import MemberInfoPanel from '@/components/genealogy/member-info-panel';
// @ts-ignore - Next.js route groups with parentheses in path
import BinaryPageClient from '../../../(app)/binary/binary-page-client';
import AddMemberDialog from '@/components/genealogy/add-member-dialog';
import EditMemberDialog from '@/components/genealogy/edit-member-dialog';
import MemberDetailModal from '@/components/genealogy/member-detail-modal';
import { useGenealogyContext } from '@/context/genealogy-context';
import type { Member } from '@/lib/types';
import { useI18n } from '@/lib/internationalization';
import { Loader2 } from 'lucide-react';

export default function GenealogyView() {
  const { t } = useI18n();
  const context = useGenealogyContext();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [addMemberProps, setAddMemberProps] = useState<{ parentId: string; position: 'left' | 'right' } | null>(null);

  const [editMemberDialogOpen, setEditMemberDialogOpen] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);

  const [memberDetailModalOpen, setMemberDetailModalOpen] = useState(false);
  const [selectedMemberForDetail, setSelectedMemberForDetail] = useState<Member | null>(null);

  const { rootMember, allMembersMap, handleUpdateMember, loading } = context || { rootMember: null, allMembersMap: new Map(), handleUpdateMember: async () => false, loading: true };

  useEffect(() => {
    if (rootMember) {
      const currentIdInUrl = searchParams.get('id');
      if (rootMember.id !== currentIdInUrl) {
        const params = new URLSearchParams(searchParams.toString());
        params.set('id', rootMember.id);
        router.replace(`/binary?${params.toString()}`);
      }
    }
  }, [rootMember, router, searchParams]);

  const handleOpenAddMemberDialog = useCallback((parentId: string, position: 'left' | 'right') => {
    setAddMemberProps({ parentId, position });
    setAddMemberDialogOpen(true);
  }, []);

  const handleOpenEditMemberDialog = useCallback((member: Member) => {
    setEditMember(member);
    setEditMemberDialogOpen(true);
  }, []);

  const handleOpenMemberDetail = useCallback((member: Member) => {
    setSelectedMemberForDetail(member);
    setMemberDetailModalOpen(true);
  }, []);

  if (loading || !context || !rootMember) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('genealogy.loading')}</p>
        </div>
      </div>
    );
  }
  
  const parentForDialog = addMemberProps ? allMembersMap?.get(addMemberProps.parentId) : null;
  const parentFullNameForDialog = parentForDialog ? `${parentForDialog.firstName} ${parentForDialog.surname}`: '';

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <header className="bg-accent">
        <MemberInfoPanel />
        <div className="bg-primary/50 h-1.5" />
      </header>
      <main className="flex-1 flex flex-col min-h-0 relative">
        <BinaryPageClient
          onAddMember={handleOpenAddMemberDialog}
          onEditMember={handleOpenEditMemberDialog}
          onMemberDetail={handleOpenMemberDetail}
        />
      </main>

      {addMemberProps && allMembersMap && (
        <AddMemberDialog
          isOpen={addMemberDialogOpen}
          onOpenChange={setAddMemberDialogOpen}
          parentId={addMemberProps.parentId}
          position={addMemberProps.position}
          parentFullName={parentFullNameForDialog}
        />
      )}

      {editMember && handleUpdateMember && (
        <EditMemberDialog
          isOpen={editMemberDialogOpen}
          onOpenChange={setEditMemberDialogOpen}
          member={editMember}
          onUpdateMember={handleUpdateMember}
        />
      )}

      <MemberDetailModal
        member={selectedMemberForDetail}
        isOpen={memberDetailModalOpen}
        onClose={() => setMemberDetailModalOpen(false)}
      />
    </div>
  );
}
