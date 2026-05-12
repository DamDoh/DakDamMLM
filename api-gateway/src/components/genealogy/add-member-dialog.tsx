
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, UserPlus, Phone, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createMemberDocument } from '../../register/actions';
import { useI18n } from '@/lib/internationalization';
import { PhoneNumberInput } from '../ui/phone-number-input';
import { isValidPhoneNumber } from 'react-phone-number-input';

const formSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters.'),
  surname: z.string().min(2, 'Surname must be at least 2 characters.'),
  email: z.string().email('Please enter a valid email address.').optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  phoneNumber: z.string().refine(isValidPhoneNumber, { message: 'A valid phone number is required.' }),
  idCard: z.any().optional(),
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
  const { toast } = useToast();
  const { t } = useI18n();

  const form = useForm<AddMemberFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      surname: '',
      email: '',
      password: '',
      phoneNumber: '',
    },
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setIsLoading(false);
      setFileName('');
    }
  }, [isOpen, form]);

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

        // Generate a unique userId (cuid format)
        const userId = `cm${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;

        const result = await createMemberDocument({
            userId,
            parentId,
            position,
            firstName: values.firstName,
            surname: values.surname,
            sponsorId: parentId,
            email: values.email || null,
            accountType: 'Distributor',
            phoneNumber: values.phoneNumber,
            idCardUrl: idCardUrl,
        });

        if (result.success && result.userId) {
            toast({
                title: t('genealogy.addMemberSuccess'),
                description: t('genealogy.addMemberSuccessDesc', { fullName: `${values.firstName} ${values.surname}` }),
            });
            onOpenChange(false);
        } else {
            toast({
                variant: 'destructive',
                title: t('register.error.registrationFailed'),
                description: result.error || t('genealogy.registrationFailedError'),
            });
        }
    } catch(error: any) {
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
      <DialogContent className="sm:max-w-lg w-[90vw] rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus /> {t('genealogy.addMember')}
          </DialogTitle>
          <DialogDescription>
            {t('genealogy.addMemberUnder', { fullName: parentFullName, position: position })} {t('genealogy.sponsorIs', { fullName: parentFullName })}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('register.passwordLabel')}</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder={t('register.passwordStrength.weak')} {...field} />
                  </FormControl>
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
            <DialogFooter>
              <Button type="submit" disabled={isLoading} className="w-full" icon={isLoading ? "loading" : "add"}>
                {isLoading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    <UserPlus />
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
