
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
import { UserPlus, Building2, UserCheck, Upload, Eye, EyeOff, Phone, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/internationalization';
import { PhoneNumberInput } from '@/components/ui/phone-number-input';
import { isValidPhoneNumber } from 'react-phone-number-input';
import { LanguageSelector } from '@/components/ui/language-selector';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { accountTypes, type Member, type Company } from '@/lib/types';
import Image from 'next/image';

const getFormSchema = (t: (key: string) => string) => z.object({
  companyId: z.string().min(1, t('register.validation.companyRequired') || 'Company is required.'),
  firstName: z.string().min(2, 'First name must be at least 2 characters.'),
  surname: z.string().min(2, 'Surname must be at least 2 characters.'),
  email: z.string().email('Please enter a valid email address.').optional().or(z.literal('')),
  phoneNumber: z.string().refine(isValidPhoneNumber, { message: 'A valid phone number is required.' }),
  password: z.string()
    .length(4, 'Password must be exactly 4 digits from your ID card number.')
    .regex(/^\d{4}$/, 'Password must be exactly 4 digits.'),
  confirmPassword: z.string(),
  sponsorId: z.string().min(1, "A sponsor is required for placement."),
  parentId: z.string().min(1, "A parent is required for placement."),
  position: z.enum(['left', 'right'], { required_error: 'You must select a position.' }),
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

export default function AdminRegisterPage() {
  const { toast } = useToast();
  const { t } = useI18n();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [fileName, setFileName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [availablePositions, setAvailablePositions] = useState<{ left: boolean; right: boolean } | null>(null);
  const [checkingPositions, setCheckingPositions] = useState(false);
  const [previewMemberId, setPreviewMemberId] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
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
      phoneNumber: '',
      email: '',
      password: '',
      confirmPassword: '',
      sponsorId: '',
      parentId: '',
      accountType: 'Customer',
      idCardNumber: '',
    },
  });

  const watchedIdCardNumber = useWatch({ control: form.control, name: 'idCardNumber' });
  const watchedFirstName = useWatch({ control: form.control, name: 'firstName' });
  const watchedSurname = useWatch({ control: form.control, name: 'surname' });
  const watchedPhoneNumber = useWatch({ control: form.control, name: 'phoneNumber' });
  const watchedSponsorId = useWatch({ control: form.control, name: 'sponsorId' });

  const previewFullName = watchedFirstName && watchedSurname
    ? `${watchedFirstName} ${watchedSurname}`.trim()
    : '';

  // Fetch member ID preview (sponsor-based) when sponsor is selected
  useEffect(() => {
    const fetchPreview = async () => {
      if (!watchedSponsorId) {
        setPreviewMemberId('');
        return;
      }
      setIsLoadingPreview(true);
      try {
        const res = await fetch(`/api/member-id/preview?sponsorId=${encodeURIComponent(watchedSponsorId)}`);
        if (res.ok) {
          const data = await res.json();
          setPreviewMemberId(data.nextMemberId || '');
        } else {
          setPreviewMemberId('');
        }
      } catch (e) {
        console.error('Error fetching member ID preview:', e);
        setPreviewMemberId('');
      } finally {
        setIsLoadingPreview(false);
      }
    };
    const tid = setTimeout(fetchPreview, 300);
    return () => clearTimeout(tid);
  }, [watchedSponsorId]);

  const showProfilePreview = !!(previewFullName || previewMemberId || watchedPhoneNumber);

  // Auto-fill password with last 4 digits of ID card number
  useEffect(() => {
    if (watchedIdCardNumber && watchedIdCardNumber.length >= 4) {
      const last4Digits = watchedIdCardNumber.slice(-4);
      form.setValue('password', last4Digits, { shouldValidate: false });
      form.setValue('confirmPassword', last4Digits, { shouldValidate: false });
    }
  }, [watchedIdCardNumber, form]);

  // Watch for placement parent changes and check available positions
  const watchedParentId = useWatch({ control: form.control, name: 'parentId' });

  useEffect(() => {
    async function checkAvailablePositions() {
      if (!watchedParentId) {
        setAvailablePositions(null);
        return;
      }

      setCheckingPositions(true);
      try {
        const res = await fetch(`/api/members/${watchedParentId}/positions`);
        if (res.ok) {
          const data = await res.json();
          setAvailablePositions(data);

          // Auto-select available position if only one is available
          const currentPosition = form.getValues('position');
          if (data.left && !data.right && currentPosition !== 'left') {
            form.setValue('position', 'left');
          } else if (data.right && !data.left && currentPosition !== 'right') {
            form.setValue('position', 'right');
          } else if (!data.left && !data.right) {
            // Both positions taken - don't auto-select, let user choose different parent
            // Keep current position if set, otherwise leave empty
          }
        } else {
          setAvailablePositions({ left: true, right: true }); // Default to both available if check fails
        }
      } catch (error) {
        console.error('Error checking available positions:', error);
        setAvailablePositions({ left: true, right: true }); // Default to both available on error
      } finally {
        setCheckingPositions(false);
      }
    }

    checkAvailablePositions();
  }, [watchedParentId, form]);

  useEffect(() => {
    async function loadData() {
      setLoadingMembers(true);
      setLoadingCompanies(true);
      try {
        // Load companies
        const companiesRes = await fetch('/api/company');
        if (companiesRes.ok) {
          const companiesData = await companiesRes.json();
          const companiesArray = Array.isArray(companiesData) ? companiesData : [];
          setCompanies(companiesArray);
        } else {
          setCompanies([]);
        }
        // Load members
        const membersRes = await fetch('/api/members?limit=500&offset=0');
        if (membersRes.ok) {
          const raw = await membersRes.json();
          const data = raw?.data ?? raw ?? [];
          setMembers(Array.isArray(data) ? (data as Member[]) : []);
        } else {
          console.error('Failed to fetch members for admin register:', membersRes.status);
        }
      } catch (error) {
        console.error('Error fetching data for admin register:', error);
      } finally {
        setLoadingMembers(false);
        setLoadingCompanies(false);
      }
    }
    loadData();
  }, []);

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
      const finalPassword = extractedPassword;

      // Prepare data for API, excluding form-only fields
      const submitData = {
        companyId: values.companyId,
        firstName: values.firstName,
        surname: values.surname,
        phoneNumber: values.phoneNumber,
        email: values.email || '',
        password: finalPassword,
        sponsorId: values.sponsorId,
        parentId: values.parentId,
        position: values.position,
        accountType: values.accountType,
        idCardNumber: values.idCardNumber,
        ...(idCardUrl && { idCardUrl }),
      };


      const res = await fetch('/api/register/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      const raw = await res.json().catch(() => ({}));
      if (!res.ok || raw?.success === false) {
        const errorMsg = raw?.error || raw?.message || 'Failed to create member';
        console.error('Registration error response:', raw);

        // If error includes available position, auto-select it
        if (raw?.availablePosition && (raw.availablePosition === 'left' || raw.availablePosition === 'right')) {
          form.setValue('position', raw.availablePosition);
          toast({
            variant: 'default',
            title: 'Position Auto-Selected',
            description: `The ${raw.availablePosition} position has been automatically selected for you. Please try again.`,
          });
        }

        throw new Error(errorMsg);
      }

      toast({
        title: t('register.admin.successTitle'),
        description: t('register.admin.successDescription', { fullName: values.firstName }),
      });

      form.reset();

      // Redirect to binary tree page after successful creation
      router.push('/binary');

    } catch (error: any) {
      console.error('AdminRegister: Error during registration:', error);
      let errorMessage = error.message || 'An unexpected error occurred.';
      if (error.message.includes('already exists')) {
        errorMessage = 'Email or phone number already registered.';
      }
      toast({
        variant: 'destructive',
        title: 'Registration Failed',
        description: errorMessage,
      });
    }

    setIsSubmitting(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="text-foreground text-xl font-bold flex items-center h-full">
            <div className="relative h-16 w-16">
              <Image
                src="/images/LOGO.png"
                alt="Logo"
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
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2"><UserPlus /> {t('register.admin.title')}</CardTitle>
            <CardDescription>
              {t('register.admin.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                        {t('register.selectCompany') || 'Select Company'}
                      </FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value} disabled={loadingCompanies}>
                          <SelectTrigger>
                            <SelectValue placeholder={t('register.chooseCompanyPlaceholder') || 'Choose a company...'} />
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
                        {t('register.chooseCompanyDescription') || 'Select the company this member will join.'}
                      </FormDescription>
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
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('genealogy.phoneNumberLabel')}</FormLabel>
                      <FormControl>
                        <PhoneNumberInput placeholder="+85545678900" {...field} />
                      </FormControl>
                      <FormDescription>
                        {t('register.admin.phoneDescription')}
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
                          {t('register.admin.passwordDescription')}
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
                          {t('register.admin.confirmPasswordDescription')}
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
                      <FormLabel className="flex items-center gap-2"><UserCheck className="h-4 w-4" /> {t('register.admin.idCardNumberLabel')} *</FormLabel>
                      <FormControl>
                        <Input placeholder={t('register.admin.idCardNumberPlaceholder')} {...field} />
                      </FormControl>
                      <FormDescription>
                        {t('register.admin.idCardNumberDescription')}
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
                        <FormLabel>{t('register.admin.sponsorLabel')}</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")} disabled={loadingMembers}>
                                {field.value ? (() => {
                                  const s = members.find(m => m.id === field.value);
                                  return s ? `${s.fullName || ''}${s.memberId ? ` (${s.memberId})` : ''}`.trim() || t('register.admin.selectSponsor') : t('register.admin.selectSponsor');
                                })() : t('register.admin.selectSponsor')}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder={t('genealogy.searchMembers') || 'Search members...'}
                                value={sponsorSearchQuery}
                                onValueChange={setSponsorSearchQuery}
                              />
                              <CommandList>
                                {!sponsorSearchQuery ? (
                                  <div className="py-6 text-center text-sm text-muted-foreground">
                                    {t('genealogy.startTypingToSearch') || 'Type to search for members...'}
                                  </div>
                                ) : (
                                  <>
                                    <CommandEmpty>{t('genealogy.noMemberFound') || 'No member found.'}</CommandEmpty>
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
                        <FormLabel>{t('register.admin.placementParentLabel')}</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")} disabled={loadingMembers}>
                                {field.value ? (() => {
                                  const p = members.find(m => m.id === field.value);
                                  return p ? `${p.fullName || ''}${p.memberId ? ` (${p.memberId})` : ''}`.trim() || t('register.admin.selectPlacement') : t('register.admin.selectPlacement');
                                })() : t('register.admin.selectPlacement')}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder={t('genealogy.searchMembers') || 'Search members...'}
                                value={placementSearchQuery}
                                onValueChange={setPlacementSearchQuery}
                              />
                              <CommandList>
                                {!placementSearchQuery ? (
                                  <div className="py-6 text-center text-sm text-muted-foreground">
                                    {t('genealogy.startTypingToSearch') || 'Type to search for members...'}
                                  </div>
                                ) : (
                                  <>
                                    <CommandEmpty>{t('genealogy.noMemberFound') || 'No member found.'}</CommandEmpty>
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
                      <FormLabel>{t('register.admin.positionLabel')}</FormLabel>
                      {availablePositions && (
                        <div className="text-sm text-muted-foreground mb-2">
                          {!availablePositions.left && !availablePositions.right && (
                            <span className="text-destructive">{t('register.admin.bothPositionsTaken')}</span>
                          )}
                          {availablePositions.left && !availablePositions.right && (
                            <span className="text-amber-600">{t('register.admin.onlyLeftAvailable')}</span>
                          )}
                          {!availablePositions.left && availablePositions.right && (
                            <span className="text-amber-600">{t('register.admin.onlyRightAvailable')}</span>
                          )}
                          {availablePositions.left && availablePositions.right && (
                            <span className="text-green-600">{t('register.admin.bothPositionsAvailable')}</span>
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
                              {t('register.admin.positionLeft')} {availablePositions && !availablePositions.left && `(${t('register.admin.positionTaken')})`}
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
                              {t('register.admin.positionRight')} {availablePositions && !availablePositions.right && `(${t('register.admin.positionTaken')})`}
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Profile preview – same flow as sign-up: only when user is inputting data */}
                {showProfilePreview && (
                  <div className="rounded-lg border-2 border-primary/20 bg-gradient-to-br from-background to-muted/30 p-4 space-y-3 shadow-sm">
                    {previewFullName && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">{t('register.admin.successNameLabel')}:</span>
                        <span className="text-base font-bold text-foreground">{previewFullName}</span>
                      </div>
                    )}
                    {(previewMemberId || isLoadingPreview) && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">{t('register.admin.successMemberIdLabel')}:</span>
                        {isLoadingPreview ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <span className="text-sm font-mono text-cyan-600 font-semibold">{previewMemberId}</span>
                        )}
                      </div>
                    )}
                    {watchedPhoneNumber && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">{t('register.admin.successPhoneLabel')}:</span>
                        <span className="text-sm font-medium">{watchedPhoneNumber}</span>
                      </div>
                    )}
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={isSubmitting || loadingMembers}
                  className="w-full"
                  icon={isSubmitting ? "loading" : "create"}
                >
                  {isSubmitting ? t('register.admin.creatingMember') : t('register.admin.createMemberAccount')}
                </Button>
                <div className="mt-4 text-center text-sm">
                  {t('register.admin.returnToPublic')}{' '}
                  <Link href="/auth/login" className="underline">
                    {t('register.admin.loginPage')}
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
