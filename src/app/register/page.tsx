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
import { UserPlus, Upload, UserCheck, Eye, EyeOff, Building2, Search, Phone, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { accountTypes, type Member, type Company } from '@/lib/types';
import { useI18n } from '@/lib/internationalization';
import { Skeleton } from '@/components/ui/skeleton';
import { PhoneNumberInput } from '@/components/ui/phone-number-input';
import { isValidPhoneNumber } from 'react-phone-number-input';
import { LanguageSelector } from '@/components/ui/language-selector';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import Image from 'next/image';


const getFormSchema = (t: (key: string) => string) => z.object({
  companyId: z.string().min(1, t('register.validation.companyRequired')),
  firstName: z.string().min(2, t('register.validation.firstNameMin')),
  surname: z.string().min(2, t('register.validation.surnameMin')),
  email: z.string().email(t('register.validation.validEmail')).optional().or(z.literal('')),
  phoneNumber: z.string().refine(isValidPhoneNumber, { message: t('register.validation.validPhone') }),
  password: z.string()
    .length(4, t('register.validation.passwordExact4DigitsFromId'))
    .regex(/^\d{4}$/, t('register.validation.passwordExact4Digits')),
  confirmPassword: z.string(),
  sponsorId: z.string().optional(),
  parentId: z.string().optional(),
  position: z.enum(['left', 'right']).optional(),
  accountType: z.enum(accountTypes, {
    required_error: t('register.validation.accountTypeRequired')
  }),
  idCard: z.any().optional(),
  idCardNumber: z.string()
    .min(1, t('register.validation.idCardRequired'))
    .regex(/^[0-9]+$/, t('register.validation.idCardDigitsOnly')),
}).refine(data => data.password === data.confirmPassword, {
  message: t('register.validation.passwordsDoNotMatch'),
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<ReturnType<typeof getFormSchema>>;


function RegisterPageContent() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingSponsor, setLoadingSponsor] = useState(true);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [fileName, setFileName] = useState('');
  const [sponsors, setSponsors] = useState<Member[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [previewMemberId, setPreviewMemberId] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [availablePositions, setAvailablePositions] = useState<{ left: boolean; right: boolean } | null>(null);
  const [checkingPositions, setCheckingPositions] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const sponsorIdFromQuery = searchParams.get('sponsorId');
  const companyIdFromQuery = searchParams.get('companyId');
  const [sponsorFromQuery, setSponsorFromQuery] = useState<Member | null>(null);
  const [referralCode, setReferralCode] = useState<string>('');
  const [sponsorSearchQuery, setSponsorSearchQuery] = useState('');
  const [placementSearchQuery, setPlacementSearchQuery] = useState('');

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
     parentId: '',
     position: undefined,
     accountType: 'Customer',
     phoneNumber: '',
     idCardNumber: '',
   },
  });

  const watchedIdCardNumber = useWatch({ control: form.control, name: 'idCardNumber' });
  const watchedFirstName = useWatch({ control: form.control, name: 'firstName' });
  const watchedSurname = useWatch({ control: form.control, name: 'surname' });
  const watchedPhoneNumber = useWatch({ control: form.control, name: 'phoneNumber' });

  // Generate preview full name
  const previewFullName = watchedFirstName && watchedSurname 
    ? `${watchedFirstName} ${watchedSurname}`.trim()
    : '';

  // Fetch next MEM ID for preview when form has required fields
  useEffect(() => {
    const fetchNextMemId = async () => {
      if (!watchedFirstName || !watchedSurname || !watchedPhoneNumber) {
        setPreviewMemberId('');
        return;
      }

      // Validate phone number has enough digits
      const cleanPhone = watchedPhoneNumber.replace(/\D/g, '');
      if (cleanPhone.length < 4) {
        setPreviewMemberId('');
        return;
      }

      setIsLoadingPreview(true);
      try {
        // Get sponsor ID from form to generate ID following sponsor's pattern
        const sponsorId = form.watch('sponsorId');
        const queryParams = sponsorId ? `?sponsorId=${sponsorId}` : '';
        
        const response = await fetch(`/api/member-id/preview${queryParams}`);
        if (response.ok) {
          const data = await response.json();
          setPreviewMemberId(data.nextMemberId || '');
        } else {
          setPreviewMemberId('');
        }
      } catch (error) {
        console.error('Error fetching preview member ID:', error);
        setPreviewMemberId('');
      } finally {
        setIsLoadingPreview(false);
      }
    };

    // Debounce the API call
    const timeoutId = setTimeout(fetchNextMemId, 300);
    return () => clearTimeout(timeoutId);
  }, [watchedFirstName, watchedSurname, watchedPhoneNumber, form.watch('sponsorId')]);

  // Check if we have enough info to show profile preview
  const showProfilePreview = previewFullName || previewMemberId || watchedPhoneNumber;

  // Auto-fill password with last 4 digits of ID card number
  useEffect(() => {
    if (watchedIdCardNumber && watchedIdCardNumber.length >= 4) {
      const last4Digits = watchedIdCardNumber.slice(-4);
      form.setValue('password', last4Digits, { shouldValidate: false });
      form.setValue('confirmPassword', last4Digits, { shouldValidate: false });
    }
  }, [watchedIdCardNumber, form]);

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
                const trackResponse = await fetch('/api/referral/track', {
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

                // Check if referral link is valid and active
                if (!trackResponse.ok) {
                    const trackData = await trackResponse.json();
                    toast({
                        title: 'Invalid Referral Link',
                        description: trackData.error || 'This referral link is inactive or has expired. Please use a valid referral link.',
                        variant: 'destructive',
                    });
                    // Clear the referral code from URL
                    setReferralCode('');
                    // Remove ref parameter from URL without reload
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.delete('ref');
                    window.history.replaceState({}, '', newUrl.toString());
                } else {
                    // Get sponsor info from referral code
                    const sponsorResponse = await fetch(`/api/referral/sponsor?code=${referralCodeFromUrl}`);
                    if (sponsorResponse.ok) {
                        const sponsorData = await sponsorResponse.json();
                        if (sponsorData.success && sponsorData.data) {
                            sponsorFromReferral = sponsorData.data.sponsor;
                            companyFromReferral = sponsorData.data.company;
                            
                            // Validate that sponsor and company data exist before using
                            if (sponsorFromReferral && companyFromReferral) {
                                setSponsorFromQuery(sponsorFromReferral);
                                if (sponsorFromReferral.id) {
                                    form.setValue('sponsorId', sponsorFromReferral.id, { shouldValidate: true });
                                }
                                if (companyFromReferral.id) {
                                    form.setValue('companyId', companyFromReferral.id, { shouldValidate: true });
                                }
                            } else {
                                console.warn('Sponsor or company data missing from referral response:', sponsorData);
                            }
                        } else {
                            console.warn('Invalid referral code or response structure:', sponsorData);
                        }
                    } else {
                        const errorData = await sponsorResponse.json().catch(() => ({}));
                        console.warn('Failed to get sponsor from referral code:', errorData);
                    }
                }
            }

            // Load companies
            const companiesResponse = await fetch('/api/company');
            if (companiesResponse.ok) {
                const companiesData = await companiesResponse.json();
                // Ensure companies is always an array
                const companiesArray = Array.isArray(companiesData) ? companiesData : [];
                setCompanies(companiesArray);

                // Set company from query if provided (unless already set from referral)
                if (!companyFromReferral && companyIdFromQuery) {
                    const company = companiesArray.find((c: Company) => c.id === companyIdFromQuery);
                    if (company) {
                        form.setValue('companyId', company.id, { shouldValidate: true });
                    }
                }
            } else {
                setCompanies([]);
            }

            // Load sponsors (only from selected company if specified)
            const companyId = form.watch('companyId') || companyFromReferral?.id;
            const sponsorsUrl = companyId
                ? `/api/sponsors?companyId=${companyId}`
                : '/api/sponsors';

            let sponsorsArray: Member[] = [];
            const sponsorsResponse = await fetch(sponsorsUrl);
            if (sponsorsResponse.ok) {
                const sponsorsData = await sponsorsResponse.json();
                // Unwrap the data field from paginated response
                sponsorsArray = Array.isArray(sponsorsData?.data) 
                    ? sponsorsData.data 
                    : Array.isArray(sponsorsData) 
                        ? sponsorsData 
                        : [];
                setSponsors(sponsorsArray as Member[]);
            } else {
                setSponsors([]);
            }

            // Set sponsor from query if provided (unless already set from referral)
            if (!sponsorFromReferral && sponsorIdFromQuery) {
                const sponsor = sponsorsArray.find((m: Member) => m.id === sponsorIdFromQuery || m.memberId === sponsorIdFromQuery);
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

  // Load members for sponsor and placement parent dropdowns
  useEffect(() => {
    async function loadMembers() {
      setLoadingMembers(true);
      try {
        const response = await fetch('/api/members?limit=1000');
        if (response.ok) {
          const data = await response.json();
          const membersArray = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
          setMembers(membersArray as Member[]);
        }
      } catch (error) {
        console.error('Failed to load members:', error);
      } finally {
        setLoadingMembers(false);
      }
    }
    loadMembers();
  }, []);

  // Check available positions when placement parent changes
  const watchedParentId = useWatch({ control: form.control, name: 'parentId' });
  useEffect(() => {
    async function checkPositions() {
      if (!watchedParentId) {
        setAvailablePositions(null);
        return;
      }

      setCheckingPositions(true);
      try {
        const response = await fetch(`/api/members/${watchedParentId}/positions`);
        if (response.ok) {
          const data = await response.json();
          setAvailablePositions({
            left: data.left !== false,
            right: data.right !== false
          });
        } else {
          setAvailablePositions({ left: true, right: true });
        }
      } catch (error) {
        console.error('Failed to check positions:', error);
        setAvailablePositions({ left: true, right: true });
      } finally {
        setCheckingPositions(false);
      }
    }
    checkPositions();
  }, [watchedParentId]);
  
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

    try {
      let idCardUrl: string | undefined;
      if (values.idCard?.[0]) {
        idCardUrl = await fileToDataUrl(values.idCard[0]);
      }

      // Extract last 4 digits from ID card number to use as password
      const idCardNumberStr = String(values.idCardNumber).trim();
      const extractedPassword = idCardNumberStr.length >= 4 ? idCardNumberStr.slice(-4) : '';
      
      // Always use the last 4 digits of ID card number as the password
      const finalPassword = extractedPassword;

      // Create user via API
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: values.email,
          phoneNumber: values.phoneNumber,
          password: finalPassword, // Use last 4 digits of ID card as password
          firstName: values.firstName,
          surname: values.surname,
          accountType: values.accountType,
          sponsorId: values.sponsorId,
          parentId: values.parentId,
          position: values.position,
          companyId: values.companyId,
          idCardUrl: idCardUrl,
          idCardNumber: values.idCardNumber,
          referralCode: referralCode || undefined, // Pass referral code to registration API
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      const { user: newUser, token } = await response.json();

      toast({
        title: t('admin.register.successTitle'),
        description: t('admin.register.successDescription', {fullName: `${values.firstName} ${values.surname}`}),
      });

      // After registration, send user to login page instead of auto-login
      router.push('/auth/login');

    } catch (error: unknown) {
      let errorMessage = t('register.error.unknown');
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes('already exists')) {
          errorMessage = 'Phone number or email already registered. Please use different credentials or log in.';
        }
      }
      toast({
        variant: 'destructive',
        title: t('register.error.registrationFailed'),
        description: errorMessage,
      });
    }

    setIsSubmitting(false);
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
           <div className="flex items-center justify-between h-16 px-4">
             <div className="text-foreground text-xl font-bold flex items-center h-full">
               {/* {t('login.portalTitle')} */}
               <div className="relative h-16 w-16">
                 <Image
                   src="/images/LOGO.png"
                    alt={t('register.logoAlt')}
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
         <Card className="w-full max-w-2xl shadow-lg">
           <CardHeader className="space-y-4 pb-6">
             {/* Logo */}
             <div className="flex justify-center -mt-4 mb-4">
               <div className="relative w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center">
                 <Image
                   src="/images/logo%203s.png"
                    alt={t('register.systemLogoAlt')}
                   fill
                   className="object-contain drop-shadow-md"
                   priority
                   sizes="(max-width: 640px) 176px, 208px"
                   unoptimized
                 />
               </div>
             </div>
             <div className="text-center pt-4 space-y-2">
               <CardTitle className="text-2xl flex items-center justify-center gap-2"><UserPlus /> {t('register.title')}</CardTitle>
               <CardDescription className="text-base">
                 {t('register.joinCompanyDescription')}
               </CardDescription>
             </div>
           </CardHeader>
           <CardContent className="pt-0">
             {loadingSponsor || loadingCompanies ? <RegisterFormSkeleton /> : (
               <Form {...form}>
                 <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Company Selection */}
                  <FormField
                    control={form.control}
                    name="companyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {t('register.selectCompany')}
                        </FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder={t('register.chooseCompanyPlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.isArray(companies) && companies.map((company) => (
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
                          {t('register.chooseCompanyDescription')}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                      <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                          <FormItem>
                          <FormLabel>{t('register.firstNameLabel')}</FormLabel>
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
                          <FormLabel>{t('register.surnameLabel')}</FormLabel>
                          <FormControl>
                              <Input placeholder={t('register.surnamePlaceholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                          </FormItem>
                      )}
                      />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                     <FormField
                       control={form.control}
                       name="phoneNumber"
                       render={({ field }) => (
                         <FormItem>
                           <FormLabel>{t('genealogy.phoneNumberLabel')}</FormLabel>
                           <FormControl>
                              <PhoneNumberInput placeholder={t('register.phonePlaceholder')} {...field} />
                           </FormControl>
                           <FormDescription>
                             {t('register.phoneNumberDescription')}
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>{t('register.passwordLabel')}</FormLabel>
                             <FormControl>
                                 <div className="relative">
                                   <Input 
                                     type={showPassword ? "text" : "password"} 
                                     {...field} 
                                     readOnly
                                     className="bg-muted cursor-not-allowed"
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
                             <FormDescription>
                               {t('register.passwordAutoDescription')}
                             </FormDescription>
                             <FormMessage />
                            </FormItem>
                        )}
                      />
                      <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                          <FormItem>
                          <FormLabel>{t('register.confirmPasswordLabel')}</FormLabel>
                          <FormControl>
                              <div className="relative">
                                <Input 
                                  type={showConfirmPassword ? "text" : "password"} 
                                  {...field} 
                                  readOnly
                                  className="bg-muted cursor-not-allowed"
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
                          <FormDescription>
                            {t('register.confirmPasswordDescription')}
                          </FormDescription>
                          <FormMessage />
                          </FormItem>
                      )}
                      />
                  </div>
                   <FormField
                     control={form.control}
                     name="idCardNumber"
                     render={({ field }) => (
                       <FormItem>
                         <FormLabel className="flex items-center gap-2"><UserCheck className="h-4 w-4" /> {t('register.idCardNumberLabel')}</FormLabel>
                         <FormControl>
                           <Input placeholder={t('register.idCardNumberPlaceholder')} {...field} />
                         </FormControl>
                         <FormDescription>
                           {t('register.idCardNumberDescription')}
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
                         <FormLabel className="flex items-center gap-2"><Upload className="h-4 w-4" /> {t('genealogy.idCardLabel')}</FormLabel>
                         <FormControl>
                           <div className="relative">
                               <Input
                                   id="id-card-upload"
                                   type="file"
                                   accept="image/*"
                                   className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                   onChange={(e) => {
                                       field.onChange(e.target.files);
                                       setFileName(e.target.files?.[0]?.name || '');
                                   }}
                               />
                                <Button asChild variant="outline" className="w-full">
                                 <div>{fileName || t('genealogy.chooseFile')}</div>
                               </Button>
                           </div>
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                    <FormField
                      control={form.control}
                      name="sponsorId"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>{t('register.admin.sponsorLabel') || 'Sponsor'}</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button 
                                  variant="outline" 
                                  role="combobox" 
                                  className={cn("w-full justify-between", !field.value && "text-muted-foreground")} 
                                  disabled={loadingMembers}
                                >
                                  {field.value ? (() => {
                                    const s = members.find(m => m.id === field.value);
                                    return s ? `${s.fullName || ''}${s.memberId ? ` (${s.memberId})` : ''}`.trim() || t('register.admin.selectSponsor') || 'Select Sponsor' : t('register.admin.selectSponsor') || 'Select Sponsor';
                                  })() : t('register.admin.selectSponsor') || 'Select Sponsor'}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                              <Command shouldFilter={false}>
                                <CommandInput 
                                   placeholder={t('register.searchMemberPlaceholder')}
                                  value={sponsorSearchQuery}
                                  onValueChange={setSponsorSearchQuery}
                                />
                                <CommandList>
                                  {!sponsorSearchQuery ? (
                                    <div className="py-6 text-center text-sm text-muted-foreground">
                                      Type to search for members...
                                    </div>
                                  ) : (
                                    <>
                                      <CommandEmpty>No members found.</CommandEmpty>
                                      <CommandGroup>
                                        {members
                                          .filter(m => {
                                            const searchLower = sponsorSearchQuery.toLowerCase();
                                            const fullName = (m.fullName || '').toLowerCase();
                                            const memberId = (m.memberId || '').toLowerCase();
                                            return fullName.includes(searchLower) || memberId.includes(searchLower);
                                          })
                                          .map(m => (
                                            <CommandItem 
                                              value={`${m.fullName} ${m.memberId}`} 
                                              key={m.id} 
                                              onSelect={() => {
                                                form.setValue("sponsorId", m.id);
                                                setSponsorSearchQuery('');
                                              }}
                                            >
                                              <Check className={cn("mr-2 h-4 w-4", m.id === field.value ? "opacity-100" : "opacity-0")} />
                                              {m.fullName} ({m.memberId})
                                            </CommandItem>
                                          ))}
                                      </CommandGroup>
                                    </>
                                  )}
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="parentId"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>{t('register.admin.placementParentLabel') || 'Placement Parent'}</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button 
                                  variant="outline" 
                                  role="combobox" 
                                  className={cn("w-full justify-between", !field.value && "text-muted-foreground")} 
                                  disabled={loadingMembers}
                                >
                                  {field.value ? (() => {
                                    const p = members.find(m => m.id === field.value);
                                    return p ? `${p.fullName || ''}${p.memberId ? ` (${p.memberId})` : ''}`.trim() || t('register.admin.selectPlacement') || 'Select Placement' : t('register.admin.selectPlacement') || 'Select Placement';
                                  })() : t('register.admin.selectPlacement') || 'Select Placement'}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                              <Command shouldFilter={false}>
                                <CommandInput 
                                   placeholder={t('register.searchMemberPlaceholder')}
                                  value={placementSearchQuery}
                                  onValueChange={setPlacementSearchQuery}
                                />
                                <CommandList>
                                  {!placementSearchQuery ? (
                                    <div className="py-6 text-center text-sm text-muted-foreground">
                                      Type to search for members...
                                    </div>
                                  ) : (
                                    <>
                                      <CommandEmpty>No members found.</CommandEmpty>
                                      <CommandGroup>
                                        {members
                                          .filter(m => {
                                            const searchLower = placementSearchQuery.toLowerCase();
                                            const fullName = (m.fullName || '').toLowerCase();
                                            const memberId = (m.memberId || '').toLowerCase();
                                            return fullName.includes(searchLower) || memberId.includes(searchLower);
                                          })
                                          .map(m => (
                                            <CommandItem 
                                              value={`${m.fullName} ${m.memberId}`} 
                                              key={m.id} 
                                              onSelect={() => {
                                                form.setValue("parentId", m.id);
                                                setPlacementSearchQuery('');
                                              }}
                                            >
                                              <Check className={cn("mr-2 h-4 w-4", m.id === field.value ? "opacity-100" : "opacity-0")} />
                                              {m.fullName} ({m.memberId})
                                            </CommandItem>
                                          ))}
                                      </CommandGroup>
                                    </>
                                  )}
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>{t('register.admin.positionLabel') || 'Position'}</FormLabel>
                        {availablePositions && (
                          <div className="text-sm text-muted-foreground mb-2">
                            {!availablePositions.left && !availablePositions.right && (
                              <span className="text-destructive">{t('register.admin.bothPositionsTaken') || 'Both positions are taken'}</span>
                            )}
                            {availablePositions.left && !availablePositions.right && (
                              <span className="text-amber-600">{t('register.admin.onlyLeftAvailable') || 'Only left position available'}</span>
                            )}
                            {!availablePositions.left && availablePositions.right && (
                              <span className="text-amber-600">{t('register.admin.onlyRightAvailable') || 'Only right position available'}</span>
                            )}
                            {availablePositions.left && availablePositions.right && (
                              <span className="text-green-600">{t('register.admin.bothPositionsAvailable') || 'Both positions available'}</span>
                            )}
                          </div>
                        )}
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex space-x-4"
                            disabled={checkingPositions || (availablePositions !== null && !availablePositions.left && !availablePositions.right)}
                          >
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem 
                                  value="left" 
                                  disabled={availablePositions ? !availablePositions.left : false}
                                />
                              </FormControl>
                              <FormLabel className={cn(
                                "font-normal",
                                availablePositions && !availablePositions.left && "text-muted-foreground opacity-50"
                              )}>
                                {t('register.admin.positionLeft') || 'Left'} {availablePositions && !availablePositions.left && `(${t('register.admin.positionTaken') || 'Taken'})`}
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem 
                                  value="right" 
                                  disabled={availablePositions ? !availablePositions.right : false}
                                />
                              </FormControl>
                              <FormLabel className={cn(
                                "font-normal",
                                availablePositions && !availablePositions.right && "text-muted-foreground opacity-50"
                              )}>
                                {t('register.admin.positionRight') || 'Right'} {availablePositions && !availablePositions.right && `(${t('register.admin.positionTaken') || 'Taken'})`}
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {/* Profile Preview */}
                  {showProfilePreview && (
                    <div className="rounded-lg border-2 border-primary/20 bg-gradient-to-br from-background to-muted/30 p-4 space-y-3 shadow-sm">
                      {previewFullName && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">Name:</span>
                          <span className="text-base font-bold text-foreground">{previewFullName}</span>
                        </div>
                      )}
                      {(previewMemberId || isLoadingPreview) && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">Member ID:</span>
                          {isLoadingPreview ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <span className="text-sm font-mono text-primary font-semibold">{previewMemberId}</span>
                          )}
                        </div>
                      )}
                      {watchedPhoneNumber && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">Phone:</span>
                          <span className="text-sm font-medium">{watchedPhoneNumber}</span>
                        </div>
                      )}
                    </div>
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
                  <div className="mt-4 text-center text-sm space-y-2">
                         <div>
                           {t('register.haveAccount')}{' '}
                           <Link href="/auth/login" className="underline">
                               {t('register.signInLink')}
                           </Link>
                         </div>
                         <div>
                           {t('register.wantToRegisterCompany')}{' '}
                           <Link href="/company-register" className="underline">
                               {t('register.registerCompany')}
                           </Link>
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
