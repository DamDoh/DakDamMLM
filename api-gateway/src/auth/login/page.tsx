
'use client';

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

const formSchema = z.object({
  loginIdentifier: z.string().min(1, 'Email or Phone Number is required.'),
  password: z.string().min(1, 'Password is required.'),
});

type LoginFormValues = z.infer<typeof formSchema>;

export default function LoginPage() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { login } = useAuthContext();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      loginIdentifier: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);

    try {
      // Use the auth context login method - it handles user lookup via API
      const success = await login(values.loginIdentifier, values.password);
      if (!success) {
        throw new Error('Invalid credentials.');
      }

      toast({
        title: t('login.successTitle'),
        description: t('login.successDescription'),
      });

      // Navigate to dashboard - the auth context has user info
      router.push('/dashboard');

    } catch (error: any) {
      let errorMessage = t('login.errorInvalid');
      if (error.message.includes('User not found')) {
        errorMessage = 'No account is associated with that identifier.';
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
         <div className="flex items-center justify-between p-4">
           <div className="text-foreground text-xl font-bold">
             {t('login.portalTitle')}
           </div>
           <LanguageSelector />
         </div>
       </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <LogIn /> {t('login.title')}
            </CardTitle>
            <CardDescription>
              {t('login.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="loginIdentifier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('login.emailOrPhoneLabel')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('login.emailOrPhonePlaceholder')} {...field} />
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
                          <Input type={showPassword ? "text" : "password"} placeholder="********" {...field} />
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
