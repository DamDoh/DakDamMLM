
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
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/context/auth-context';
import { useI18n } from '@/lib/internationalization';
import { formatCurrency, formatPV } from '@/lib/utils';
import Image from 'next/image';

const formSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive.'),
  remark: z.string().optional(),
  proof: z.any().refine(files => files?.length === 1, "Proof of transaction is required."),
});

type TopUpFormValues = z.infer<typeof formSchema>;

interface TopUpDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  balance: number;
}

export default function TopUpDialog({ isOpen, onOpenChange, balance }: TopUpDialogProps) {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuthContext();

  const form = useForm<TopUpFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      remark: '',
    },
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setIsLoading(false);
      setFileName('');
      setImagePreview(null);
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

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        form.setValue('proof', event.target.files);
        setFileName(file.name);
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (values: TopUpFormValues) => {
    setIsLoading(true);
    if (!user) {
      toast({ variant: 'destructive', title: t('common.error'), description: t('ecash.dialog.authError') });
      setIsLoading(false);
      return;
    }

    try {
       const file = values.proof?.[0];
       if (!file) {
           toast({ variant: 'destructive', title: 'Proof Required', description: 'Please upload proof of your transaction.' });
           setIsLoading(false);
           return;
       }
       const proofUrl = await fileToDataUrl(file);

       const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
       if (!token) {
         toast({ variant: 'destructive', title: 'Authentication Error', description: 'Please log in again.' });
         setIsLoading(false);
         return;
       }

       const response = await fetch('/api/pv-topup-requests', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           Authorization: `Bearer ${token}`,
         },
         body: JSON.stringify({
           pvAmount: values.amount,
           remark: values.remark || '',
           proofUrl: proofUrl,
         }),
       });

      let data: any = {};
      const responseText = await response.text();
      
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('Failed to parse server response:', parseError, 'Response text:', responseText);
        data = { 
          error: 'Failed to parse server response',
          rawResponse: responseText.substring(0, 200) // First 200 chars for debugging
        };
      }

      if (!response.ok) {
        const errorMsg = data.message || data.error || data.details || `Server error: ${response.status} ${response.statusText}`;
        console.error('Topup request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorMsg,
          data,
          responseText: responseText.substring(0, 500) // First 500 chars for debugging
        });
        toast({ 
          variant: 'destructive', 
          title: t('ecash.topup.requestFailed'), 
          description: errorMsg
        });
      } else {
        toast({ title: t('ecash.topup.requestSubmitted'), description: data.message || 'Topup request submitted successfully' });
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("E-Cash top-up request failed:", error);
      toast({ variant: 'destructive', title: t('common.error'), description: error.message || t('ecash.dialog.error') });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[90vw] rounded-lg">
        <DialogHeader>
          <DialogTitle>{t('ecash.topup.title')}</DialogTitle>
          <DialogDescription>
             {t('ecash.topup.description', { balance: formatPV(balance) }).split(/(<strong>.*<\/strong>)/g).map((part, index) => {
                if (part.startsWith('<strong')) {
                    return <strong key={index}>{formatPV(balance)}</strong>;
                }
                return part;
             })}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
             <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('ecash.topup.amountLabel')}</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="proof"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2"><Upload className="h-4 w-4" /> {t('ecash.topup.proofLabel')}</FormLabel>
                  <FormControl>
                     <div className="relative">
                        <Input 
                            id="proof-upload" 
                            type="file" 
                            accept="image/*"
                            required
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={handleImageChange}
                        />
                         <Button asChild variant="outline" className="w-full">
                           <div>{fileName || t('ecash.topup.uploadButton')}</div>
                         </Button>
                    </div>
                  </FormControl>
                  {imagePreview && (
                    <div className="mt-2">
                        <Image src={imagePreview} alt="Proof preview" width={100} height={100} className="rounded-md border object-contain" />
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="remark"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remark (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Add any notes for the admin here..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="animate-spin" /> : t('ecash.topup.submitButton')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
