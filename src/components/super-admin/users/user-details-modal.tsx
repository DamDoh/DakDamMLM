'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, CheckCircle, Users, Mail, Shield, Activity, DollarSign, Calendar, Edit2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';

export default function UserDetailsModal({
  userId,
  isOpen,
  onClose,
  onActionSuccess
}: {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onActionSuccess: () => void;
}) {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  const loadUserDetails = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      
      const response = await fetch(`/api/super-admin/iam/users/${userId}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserData(data.user || {});
      } else if (response.status === 401) {
        toast({
          variant: 'destructive',
          title: 'Authentication Required',
          description: 'Please log in to view user details.',
        });
      } else {
        console.error('Failed to load user details:', response.status);
        setUserData({});
      }
    } catch (error) {
      console.error('Error loading user details:', error);
      setUserData({});
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    // In a real app, we would send the updated data to the API
    setIsEditing(false);
    toast({
      title: t('superAdmin.userUpdated'),
      description: t('superAdmin.userUpdatedDescription')
    });
    onActionSuccess();
  };

  useEffect(() => {
    loadUserDetails();
  }, [userId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-[600px] max-w-full">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground hover:bg-muted"
          aria-label="Close"
        >
          <XCircle className="h-4 w-4" />
        </button>
        
        <Card className="p-6">
          {!loading && userData ? (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  {t('superAdmin.userDetails')}
                </CardTitle>
                {isEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(false)}
                    className="ml-auto"
                  >
                    {t('common.cancel')}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                      className="mr-2"
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onClose}
                    >
                      {t('common.close')}
                    </Button>
                  </>
                )}
                <CardDescription>
                  {t('superAdmin.viewAndManageUser')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold">{t('superAdmin.personalInformation')}</h2>
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="w-1/3 font-medium">{t('superAdmin.fullName')}</TableCell>
                          <TableCell>{userData.fullName || 'N/A'}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="w-1/3 font-medium">{t('superAdmin.email')}</TableCell>
                          <TableCell>{userData.email || 'N/A'}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="w-1/3 font-medium">{t('superAdmin.phoneNumber')}</TableCell>
                          <TableCell>{userData.phoneNumber || 'N/A'}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="w-1/3 font-medium">{t('superAdmin.memberId')}</TableCell>
                          <TableCell>{userData.memberId || 'N/A'}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold">{t('superAdmin.accountInformation')}</h2>
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="w-1/3 font-medium">{t('superAdmin.accountType')}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{userData.accountType || 'N/A'}</Badge>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="w-1/3 font-medium">{t('superAdmin.status')}</TableCell>
                          <TableCell>
                            <Badge 
                              className={userData.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                            >
                              {userData.active ? t('common.active') : t('common.inactive')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="w-1/3 font-medium">{t('superAdmin.createdAt')}</TableCell>
                          <TableCell>
                            {userData.createdAt ? (
                              <span className="text-sm">
                                {new Date(userData.createdAt).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {t('superAdmin.unknown')}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="w-1/3 font-medium">{t('superAdmin.lastActivity')}</TableCell>
                          <TableCell>
                            {userData.lastActivityDate ? (
                              <span className="text-sm">
                                {new Date(userData.lastActivityDate).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {t('superAdmin.never')}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold">{t('superAdmin.securityInformation')}</h2>
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="w-1/3 font-medium">{t('superAdmin.mfaEnabled')}</TableCell>
                          <TableCell>
                            {userData.mfaEnabled ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-600" />
                            )}
                            {userData.mfaEnabled ? t('common.enabled') : t('common.disabled')}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="w-1/3 font-medium">{t('superAdmin.failedLoginAttempts')}</TableCell>
                          <TableCell>{userData.failedLoginAttempts || 0}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="w-1/3 font-medium">{t('superAdmin.accountLocked')}</TableCell>
                          <TableCell>
                            {userData.lockedUntil ? (
                              <AlertTriangle className="h-4 w-4 text-orange-600" />
                              {t('superAdmin.lockedUntil', { date: new Date(userData.lockedUntil).toLocaleDateString() })}
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              {t('common.active')}
                            )}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold">{t('superAdmin.financialOverview')}</h2>
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="w-1/3 font-medium">{t('superAdmin.totalCommission')}</TableCell>
                          <TableCell>${userData.totalCommission || 0}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="w-1/3 font-medium">{t('superAdmin.pendingCommission')}</TableCell>
                          <TableCell>${userData.pendingCommission || 0}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="w-1/3 font-medium">{t('superAdmin.walletBalance')}</TableCell>
                          <TableCell>${userData.walletBalance || 0}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center py-8">
              {loading ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              ) : (
                <>
                  <AlertTriangle className="h-8 w-8 text-red-600 mb-4" />
                  <p className="text-center">{t('superAdmin.userNotFound')}</p>
                </>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}