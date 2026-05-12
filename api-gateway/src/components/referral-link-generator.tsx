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
  links: ReferralLink[];
}

export default function ReferralLinkGenerator() {
  const { toast } = useToast();
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
          <h2 className="text-2xl font-bold">Referral Links</h2>
          <p className="text-muted-foreground">Create and manage your referral links to earn commissions</p>
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
            Create Referral Link
          </CardTitle>
          <CardDescription>
            Generate a unique referral link that automatically tracks clicks and conversions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expiresIn">Link Expiration (days)</Label>
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
                Leave empty for no expiration
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customMessage">Custom Message (Optional)</Label>
              <Input
                id="customMessage"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Join my team!"
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
                Creating Link...
              </>
            ) : (
              <>
                <Link className="mr-2 h-4 w-4" />
                Generate Referral Link
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
              <CardTitle className="text-sm font-medium">Total Links</CardTitle>
              <Link className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLinks}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activeLinks} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClicks}</div>
              <p className="text-xs text-muted-foreground">
                Link visits
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversions</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalConversions}</div>
              <p className="text-xs text-muted-foreground">
                New members
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.conversionRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                Click to conversion
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Referral Links Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Referral Links</CardTitle>
          <CardDescription>
            Manage your active referral links and track their performance
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
                  <TableHead>Code</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Clicks</TableHead>
                  <TableHead>Conversions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
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
                      <Badge variant={link.isActive ? 'default' : 'secondary'}>
                        {link.isActive ? 'Active' : 'Inactive'}
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
                          onClick={() => window.open(link.url, '_blank')}
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
                        {link.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deactivateLink(link.id)}
                          >
                            <Settings className="h-3 w-3" />
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
              <p className="text-muted-foreground">No referral links created yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Create your first referral link to start earning commissions
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}