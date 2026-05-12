
'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Info } from 'lucide-react';
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

  const handleDetailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDetailClick && member) {
      onDetailClick(member);
    }
  };

  const handleNodeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onNodeClick(member.id);
  };

  const fullName = `${member.firstName || ''} ${member.surname || ''}`.trim();
  const placeholder = imageMap.get(member.avatarUrl);
  const avatarSrc = placeholder?.imageUrl || member.avatarUrl;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex flex-col items-center gap-1 cursor-pointer group relative transition-all duration-300 hover:scale-105",
              !member.active && "opacity-75"
            )}
            onClick={handleNodeClick}
          >
      <div className="relative">
        {/* Rank name text above avatar */}
        {member.rank && member.rank !== 'Member' && (
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
            <p className="text-xs font-semibold text-foreground whitespace-nowrap bg-background/80 px-1 rounded">
              {member.rank}
            </p>
          </div>
        )}
        <div className="relative">
          {member.rank && member.rank !== 'Member' ? (
            /* Show only rank logo when rank is selected */
            <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center">
              <RankBadge rank={member.rank} className="w-20 h-20 rounded-full" />
            </div>
          ) : (
            /* Show avatar when no rank or Member rank */
            <Avatar className="w-20 h-20 border-4" style={{ borderColor: member.active ? 'hsl(var(--primary))' : 'hsl(var(--destructive))' }}>
              <AvatarImage 
                src={avatarSrc} 
                alt={fullName} 
                className={cn(!member.active && "grayscale")}
                {...(placeholder && { 'data-ai-hint': placeholder['data-ai-hint'] })}
              />
              <AvatarFallback>{(member.firstName?.charAt(0) ?? '?').toUpperCase()}</AvatarFallback>
            </Avatar>
          )}
        </div>
        {/* Action buttons container */}
        <div className="absolute -right-2 -bottom-2 flex gap-1">
          {onDetailClick && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-background shadow-md"
              onClick={handleDetailClick}
              aria-label={`View details of ${fullName}`}
            >
              <Info className="h-4 w-4" />
            </Button>
          )}
          {onEditClick && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-background shadow-md"
              onClick={handleEditClick}
              aria-label={`Edit ${fullName}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="text-center">
        <p className="font-bold text-sm truncate w-32">{fullName || 'Unnamed Member'}</p>
        <p className="text-xs text-muted-foreground">{member.memberId}</p>
      </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Click to view {fullName}'s downline</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
