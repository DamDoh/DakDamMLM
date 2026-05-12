'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Loader2, UserPlus, Phone, Upload, UserCheck, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createMemberDocument } from '@/app/register/actions';
import { useI18n } from '@/lib/internationalization';
import { PhoneNumberInput } from '../ui/phone-number-input';
import { isValidPhoneNumber } from 'react-phone-number-input';
import { useGenealogyContext } from '@/context/genealogy-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Building2 } from 'lucide-react';
import type { Company } from '@/lib/types';
import { accountTypes } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  companyId: z.string().min(1, 'Company selection is required.'),
  accountType: z.enum(['Customer', 'Distributor'] as [string, ...string[]]),
  sponsorId: z.string().min(1, 'Sponsor selection is required.'),
  uplineId: z.string().min(1, 'Upline (Placement) selection is required.'),
  firstName: z.string().min(2, 'First name must be at least 2 characters.'),
  surname: z.string().min(2, 'Surname must be at least 2 characters.'),
  email: z.string()
    .optional()
    .or(z.literal(''))
    .refine((val) => !val || z.string().email().safeParse(val).success, {
      message: 'Please enter a valid email address.',
    }),
  password: z.string().optional().or(z.literal('')),
  phoneNumber: z.string().refine(isValidPhoneNumber, { message: 'A valid phone number is required.' }),
  idCardNumber: z.string().min(1, 'ID card number is required.').regex(/^[0-9]+$/, 'ID card number must contain only numbers.'),
  idCard: z.any().optional(),
}).superRefine((data, ctx) => {
  // If email is provided, password is required
  if (data.email && data.email.trim() !== '') {
    if (!data.password || data.password.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Password is required.',
        path: ['password'],
      });
    }
  }
  // If email is not provided, password is optional (no validation needed)
  // Password is automatically set to last 4 digits of ID card, so no minimum length validation needed
});

type AddMemberFormValues = z.infer<typeof formSchema>;

interface AddMemberDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  parentId: string;
  position: 'left' | 'right';
  parentFullName: string;
}

