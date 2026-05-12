'use client';

// Prevent static generation - this page requires client-side only features
export const dynamic = 'force-dynamic';

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
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LanguageSelector } from '@/components/ui/language-selector';
import { useI18n } from '@/lib/internationalization';
import { useAuthContext } from '@/context/auth-context';
import Image from 'next/image';

type LoginFormValues = {
  memberId: string;
  password: string;
};

export default function LoginPage() {
  const { toast } = useToast();
  const { t } = useI18n();
  
  const formSchema = z.object({
    memberId: z.string().min(1, t('login.memberIdRequired')),
    password: z.string().min(1, t('login.passwordRequired')),
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { login, user } = useAuthContext();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      memberId: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);

    try {
      // Use the auth context login method - it handles user lookup via API
      const success = await login(values.memberId, values.password);
      if (!success) {
        throw new Error('Invalid credentials.');
      }

      toast({
        title: t('login.successTitle'),
        description: t('login.successDescription'),
      });

      // Navigate to appropriate dashboard based on user role
      // Admins and super admins get advanced dashboard, customers get simple dashboard
      const dashboardPath = user?.isAdmin ? '/admin/dashboard' : '/dashboard';
      router.push(dashboardPath);

    } catch (error: any) {
      let errorMessage = t('login.errorInvalid');
      if (error.message.includes('User not found')) {
        errorMessage = t('login.errorNoAccount');
      } else if (error.message.includes('Invalid password')) {
        errorMessage = t('login.errorInvalid');
      }
       // Error logging removed for production
       toast({
         variant: 'destructive',
         title: t('login.errorTitle'),
         description: errorMessage,
       });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="bg-card border-b border-border">
         <div className="flex items-center justify-between h-16 px-4">
           <div className="text-foreground text-xl font-bold flex items-center h-full">
             {/* {t('login.portalTitle')} */}
             <div className="relative h-16 w-16">
                <Image
                  src="/images/LOGO.png"
                  alt={t('login.logoAlt')}
                  fill
                  className="object-contain"
                  priority
                  sizes="64px"
                />
             </div>
           </div>
           <LanguageSelector />
         </div>
       </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-4 pb-6">
            {/* Logo */}
            <div className="flex justify-center -mt-4 mb-4">
              <div className="relative w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center">
                <Image
                  src="/images/logo%203s.png"
                  alt={t('login.systemLogoAlt')}
                  fill
                  className="object-contain drop-shadow-md"
                  priority
                  sizes="(max-width: 640px) 176px, 208px"
                  unoptimized
                />
              </div>
            </div>
            <div className="text-center pt-4">
              <CardDescription className="text-base">
                {t('login.description')}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="memberId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('login.memberIdLabel')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('login.memberIdPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('login.passwordLabel')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type={showPassword ? "text" : "password"} placeholder={t('login.passwordPlaceholder')} {...field} />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <div className="flex items-center justify-end">
                    <Link
                        href="/auth/forgot-password"
                        className="text-sm font-medium text-primary hover:underline"
                    >
                        {t('login.forgotPassword')}
                    </Link>
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full"
                  icon={isLoading ? "loading" : "login"}
                >
                  {isLoading ? (
                    t('login.signingIn')
                  ) : (
                    t('login.signIn')
                  )}
                </Button>
              </form>
            </Form>
            <div className="mt-6 text-center text-sm">
                {t('login.noAccount')}{' '}
                <Link href="/register" className="underline">
                    {t('login.signUp')}
                </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
