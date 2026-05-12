
'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Plus, Pencil } from 'lucide-react';
import type { Member } from '@/lib/types';
import RankBadge from './rank-badge';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useI18n } from '@/lib/internationalization';
import placeholderData from '@/lib/placeholder-images.json';

const imageMap = new Map(placeholderData.images.map(img => [img.id, img]));

interface MemberNodeProps {
  member?: Member;
  onNodeClick: (id: string) => void;
  onAddClick?: () => void;
  onEditClick?: (member: Member) => void;
  onDetailClick?: (member: Member) => void;
}

export default function MemberNode({ member, onNodeClick, onAddClick, onEditClick, onDetailClick }: MemberNodeProps) {
  const { t } = useI18n();

  if (!member) {
    return (
       <div className="flex flex-col items-center gap-2">
        <Button variant="ghost" className="w-20 h-20 rounded-full border-2 border-dashed bg-gray-100 flex items-center justify-center" onClick={onAddClick}>
            <Plus className="h-8 w-8 text-gray-400" />
        </Button>
        <p className="text-xs text-muted-foreground">{t('genealogy.addMember')}</p>
      </div>
    );
  }

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent onNodeClick from firing
    if (onEditClick) {
      onEditClick(member);
    }
  };

  const fullName = `${member.firstName || ''} ${member.surname || ''}`.trim();
  const placeholder = imageMap.get(member.avatarUrl);
  const avatarSrc = placeholder?.imageUrl || member.avatarUrl;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 cursor-pointer group relative",
        !member.active && "opacity-75"
      )}
      onClick={() => onNodeClick(member.id)}
    >
      <div className="relative">
        <Avatar className="w-20 h-20 border-4" style={{ borderColor: member.active ? 'hsl(var(--primary))' : 'hsl(var(--destructive))' }}>
          <AvatarImage 
            src={avatarSrc} 
            alt={fullName} 
            className={cn(!member.active && "grayscale")}
            {...(placeholder && { 'data-ai-hint': placeholder['data-ai-hint'] })}
          />
          <AvatarFallback>{(member.firstName?.charAt(0) ?? '?').toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="absolute -top-2 left-1/2 -translate-x-1/2">
          <RankBadge rank={member.rank} />
        </div>
         {onEditClick && (
          <Button
            variant="outline"
            size="icon"
            className="absolute -right-2 -bottom-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-background"
            onClick={handleEditClick}
            aria-label={`Edit ${fullName}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="text-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
                <p className="font-bold text-sm truncate w-32">{fullName || 'Unnamed Member'}</p>
            </TooltipTrigger>
            <TooltipContent>
              <p>{fullName || 'Unnamed Member'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <p className="text-xs text-muted-foreground">{member.memberId}</p>
      </div>
    </div>
  );
}
