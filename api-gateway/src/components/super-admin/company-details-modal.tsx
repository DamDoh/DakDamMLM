'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building2,
  Users,
  DollarSign,
  Calendar,
  Mail,
  Phone,
  Globe,
  MapPin,
  Shield,
  CheckCircle,
  Settings,
  BarChart3
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import Image from 'next/image';

interface CompanyDetails {
  id: string;
  name: string;
  description?: string;
  email: string;
  phone: string;
  website?: string;
  country: string;
  currency: string;
  timezone: string;
  taxId?: string;
  licenseNumber?: string;
  industry?: string;
  logoUrl?: string;
  status: 'active' | 'pending' | 'suspended' | 'inactive';
  subscriptionTier: string;
  userCount: number;
  revenue: number;
  createdAt: string;
  lastActivity: string;
  users: Array<{
    id: string;
    memberId: string;
    fullName: string;
    email: string;
    rank: string;
    pv: number;
    joinDate: string;
  }>;
}

interface CompanyDetailsModalProps {
  companyId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function CompanyDetailsModal({ companyId, isOpen, onClose }: CompanyDetailsModalProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (companyId && isOpen) {
      loadCompanyDetails();
    }
  }, [companyId, isOpen]);

  const loadCompanyDetails = async () => {
    if (!companyId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/super-admin/companies/${companyId}`);
      if (response.ok) {
        const data = await response.json();
        setCompany(data);
      }
    } catch (error) {
      console.error('Failed to load company details:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load company details.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyAction = async (action: string) => {
    if (!company) return;

    try {
      const response = await fetch(`/api/super-admin/companies/${company.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Company ${action} successfully.`,
        });
        loadCompanyDetails(); // Refresh data
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to ${action} company.`,
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!company) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            {company.name}
          </DialogTitle>
          <DialogDescription>
            {t('superAdmin.companyOverview')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Company Header */}
          <div className="flex items-start gap-4 p-4 bg-muted rounded-lg">
            {company.logoUrl && (
              <Image
                src={company.logoUrl}
                alt={company.name}
                width={64}
                height={64}
                className="h-16 w-16 rounded-lg object-cover"
              />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xl font-semibold">{company.name}</h3>
                <Badge className={getStatusColor(company.status)}>
                  {company.status}
                </Badge>
                <Badge variant="outline">{company.subscriptionTier}</Badge>
              </div>
              {company.description && (
                <p className="text-muted-foreground mb-2">{company.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Joined {new Date(company.createdAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {company.userCount} members
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  ${company.revenue} revenue
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {company.status === 'pending' && (
                <Button onClick={() => handleCompanyAction('approve')} size="sm">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Approve
                </Button>
              )}
              {company.status === 'active' && (
                <Button
                  onClick={() => handleCompanyAction('suspend')}
                  variant="outline"
                  size="sm"
                >
                  <Shield className="h-3 w-3 mr-1" />
                  Suspend
                </Button>
              )}
              {company.status === 'suspended' && (
                <Button
                  onClick={() => handleCompanyAction('unsuspend')}
                  variant="outline"
                  size="sm"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Unsuspend
                </Button>
              )}
            </div>
          </div>

          {/* Company Details Tabs */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{t('superAdmin.contactInfo')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{company.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{company.phone}</span>
                    </div>
                    {company.website && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {company.website}
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{t('superAdmin.businessDetails')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{company.country}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>{company.currency}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span>{company.timezone}</span>
                    </div>
                    {company.industry && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{company.industry}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('superAdmin.companyUsers')}</CardTitle>
                  <CardDescription>
                    {t('superAdmin.allDistributors')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('superAdmin.memberId')}</TableHead>
                        <TableHead>{t('superAdmin.name')}</TableHead>
                        <TableHead>{t('superAdmin.email')}</TableHead>
                        <TableHead>{t('superAdmin.rank')}</TableHead>
                        <TableHead>{t('superAdmin.pv')}</TableHead>
                        <TableHead>{t('superAdmin.joinDate')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {company.users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-mono">{user.memberId}</TableCell>
                          <TableCell>{user.fullName}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{user.rank}</Badge>
                          </TableCell>
                          <TableCell>{user.pv}</TableCell>
                          <TableCell>
                            {new Date(user.joinDate).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">User Growth</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">+{company.userCount}</div>
                    <p className="text-sm text-muted-foreground">Total members</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">${company.revenue}</div>
                    <p className="text-sm text-muted-foreground">Total earnings</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {new Date(company.lastActivity).toLocaleDateString()}
                    </div>
                    <p className="text-sm text-muted-foreground">Last activity</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('superAdmin.companySettings')}</CardTitle>
                  <CardDescription>
                    {t('superAdmin.adminControlsCompany')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-2" />
                      {t('superAdmin.editDetails')}
                    </Button>
                    <Button variant="outline" size="sm">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      {t('superAdmin.viewAnalytics')}
                    </Button>
                    <Button variant="outline" size="sm">
                      <Shield className="h-4 w-4 mr-2" />
                      {t('superAdmin.securitySettings')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}