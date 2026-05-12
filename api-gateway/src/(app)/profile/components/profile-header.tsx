'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Upload, KeyRound, ArrowUpCircle } from 'lucide-react';
import { useI18n } from '@/lib/internationalization';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { Member } from '@/lib/types';
import placeholderData from '@/lib/placeholder-images.json';

const imageMap = new Map(placeholderData.images.map(img => [img.id, img]));

interface ProfileHeaderProps {
  user: Member;
  isAdmin: boolean;
  onUpgradeAccount: () => Promise<void>;
  onAvatarUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export default function ProfileHeader({ user, isAdmin, onUpgradeAccount, onAvatarUpload }: ProfileHeaderProps) {
  const { t } = useI18n();

  const placeholder = imageMap.get(user.avatarUrl);
  const avatarSrc = placeholder?.imageUrl || user.avatarUrl;

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-24 h-24 group shrink-0">
            <Avatar className="w-24 h-24 border-4 border-primary shadow-md">
              <AvatarImage src={avatarSrc} alt={user.fullName} />
              <AvatarFallback>{user.fullName.charAt(0)}</AvatarFallback>
            </Avatar>
            <label htmlFor="avatar-upload" className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <Upload className="h-6 w-6 text-white" />
              <input id="avatar-upload" type="file" className="hidden" accept="image/*" onChange={onAvatarUpload} />
            </label>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <CardTitle className="text-3xl">{user.fullName}</CardTitle>
            {!isAdmin && <p className="text-muted-foreground">{user.memberId}</p>}
            <div className="mt-2 flex justify-center sm:justify-start items-center gap-2">
              <Button asChild variant="outline" size="sm" icon="edit">
                <Link href="/profile/edit">Edit Profile</Link>
              </Button>
              <Button asChild variant="outline" size="sm" icon={KeyRound}>
                <Link href="/auth/change-password">Change Password</Link>
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isAdmin && user.accountType === 'Customer' && (
          <Card className="bg-primary/10 border-primary/50 text-center">
            <CardContent className="p-6">
              <h3 className="font-bold text-lg mb-2">{t('profile.readyToEarn')}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t('profile.currentlyCustomer')}</p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button icon={ArrowUpCircle}>
                    {t('profile.upgradeToDistributor')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('profile.confirmAccountUpgrade')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('profile.upgradeConfirmation')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={onUpgradeAccount}>{t('profile.confirmUpgrade')}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}