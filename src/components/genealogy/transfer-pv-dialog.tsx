
'use client';

import { useState } from 'react';
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
import { Loader2, Coins } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatPV } from '@/lib/utils';

const formSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0').max(1000000, 'Amount is too large'),
});

type TransferPVFormValues = z.infer<typeof formSchema>;

interface TransferPVDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  memberId: string;
  memberName: string;
  currentPV: number;
  onTransferSuccess: () => void;
}

export default function TransferPVDialog({
  isOpen,
  onOpenChange,
  memberId,
  memberName,
  currentPV,
  onTransferSuccess,
}: TransferPVDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<TransferPVFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
    },
  });

  const onSubmit = async (values: TransferPVFormValues) => {
    setIsLoading(true);
    try {
      // Get auth token from localStorage
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      const response = await fetch(`/api/members/${memberId}/transfer-pv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: values.amount,
        }),
      });

      // Handle non-JSON responses
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || `Server error: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        const errorMessage = data.error || data.message || `Failed to top-up PV: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }

      toast({
        title: 'PV Topped Up Successfully',
        description: `Topped up ${formatPV(values.amount)} PV to ${memberName}.`,
      });

      form.reset();
      onTransferSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Failed to top-up PV:', error);
      toast({
        variant: 'destructive',
        title: 'Top-Up Failed',
        description: error.message || 'Failed to top-up PV. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Top-Up PV to Member
          </DialogTitle>
          <DialogDescription>
            Top-Up PV to {memberName}. Current PV: {formatPV(currentPV)}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PV Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    Enter the amount of PV to top-up to this member.
                  </p>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    Topping up...
                  </>
                ) : (
                  'Top-Up PV'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

