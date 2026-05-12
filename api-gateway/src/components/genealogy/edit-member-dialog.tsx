

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
import { Loader2, UserCog } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Member, Rank, StockistLevel } from '@/lib/types';
import { ranks, stockistLevels } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/lib/internationalization';
import { PhoneNumberInput } from '@/components/ui/phone-number-input';
import { checkProfileConflicts } from '@/services/server-actions';


const formSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters.'),
  surname: z.string().min(2, 'Surname must be at least 2 characters.'),
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 characters.'),
  email: z.string().email('Please enter a valid email address.').optional().or(z.literal('')),
  rank: z.enum(ranks as [string, ...string[]]),
  storeOwnerLevel: z.union([z.enum(stockistLevels as [string, ...string[]]), z.literal('None')]),
  active: z.boolean(),
});

type EditMemberFormValues = z.infer<typeof formSchema>;

interface EditMemberDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  member: Member;
  onUpdateMember: (memberId: string, updatedData: Partial<Member>) => Promise<boolean>;
}

export default function EditMemberDialog({ isOpen, onOpenChange, member, onUpdateMember }: EditMemberDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  const form = useForm<EditMemberFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      surname: '',
      phoneNumber: '',
      email: '',
      active: true,
    },
  });


  useEffect(() => {
    if (!isOpen) {
      setIsLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && member) {
      form.reset({
        firstName: member.firstName,
        surname: member.surname,
        phoneNumber: member.phoneNumber,
        email: member.email || '',
        rank: member.rank,
        storeOwnerLevel: member.storeOwnerLevel || 'None',
        active: member.active,
      });
    }
  }, [isOpen, member, form]);

  const onSubmit = async (values: EditMemberFormValues) => {
    setIsLoading(true);

    // Check for conflicts with existing email/phone
    const { phoneConflict, emailConflict } = await checkProfileConflicts(member.id, {
      phoneNumber: values.phoneNumber,
      email: values.email || null
    });

    if (phoneConflict) {
      toast({
        variant: 'destructive',
        title: 'Phone Number Conflict',
        description: 'This phone number is already in use by another member.',
      });
      setIsLoading(false);
      return;
    }

    if (emailConflict) {
      toast({
        variant: 'destructive',
        title: 'Email Conflict',
        description: 'This email address is already in use by another member.',
      });
      setIsLoading(false);
      return;
    }

    const success = await onUpdateMember(member.id, {
      firstName: values.firstName,
      surname: values.surname,
      email: values.email || null,
      phoneNumber: values.phoneNumber,
      rank: values.rank as Rank,
      storeOwnerLevel: values.storeOwnerLevel === 'None' ? null : values.storeOwnerLevel as StockistLevel,
      active: values.active,
    });

    setIsLoading(false);

    if (success) {
      toast({
        title: 'Member Updated',
        description: `Successfully updated ${values.firstName} ${values.surname}.`,
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog /> {t('genealogy.editMember')}
          </DialogTitle>
          <DialogDescription>
            {t('genealogy.editMemberDetails', { fullName: `${member.firstName} ${member.surname}` })}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <PhoneNumberInput placeholder={t('register.phonePlaceholder')} {...field} />
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
                  <FormLabel>Email (optional)</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder={t('register.emailPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="rank"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('profile.rank')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a rank" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ranks.map(rank => (
                          <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="storeOwnerLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('profile.stockistLevel')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Stockist Level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="None">None</SelectItem>
                        {stockistLevels.map(level => (
                          <SelectItem key={level} value={level}>{`${level} Stockist`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
             <FormField
                control={form.control}
                name="active"
                render={({ field }) => {
                  const isDisabled = member.isAdmin || member.deleted;
                  return (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>{t('genealogy.activeStatus')}</FormLabel>
                        <FormMessage />
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isDisabled}
                        />
                      </FormControl>
                    </FormItem>
                  );
                }}
              />
            <DialogFooter>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    {t('common.save')}
                  </>
                ) : (
                  t('common.save')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
