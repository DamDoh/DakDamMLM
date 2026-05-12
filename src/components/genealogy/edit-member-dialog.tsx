

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
import type { Member } from '@/lib/types';
import type { Rank } from '@/lib/rank';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/lib/internationalization';
import { PhoneNumberInput } from '@/components/ui/phone-number-input';
import { checkProfileConflicts } from '@/services/server-actions';
import { getPVForRank } from '@/lib/rank';
import { getMaintenanceTopupAmount } from '@/lib/maintenance';
import { useGenealogyContext } from '@/context/genealogy-context';
import { useAuthContext } from '@/context/auth-context';
import TransferPVDialog from './transfer-pv-dialog';

// Only the 9 ranks: Member (0 PV) + the 8 ranks from the table
const availableRanks: (Rank | 'Double President')[] = [
  'Member',           // 0 PV
  'Bronze',           // 60 PV
  'Silver',           // 100 PV
  'Gold',             // 500 PV
  'Diamond',          // 1000 PV
  'Manager',          // 1000 PV
  'Director',         // 1000 PV
  'President',        // 1000 PV
  'Double President' as any, // 1000 PV
];


const formSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters.'),
  surname: z.string().min(2, 'Surname must be at least 2 characters.'),
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 characters.'),
  email: z.string().email('Please enter a valid email address.').optional().or(z.literal('')),
  rank: z.enum(availableRanks as [string, ...string[]] as [string, ...string[]]),
  pv: z.coerce.number().min(0, 'PV must be a positive number.').optional(),
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
  const [isTransferPVDialogOpen, setTransferPVDialogOpen] = useState(false);
  const [maintenanceStatus, setMaintenanceStatus] = useState<{
    isMaintained: boolean;
    daysRemaining: number;
    maintainStatus: string;
  } | null>(null);
  const [loadingMaintenance, setLoadingMaintenance] = useState(false);
  const [isToppingUpMaintenance, setIsToppingUpMaintenance] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();
  const { user: authUser } = useAuthContext();
  const genealogyContext = useGenealogyContext();
  const rootMember = genealogyContext?.rootMember ?? null;
  const isAdminStock = !!(
    rootMember?.storeOwnerLevel &&
    ['S', 'M', 'C', 'D'].includes(rootMember.storeOwnerLevel)
  );
  const isAdmin = !!(authUser as any)?.isAdmin;
  const canTopUpMaintenance = isAdminStock || isAdmin;

  const form = useForm<EditMemberFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      surname: '',
      phoneNumber: '',
      email: '',
      pv: 0,
      active: true,
    },
  });


  useEffect(() => {
    if (!isOpen) {
      setIsLoading(false);
      setMaintenanceStatus(null);
      setLoadingMaintenance(false);
    }
  }, [isOpen]);

  const fetchMaintenanceStatus = async () => {
    if (!member?.id) {
      setMaintenanceStatus(null);
      return;
    }
    setLoadingMaintenance(true);
    setMaintenanceStatus(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) return;
      const res = await fetch(`/api/members/${member.id}/details`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const maintained = !!data.isMaintained;
      const daysRem = typeof data.maintenanceDaysRemaining === 'number' ? data.maintenanceDaysRemaining : 0;
      const status = typeof data.maintainStatus === 'string' ? data.maintainStatus : (maintained ? 'MAINTAINED' : 'NOT_MAINTAINED');
      setMaintenanceStatus({
        isMaintained: maintained,
        daysRemaining: daysRem,
        maintainStatus: status,
      });
    } catch (e) {
      console.error('Failed to fetch maintenance status:', e);
      setMaintenanceStatus(null);
    } finally {
      setLoadingMaintenance(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !member?.id) {
      setMaintenanceStatus(null);
      return;
    }
    fetchMaintenanceStatus();
  }, [isOpen, member?.id]);

  useEffect(() => {
    if (isOpen && member) {
      form.reset({
        firstName: member.firstName,
        surname: member.surname,
        phoneNumber: member.phoneNumber,
        email: member.email || '',
        rank: member.rank,
        pv: member.pv || 0,
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

    // When admin only selects rank: update rank only; do NOT update PV.
    // PV will show on E-comm only after a Top-Up PV. Commissions still use rank.
    const selectedRank = values.rank as Rank;

    const success = await onUpdateMember(member.id, {
      firstName: values.firstName,
      surname: values.surname,
      email: values.email || null,
      phoneNumber: values.phoneNumber,
      rank: selectedRank as any,
      active: values.active,
      rankOnlyNoPv: true, // E-comm shows rank only, no PV until Top-Up
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

  const handleTopUpMaintenance = async () => {
    if (!member?.id || isToppingUpMaintenance) return;
    const required = getMaintenanceTopupAmount(member.rank);
    setIsToppingUpMaintenance(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please log in again.' });
        return;
      }
      const res = await fetch('/api/maintenance-topup-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetMemberId: member.id, amount: required }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: t('genealogy.maintenanceTopUpFailed'),
          description: data.message || data.error || t('genealogy.maintenanceTopUpFailedDesc'),
        });
        return;
      }
      toast({
        title: t('genealogy.maintenancePaidSuccess'),
        description: data.message || t('genealogy.maintenancePaidSuccessDesc', {
          amount: String(required),
          memberName: `${member.firstName} ${member.surname}`,
        }),
      });
      await fetchMaintenanceStatus();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to top up maintenance.',
      });
    } finally {
      setIsToppingUpMaintenance(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <UserCog /> {t('genealogy.editMember')}
          </DialogTitle>
          <DialogDescription>
            {t('genealogy.editMemberDetails', { fullName: `${member.firstName} ${member.surname}` })}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-1 -mx-1 space-y-4 max-h-[60vh]">
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
            <FormField
              control={form.control}
              name="rank"
              render={({ field }) => {
                const handleRankChange = (newRank: string) => {
                  field.onChange(newRank);
                  // Display-only: show PV for selected rank (not saved; use Top-Up to set PV on E-comm)
                  const selectedRank = newRank as Rank;
                  const requiredPV = getPVForRank(selectedRank);
                  form.setValue('pv', requiredPV);
                };

                return (
                  <FormItem>
                    <FormLabel>{t('profile.rank')}</FormLabel>
                    <Select onValueChange={handleRankChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a rank" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableRanks.map(rank => (
                          <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Rank only: PV will not show on E-comm until you Top-Up PV for this member.
                    </p>
                  </FormItem>
                );
              }}
            />
            <FormField
              control={form.control}
              name="pv"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>PV (Point Value)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        step="1"
                        placeholder="0" 
                        {...field}
                        value={field.value ?? 0}
                        disabled={true}
                        readOnly={true}
                        className="bg-muted cursor-not-allowed"
                      />
                    </FormControl>
                    <FormMessage />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Rank-only edit: PV will not show on E-comm until you Top-Up PV. To set PV and show on E-comm, use Top-Up PV.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setTransferPVDialogOpen(true)}
                        className="ml-2"
                      >
                        Top-Up PV
                      </Button>
                    </div>
                  </FormItem>
                );
              }}
            />

            {/* Maintenance: status + admin top-up (below Top-Up PV) */}
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel className="text-sm font-medium">{t('genealogy.maintenanceLabel')}</FormLabel>
                {canTopUpMaintenance && !maintenanceStatus?.isMaintained && !loadingMaintenance && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTopUpMaintenance}
                    disabled={isToppingUpMaintenance}
                  >
                    {isToppingUpMaintenance ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        {t('genealogy.toppingUpMaintenance')}
                      </>
                    ) : (
                      t('genealogy.topUpMaintenance')
                    )}
                  </Button>
                )}
              </div>
              {loadingMaintenance ? (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('genealogy.loadingMaintenance')}
                </p>
              ) : maintenanceStatus ? (
                maintenanceStatus.isMaintained ? (
                  <p className="text-sm text-green-700 font-medium">
                    {t('genealogy.maintenancePaid', {
                      days: String(maintenanceStatus.daysRemaining),
                      month: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
                    })}
                  </p>
                ) : (
                  <p className="text-sm text-amber-700 font-medium">
                    {t('genealogy.maintenanceUnpaid', {
                      month: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
                    })}
                  </p>
                )
              ) : (
                <p className="text-xs text-muted-foreground">—</p>
              )}
              <p className="text-xs text-muted-foreground">
                {t('genealogy.maintenanceDescription', {
                  amount: String(getMaintenanceTopupAmount(member.rank)),
                })}
              </p>
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
            </div>
            <DialogFooter className="flex-shrink-0">
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
        <TransferPVDialog
          isOpen={isTransferPVDialogOpen}
          onOpenChange={setTransferPVDialogOpen}
          memberId={member.id}
          memberName={`${member.firstName} ${member.surname}`}
          currentPV={member.pv || 0}
          onTransferSuccess={() => {
            // Refresh member data after transfer
            // Close the edit dialog and let parent component refresh
            onOpenChange(false);
            // Optionally trigger a page refresh to show updated PV
            setTimeout(() => {
              window.location.reload();
            }, 500);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
