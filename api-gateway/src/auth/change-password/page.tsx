
'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2, KeyRound, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { useAuthContext } from '@/context/auth-context';
import { useI18n } from '@/lib/internationalization';
import PasswordStrengthIndicator from '@/components/auth/password-strength-indicator';
import Link from 'next/link';
import { changePassword } from './actions';

const getFormSchema = (t: (key: string) => string) => z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters.')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
    .regex(/[0-9]/, 'Password must contain at least one number.')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character.'),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: t('changePassword.passwordMismatch'),
  path: ['confirmPassword'], // path to show error
});

type ChangePasswordFormValues = z.infer<ReturnType<typeof getFormSchema>>;

export default function ChangePasswordPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuthContext();
  const { t } = useI18n();

  const formSchema = getFormSchema(t);

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const watchedNewPassword = useWatch({ control: form.control, name: 'newPassword' });

  const onSubmit = async (values: ChangePasswordFormValues) => {
    setIsLoading(true);

    if (!user || !user.id) {
       toast({
        variant: 'destructive',
        title: t('changePassword.errorTitle'),
        description: t('changePassword.errorAuth'),
      });
      setIsLoading(false);
      return;
    }

    try {
      const result = await changePassword(user.id, values.currentPassword, values.newPassword);

      if (result.success) {
        toast({
          title: t('changePassword.successTitle'),
          description: t('changePassword.successDescription'),
        });
        form.reset();
      } else {
        let description = t('changePassword.errorGeneric');
        if (result.error?.includes('Invalid current password')) {
          description = t('changePassword.errorWrongPassword');
        }
        toast({
          variant: 'destructive',
          title: t('changePassword.errorTitle'),
          description,
        });
      }

    } catch (error: any) {
      console.error('Password change failed:', error);
      toast({
        variant: 'destructive',
        title: t('changePassword.errorTitle'),
        description: t('changePassword.errorGeneric'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 p-4 pt-6 sm:p-6 md:p-8 flex justify-center items-start">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <KeyRound />
                {t('changePassword.title')}
              </CardTitle>
              <CardDescription>
                {t('changePassword.description')}
              </CardDescription>
            </div>
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('changePassword.currentPasswordLabel')}</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
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
                    <FormLabel>{t('changePassword.newPasswordLabel')}</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <PasswordStrengthIndicator password={watchedNewPassword} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('changePassword.confirmPasswordLabel')}</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading} className="w-full" icon={isLoading ? "loading" : KeyRound}>
                {isLoading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  t('changePassword.updatePassword')
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
