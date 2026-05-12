'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Users, Mail, Key, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';

interface UserFormData {
  firstName: string;
  surname: string;
  email: string;
  phoneNumber?: string;
  accountType: string;
  password?: string;
  sponsorId?: string;
  notes?: string;
}

export default function UserCreateModal({
  isOpen,
  onClose,
  onActionSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  onActionSuccess: () => void;
}) {
  const [formData, setFormData] = useState<UserFormData>({
    firstName: '',
    surname: '',
    email: '',
    phoneNumber: '',
    accountType: 'Customer',
    password: '',
    sponsorId: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // In a real app, we would send this data to the API
      // For now, we'll simulate an API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: t('superAdmin.userCreated'),
        description: t('superAdmin.userCreatedDescription', { name: `${formData.firstName} ${formData.surname}` })
      });
      
      onClose();
      onActionSuccess();
    } catch (error) {
      console.error('Error creating user:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('superAdmin.userCreateError')
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-[500px] max-w-full">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground hover:bg-muted"
          aria-label="Close"
        >
          <XCircle className="h-4 w-4" />
        </button>
        
        <Card className="p-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              {t('superAdmin.createUser')}
            </CardTitle>
            <CardDescription>
              {t('superAdmin.createUserDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="firstName">{t('superAdmin.firstName')}</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder={t('superAdmin.enterFirstName')}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="surname">{t('superAdmin.surname')}</Label>
                  <Input
                    id="surname"
                    name="surname"
                    value={formData.surname}
                    onChange={handleChange}
                    placeholder={t('superAdmin.enterSurname')}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">{t('superAdmin.email')}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder={t('superAdmin.enterEmail')}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phoneNumber">{t('superAdmin.phoneNumber')}</Label>
                  <Input
                    id="phoneNumber"
                    name="phoneNumber"
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    placeholder={t('superAdmin.enterPhoneNumber')}
                  />
                </div>
                <div>
                  <Label htmlFor="accountType">{t('superAdmin.accountType')}</Label>
                  <Select
                    onValueChange={(value) => setFormData(prev => ({ ...prev, accountType: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('superAdmin.selectAccountType')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Customer">{t('superAdmin.customer')}</SelectItem>
                      <SelectItem value="Distributor">{t('superAdmin.distributor')}</SelectItem>
                      <SelectItem value="Stockist">{t('superAdmin.stockist')}</SelectItem>
                      <SelectItem value="Admin">{t('superAdmin.admin')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sponsorId">{t('superAdmin.sponsorId')}</Label>
                  <Input
                    id="sponsorId"
                    name="sponsorId"
                    value={formData.sponsorId}
                    onChange={handleChange}
                    placeholder={t('superAdmin.enterSponsorIdOptional')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t('superAdmin.password')}</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder={t('superAdmin.enterPassword')}
                    required
                    minLength={8}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('superAdmin.passwordRequirements')}
                  </p>
                </div>
                <div>
                  <Label htmlFor="notes">{t('superAdmin.notes')}</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder={t('superAdmin.enterNotesOptional)}
                    rows={4}
                  />
                </div>
              </div>
              
              <div className="flex justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="mr-2"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="default"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </>
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  {t('common.create')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}