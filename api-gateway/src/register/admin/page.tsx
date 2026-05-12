
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/internationalization';
import { PhoneNumberInput } from '@/components/ui/phone-number-input';
import { isValidPhoneNumber } from 'react-phone-number-input';
import { LanguageSelector } from '@/components/ui/language-selector';
import { getAllMembers } from '@/services/server-actions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { Member } from '@/lib/types';
import { prisma } from '@/lib/database';
import bcrypt from 'bcryptjs';


const formSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters.'),
  surname: z.string().min(2, 'Surname must be at least 2 characters.'),
  phoneNumber: z.string().refine(isValidPhoneNumber, { message: 'A valid phone number is required.' }),
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters long.'),
  sponsorId: z.string().min(1, "A sponsor is required for placement."),
  parentId: z.string().min(1, "A parent is required for placement."),
  position: z.enum(['left', 'right'], { required_error: 'You must select a position.'}),
});

type RegisterFormValues = z.infer<typeof formSchema>;

export default function AdminRegisterPage() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      surname: '',
      phoneNumber: '',
      email: '',
      password: '',
      sponsorId: '',
      parentId: '',
    },
  });

  useEffect(() => {
    async function loadMembers() {
        setLoadingMembers(true);
        const allMembers = await getAllMembers();
        setMembers(allMembers);
        setLoadingMembers(false);
    }
    loadMembers();
  }, []);

  const onSubmit = async (values: RegisterFormValues) => {
    setIsSubmitting(true);

    try {
      // Check if email or phone number already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: values.email },
            { phoneNumber: values.phoneNumber }
          ]
        }
      });

      if (existingUser) {
        throw new Error('Email or phone number already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(values.password, 12);

      // Generate member ID
      const memberId = `DK${Date.now().toString().slice(-6)}`;

      // Create user in database
      const newUser = await prisma.user.create({
        data: {
          email: values.email,
          phoneNumber: values.phoneNumber,
          password: hashedPassword,
          firstName: values.firstName,
          surname: values.surname,
          fullName: `${values.firstName} ${values.surname}`,
          memberId: memberId,
          accountType: 'Distributor',
          sponsorId: values.sponsorId,
          placementParentId: values.parentId,
          position: values.position,
          active: true,
          isAdmin: false,
          teamSize: {},
          children: {},
          addresses: {},
        }
      });

      toast({
        title: t('register.admin.successTitle'),
        description: t('register.admin.successDescription', {fullName: values.firstName}),
      });

      form.reset();

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
          <div className="flex items-center justify-between p-4">
            <div className="text-foreground text-xl font-bold">
              {t('login.portalTitle')}
            </div>
            <LanguageSelector />
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2"><UserPlus /> Create New Member</CardTitle>
            <CardDescription>
              Manually create a new member and place them in the genealogy tree.
            </CardDescription>
          </CardHeader>
          <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                            <PhoneNumberInput {...field} />
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
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder={t('register.emailPlaceholder')} {...field} />
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
                        <FormLabel>{t('register.passwordLabel')}</FormLabel>
                        <FormControl>
                            <Input type="password" {...field} />
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
                                <FormLabel>Sponsor</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                        <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                                            {field.value ? members.find(m => m.id === field.value)?.fullName : "Select Sponsor"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Search member..." /><CommandList><CommandEmpty>No members found.</CommandEmpty><CommandGroup>
                                        {members.map(m => (
                                            <CommandItem value={m.fullName} key={m.id} onSelect={() => form.setValue("sponsorId", m.id)}>
                                            <Check className={cn("mr-2 h-4 w-4", m.id === field.value ? "opacity-100" : "opacity-0")} />
                                            {m.fullName} ({m.memberId})
                                            </CommandItem>
                                        ))}
                                    </CommandGroup></CommandList></Command></PopoverContent>
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
                                <FormLabel>Placement Parent</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                        <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                                            {field.value ? members.find(m => m.id === field.value)?.fullName : "Select Placement"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Search member..." /><CommandList><CommandEmpty>No members found.</CommandEmpty><CommandGroup>
                                        {members.map(m => (
                                            <CommandItem value={m.fullName} key={m.id} onSelect={() => form.setValue("parentId", m.id)}>
                                            <Check className={cn("mr-2 h-4 w-4", m.id === field.value ? "opacity-100" : "opacity-0")} />
                                            {m.fullName} ({m.memberId})
                                            </CommandItem>
                                        ))}
                                    </CommandGroup></CommandList></Command></PopoverContent>
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
                            <FormLabel>Position</FormLabel>
                            <FormControl>
                            <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="flex space-x-4"
                            >
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl><RadioGroupItem value="left" /></FormControl>
                                <FormLabel className="font-normal">Left</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl><RadioGroupItem value="right" /></FormControl>
                                <FormLabel className="font-normal">Right</FormLabel>
                                </FormItem>
                            </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                  <Button
                    type="submit"
                    disabled={isSubmitting || loadingMembers}
                    className="w-full"
                    icon={isSubmitting ? "loading" : "create"}
                  >
                    {isSubmitting ? 'Creating Member...' : 'Create Member Account'}
                  </Button>
                  <div className="mt-4 text-center text-sm">
                      Return to the public{' '}
                      <Link href="/auth/login" className="underline">
                          Login Page
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
