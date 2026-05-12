'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Settings, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';

interface ConfigFormData {
  key: string;
  value: string;
  type: string;
  category: string;
  description: string;
  isActive: boolean;
}

export default function ConfigCreateModal({
  isOpen,
  onClose,
  onActionSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  onActionSuccess: () => void;
}) {
  const [formData, setFormData] = useState<ConfigFormData>({
    key: '',
    value: '',
    type: 'string',
    category: 'system',
    description: '',
    isActive: true
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
        title: t('superAdmin.configCreated'),
        description: t('superAdmin.configCreatedDescription', { key: formData.key })
      });
      
      onClose();
      onActionSuccess();
    } catch (error) {
      console.error('Error creating config:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('superAdmin.configCreateError')
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
              <Settings className="h-5 w-5 text-gray-600" />
              {t('superAdmin.addConfig')}
            </CardTitle>
            <CardDescription>
              {t('superAdmin.addConfigDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="config-key">{t('superAdmin.configKey')}</Label>
                  <Input
                    id="config-key"
                    name="key"
                    value={formData.key}
                    onChange={handleChange}
                    placeholder={t('superAdmin.enterConfigKey')}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="config-value">{t('superAdmin.configValue')}</Label>
                  <Input
                    id="config-value"
                    name="value"
                    value={formData.value}
                    onChange={handleChange}
                    placeholder={t('superAdmin.enterConfigValue')}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="config-type">{t('superAdmin.configType')}</Label>
                  <Select
                    onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('superAdmin.selectConfigType')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">{t('superAdmin.string')}</SelectItem>
                      <SelectItem value="number">{t('superAdmin.number')}</SelectItem>
                      <SelectItem value="boolean">{t('superAdmin.boolean')}</SelectItem>
                      <SelectItem value="json">{t('superAdmin.json')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="config-category">{t('superAdmin.configCategory')}</Label>
                  <Select
                    onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('superAdmin.selectCategory')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">{t('superAdmin.system')}</SelectItem>
                      <SelectItem value="feature_flags">{t('superAdmin.featureFlags')}</SelectItem>
                      <SelectItem value="security_settings">{t('superAdmin.securitySettings')}</SelectItem>
                      <SelectItem value="system_limits">{t('superAdmin.systemLimits')}</SelectItem>
                      <SelectItem value="notification">{t('superAdmin.notification')}</SelectItem>
                      <SelectItem value="integration">{t('superAdmin.integration')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="config-description">{t('superAdmin.description')}</Label>
                  <Textarea
                    id="config-description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder={t('superAdmin.enterDescriptionOptional)}
                    rows={3}
                  />
                </div>
                <div className="flex items-start space-x-4">
                  <Switch
                    checked={formData.isActive}
                    onChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                  >
                    <span className="ml-2">{t('superAdmin.active')}</span>
                  </Switch>
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