
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
import { Loader2, Mail, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/internationalization';
import { LanguageSelector } from '@/components/ui/language-selector';
import Image from 'next/image';

type ForgotPasswordFormValues = {
  email: string;
};

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const { t } = useI18n();
  
  const formSchema = z.object({
    email: z.string().email(t('forgotPassword.emailRequired')),
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setIsLoading(true);

    try {
      // Call the API to request password reset
      const response = await fetch(`/api/auth/reset-password?email=${encodeURIComponent(values.email)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to request password reset');
      }

      // Always show success message (for security, don't reveal if email exists)
      setIsSubmitted(true);
      toast({
        title: t('forgotPassword.success.title') || 'Success',
        description: result.message || t('forgotPassword.successMessage', { email: values.email }),
      });

    } catch (error: any) {
      console.error('Password reset failed:', error);
      toast({
        variant: 'destructive',
        title: t('forgotPassword.error.title'),
        description: error.message || t('forgotPassword.error.description'),
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
                  alt="DakDam Logo"
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
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Mail /> {t('forgotPassword.title')}
            </CardTitle>
            <CardDescription>
                {isSubmitted 
                    ? t('forgotPassword.submittedDescription')
                    : t('forgotPassword.description')
                }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSubmitted ? (
                <div className="flex flex-col items-center text-center gap-4">
                    <CheckCircle className="h-16 w-16 text-green-500" />
                    <p className="text-muted-foreground">
                        {t('forgotPassword.successMessage', { email: form.getValues('email')})}
                    </p>
                     <Button asChild className="w-full">
                        <Link href="/auth/login">
                           {t('forgotPassword.returnToLogin')}
                        </Link>
                    </Button>
                </div>
            ) : (
                <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>{t('login.emailOrPhoneLabel')}</FormLabel>
                        <FormControl>
                            <Input type="email" placeholder={t('forgotPassword.emailPlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <Button type="submit" disabled={isLoading} className="w-full" icon={isLoading ? Loader2 : Mail}>
                      {isLoading ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        t('forgotPassword.sendLinkButton')
                      )}
                    </Button>
                </form>
                </Form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
