'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import type { Member } from '@/lib/types';

const formSchema = z
  .object({
    currentIdCard: z.string().min(1, 'Current ID card is required'),
    newPassword: z.string().min(4, 'New password must be at least 4 characters'),
    confirmPassword: z.string().min(4, 'Confirm password is required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ChangePasswordFormValues = z.infer<typeof formSchema>;

interface ChangePasswordDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  member: Member;
  onChangePassword: (memberId: string, currentIdCard: string, newPassword: string) => Promise<boolean>;
}

export default function ChangePasswordDialog({
  isOpen,
  onOpenChange,
  member,
  onChangePassword
}: ChangePasswordDialogProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingIdCard, setLoadingIdCard] = useState(false);
  const [currentIdCard, setCurrentIdCard] = useState<string | null>(null);
  const [showCurrentIdCard, setShowCurrentIdCard] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentIdCard: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const fetchCurrentIdCard = async () => {
    if (!member?.id) return;
    setLoadingIdCard(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) return;
      const response = await fetch(`/api/members/${member.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        const idCard = data.user?.idCardNumber ?? null;
        setCurrentIdCard(idCard);
        if (idCard) form.setValue('currentIdCard', idCard);
      }
    } catch (e) {
      console.error('Failed to fetch ID card:', e);
    } finally {
      setLoadingIdCard(false);
    }
  };

  useEffect(() => {
    if (isOpen && member?.id) {
      fetchCurrentIdCard();
    } else if (!isOpen) {
      form.reset();
      setCurrentIdCard(null);
      setShowCurrentIdCard(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }
  }, [isOpen, member?.id]);

  const onSubmit = async (values: ChangePasswordFormValues) => {
    setIsLoading(true);

    const success = await onChangePassword(member.id, values.currentIdCard, values.newPassword);

    setIsLoading(false);

    if (success) {
      toast({
        title: 'Password Changed',
        description: `Password for ${member.fullName} has been successfully updated.`,
      });
      onOpenChange(false);
      form.reset();
    } else {
      toast({
        variant: 'destructive',
        title: 'Password Change Failed',
        description: 'Failed to update the password. Please try again.',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            {t('admin.users.changePassword') || 'Change Password'}
          </DialogTitle>
          <DialogDescription>
            {t('profile.changePasswordDescription') || 'Update password using ID card number for'} {member.fullName} ({member.memberId})
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="currentIdCard"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('profile.currentIdCard') || 'Current ID Card'}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showCurrentIdCard ? "text" : "password"}
                        placeholder={loadingIdCard ? (t('common.asterisk') || '****') : (t('profile.currentIdCardPlaceholder') || 'Enter current ID card number')}
                        {...field}
                        disabled={loadingIdCard || true}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowCurrentIdCard(!showCurrentIdCard)}
                        disabled={loadingIdCard}
                      >
                        {showCurrentIdCard ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('profile.newPassword') || 'New Password'}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        placeholder={t('profile.newPasswordPlaceholder') || 'Enter new password'}
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('profile.confirmPassword') || 'Confirm Password'}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder={t('profile.confirmPasswordPlaceholder') || 'Confirm new password'}
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset();
                  onOpenChange(false);
                }}
                disabled={isLoading}
              >
                {t('common.cancel') || 'Cancel'}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.loading') || 'Saving...'}
                  </>
                ) : (
                  t('common.save') || 'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}