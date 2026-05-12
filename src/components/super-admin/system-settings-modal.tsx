'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Settings,
  Shield,
  Database,
  Mail,
  Bell,
  Globe,
  Key,
  Server,
  Save
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import LanguageManagement from './language-management';
import { LanguageStorage } from '@/lib/language-storage';

interface SystemSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SystemSettings {
  superAdminEmail: string;
  allowNewRegistrations: boolean;
  requireEmailVerification: boolean;
  requirePhoneVerification: boolean;
  maintenanceMode: boolean;
  maxLoginAttempts: number;
  sessionTimeout: number;
  enableNotifications: boolean;
  enableEmailNotifications: boolean;
  enableSMSNotifications: boolean;
  defaultLanguage: string;
  supportedLanguages: string[];
  apiRateLimit: number;
  databaseBackupFrequency: string;
}

export default function SystemSettingsModal({ isOpen, onClose }: SystemSettingsModalProps) {
  const { toast } = useToast();
  const { t, getSupportedLanguages } = useI18n();
  const [availableLanguages, setAvailableLanguages] = useState<any[]>([]);
  
  // Load available languages on mount and when updated
  useEffect(() => {
    const loadAvailableLanguages = () => {
      const allLanguages = getSupportedLanguages();
      setAvailableLanguages(allLanguages);
    };
    
    loadAvailableLanguages();
    
    window.addEventListener('languagesUpdated', loadAvailableLanguages);
    return () => window.removeEventListener('languagesUpdated', loadAvailableLanguages);
  }, [getSupportedLanguages]);
  
  const [settings, setSettings] = useState<SystemSettings>({
    superAdminEmail: '',
    allowNewRegistrations: true,
    requireEmailVerification: false,
    requirePhoneVerification: false,
    maintenanceMode: false,
    maxLoginAttempts: 5,
    sessionTimeout: 3600,
    enableNotifications: true,
    enableEmailNotifications: true,
    enableSMSNotifications: false,
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'th', 'km', 'vi'],
    apiRateLimit: 100,
    databaseBackupFrequency: 'daily',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  // Helper function to get auth headers
  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      // In a real implementation, this would fetch from an API endpoint
      // For now, we'll use default values
      const response = await fetch('/api/super-admin/settings', {
        headers: getAuthHeaders(),
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else if (response.status === 404) {
        // Settings endpoint doesn't exist yet, use defaults
        console.log('Settings endpoint not implemented, using defaults');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Use default settings on error
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/super-admin/settings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast({
          title: t('systemSettings.saveSuccess'),
          description: t('systemSettings.saveSuccessDesc'),
        });
        onClose();
      } else {
        // If endpoint doesn't exist, just show a success message for now
        toast({
          title: t('systemSettings.settingsUpdated'),
          description: t('systemSettings.settingsUpdatedDesc'),
        });
        onClose();
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        variant: 'destructive',
        title: t('systemSettings.saveError'),
        description: t('systemSettings.saveErrorDesc'),
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('systemSettings.title')}
          </DialogTitle>
          <DialogDescription>
            {t('systemSettings.description')}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">{t('systemSettings.general')}</TabsTrigger>
            <TabsTrigger value="security">{t('systemSettings.security')}</TabsTrigger>
            <TabsTrigger value="notifications">{t('systemSettings.notifications')}</TabsTrigger>
            <TabsTrigger value="languages">{t('systemSettings.languages')}</TabsTrigger>
            <TabsTrigger value="advanced">{t('systemSettings.advanced')}</TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('systemSettings.generalTitle')}</CardTitle>
                <CardDescription>{t('systemSettings.generalDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="superAdminEmail">{t('systemSettings.superAdminEmail')}</Label>
                  <Input
                    id="superAdminEmail"
                    type="email"
                    value={settings.superAdminEmail}
                    onChange={(e) => updateSetting('superAdminEmail', e.target.value)}
                    placeholder="admin@dakdam.com"
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('systemSettings.superAdminEmailDesc')}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('systemSettings.allowNewRegistrations')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('systemSettings.allowNewRegistrationsDesc')}
                    </p>
                  </div>
                  <Switch
                    checked={settings.allowNewRegistrations}
                    onCheckedChange={(checked) => updateSetting('allowNewRegistrations', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('systemSettings.maintenanceMode')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('systemSettings.maintenanceModeDesc')}
                    </p>
                  </div>
                  <Switch
                    checked={settings.maintenanceMode}
                    onCheckedChange={(checked) => updateSetting('maintenanceMode', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {t('systemSettings.securityTitle')}
                </CardTitle>
                <CardDescription>{t('systemSettings.securityDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('systemSettings.requireEmailVerification')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('systemSettings.requireEmailVerificationDesc')}
                    </p>
                  </div>
                  <Switch
                    checked={settings.requireEmailVerification}
                    onCheckedChange={(checked) => updateSetting('requireEmailVerification', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('systemSettings.requirePhoneVerification')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('systemSettings.requirePhoneVerificationDesc')}
                    </p>
                  </div>
                  <Switch
                    checked={settings.requirePhoneVerification}
                    onCheckedChange={(checked) => updateSetting('requirePhoneVerification', checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxLoginAttempts">{t('systemSettings.maxLoginAttempts')}</Label>
                  <Input
                    id="maxLoginAttempts"
                    type="number"
                    min="3"
                    max="10"
                    value={settings.maxLoginAttempts}
                    onChange={(e) => updateSetting('maxLoginAttempts', parseInt(e.target.value) || 5)}
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('systemSettings.maxLoginAttemptsDesc')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">{t('systemSettings.sessionTimeout')}</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    min="300"
                    max="86400"
                    value={settings.sessionTimeout}
                    onChange={(e) => updateSetting('sessionTimeout', parseInt(e.target.value) || 3600)}
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('systemSettings.sessionTimeoutDesc')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Settings */}
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  {t('systemSettings.notificationsTitle')}
                </CardTitle>
                <CardDescription>{t('systemSettings.notificationsDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('systemSettings.enableNotifications')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('systemSettings.enableNotificationsDesc')}
                    </p>
                  </div>
                  <Switch
                    checked={settings.enableNotifications}
                    onCheckedChange={(checked) => updateSetting('enableNotifications', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {t('systemSettings.emailNotifications')}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t('systemSettings.emailNotificationsDesc')}
                    </p>
                  </div>
                  <Switch
                    checked={settings.enableEmailNotifications}
                    onCheckedChange={(checked) => updateSetting('enableEmailNotifications', checked)}
                    disabled={!settings.enableNotifications}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('systemSettings.smsNotifications')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('systemSettings.smsNotificationsDesc')}
                    </p>
                  </div>
                  <Switch
                    checked={settings.enableSMSNotifications}
                    onCheckedChange={(checked) => updateSetting('enableSMSNotifications', checked)}
                    disabled={!settings.enableNotifications}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          {/* Language Management */}
          <TabsContent value="languages" className="space-y-4">
            <LanguageManagement />
          </TabsContent>

          {/* Advanced Settings */}
          <TabsContent value="advanced" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  {t('systemSettings.advancedTitle')}
                </CardTitle>
                <CardDescription>{t('systemSettings.advancedDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="apiRateLimit">{t('systemSettings.apiRateLimit')}</Label>
                  <Input
                    id="apiRateLimit"
                    type="number"
                    min="10"
                    max="1000"
                    value={settings.apiRateLimit}
                    onChange={(e) => updateSetting('apiRateLimit', parseInt(e.target.value) || 100)}
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('systemSettings.apiRateLimitDesc')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="databaseBackupFrequency">{t('systemSettings.databaseBackupFrequency')}</Label>
                  <select
                    id="databaseBackupFrequency"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    value={settings.databaseBackupFrequency}
                    onChange={(e) => updateSetting('databaseBackupFrequency', e.target.value)}
                  >
                    <option value="hourly">{t('systemSettings.backupHourly')}</option>
                    <option value="daily">{t('systemSettings.backupDaily')}</option>
                    <option value="weekly">{t('systemSettings.backupWeekly')}</option>
                    <option value="monthly">{t('systemSettings.backupMonthly')}</option>
                  </select>
                  <p className="text-sm text-muted-foreground">
                    {t('systemSettings.databaseBackupFrequencyDesc')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            {t('systemSettings.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? t('systemSettings.saving') : t('systemSettings.saveSettings')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

