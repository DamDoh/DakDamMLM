'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Link,
  Copy,
  Share2,
  BarChart3,
  Users,
  Eye,
  UserCheck,
  RefreshCw,
  ExternalLink,
  Settings
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/context/auth-context';
import { useCompany } from '@/context/company-context';
import { useI18n } from '@/lib/internationalization';

interface ReferralLink {
  id: string;
  code: string;
  url: string;
  clicks: number;
  conversions: number;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
  relationships: number;
}

interface ReferralStats {
  totalLinks: number;
  activeLinks: number;
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  commissionRate?: number; // Commission rate based on rank (as percentage)
  sponsorRank?: string | null; // Sponsor's rank
  links: ReferralLink[];
}

export default function ReferralLinkGenerator() {
  const { toast } = useToast();
  const { t } = useI18n();
  const { user } = useAuthContext();
  const { company } = useCompany();
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [expiresIn, setExpiresIn] = useState<number>(30);
  const [customMessage, setCustomMessage] = useState('');

  useEffect(() => {
    if (user && company) {
      loadReferralStats();
    }
  }, [user, company]);

  const loadReferralStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/referral/link?sponsorId=${user?.id}&companyId=${company?.id}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load referral stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const createReferralLink = async () => {
    if (!user || !company) return;

    try {
      setCreating(true);
      const response = await fetch('/api/referral/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sponsorId: user.id,
          companyId: company.id,
          expiresIn: expiresIn || undefined,
          metadata: {
            customMessage,
            createdBy: user.fullName,
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Referral Link Created',
          description: 'Your new referral link has been generated successfully.',
        });

        // Copy to clipboard
        navigator.clipboard.writeText(result.referralLink.url);
        toast({
          title: 'Link Copied',
          description: 'Referral link copied to clipboard!',
        });

        loadReferralStats();
        setCustomMessage('');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create referral link.',
      });
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: 'Copied!',
      description: 'Referral link copied to clipboard.',
    });
  };

  // Helper function to check if a link is truly active (not expired and isActive is true)
  const isLinkActive = (link: ReferralLink): boolean => {
    if (!link.isActive) {
      return false;
    }
    // Check if expired
    if (link.expiresAt) {
      const expiresAt = new Date(link.expiresAt);
      const now = new Date();
      if (expiresAt < now) {
        return false;
      }
    }
    return true;
  };

  const shareOnSocial = (url: string, platform: string) => {
    const text = `Join ${company?.name} with me! Use my referral link: ${url}`;
    let shareUrl = '';

    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
        break;
      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        break;
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }
  };

  const activateLink = async (linkId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/referral/link?linkId=${linkId}&sponsorId=${user?.id}&action=activate`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        throw new Error('Failed to activate link');
      }

      toast({
        title: 'Link Activated',
        description: 'Referral link has been activated successfully.',
      });

      loadReferralStats();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to activate referral link.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const deactivateLink = async (linkId: string) => {
    try {
      const response = await fetch(`/api/referral/link?linkId=${linkId}&sponsorId=${user?.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Link Deactivated',
          description: 'Referral link has been deactivated.',
        });
        loadReferralStats();
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to deactivate referral link.',
      });
    }
  };

  if (!user || !company) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Please log in to access referral tools</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('referral.referral.links')}</h2>
          <p className="text-muted-foreground">{t('referral.referral.linksDescription')}</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          <Link className="h-3 w-3 mr-1" />
          {stats?.activeLinks || 0} Active Links
        </Badge>
      </div>

      {/* Create New Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            {t('referral.referral.createLink')}
          </CardTitle>
          <CardDescription>
            {t('referral.referral.linkDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expiresIn">{t('referral.referral.linkExpiration')}</Label>
              <Input
                id="expiresIn"
                type="number"
                value={expiresIn}
                onChange={(e) => setExpiresIn(Number(e.target.value))}
                placeholder="30"
                min="1"
                max="365"
              />
              <p className="text-xs text-muted-foreground">
                {t('referral.referral.linkExpirationDescription')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customMessage">{t('referral.referral.customMessage')}</Label>
              <Input
                id="customMessage"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder={t('referral.referral.customMessagePlaceholder')}
              />
            </div>
          </div>

          <Button
            onClick={createReferralLink}
            disabled={creating}
            className="w-full"
          >
            {creating ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                {t('referral.referral.creatingLink')}
              </>
            ) : (
              <>
                <Link className="mr-2 h-4 w-4" />
                {t('referral.referral.generateLink')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Statistics Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('referral.referral.totalLinks')}</CardTitle>
              <Link className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLinks}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activeLinks} {t('referral.referral.activeLinks')},
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('referral.referral.totalClicks')}</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClicks}</div>
              <p className="text-xs text-muted-foreground">
                {t('referral.referral.linkVisits')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('referral.referral.conversions')}</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalConversions}</div>
              <p className="text-xs text-muted-foreground">
                {t('referral.referral.newMembers')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('referral.referral.commissionRate')}</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.commissionRate !== undefined ? stats.commissionRate.toFixed(1) : '0.0'}%
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.sponsorRank ? `${t('referral.referral.rank')}: ${stats.sponsorRank}` : t('referral.referral.member')}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Referral Links Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('referral.referral.yourReferralLinks')}</CardTitle>
          <CardDescription>
            {t('referral.referral.yourReferralLinksDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : stats?.links.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('referral.referral.code')}</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>{t('referral.referral.clicks')}</TableHead>
                  <TableHead>{t('referral.referral.conversions')}</TableHead>
                  <TableHead>{t('referral.referral.status')}</TableHead>
                  <TableHead>{t('referral.referral.created')}</TableHead>
                  <TableHead>{t('referral.referral.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.links.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="font-mono text-sm">{link.code}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 max-w-xs">
                        <span className="truncate text-sm">{link.url}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(link.url)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{link.clicks}</TableCell>
                    <TableCell>{link.conversions}</TableCell>
                    <TableCell>
                      <Badge variant={isLinkActive(link) ? 'default' : 'secondary'}>
                        {isLinkActive(link) ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(link.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(link.url)}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => shareOnSocial(link.url, 'whatsapp')}
                        >
                          <Share2 className="h-3 w-3" />
                        </Button>
                        {isLinkActive(link) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deactivateLink(link.id)}
                            title="Deactivate link"
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => activateLink(link.id)}
                            title="Activate link"
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Link className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{t('referral.referral.noReferralLinksCreated')}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {t('referral.referral.firstReferralLink')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}