export default function AddMemberDialog({ isOpen, onOpenChange, parentId, position, parentFullName }: AddMemberDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const { toast } = useToast();
  const { t } = useI18n();
  const context = useGenealogyContext();
  const refreshMembers = context ? context.refreshMembers : async () => { };
  const allMembersMap = context?.allMembersMap || new Map();
  const currentUserId = context?.userId || null;

  // Get parent member information
  const parentMember = parentId ? allMembersMap.get(parentId) : null;
  const parentMemberId = parentMember?.memberId || '';

  const form = useForm<AddMemberFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyId: '',
      accountType: 'Distributor',
      sponsorId: parentId || '', // Default to parentId as sponsor
      uplineId: parentId || '', // Default to parentId as upline (placement)
      firstName: '',
      surname: '',
      email: '',
      password: '',
      phoneNumber: '',
      idCardNumber: '',
    },
  });

  // State for member search
  const [sponsorSearchOpen, setSponsorSearchOpen] = useState(false);
  const [uplineSearchOpen, setUplineSearchOpen] = useState(false);
  const [availableMembers, setAvailableMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [sponsorSearchQuery, setSponsorSearchQuery] = useState('');
  const [uplineSearchQuery, setUplineSearchQuery] = useState('');

  // Fetch all available members for sponsor/upline selection
  useEffect(() => {
    if (isOpen) {
      fetchAvailableMembers();
    }
  }, [isOpen]);

  const fetchAvailableMembers = async () => {
    setLoadingMembers(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        setAvailableMembers([]);
        return;
      }

      const response = await fetch('/api/members', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Handle different response formats:
        // - Direct array: data
        // - Wrapped with success: data.data
        // - Legacy format: data.members
        const membersArray = Array.isArray(data)
          ? data
          : (data.data || data.members || []);
        setAvailableMembers(membersArray);
      } else {
        setAvailableMembers([]);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
      setAvailableMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  // Load companies on mount
  useEffect(() => {
    async function loadCompanies() {
      setLoadingCompanies(true);
      try {
        const companiesResponse = await fetch('/api/company');
        if (companiesResponse.ok) {
          const companiesData = await companiesResponse.json();
          const companiesArray = Array.isArray(companiesData) ? companiesData : [];
          setCompanies(companiesArray);

          // Auto-select first company if only one exists
          if (companiesArray.length === 1) {
            form.setValue('companyId', companiesArray[0].id, { shouldValidate: true });
          }
        } else {
          setCompanies([]);
        }
      } catch (error) {
        console.error('Error loading companies:', error);
        setCompanies([]);
      } finally {
        setLoadingCompanies(false);
      }
    }

    if (isOpen) {
      loadCompanies();
    }
  }, [isOpen, form]);

  const watchedIdCardNumber = form.watch('idCardNumber');
  const watchedFirstName = form.watch('firstName');
  const watchedSurname = form.watch('surname');
  const watchedPhoneNumber = form.watch('phoneNumber');
  const watchedSponsorId = form.watch('sponsorId');
  const [previewMemberId, setPreviewMemberId] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Generate preview member ID and full name
  const previewFullName = watchedFirstName && watchedSurname
    ? `${watchedFirstName} ${watchedSurname}`.trim()
    : '';

  // Fetch preview member ID following sponsor's pattern when form has required fields
  useEffect(() => {
    const fetchPreviewMemberId = async () => {
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

      // Use selected sponsorId, fallback to parentId
      const sponsorIdToUse = watchedSponsorId || parentId;
      if (!sponsorIdToUse) {
        setPreviewMemberId('');
        return;
      }

      setIsLoadingPreview(true);
      try {
        // Use selected sponsorId to generate ID following sponsor's pattern
        // If sponsor has SK3480, new member will get SK3481, etc.
        const queryParams = sponsorIdToUse ? `?sponsorId=${sponsorIdToUse}` : '';

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
    const timeoutId = setTimeout(fetchPreviewMemberId, 300);
    return () => clearTimeout(timeoutId);
  }, [watchedFirstName, watchedSurname, watchedPhoneNumber, watchedSponsorId, parentId]);

  // Check if we have enough info to show profile preview
  const showProfilePreview = previewFullName || previewMemberId || watchedPhoneNumber;

  // Auto-fill password with last 4 digits of ID card number
  useEffect(() => {
    if (watchedIdCardNumber && watchedIdCardNumber.length >= 4) {
      const last4Digits = watchedIdCardNumber.slice(-4);
      form.setValue('password', last4Digits, { shouldValidate: false });
    }
  }, [watchedIdCardNumber, form]);

  useEffect(() => {
    if (!isOpen) {
      form.reset({
        companyId: '',
        accountType: 'Distributor',
        sponsorId: parentId || '',
        uplineId: parentId || '',
        firstName: '',
        surname: '',
        email: '',
        password: '',
        phoneNumber: '',
        idCardNumber: '',
      });
      setIsLoading(false);
      setFileName('');
      setSponsorSearchOpen(false);
      setUplineSearchOpen(false);
    } else {
      // Reset to default values when dialog opens
      form.reset({
        companyId: '',
        accountType: 'Distributor',
        sponsorId: parentId || '',
        uplineId: parentId || '',
        firstName: '',
        surname: '',
        email: '',
        password: '',
        phoneNumber: '',
        idCardNumber: '',
      });
    }
  }, [isOpen, form, parentId]);

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const onSubmit = async (values: AddMemberFormValues) => {
    setIsLoading(true);

    try {
      let idCardUrl;
      if (values.idCard?.[0]) {
        idCardUrl = await fileToDataUrl(values.idCard[0]);
      }

      // Extract last 4 digits from ID card number to use as password
      const idCardNumberStr = String(values.idCardNumber).trim();
      const extractedPassword = idCardNumberStr.length >= 4 ? idCardNumberStr.slice(-4) : '';

      // Always use the last 4 digits of ID card number as the password
      const finalPassword = extractedPassword || (values.password && values.password.trim() !== '' ? values.password : undefined);

      // Determine position based on upline's children
      const uplineMember = allMembersMap.get(values.uplineId);
      let finalPosition = position; // Default to the position from props
      if (uplineMember) {
        // If upline has no left child, place on left; otherwise on right
        if (!uplineMember.children?.left) {
          finalPosition = 'left';
        } else if (!uplineMember.children?.right) {
          finalPosition = 'right';
        }
        // If both exist, use the original position
      }

      const result = await createMemberDocument({
        parentId: values.uplineId, // Use selected upline as placement parent
        position: finalPosition,
        firstName: values.firstName,
        surname: values.surname,
        sponsorId: values.sponsorId, // Use selected sponsor
        email: values.email || null,
        accountType: values.accountType,
        companyId: values.companyId,
        phoneNumber: values.phoneNumber,
        idCardUrl: idCardUrl,
        password: finalPassword,
        idCardNumber: values.idCardNumber,
        storeOwnerLevel: null,
        currentUserId: currentUserId || undefined,
      });

      if (result.success && result.userId) {
        // Show success message first
        toast({
          title: t('genealogy.addMemberSuccess'),
          description: t('genealogy.addMemberSuccessDesc', { fullName: `${values.firstName} ${values.surname}` }),
          duration: 5000, // Show for 5 seconds
        });

        // Reset form immediately
        form.reset();
        setFileName('');

        // Refresh the genealogy tree to show the new member BEFORE closing dialog
        // Add a delay to ensure database commit is complete
        try {
          console.log('Refreshing genealogy tree after member creation...');

          // First refresh after a short delay
          await new Promise(resolve => setTimeout(resolve, 500));
          if (context?.refreshMembers) {
            await context.refreshMembers();
            console.log('Genealogy tree refreshed successfully');
          }

          // Second refresh after a longer delay to ensure everything is committed
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (context?.refreshMembers) {
            await context.refreshMembers();
            console.log('Second refresh completed');
          }

          // Close dialog after refresh is complete
          onOpenChange(false);
        } catch (refreshError) {
          console.error('Failed to refresh members:', refreshError);
          // Close dialog even if refresh fails
          onOpenChange(false);
          // Show error toast if refresh fails
          toast({
            variant: 'destructive',
            title: 'Refresh Warning',
            description: 'Member was added but the tree may need manual refresh. Please refresh the page.',
            duration: 5000,
          });
        }
      } else {
        toast({
          variant: 'destructive',
          title: t('register.error.registrationFailed'),
          description: result.error || t('genealogy.registrationFailedError'),
          duration: 5000,
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('register.error.registrationFailed'),
        description: error.message || 'An unexpected error occurred.',
      });
    }

    setIsLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg w-[90vw] rounded-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus /> {t('genealogy.addMember')}
          </DialogTitle>
          <DialogDescription>
            {t('genealogy.addMemberUnder', { fullName: parentFullName, position: position })} {t('genealogy.sponsorIs', { fullName: parentFullName })}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex-1 overflow-y-auto px-1 -mx-1 space-y-4 max-h-[60vh]">
              {/* Company Selection */}
              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {t('register.selectCompany')} *
                    </FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={loadingCompanies}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={loadingCompanies ? t('common.loading') : t('register.chooseCompanyPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
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

              {/* Account Type Selection */}
              <FormField
                control={form.control}
                name="accountType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>{t('register.accountTypeLabel')}</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <FormLabel className="flex items-center gap-2">
                      <Phone className="h-4 w-4" /> {t('genealogy.phoneNumberLabel')}
                    </FormLabel>
                    <FormControl>
                      <PhoneNumberInput {...field} placeholder="+85545678900" />
                    </FormControl>
                    <FormDescription>
                      {t('genealogy.phoneNumberDescription')}
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
              <FormField
                control={form.control}
                name="idCardNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4" /> {t('genealogy.idCardNumberLabel')} *
                    </FormLabel>
                    <FormControl>
                      <Input placeholder={t('genealogy.idCardNumberPlaceholder')} {...field} />
                    </FormControl>
                    <FormDescription>
                      {t('genealogy.idCardNumberDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => {
                  const emailValue = form.watch('email');
                  const isPasswordRequired = emailValue && emailValue.trim() !== '';
                  return (
                    <FormItem>
                      <FormLabel>
                        {t('register.passwordLabel')} {isPasswordRequired ? '' : `(${t('genealogy.passwordAutoGenerated')})`}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder={t('genealogy.passwordAutoFilledPlaceholder')}
                            {...field}
                            readOnly
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
                        {t('genealogy.passwordAutoDescription')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
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

              {/* Sponsor and Upline Selection - Side by Side (Moved to Bottom) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sponsorId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t('genealogy.sponsorLabel') || 'Sponsor'}</FormLabel>
                      <Popover
                        open={sponsorSearchOpen}
                        onOpenChange={(open) => {
                          setSponsorSearchOpen(open);
                          if (!open) {
                            setSponsorSearchQuery('');
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                              disabled={loadingMembers}
                            >
                              {field.value
                                ? (() => {
                                  const selected = availableMembers.find(m => m.id === field.value);
                                  return selected ? `${selected.fullName || `${selected.firstName || ''} ${selected.surname || ''}`.trim()} (${selected.memberId || ''})` : "Select Sponsor";
                                })()
                                : (t('genealogy.selectSponsor') || "Select Sponsor")}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder={t('genealogy.searchMembers') || "Search members..."}
                              value={sponsorSearchQuery}
                              onValueChange={setSponsorSearchQuery}
                            />
                            <CommandList>
                              {!sponsorSearchQuery ? (
                                <div className="py-6 text-center text-sm text-muted-foreground">
                                  {t('genealogy.startTypingToSearch') || "Type to search for members..."}
                                </div>
                              ) : (
                                <>
                                  <CommandEmpty>{t('genealogy.noMemberFound') || "No member found."}</CommandEmpty>
                                  <CommandGroup>
                                    {availableMembers
                                      .filter((member) => {
                                        const searchLower = sponsorSearchQuery.toLowerCase();
                                        const fullName = (member.fullName || `${member.firstName || ''} ${member.surname || ''}`.trim() || 'Unknown').toLowerCase();
                                        const memberId = (member.memberId || '').toLowerCase();
                                        return fullName.includes(searchLower) || memberId.includes(searchLower);
                                      })
                                      .map((member) => {
                                        const fullName = member.fullName || `${member.firstName || ''} ${member.surname || ''}`.trim() || 'Unknown';
                                        return (
                                          <CommandItem
                                            value={`${fullName} ${member.memberId || ''}`}
                                            key={member.id}
                                            onSelect={() => {
                                              field.onChange(member.id);
                                              setSponsorSearchOpen(false);
                                              setSponsorSearchQuery('');
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                member.id === field.value ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            <div className="flex flex-col flex-1">
                                              <span className="font-medium">{fullName}</span>
                                              <span className="text-sm text-muted-foreground">{member.memberId || ''}</span>
                                            </div>
                                          </CommandItem>
                                        );
                                      })}
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
                  name="uplineId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t('genealogy.uplineLabel') || 'Upline'}</FormLabel>
                      <Popover
                        open={uplineSearchOpen}
                        onOpenChange={(open) => {
                          setUplineSearchOpen(open);
                          if (!open) {
                            setUplineSearchQuery('');
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                              disabled={loadingMembers}
                            >
                              {field.value
                                ? (() => {
                                  const selected = availableMembers.find(m => m.id === field.value);
                                  return selected ? `${selected.fullName || `${selected.firstName || ''} ${selected.surname || ''}`.trim()} (${selected.memberId || ''})` : "Select Placement";
                                })()
                                : (t('genealogy.selectPlacement') || "Select Placement")}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder={t('genealogy.startTypingToSearch') || "Start typing to search..."}
                              value={uplineSearchQuery}
                              onValueChange={setUplineSearchQuery}
                            />
                            <CommandList>
                              {!uplineSearchQuery ? (
                                <div className="py-6 text-center text-sm text-muted-foreground">
                                  {t('genealogy.startTypingToSearch') || "Start typing to search..."}
                                </div>
                              ) : (
                                <>
                                  <CommandEmpty>{t('genealogy.noMemberFound') || "No member found."}</CommandEmpty>
                                  <CommandGroup>
                                    {availableMembers
                                      .filter((member) => {
                                        const searchLower = uplineSearchQuery.toLowerCase();
                                        const fullName = (member.fullName || `${member.firstName || ''} ${member.surname || ''}`.trim() || 'Unknown').toLowerCase();
                                        const memberId = (member.memberId || '').toLowerCase();
                                        return fullName.includes(searchLower) || memberId.includes(searchLower);
                                      })
                                      .map((member) => {
                                        const fullName = member.fullName || `${member.firstName || ''} ${member.surname || ''}`.trim() || 'Unknown';
                                        return (
                                          <CommandItem
                                            value={`${fullName} ${member.memberId || ''}`}
                                            key={member.id}
                                            onSelect={() => {
                                              field.onChange(member.id);
                                              setUplineSearchOpen(false);
                                              setUplineSearchQuery('');
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                member.id === field.value ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            <div className="flex flex-col flex-1">
                                              <span className="font-medium">{fullName}</span>
                                              <span className="text-sm text-muted-foreground">{member.memberId || ''}</span>
                                            </div>
                                          </CommandItem>
                                        );
                                      })}
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

              {/* Profile Preview - Bottom of Form */}
              {showProfilePreview && (
                <div className="rounded-lg border-2 border-primary/20 bg-gradient-to-br from-background to-muted/30 p-4 space-y-3 shadow-sm">
                  {previewFullName && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">{t('genealogy.profilePreviewName')}</span>
                      <span className="text-base font-bold text-foreground">{previewFullName}</span>
                    </div>
                  )}
                  {(previewMemberId || isLoadingPreview) && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">{t('genealogy.profilePreviewMemberId')}</span>
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
                      <span className="text-sm font-medium text-muted-foreground">{t('genealogy.profilePreviewPhone')}</span>
                      <span className="text-sm font-medium">{watchedPhoneNumber}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('genealogy.addingMember')}
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    {t('genealogy.addMember')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
