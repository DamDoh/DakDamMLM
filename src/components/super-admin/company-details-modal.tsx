'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
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
  BarChart3,
  Loader2,
  Save
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  allowEmailLogin?: boolean;
  allowPhoneLogin?: boolean;
  requireEmailVerification?: boolean;
  requirePhoneVerification?: boolean;
  isActive?: boolean;
  isVerified?: boolean;
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
  onActionSuccess?: () => void;
}

const companyFormSchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters'),
  domain: z.string().optional(),
  description: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  country: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  taxId: z.string().optional(),
  licenseNumber: z.string().optional(),
  industry: z.string().optional(),
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;

export default function CompanyDetailsModal({ companyId, isOpen, onClose, onActionSuccess }: CompanyDetailsModalProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isSecurityDialogOpen, setIsSecurityDialogOpen] = useState(false);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);
  const [securitySettings, setSecuritySettings] = useState({
    allowEmailLogin: true,
    allowPhoneLogin: true,
    requireEmailVerification: false,
    requirePhoneVerification: false,
  });

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: '',
      domain: '',
      description: '',
      email: '',
      phone: '',
      website: '',
      country: '',
      currency: '',
      timezone: '',
      taxId: '',
      licenseNumber: '',
      industry: '',
    },
  });

  // Debug logging
  useEffect(() => {
    console.log('[CompanyDetailsModal] Props changed:', { companyId, isOpen });
    if (isOpen) {
      console.log('[CompanyDetailsModal] Modal should be visible now');
    }
  }, [companyId, isOpen]);

  const loadCompanyDetails = async () => {
    if (!companyId) {
      console.warn('[CompanyDetailsModal] No companyId provided');
      return;
    }

    try {
      console.log('[CompanyDetailsModal] Loading company details for:', companyId);
      setLoading(true);
      setCompany(null); // Reset company data
      
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/super-admin/companies/${companyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('[CompanyDetailsModal] API Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[CompanyDetailsModal] API Error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('[CompanyDetailsModal] Company data loaded:', data);
      setCompany(data);
    } catch (error) {
      console.error('[CompanyDetailsModal] Failed to load company details:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load company details.',
      });
      setCompany(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId && isOpen) {
      loadCompanyDetails();
    } else if (!isOpen) {
      // Reset state when modal closes
      setCompany(null);
      setLoading(false);
      setActiveTab('overview'); // Reset to overview tab when modal closes
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, isOpen]);

  // Update form when company data is loaded
  useEffect(() => {
    if (company) {
      form.reset({
        name: company.name || '',
        domain: '',
        description: company.description || '',
        email: company.email || '',
        phone: company.phone || '',
        website: company.website || '',
        country: company.country || '',
        currency: company.currency || '',
        timezone: company.timezone || '',
        taxId: company.taxId || '',
        licenseNumber: company.licenseNumber || '',
        industry: company.industry || '',
      });

      // Update security settings
      setSecuritySettings({
        allowEmailLogin: company.allowEmailLogin ?? true,
        allowPhoneLogin: company.allowPhoneLogin ?? true,
        requireEmailVerification: company.requireEmailVerification ?? false,
        requirePhoneVerification: company.requirePhoneVerification ?? false,
      });
    }
  }, [company, form]);

  const handleOpenEditDialog = () => {
    if (company) {
      setIsEditDialogOpen(true);
    }
  };

  const handleViewAnalytics = () => {
    setActiveTab('analytics');
  };

  const handleOpenSecurityDialog = () => {
    if (company) {
      setIsSecurityDialogOpen(true);
    }
  };

  const handleSaveSecuritySettings = async () => {
    if (!companyId || !company) return;

    try {
      setIsSavingSecurity(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/company/${companyId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(securitySettings),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to update security settings');
      }

      toast({
        title: t('common.success'),
        description: t('superAdmin.securitySettings.updateSuccess') || 'Security settings updated successfully',
      });

      setIsSecurityDialogOpen(false);
      loadCompanyDetails(); // Refresh company data
      onActionSuccess?.(); // Refresh parent page
    } catch (error) {
      console.error('[CompanyDetailsModal] Failed to update security settings:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('superAdmin.securitySettings.updateFailed') || 'Failed to update security settings',
      });
    } finally {
      setIsSavingSecurity(false);
    }
  };

  const handleEditCompany = async (values: CompanyFormValues) => {
    if (!companyId || !company) return;

    try {
      setIsSaving(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/company/${companyId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to update company');
      }

      toast({
        title: t('common.success'),
        description: t('superAdmin.company.updateSuccess', { companyName: values.name }) || `Company ${values.name} updated successfully`,
      });

      setIsEditDialogOpen(false);
      loadCompanyDetails(); // Refresh company data
      onActionSuccess?.(); // Refresh parent page
    } catch (error) {
      console.error('[CompanyDetailsModal] Failed to update company:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('superAdmin.company.updateFailed') || 'Failed to update company',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompanyAction = async (action: string) => {
    if (!company) return;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Authentication required',
        });
        return;
      }

      const response = await fetch(`/api/super-admin/companies/${company.id}/action`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Success',
          description: data.message || `Company ${action} successfully.`,
        });
        loadCompanyDetails(); // Refresh modal data
        // Trigger parent page refresh
        if (onActionSuccess) {
          onActionSuccess();
        }
        // Close the modal after successful action
        setTimeout(() => {
          onClose();
        }, 500); // Small delay to show the success message
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[CompanyDetailsModal] Company action error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to ${action} company.`,
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      console.log('[CompanyDetailsModal] Dialog onOpenChange:', open);
      if (!open) onClose();
    }}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        {loading ? (
          <>
            <DialogHeader>
              <DialogTitle>Loading Company Details</DialogTitle>
              <DialogDescription>
                {companyId ? `Loading details for company: ${companyId}` : 'Please wait while we fetch the company information...'}
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </>
        ) : !company ? (
          <>
            <DialogHeader>
              <DialogTitle>Company Not Found</DialogTitle>
              <DialogDescription>
                {companyId ? `Unable to load details for company: ${companyId}` : 'Company information could not be loaded.'}
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">Failed to load company details.</p>
                <Button onClick={loadCompanyDetails} variant="outline">
                  Retry
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
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
                      {company.users && company.users.length > 0 ? (
                        company.users.map((user) => (
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
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No users found for this company.
                          </TableCell>
                        </TableRow>
                      )}
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
                    <Button variant="outline" size="sm" onClick={handleOpenEditDialog}>
                      <Settings className="h-4 w-4 mr-2" />
                      {t('superAdmin.editDetails')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleViewAnalytics}>
                      <BarChart3 className="h-4 w-4 mr-2" />
                      {t('superAdmin.viewAnalytics')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleOpenSecurityDialog}>
                      <Shield className="h-4 w-4 mr-2" />
                      {t('superAdmin.securitySettings')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
          </>
        )}
      </DialogContent>

      {/* Edit Company Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="h-5 w-5" />
              {t('superAdmin.editCompanyDetails') || 'Edit Company Details'}
            </DialogTitle>
            <DialogDescription>
              {t('superAdmin.updateCompanyInformation') || 'Update company information'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditCompany)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('superAdmin.companyName') || 'Company Name'}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('superAdmin.companyNamePlaceholder') || 'Company name'} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="domain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('superAdmin.domain') || 'Domain'}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('superAdmin.domainPlaceholder') || 'company.com'} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('superAdmin.companyDescription') || 'Description'}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('superAdmin.companyDescriptionPlaceholder') || 'Company description'}
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('superAdmin.email')}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder={t('superAdmin.emailPlaceholder') || 'email@company.com'} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('superAdmin.phone') || 'Phone'}</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder={t('superAdmin.phonePlaceholder') || '+1234567890'} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('superAdmin.website') || 'Website'}</FormLabel>
                    <FormControl>
                      <Input type="url" placeholder={t('superAdmin.websitePlaceholder') || 'https://company.com'} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('superAdmin.country') || 'Country'}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('superAdmin.countryPlaceholder') || 'Country'} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('superAdmin.currency') || 'Currency'}</FormLabel>
                      <FormControl>
                        <Input placeholder="USD" maxLength={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('superAdmin.timezone') || 'Timezone'}</FormLabel>
                      <FormControl>
                        <Input placeholder="UTC" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('superAdmin.taxId') || 'Tax ID'}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('superAdmin.taxIdPlaceholder') || 'Tax ID'} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="licenseNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('superAdmin.licenseNumber') || 'License Number'}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('superAdmin.licenseNumberPlaceholder') || 'License Number'} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('superAdmin.industry') || 'Industry'}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('superAdmin.industryPlaceholder') || 'Industry'} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={isSaving}
                >
                  {t('common.cancel') || 'Cancel'}
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('common.saving') || 'Saving...'}
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {t('common.save') || 'Save'}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Security Settings Dialog */}
      <Dialog open={isSecurityDialogOpen} onOpenChange={setIsSecurityDialogOpen}>
        <DialogContent className="sm:max-w-2xl w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t('superAdmin.securitySettings') || 'Security Settings'}
            </DialogTitle>
            <DialogDescription>
              {t('superAdmin.securitySettings.description') || 'Configure authentication and verification settings for this company'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('superAdmin.securitySettings.authentication') || 'Authentication'}</CardTitle>
                <CardDescription>
                  {t('superAdmin.securitySettings.authenticationDescription') || 'Configure how distributors can log in to the platform'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t('superAdmin.securitySettings.allowEmailLogin') || 'Allow Email Login'}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('superAdmin.securitySettings.allowEmailLoginDescription') || 'Distributors can log in using their email address'}
                      </p>
                    </div>
                    <Switch
                      checked={securitySettings.allowEmailLogin}
                      onCheckedChange={(checked) => setSecuritySettings({
                        ...securitySettings,
                        allowEmailLogin: checked
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t('superAdmin.securitySettings.allowPhoneLogin') || 'Allow Phone Login'}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('superAdmin.securitySettings.allowPhoneLoginDescription') || 'Distributors can log in using their phone number'}
                      </p>
                    </div>
                    <Switch
                      checked={securitySettings.allowPhoneLogin}
                      onCheckedChange={(checked) => setSecuritySettings({
                        ...securitySettings,
                        allowPhoneLogin: checked
                      })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('superAdmin.securitySettings.verification') || 'Verification'}</CardTitle>
                <CardDescription>
                  {t('superAdmin.securitySettings.verificationDescription') || 'Configure verification requirements for new distributors'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t('superAdmin.securitySettings.requireEmailVerification') || 'Require Email Verification'}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('superAdmin.securitySettings.requireEmailVerificationDescription') || 'New distributors must verify their email before accessing the platform'}
                      </p>
                    </div>
                    <Switch
                      checked={securitySettings.requireEmailVerification}
                      onCheckedChange={(checked) => setSecuritySettings({
                        ...securitySettings,
                        requireEmailVerification: checked
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t('superAdmin.securitySettings.requirePhoneVerification') || 'Require Phone Verification'}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('superAdmin.securitySettings.requirePhoneVerificationDescription') || 'New distributors must verify their phone number before accessing the platform'}
                      </p>
                    </div>
                    <Switch
                      checked={securitySettings.requirePhoneVerification}
                      onCheckedChange={(checked) => setSecuritySettings({
                        ...securitySettings,
                        requirePhoneVerification: checked
                      })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSecurityDialogOpen(false)}
              disabled={isSavingSecurity}
            >
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button onClick={handleSaveSecuritySettings} disabled={isSavingSecurity}>
              {isSavingSecurity ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.saving') || 'Saving...'}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {t('common.save') || 'Save'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}