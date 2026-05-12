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
import { Loader2, LogIn, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LanguageSelector } from '@/components/ui/language-selector';
import { useI18n } from '@/lib/internationalization';
import { useAuthContext } from '@/context/auth-context';
import { useCompany } from '@/context/company-context';
import { PhoneNumberInput } from '@/components/ui/phone-number-input';
import { isValidPhoneNumber } from 'react-phone-number-input';

const createFormSchema = (allowEmail: boolean, allowPhone: boolean) => {
  return z.object({
    email: z.string().email('Please enter a valid email address.').optional(),
    phoneNumber: z.string().refine(isValidPhoneNumber, {
      message: 'A valid phone number is required.'
    }).optional(),
    password: z.string().min(1, 'Password is required.'),
  }).refine(
    (data) => (allowEmail && data.email) || (allowPhone && data.phoneNumber),
    {
      message: 'Please provide either email or phone number.',
      path: allowEmail ? ['email'] : ['phoneNumber'],
    }
  );
};

type CompanyLoginFormValues = {
  email?: string;
  phoneNumber?: string;
  password: string;
};

export default function CompanyLogin() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { login } = useAuthContext();
  const { company } = useCompany();

  const allowEmailLogin = company?.allowEmailLogin ?? true;
  const allowPhoneLogin = company?.allowPhoneLogin ?? true;

  const formSchema = createFormSchema(allowEmailLogin, allowPhoneLogin);

  const form = useForm<CompanyLoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      phoneNumber: '',
      password: '',
    },
  });

  const onSubmit = async (values: CompanyLoginFormValues) => {
    setIsLoading(true);

    try {
      // Determine login identifier
      const loginIdentifier = values.email || values.phoneNumber || '';

      // Use the auth context login method
      const success = await login(loginIdentifier, values.password);
      if (!success) {
        throw new Error('Invalid credentials.');
      }

      toast({
        title: 'Login Successful',
        description: 'Welcome back!',
      });

      router.push('/dashboard');

    } catch (error: any) {
      let errorMessage = 'Invalid credentials. Please try again.';
      if (error.message.includes('User not found')) {
        errorMessage = 'No account found with that identifier.';
      }
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loginPageConfig = company?.loginPageConfig;
  const customTitle = loginPageConfig?.title || `${company?.name || 'DakDam'} Login`;
  const customSubtitle = loginPageConfig?.subtitle || 'Enter your credentials to access your account.';
  const backgroundImage = loginPageConfig?.backgroundImageUrl;
  const showLanguageSelector = loginPageConfig?.showLanguageSelector ?? true;

  return (
    <div
      className="flex flex-col min-h-screen bg-background"
      style={backgroundImage ? {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
      <header className="bg-card/80 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            {company?.logoUrl && (
              <img
                src={company.logoUrl}
                alt={`${company.name} logo`}
                className="h-8 w-auto"
              />
            )}
            <div className="text-foreground text-xl font-bold">
              {company?.name || t('platform.name')}
            </div>
          </div>
          {showLanguageSelector && <LanguageSelector />}
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm bg-card/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <LogIn /> {customTitle}
            </CardTitle>
            <CardDescription>
              {customSubtitle}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {allowEmailLogin && (
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input placeholder="you@company.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {allowPhoneLogin && (
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <PhoneNumberInput placeholder="+12345678900" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {!allowEmailLogin && !allowPhoneLogin && (
                  <div className="text-center text-muted-foreground">
                    No login methods are currently enabled for this company.
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
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
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full"
                  style={company?.primaryColor ? {
                    backgroundColor: company.primaryColor,
                  } : undefined}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            </Form>

            <div className="mt-6 text-center text-sm">
              {'Don\'t have an account? '}
              <Link href="/register" className="underline">
                Sign up
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Custom CSS injection */}
      {company?.customCss && (
        <style dangerouslySetInnerHTML={{ __html: company.customCss }} />
      )}
    </div>
  );
}