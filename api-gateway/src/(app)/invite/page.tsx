
'use client';

import { useState, useEffect } from 'react';
import { useGenealogyContext } from '@/context/genealogy-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Copy, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/internationalization';

export default function InvitePage() {
  const { t } = useI18n();
  const context = useGenealogyContext();
  // Set loading to true if context is not yet available.
  const { rootMember, loading } = context || { rootMember: null, loading: true };

  const [referralLink, setReferralLink] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined' && rootMember) {
      const url = new URL(window.location.origin);
      url.pathname = '/register';
      url.searchParams.set('sponsorId', rootMember.id);
      setReferralLink(url.toString());
    }
  }, [rootMember]);

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    toast({
      title: t('invite.linkCopiedTitle'),
      description: t('invite.linkCopiedDescription'),
    });
  };

  if (loading || !rootMember) {
    return (
       <div className="flex-1 p-4 pt-6 md:p-8 flex justify-center items-start">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-full mt-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-4 w-32" />
                    <div className="flex gap-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-10" />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="flex-1 p-4 pt-6 md:p-8 flex justify-center items-start">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-6 w-6" />
            {t('invite.title')}
          </CardTitle>
          <CardDescription>
            {t('invite.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label htmlFor="referral-link" className="text-sm font-medium">{t('invite.linkLabel')}</label>
          <div className="flex gap-2">
            <Input id="referral-link" readOnly value={referralLink} />
            <Button variant="outline" size="icon" onClick={handleCopy} aria-label={t('invite.copyLink')} disabled={!referralLink}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
