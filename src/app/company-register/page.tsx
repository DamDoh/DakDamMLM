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
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Building2, Globe, Mail, Phone, Upload, User, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PhoneNumberInput } from '@/components/ui/phone-number-input';
import { isValidPhoneNumber } from 'react-phone-number-input';
import { LanguageSelector } from '@/components/ui/language-selector';
import { createCompanyDocument } from './actions';
import { useI18n } from '@/lib/internationalization';
import Image from 'next/image';

type CompanyFormValues = {
  name: string;
  domain?: string;
  description?: string;
  website?: string;
  email: string;
  phone: string;
  taxId?: string;
  licenseNumber?: string;
  industry?: string;
  country: string;
  currency: string;
  timezone: string;
  logoUrl?: string;
  // Admin account fields
  adminFirstName: string;
  adminSurname: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
  adminConfirmPassword: string;
};

export default function CompanyRegisterPage() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();

  const companySchema = useMemo(() => z.object({
    name: z.string().min(2, t('companyRegister.validation.companyNameMin')),
    domain: z.string().optional(),
    description: z.string().optional(),
    website: z.string().url(t('companyRegister.validation.validWebsite')).optional().or(z.literal('')),
    email: z.string().email(t('companyRegister.validation.validEmail')),
    phone: z.string().refine(isValidPhoneNumber, { message: t('companyRegister.validation.validPhone') }),
    taxId: z.string().optional(),
    licenseNumber: z.string().optional(),
    industry: z.string().optional(),
    country: z.string().min(2, t('companyRegister.validation.selectCountry')),
    currency: z.string().min(3).max(3, t('companyRegister.validation.currencyLength')),
    timezone: z.string().min(1, t('companyRegister.validation.selectTimezone')),
    logoUrl: z.string().optional(),
    // Admin account validation
    adminFirstName: z.string().min(2, t('companyRegister.validation.adminFirstNameMin')),
    adminSurname: z.string().min(2, t('companyRegister.validation.adminSurnameMin')),
    adminEmail: z.string().email(t('companyRegister.validation.validEmail')),
    adminPhone: z.string().refine(isValidPhoneNumber, { message: t('companyRegister.validation.validPhone') }),
    adminPassword: z.string().min(8, t('companyRegister.validation.passwordMin')),
    adminConfirmPassword: z.string(),
  }).refine(data => data.adminPassword === data.adminConfirmPassword, {
    message: t('companyRegister.validation.passwordsDoNotMatch'),
    path: ['adminConfirmPassword'],
  }), [t]);

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: '',
      domain: '',
      description: '',
      website: '',
      email: '',
      phone: '',
      taxId: '',
      licenseNumber: '',
      industry: '',
      country: '',
      currency: 'USD',
      timezone: 'UTC',
      logoUrl: '',
      adminFirstName: '',
      adminSurname: '',
      adminEmail: '',
      adminPhone: '',
      adminPassword: '',
      adminConfirmPassword: '',
    },
  });

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const onSubmit = async (values: CompanyFormValues) => {
    setIsSubmitting(true);

    try {
      let logoUrl: string | undefined;
      if (logoFile) {
        logoUrl = await fileToDataUrl(logoFile);
      }

      const companyData = {
        ...values,
        logoUrl,
      };

      // Use server action instead of API route (no authentication required)
      const result = await createCompanyDocument(companyData);

      if (!result.success) {
        throw new Error(result.error || 'Failed to register company');
      }

      toast({
        title: t('companyRegister.registrationSuccessful'),
        description: result.message,
      });

      // Redirect to login or dashboard
      router.push('/auth/login');

    } catch (error: any) {
      console.error('Registration error:', error);
      const errorMessage = error?.message || error?.error || t('companyRegister.failedToRegister');
      
      toast({
        variant: 'destructive',
        title: t('companyRegister.registrationFailed'),
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const countries = [
    { value: 'US', label: 'United States' },
    { value: 'CA', label: 'Canada' },
    { value: 'GB', label: 'United Kingdom' },
    { value: 'AU', label: 'Australia' },
    { value: 'DE', label: 'Germany' },
    { value: 'FR', label: 'France' },
    { value: 'TH', label: 'Thailand' },
    { value: 'VN', label: 'Vietnam' },
    { value: 'KH', label: 'Cambodia' },
    { value: 'MY', label: 'Malaysia' },
    { value: 'SG', label: 'Singapore' },
    { value: 'ID', label: 'Indonesia' },
    { value: 'PH', label: 'Philippines' },
  ];

  const timezones = [
    { value: 'UTC', label: 'UTC' },
    { value: 'America/New_York', label: 'Eastern Time' },
    { value: 'America/Chicago', label: 'Central Time' },
    { value: 'America/Denver', label: 'Mountain Time' },
    { value: 'America/Los_Angeles', label: 'Pacific Time' },
    { value: 'Europe/London', label: 'London' },
    { value: 'Europe/Paris', label: 'Paris' },
    { value: 'Asia/Bangkok', label: 'Bangkok' },
    { value: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh City' },
    { value: 'Asia/Phnom_Penh', label: 'Phnom Penh' },
    { value: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur' },
    { value: 'Asia/Singapore', label: 'Singapore' },
    { value: 'Asia/Jakarta', label: 'Jakarta' },
    { value: 'Asia/Manila', label: 'Manila' },
  ];

  const currencies = [
    { value: 'USD', label: 'USD - US Dollar' },
    { value: 'EUR', label: 'EUR - Euro' },
    { value: 'GBP', label: 'GBP - British Pound' },
    { value: 'THB', label: 'THB - Thai Baht' },
    { value: 'VND', label: 'VND - Vietnamese Dong' },
    { value: 'KHR', label: 'KHR - Cambodian Riel' },
    { value: 'MYR', label: 'MYR - Malaysian Ringgit' },
    { value: 'SGD', label: 'SGD - Singapore Dollar' },
    { value: 'IDR', label: 'IDR - Indonesian Rupiah' },
    { value: 'PHP', label: 'PHP - Philippine Peso' },
  ];

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
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              {t('companyRegister.title')}
            </CardTitle>
            <CardDescription>
              {t('companyRegister.description')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">{t('companyRegister.basicInformation')}</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('companyRegister.companyName')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('companyRegister.companyNamePlaceholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="domain"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('companyRegister.customDomain')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('companyRegister.customDomainPlaceholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('companyRegister.companyDescription')}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t('companyRegister.companyDescriptionPlaceholder')}
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="logoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Upload className="h-4 w-4" />
                          {t('companyRegister.companyLogo')}
                        </FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setLogoFile(file);
                                  field.onChange(file.name);
                                }
                              }}
                            />
                            {logoFile && (
                              <div className="text-sm text-muted-foreground">
                                {t('companyRegister.selectedFile', { fileName: logoFile.name })}
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">{t('companyRegister.contactInformation')}</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            {t('companyRegister.emailAddress')}
                          </FormLabel>
                          <FormControl>
                            <Input type="email" placeholder={t('companyRegister.emailPlaceholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            {t('companyRegister.phoneNumber')}
                          </FormLabel>
                          <FormControl>
                            <PhoneNumberInput placeholder={t('companyRegister.phonePlaceholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          {t('companyRegister.website')}
                        </FormLabel>
                        <FormControl>
                          <Input placeholder={t('companyRegister.websitePlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Business Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">{t('companyRegister.businessInformation')}</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="taxId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('companyRegister.taxId')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('companyRegister.taxIdPlaceholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="licenseNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('companyRegister.businessLicense')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('companyRegister.businessLicensePlaceholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('companyRegister.industry')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('companyRegister.industryPlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Regional Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">{t('companyRegister.regionalSettings')}</h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('companyRegister.country')}</FormLabel>
                          <FormControl>
                            <select
                              {...field}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <option value="">{t('companyRegister.selectCountry')}</option>
                              {countries.map((country) => (
                                <option key={country.value} value={country.value}>
                                  {country.label}
                                </option>
                              ))}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('companyRegister.currency')}</FormLabel>
                          <FormControl>
                            <select
                              {...field}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {currencies.map((currency) => (
                                <option key={currency.value} value={currency.value}>
                                  {currency.label}
                                </option>
                              ))}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('companyRegister.timezone')}</FormLabel>
                          <FormControl>
                            <select
                              {...field}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {timezones.map((tz) => (
                                <option key={tz.value} value={tz.value}>
                                  {tz.label}
                                </option>
                              ))}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Admin Account Information */}
                <div className="space-y-4 border-t pt-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {t('companyRegister.adminAccount')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('companyRegister.adminAccountDescription')}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="adminFirstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('companyRegister.adminFirstName')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('companyRegister.adminFirstNamePlaceholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="adminSurname"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('companyRegister.adminSurname')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('companyRegister.adminSurnamePlaceholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="adminEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            {t('companyRegister.adminEmail')}
                          </FormLabel>
                          <FormControl>
                            <Input type="email" placeholder={t('companyRegister.adminEmailPlaceholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="adminPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            {t('companyRegister.adminPhone')}
                          </FormLabel>
                          <FormControl>
                            <PhoneNumberInput placeholder={t('companyRegister.adminPhonePlaceholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="adminPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('companyRegister.adminPassword')}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder={t('companyRegister.adminPasswordPlaceholder')}
                                {...field}
                              />
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

                    <FormField
                      control={form.control}
                      name="adminConfirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('companyRegister.adminConfirmPassword')}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder={t('companyRegister.adminConfirmPasswordPlaceholder')}
                                {...field}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              >
                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('companyRegister.registeringCompany')}
                    </>
                  ) : (
                    t('companyRegister.registerCompany')
                  )}
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                  {t('companyRegister.alreadyHaveCompany')}{' '}
                  <Link href="/auth/login" className="underline hover:text-primary">
                    {t('companyRegister.signIn')}
                  </Link>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}