
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { UserPlus, Upload, UserCheck, Eye, EyeOff, Building2, Search, CheckCircle, Clock, AlertCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { accountTypes, type Member, type Company } from '@/lib/types';
import { useI18n } from '@/lib/internationalization';
import PasswordStrengthIndicator from '@/components/auth/password-strength-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import { PhoneNumberInput } from '@/components/ui/phone-number-input';
import { isValidPhoneNumber } from 'react-phone-number-input';
import { LanguageSelector } from '@/components/ui/language-selector';
// Removed getAllMembers import - will use direct Prisma call instead
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Image from 'next/image';


const getFormSchema = (t: (key: string) => string) => z.object({
  companyId: z.string().min(1, 'Please select a company to join.'),
  firstName: z.string().min(2, 'First name must be at least 2 characters.'),
  surname: z.string().min(2, 'Surname must be at least 2 characters.'),
  email: z.string().email('Please enter a valid email address.').optional().or(z.literal('')),
  phoneNumber: z.string().refine(isValidPhoneNumber, { message: 'A valid phone number is required.' }),
  password: z.string()
    .min(8, 'Password must be at least 8 characters.')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
    .regex(/[0-9]/, 'Password must contain at least one number.')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character.'),
  confirmPassword: z.string(),
  sponsorId: z.string().optional(),
  accountType: z.enum(accountTypes, {
    required_error: "You need to select an account type."
  }),
  idCard: z.any().optional(),
  idCardNumber: z.string().min(1, 'ID card number is required.').regex(/^[0-9]+$/, 'ID card number must contain only numbers.'),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<ReturnType<typeof getFormSchema>>;


function RegisterPageContent() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingSponsor, setLoadingSponsor] = useState(true);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [fileName, setFileName] = useState('');
  const [sponsors, setSponsors] = useState<Member[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const sponsorIdFromQuery = searchParams.get('sponsorId');
  const companyIdFromQuery = searchParams.get('companyId');
  const [sponsorFromQuery, setSponsorFromQuery] = useState<Member | null>(null);
  const [referralCode, setReferralCode] = useState<string>('');

  // Enhanced registration features
  const [registrationProgress, setRegistrationProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [smartSuggestions, setSmartSuggestions] = useState<string[]>([]);

  const totalSteps = 4; // Company, Personal, Security, Verification

  const formSchema = getFormSchema(t);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: {
     companyId: '',
     firstName: '',
     surname: '',
     email: '',
     password: '',
     confirmPassword: '',
     sponsorId: '',
     accountType: 'Customer',
     phoneNumber: '',
     idCardNumber: '',
   },
  });

  const watchedPassword = useWatch({ control: form.control, name: 'password' });
  const watchedFields = useWatch({ control: form.control });

  // Enhanced form features
  useEffect(() => {
    // Calculate progress based on completed fields
    const calculateProgress = () => {
      const requiredFields = [
        'companyId', 'firstName', 'surname', 'phoneNumber',
        'password', 'confirmPassword', 'accountType', 'idCardNumber'
      ];

      const completedFields = requiredFields.filter(field => {
        const value = watchedFields[field];
        return value && (Array.isArray(value) ? value.length > 0 : String(value).trim() !== '');
      });

      const progress = Math.round((completedFields.length / requiredFields.length) * 100);
      setRegistrationProgress(progress);
    };

    calculateProgress();
  }, [watchedFields]);

  // Auto-save functionality
  useEffect(() => {
    const autoSave = async () => {
      if (Object.keys(watchedFields).length === 0) return;

      setAutoSaveStatus('saving');
      try {
        const response = await fetch('/api/onboarding/register/autosave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: `session_${Date.now()}`,
            stepData: watchedFields,
            progress: registrationProgress
          })
        });

        if (response.ok) {
          setAutoSaveStatus('saved');
          setLastSaved(new Date());
        } else {
          setAutoSaveStatus('error');
        }
      } catch (error) {
        setAutoSaveStatus('error');
      }
    };

    // Auto-save every 30 seconds if form has data
    const interval = setInterval(autoSave, 30000);
    return () => clearInterval(interval);
  }, [watchedFields, registrationProgress]);

  // Smart validation and suggestions
  useEffect(() => {
    const generateSuggestions = () => {
      const suggestions: string[] = [];
      const errors: string[] = [];

      // Company selection suggestions
      if (!watchedFields.companyId && companies.length > 0) {
        suggestions.push("💡 Select a company to see available sponsors");
      }

      // Password strength feedback
      if (watchedFields.password && watchedFields.password.length < 8) {
        errors.push("Password must be at least 8 characters");
      }

      // Email/phone validation
      if (watchedFields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(watchedFields.email)) {
        errors.push("Please enter a valid email address");
      }

      // Sponsor suggestions
      if (watchedFields.companyId && !watchedFields.sponsorId && sponsors.length > 0) {
        suggestions.push("🎯 Finding a sponsor will help you get started faster");
      }

      setValidationErrors(errors);
      setSmartSuggestions(suggestions);
    };

    generateSuggestions();
  }, [watchedFields, companies, sponsors]);

  // Load auto-saved data on mount
  useEffect(() => {
    const loadAutoSavedData = async () => {
      try {
        const response = await fetch('/api/onboarding/register/autosave');
        if (response.ok) {
          const { data } = await response.json();
          if (data) {
            // Restore form data
            Object.keys(data).forEach(key => {
              if (form.getValues(key) === undefined || form.getValues(key) === '') {
                form.setValue(key, data[key], { shouldValidate: false });
              }
            });
            toast({
              title: "Progress Restored",
              description: "Your previous progress has been loaded.",
            });
          }
        }
      } catch (error) {
        // Ignore auto-save loading errors
      }
    };

    loadAutoSavedData();
  }, [form, toast]);

  useEffect(() => {
    async function loadData() {
        setLoadingSponsor(true);
        setLoadingCompanies(true);

        try {
            // Check for referral code in URL
            const referralCodeFromUrl = searchParams.get('ref');
            let sponsorFromReferral = null;
            let companyFromReferral = null;

            if (referralCodeFromUrl) {
                setReferralCode(referralCodeFromUrl);

                // Track the referral click
                await fetch('/api/referral/track', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        referralCode: referralCodeFromUrl,
                        metadata: {
                            userAgent: navigator.userAgent,
                            timestamp: new Date().toISOString(),
                            referrer: document.referrer,
                        }
                    })
                });

                // Get sponsor info from referral code
                const sponsorResponse = await fetch(`/api/referral/sponsor?code=${referralCodeFromUrl}`);
                if (sponsorResponse.ok) {
                    const sponsorData = await sponsorResponse.json();
                    sponsorFromReferral = sponsorData.sponsor;
                    companyFromReferral = sponsorData.company;
                    setSponsorFromQuery(sponsorFromReferral);
                    form.setValue('sponsorId', sponsorFromReferral.id, { shouldValidate: true });
                    form.setValue('companyId', companyFromReferral.id, { shouldValidate: true });
                }
            }

            // Load companies
            const companiesResponse = await fetch('/api/company');
            if (companiesResponse.ok) {
                const companiesData = await companiesResponse.json();
                setCompanies(companiesData);

                // Set company from query if provided (unless already set from referral)
                if (!companyFromReferral && companyIdFromQuery) {
                    const company = companiesData.find((c: Company) => c.id === companyIdFromQuery);
                    if (company) {
                        form.setValue('companyId', company.id, { shouldValidate: true });
                    }
                }
            }

            // Load sponsors (only from selected company if specified)
            const companyId = form.watch('companyId') || companyFromReferral?.id;
            const sponsorsUrl = companyId
                ? `/api/sponsors?companyId=${companyId}`
                : '/api/sponsors';

            const sponsorsResponse = await fetch(sponsorsUrl);
            if (sponsorsResponse.ok) {
                const sponsorsData = await sponsorsResponse.json();
                setSponsors(sponsorsData as Member[]);
            }

            // Set sponsor from query if provided (unless already set from referral)
            if (!sponsorFromReferral && sponsorIdFromQuery) {
                const sponsor = sponsors.find((m: Member) => m.id === sponsorIdFromQuery || m.memberId === sponsorIdFromQuery);
                if (sponsor) {
                    setSponsorFromQuery(sponsor as Member);
                    form.setValue('sponsorId', sponsor.id, { shouldValidate: true });
                }
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        }

        setLoadingSponsor(false);
        setLoadingCompanies(false);
    }

    loadData();
  }, [searchParams, form, sponsorIdFromQuery, companyIdFromQuery]);
  
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
  };

  const onSubmit = async (values: RegisterFormValues) => {
    setIsSubmitting(true);
    setCurrentStep(4); // Final step

    try {
      // Step 4: Processing
      setRegistrationProgress(90);

      let idCardUrl: string | undefined;
      if (values.idCard?.[0]) {
        idCardUrl = await fileToDataUrl(values.idCard[0]);
      }

      // Enhanced registration with progress tracking
      const registrationData = {
        email: values.email,
        phoneNumber: values.phoneNumber,
        password: values.password,
        firstName: values.firstName,
        surname: values.surname,
        accountType: values.accountType,
        sponsorId: values.sponsorId,
        companyId: values.companyId,
        idCardUrl: idCardUrl,
        idCardNumber: values.idCardNumber,
        referralCode,
        registrationMetadata: {
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          completionTime: Date.now() - (lastSaved?.getTime() || Date.now()),
          autoSaved: lastSaved !== null
        }
      };

      // Create user via enhanced API
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      const { user: newUser, token } = await response.json();
      setRegistrationProgress(100);

      // Track referral conversion if this came from a referral link
      if (referralCode) {
        await fetch('/api/referral/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referralCode,
            conversion: true,
            newMemberId: newUser.id,
            registrationData
          })
        });
      }

      // Store token in localStorage for auto-login
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', token);
      }

      toast({
        title: "🎉 Registration Successful!",
        description: `Welcome ${values.firstName}! Your account has been created and you're ready to start building your network.`,
      });

      // Clear auto-save data
      await fetch('/api/onboarding/register/autosave', {
        method: 'DELETE'
      });

      // Auto-login the user
      setTimeout(() => router.push('/dashboard'), 2000);

    } catch (error: unknown) {
      let errorMessage = t('register.error.unknown');
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes('already exists')) {
          errorMessage = 'Phone number or email already registered. Please use different credentials or log in.';
        } else if (error.message.includes('validation')) {
          errorMessage = 'Please check all required fields and try again.';
        }
      }

      toast({
        variant: 'destructive',
        title: 'Registration Failed',
        description: errorMessage,
      });

      setRegistrationProgress(75); // Reset to allow retry

    } finally {
      setIsSubmitting(false);
    }
  };
  

  const RegisterFormSkeleton = () => (
     <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
  );

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
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <UserPlus /> {t('register.title')}
              </CardTitle>
              <CardDescription>
                Join a company and become a distributor. Find your sponsor and start building your network.
              </CardDescription>

              {/* Enhanced Progress Indicator */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Registration Progress</span>
                  <span className="font-medium">{registrationProgress}%</span>
                </div>
                <Progress value={registrationProgress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Company</span>
                  <span>Details</span>
                  <span>Security</span>
                  <span>Complete</span>
                </div>
              </div>

              {/* Auto-save Status */}
              {lastSaved && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {autoSaveStatus === 'saving' && <Clock className="h-3 w-3 animate-spin" />}
                  {autoSaveStatus === 'saved' && <CheckCircle className="h-3 w-3 text-green-500" />}
                  {autoSaveStatus === 'error' && <AlertCircle className="h-3 w-3 text-red-500" />}
                  <span>
                    {autoSaveStatus === 'saving' && 'Saving progress...'}
                    {autoSaveStatus === 'saved' && `Progress saved ${lastSaved.toLocaleTimeString()}`}
                    {autoSaveStatus === 'error' && 'Auto-save failed'}
                  </span>
                </div>
              )}

              {/* Smart Suggestions */}
              {smartSuggestions.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      {smartSuggestions.map((suggestion, index) => (
                        <div key={index} className="text-sm">{suggestion}</div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      {validationErrors.map((error, index) => (
                        <div key={index} className="text-sm">• {error}</div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardHeader>
            <CardContent>
              {loadingSponsor || loadingCompanies ? <RegisterFormSkeleton /> : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                   {/* Step 1: Company Selection */}
                   <div className="space-y-4">
                     <div className="flex items-center gap-2 text-lg font-semibold">
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                         currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                       }`}>
                         1
                       </div>
                       <span className={currentStep >= 1 ? 'text-foreground' : 'text-muted-foreground'}>
                         Choose Your Company
                       </span>
                       {currentStep > 1 && <CheckCircle className="h-5 w-5 text-green-500" />}
                     </div>

                     <div className="ml-10 space-y-4">
                       <FormField
                         control={form.control}
                         name="companyId"
                         render={({ field }) => (
                           <FormItem>
                             <FormLabel className="flex items-center gap-2">
                               <Building2 className="h-4 w-4" />
                               Select Company *
                             </FormLabel>
                             <FormControl>
                               <Select onValueChange={(value) => {
                                 field.onChange(value);
                                 setCurrentStep(1);
                               }} value={field.value}>
                                 <SelectTrigger>
                                   <SelectValue placeholder="Choose a company to join" />
                                 </SelectTrigger>
                                 <SelectContent>
                                   {companies.map((company) => (
                                     <SelectItem key={company.id} value={company.id}>
                                       <div className="flex items-center gap-2">
                                         {company.logoUrl && (
                                           <Image
                                             src={company.logoUrl}
                                             alt={company.name}
                                             width={24}
                                             height={24}
                                             className="h-6 w-6 rounded object-cover"
                                           />
                                         )}
                                         <div>
                                           <div className="font-medium">{company.name}</div>
                                           <div className="text-xs text-muted-foreground">
                                             {company.description}
                                           </div>
                                         </div>
                                       </div>
                                     </SelectItem>
                                   ))}
                                 </SelectContent>
                               </Select>
                             </FormControl>
                             <FormDescription>
                               Choose the MLM company you want to join as a distributor.
                             </FormDescription>
                             <FormMessage />
                           </FormItem>
                         )}
                       />

                       <FormField
                         control={form.control}
                         name="accountType"
                         render={({ field }) => (
                           <FormItem className="space-y-3">
                             <FormLabel>Account Type *</FormLabel>
                             <FormControl>
                               <RadioGroup
                                 onValueChange={field.onChange}
                                 defaultValue={field.value}
                                 className="flex flex-col space-y-2"
                               >
                                 <div className="flex items-center space-x-3 space-y-0 p-3 border rounded-lg hover:bg-muted/50">
                                   <FormControl>
                                     <RadioGroupItem value="Customer" />
                                   </FormControl>
                                   <div className="flex-1">
                                     <FormLabel className="font-medium cursor-pointer">
                                       {t('register.customerLabel')}
                                     </FormLabel>
                                     <FormDescription className="text-xs">
                                       Purchase products and enjoy member benefits
                                     </FormDescription>
                                   </div>
                                 </div>
                                 <div className="flex items-center space-x-3 space-y-0 p-3 border rounded-lg hover:bg-muted/50">
                                   <FormControl>
                                     <RadioGroupItem value="Distributor" />
                                   </FormControl>
                                   <div className="flex-1">
                                     <FormLabel className="font-medium cursor-pointer">
                                       {t('register.distributorLabel')}
                                     </FormLabel>
                                     <FormDescription className="text-xs">
                                       Build your network and earn commissions
                                     </FormDescription>
                                   </div>
                                 </div>
                               </RadioGroup>
                             </FormControl>
                             <FormMessage />
                           </FormItem>
                         )}
                       />
                     </div>
                   </div>

                   {/* Step 2: Personal Information */}
                   <div className="space-y-4">
                     <div className="flex items-center gap-2 text-lg font-semibold">
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                         currentStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                       }`}>
                         2
                       </div>
                       <span className={currentStep >= 2 ? 'text-foreground' : 'text-muted-foreground'}>
                         Personal Information
                       </span>
                       {currentStep > 2 && <CheckCircle className="h-5 w-5 text-green-500" />}
                     </div>

                     <div className="ml-10 space-y-4">

                  <FormField
                    control={form.control}
                    name="accountType"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>{t('register.accountTypeLabel')}</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-1"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="Customer" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                {t('register.customerLabel')}
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="Distributor" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                {t('register.distributorLabel')}
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                         <FormField
                         control={form.control}
                         name="firstName"
                         render={({ field }) => (
                             <FormItem>
                             <FormLabel>{t('register.firstNameLabel')} *</FormLabel>
                             <FormControl>
                                 <Input placeholder={t('register.firstNamePlaceholder')} {...field} />
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
                             <FormLabel>{t('register.surnameLabel')} *</FormLabel>
                             <FormControl>
                                 <Input placeholder={t('register.surnamePlaceholder')} {...field} />
                             </FormControl>
                             <FormMessage />
                             </FormItem>
                         )}
                         />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                         <FormField
                           control={form.control}
                           name="phoneNumber"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>{t('genealogy.phoneNumberLabel')} *</FormLabel>
                               <FormControl>
                                 <PhoneNumberInput placeholder="+12345678900" {...field} />
                               </FormControl>
                               <FormDescription>
                                 Enter your phone number in international format, e.g., +12345678900
                               </FormDescription>
                               <FormMessage />
                             </FormItem>
                           )}
                         />
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('register.emailOptionalLabel')}</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder={t('register.emailPlaceholder')} {...field} />
                              </FormControl>
                              <FormDescription>
                                Optional but recommended for account recovery and updates
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Security Setup */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-lg font-semibold">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        currentStep >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        3
                      </div>
                      <span className={currentStep >= 3 ? 'text-foreground' : 'text-muted-foreground'}>
                        Security Setup
                      </span>
                      {currentStep > 3 && <CheckCircle className="h-5 w-5 text-green-500" />}
                    </div>

                    <div className="ml-10 space-y-4">
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                         <FormField
                           control={form.control}
                           name="password"
                           render={({ field }) => (
                               <FormItem>
                               <FormLabel>{t('register.passwordLabel')} *</FormLabel>
                               <FormControl>
                                   <div className="relative">
                                     <Input type={showPassword ? "text" : "password"} {...field} />
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
                               <PasswordStrengthIndicator password={watchedPassword} />
                               <FormMessage />
                               </FormItem>
                           )}
                         />
                         <FormField
                         control={form.control}
                         name="confirmPassword"
                         render={({ field }) => (
                             <FormItem>
                             <FormLabel>{t('register.confirmPasswordLabel')} *</FormLabel>
                             <FormControl>
                                 <div className="relative">
                                   <Input type={showConfirmPassword ? "text" : "password"} {...field} />
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
                  </div>

                  {/* Step 4: Verification & Final Setup */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-lg font-semibold">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        currentStep >= 4 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        4
                      </div>
                      <span className={currentStep >= 4 ? 'text-foreground' : 'text-muted-foreground'}>
                        Verification & Setup
                      </span>
                      {isSubmitting && <CheckCircle className="h-5 w-5 text-green-500 animate-pulse" />}
                    </div>

                    <div className="ml-10 space-y-4">
                       {/* Sponsor Selection */}
                       {sponsorFromQuery ? (
                         <div className="space-y-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                           <Label className="flex items-center gap-2 text-green-800">
                             <CheckCircle className="h-4 w-4" />
                             Your Sponsor
                           </Label>
                           <div className="flex items-center gap-3">
                               <UserCheck className="h-5 w-5 text-green-600" />
                               <div>
                                 <span className="font-semibold text-green-800">{sponsorFromQuery.fullName}</span>
                                 <Badge variant="secondary" className="ml-2">{sponsorFromQuery.memberId}</Badge>
                               </div>
                           </div>
                           <p className="text-sm text-green-700">
                             Great! Your sponsor has been automatically selected from your referral link.
                           </p>
                         </div>
                       ) : (
                         <FormField
                           control={form.control}
                           name="sponsorId"
                           render={({ field }) => (
                             <FormItem className="flex flex-col">
                               <FormLabel className="flex items-center gap-2">
                                 <Search className="h-4 w-4" />
                                 Find Your Sponsor
                               </FormLabel>
                               <Popover>
                                 <PopoverTrigger asChild>
                                   <FormControl>
                                       <Button
                                         variant="outline"
                                         role="combobox"
                                         className={cn(
                                           "w-full justify-between",
                                           !field.value && "text-muted-foreground"
                                         )}
                                       >
                                         {field.value
                                           ? sponsors.find(
                                               (s) => s.id === field.value
                                             )?.fullName
                                           : "Search by name or member ID"}
                                         <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                       </Button>
                                     </FormControl>
                                 </PopoverTrigger>
                                 <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                   <Command>
                                     <CommandInput placeholder="Search sponsors by name or ID..." />
                                     <CommandList>
                                       <CommandEmpty>No sponsor found.</CommandEmpty>
                                       <CommandGroup>
                                         {sponsors.map((s) => (
                                             <CommandItem
                                             value={`${s.fullName} ${s.memberId}`}
                                             key={s.id}
                                             onSelect={() => {
                                                 form.setValue("sponsorId", s.id)
                                             }}
                                             >
                                             <Check className={cn("mr-2 h-4 w-4", s.id === field.value ? "opacity-100" : "opacity-0")} />
                                             <div className="flex flex-col">
                                               <span className="font-medium">{s.fullName}</span>
                                               <span className="text-sm text-muted-foreground">ID: {s.memberId}</span>
                                             </div>
                                             </CommandItem>
                                         ))}
                                       </CommandGroup>
                                     </CommandList>
                                   </Command>
                                 </PopoverContent>
                               </Popover>
                               <FormDescription>
                                 Search for your sponsor by their name or member ID. Your sponsor will help you get started in the network.
                               </FormDescription>
                               <FormMessage />
                             </FormItem>
                           )}
                         />
                       )}

                       {/* ID Verification */}
                       <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                         <div className="flex items-center gap-2">
                           <UserCheck className="h-5 w-5 text-blue-600" />
                           <Label className="text-blue-800 font-medium">Identity Verification</Label>
                         </div>

                         <FormField
                           control={form.control}
                           name="idCardNumber"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>ID Card Number *</FormLabel>
                               <FormControl>
                                 <Input placeholder="Enter your ID card number" {...field} />
                               </FormControl>
                               <FormDescription>
                                 Enter your government-issued ID card number. This prevents duplicate accounts and ensures security.
                               </FormDescription>
                               <FormMessage />
                             </FormItem>
                           )}
                         />

                         <FormField
                           control={form.control}
                           name="idCard"
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>ID Card Upload</FormLabel>
                               <FormControl>
                                 <div className="relative">
                                     <Input
                                         id="id-card-upload"
                                         type="file"
                                         accept="image/*,.pdf"
                                         className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                         onChange={(e) => {
                                             field.onChange(e.target.files);
                                             setFileName(e.target.files?.[0]?.name || '');
                                         }}
                                     />
                                      <Button asChild variant="outline" className="w-full h-24 border-dashed">
                                       <div className="flex flex-col items-center gap-2">
                                         <Upload className="h-6 w-6 text-muted-foreground" />
                                         <span className="text-sm">
                                           {fileName || 'Click to upload ID card (image or PDF)'}
                                         </span>
                                       </div>
                                     </Button>
                                 </div>
                               </FormControl>
                               <FormDescription>
                                 Upload a clear photo or scan of your government-issued ID for verification.
                               </FormDescription>
                               <FormMessage />
                             </FormItem>
                           )}
                         />
                       </div>

                       {/* Registration Summary */}
                       <div className="p-4 bg-gray-50 border rounded-lg">
                         <h4 className="font-medium mb-2">Registration Summary</h4>
                         <div className="text-sm space-y-1">
                           <div>Company: {companies.find(c => c.id === watchedFields.companyId)?.name || 'Not selected'}</div>
                           <div>Account Type: {watchedFields.accountType === 'Distributor' ? 'Distributor (earn commissions)' : 'Customer (purchase only)'}</div>
                           <div>Sponsor: {sponsorFromQuery?.fullName || 'Not selected'}</div>
                           <div className="pt-2 border-t">
                             <span className="text-muted-foreground">By registering, you agree to our </span>
                             <Link href="/terms" className="text-primary underline">Terms of Service</Link>
                             <span className="text-muted-foreground"> and </span>
                             <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>
                           </div>
                         </div>
                       </div>
                     </div>
                   </div>

                   {/* Enhanced Submit Section */}
                   <div className="space-y-4 pt-6 border-t">
                     <Button
                       type="submit"
                       disabled={isSubmitting || loadingSponsor || registrationProgress < 80}
                       className="w-full h-12 text-lg font-semibold"
                       size="lg"
                     >
                       {isSubmitting ? (
                         <div className="flex items-center gap-2">
                           <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                           Creating Your Account...
                         </div>
                       ) : registrationProgress < 80 ? (
                         'Complete Required Fields'
                       ) : (
                         '🚀 Create My Account'
                       )}
                     </Button>

                     {registrationProgress < 80 && (
                       <p className="text-sm text-muted-foreground text-center">
                         Please complete all required fields to continue
                       </p>
                     )}

                     {isSubmitting && (
                       <div className="text-center space-y-2">
                         <div className="text-sm text-muted-foreground">
                           Setting up your account and network...
                         </div>
                         <Progress value={registrationProgress} className="h-2" />
                       </div>
                     )}
                   </div>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                              <Command>
                                <CommandInput placeholder="Search sponsors by name or ID..." />
                                <CommandList>
                                  <CommandEmpty>No sponsor found.</CommandEmpty>
                                  <CommandGroup>
                                    {sponsors.map((s) => (
                                        <CommandItem
                                        value={`${s.fullName} ${s.memberId}`}
                                        key={s.id}
                                        onSelect={() => {
                                            form.setValue("sponsorId", s.id)
                                        }}
                                        >
                                        <Check className={cn("mr-2 h-4 w-4", s.id === field.value ? "opacity-100" : "opacity-0")} />
                                        <div className="flex flex-col">
                                          <span className="font-medium">{s.fullName}</span>
                                          <span className="text-sm text-muted-foreground">ID: {s.memberId}</span>
                                        </div>
                                        </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormDescription>
                            Search for your sponsor by their name or member ID. Your sponsor will help you get started in the network.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <Button
                    type="submit"
                    disabled={isSubmitting || loadingSponsor}
                    className="w-full"
                    icon="create"
                  >
                    {isSubmitting ? (
                      t('register.creatingAccount')
                    ) : (
                      t('register.registerButton')
                    )}
                  </Button>
                   {/* Enhanced Footer */}
                   <div className="mt-8 pt-6 border-t space-y-4">
                     <div className="text-center text-sm space-y-2">
                        <div className="flex items-center justify-center gap-4 text-muted-foreground">
                          <Link href="/auth/login" className="hover:text-primary transition-colors">
                              Already have an account? Sign In
                          </Link>
                          <span>•</span>
                          <Link href="/help" className="hover:text-primary transition-colors">
                              Need Help?
                          </Link>
                        </div>

                        <div className="pt-2">
                          <Link href="/company-register" className="inline-flex items-center gap-2 text-primary hover:underline font-medium">
                              <Building2 className="h-4 w-4" />
                              Register a New Company Instead
                          </Link>
                        </div>
                     </div>

                     {/* Security & Trust Badges */}
                     <div className="flex items-center justify-center gap-4 pt-4 border-t">
                       <div className="flex items-center gap-1 text-xs text-muted-foreground">
                         <CheckCircle className="h-3 w-3 text-green-500" />
                         SSL Encrypted
                       </div>
                       <div className="flex items-center gap-1 text-xs text-muted-foreground">
                         <CheckCircle className="h-3 w-3 text-green-500" />
                         GDPR Compliant
                       </div>
                       <div className="flex items-center gap-1 text-xs text-muted-foreground">
                         <CheckCircle className="h-3 w-3 text-green-500" />
                         Secure Payments
                       </div>
                     </div>
                   </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
        </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RegisterPageContent />
    </Suspense>
  );
}
