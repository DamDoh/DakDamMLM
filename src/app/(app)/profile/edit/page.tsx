'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { Loader2, User, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useGenealogyContext } from '@/context/genealogy-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/internationalization';

const profileFormSchema = z.object({
  firstName: z.string()
    .min(2, 'First name must be at least 2 characters.')
    .max(50, 'First name must be less than 50 characters.')
    .regex(/^[a-zA-Z\s'-]+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes.'),
  surname: z.string()
    .min(2, 'Last name must be at least 2 characters.')
    .max(50, 'Last name must be less than 50 characters.')
    .regex(/^[a-zA-Z\s'-]+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes.'),
  phoneNumber: z.string()
    .min(10, 'Phone number must be at least 10 characters.')
    .max(15, 'Phone number must be less than 15 characters.')
    .regex(/^[\+]?[1-9][\d]{0,14}$/, 'Please enter a valid phone number.'),
  email: z.string()
    .optional()
    .refine((val) => !val || val === '' || z.string().email().safeParse(val).success,
      'Please enter a valid email address.')
    .refine((val) => !val || val.length <= 100, 'Email must be less than 100 characters.'),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function EditProfilePage() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const context = useGenealogyContext();
  const { rootMember: user, handleUpdateMember } = context || { rootMember: null, handleUpdateMember: async () => false };

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: '',
      surname: '',
      phoneNumber: '',
      email: '',
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.firstName,
        surname: user.surname,
        phoneNumber: user.phoneNumber,
        email: user.email || '',
      });
    }
  }, [user, form]);

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user || !handleUpdateMember) return;

    setIsLoading(true);

    try {
      // Additional client-side validation
      if (values.firstName.trim() === values.surname.trim()) {
        toast({
          variant: 'destructive',
          title: t('profile.validationError'),
          description: t('profile.nameSameError'),
        });
        setIsLoading(false);
        return;
      }

      // Check for conflicts with existing users before updating
      const { checkProfileConflicts } = await import('@/services/server-actions');
      const conflicts = await checkProfileConflicts(user.id, { phoneNumber: values.phoneNumber, email: values.email || null });

      if (conflicts.phoneConflict) {
        toast({
          variant: 'destructive',
          title: t('profile.phoneConflict'),
          description: t('profile.phoneConflictDesc'),
        });
        setIsLoading(false);
        return;
      }

      if (conflicts.emailConflict) {
        toast({
          variant: 'destructive',
          title: t('profile.emailConflict'),
          description: t('profile.emailConflictDesc'),
        });
        setIsLoading(false);
        return;
      }

      const success = await handleUpdateMember(user.id, {
        firstName: values.firstName.trim(),
        surname: values.surname.trim(),
        phoneNumber: values.phoneNumber.trim(),
        email: values.email?.trim() || null,
      });

      if (success) {
        toast({
          title: t('profile.updateSuccess'),
          description: t('profile.updateSuccessDesc'),
        });
        // Redirect back to profile page after successful update
        router.push('/profile');
      } else {
        toast({
          variant: 'destructive',
          title: t('profile.updateFailed'),
          description: t('profile.updateFailedDesc'),
        });
      }
    } catch (error) {
      console.error('Profile update failed:', error);
      toast({
        variant: 'destructive',
        title: t('profile.updateFailed'),
        description: t('profile.updateFailedDesc'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex-1 p-4 pt-6 sm:p-6 md:p-8 flex justify-center items-start">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 pt-6 sm:p-6 md:p-8 flex justify-center items-start">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User />
                {t('profile.editProfile')}
              </CardTitle>
              <CardDescription>
                {t('profile.updatePersonalInfo')}
              </CardDescription>
            </div>
            <Link href="/profile">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                {t('profile.backToProfile')}
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('profile.firstName')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="surname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('profile.lastName')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('profile.phoneNumber')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('profile.phoneNumber')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('profile.emailOptional')}</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder={t('profile.email')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    {t('profile.updating')}
                  </>
                ) : (
                  t('profile.updateProfile')
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}