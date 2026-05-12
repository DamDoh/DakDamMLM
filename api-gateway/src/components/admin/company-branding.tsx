'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Palette, Monitor, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/context/company-context';
import type { Company } from '@/lib/types';
import Image from 'next/image';

export default function CompanyBranding() {
  const { toast } = useToast();
  const { company, updateCompanyBranding } = useCompany();
  const [isLoading, setIsLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);

  const [brandingData, setBrandingData] = useState({
    logoUrl: company?.logoUrl || '',
    faviconUrl: company?.faviconUrl || '',
    primaryColor: company?.primaryColor || '#3b82f6',
    secondaryColor: company?.secondaryColor || '#64748b',
    loginPageConfig: {
      title: company?.loginPageConfig?.title || '',
      subtitle: company?.loginPageConfig?.subtitle || '',
      backgroundImageUrl: company?.loginPageConfig?.backgroundImageUrl || '',
      showLanguageSelector: company?.loginPageConfig?.showLanguageSelector !== undefined ? company.loginPageConfig.showLanguageSelector : true,
    },
    customCss: company?.customCss || '',
  });

  const [authSettings, setAuthSettings] = useState({
    allowEmailLogin: company?.allowEmailLogin ?? true,
    allowPhoneLogin: company?.allowPhoneLogin ?? true,
    requireEmailVerification: company?.requireEmailVerification ?? false,
    requirePhoneVerification: company?.requirePhoneVerification ?? false,
  });

  const handleFileUpload = async (file: File, type: 'logo' | 'favicon' | 'background') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    try {
      const response = await fetch('/api/upload/company-asset', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const { url } = await response.json();
        return url;
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
    return null;
  };

  const handleSaveBranding = async () => {
    setIsLoading(true);
    try {
      let updates: Partial<Company> = { ...brandingData };

      // Upload files if selected
      if (logoFile) {
        const logoUrl = await handleFileUpload(logoFile, 'logo');
        if (logoUrl) updates.logoUrl = logoUrl;
      }

      if (faviconFile) {
        const faviconUrl = await handleFileUpload(faviconFile, 'favicon');
        if (faviconUrl) updates.faviconUrl = faviconUrl;
      }

      if (backgroundFile) {
        const backgroundUrl = await handleFileUpload(backgroundFile, 'background');
        if (backgroundUrl) {
          updates.loginPageConfig = {
            ...brandingData.loginPageConfig,
            ...updates.loginPageConfig,
            backgroundImageUrl: backgroundUrl,
            showLanguageSelector: updates.loginPageConfig?.showLanguageSelector ?? brandingData.loginPageConfig.showLanguageSelector,
          };
        }
      }

      await updateCompanyBranding(updates);

      toast({
        title: 'Branding Updated',
        description: 'Company branding has been updated successfully.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Failed to update company branding.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAuthSettings = async () => {
    setIsLoading(true);
    try {
      await updateCompanyBranding(authSettings);

      toast({
        title: 'Authentication Settings Updated',
        description: 'Login preferences have been updated successfully.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Failed to update authentication settings.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Company Branding</h2>
          <p className="text-muted-foreground">{'Customize your company\'s appearance and login experience'}</p>
        </div>
      </div>

      <Tabs defaultValue="branding" className="space-y-6">
        <TabsList>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="login-page">Login Page</TabsTrigger>
          <TabsTrigger value="authentication">Authentication</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Visual Branding
              </CardTitle>
              <CardDescription>
                Upload your company logo, set brand colors, and customize the visual identity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="logo">Company Logo</Label>
                    <div className="mt-2">
                      <Input
                        id="logo"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                      />
                      {brandingData.logoUrl && (
                        <div className="mt-2">
                          <Image
                            src={brandingData.logoUrl}
                            alt="Current logo"
                            width={100}
                            height={100}
                            className="h-12 w-auto border rounded"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="favicon">Favicon</Label>
                    <div className="mt-2">
                      <Input
                        id="favicon"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setFaviconFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="primary-color">Primary Color</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="primary-color"
                        type="color"
                        value={brandingData.primaryColor}
                        onChange={(e) => setBrandingData({
                          ...brandingData,
                          primaryColor: e.target.value
                        })}
                        className="w-16 h-10"
                      />
                      <Input
                        value={brandingData.primaryColor}
                        onChange={(e) => setBrandingData({
                          ...brandingData,
                          primaryColor: e.target.value
                        })}
                        placeholder="#3b82f6"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="secondary-color">Secondary Color</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="secondary-color"
                        type="color"
                        value={brandingData.secondaryColor}
                        onChange={(e) => setBrandingData({
                          ...brandingData,
                          secondaryColor: e.target.value
                        })}
                        className="w-16 h-10"
                      />
                      <Input
                        value={brandingData.secondaryColor}
                        onChange={(e) => setBrandingData({
                          ...brandingData,
                          secondaryColor: e.target.value
                        })}
                        placeholder="#64748b"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="login-page" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Login Page Customization
              </CardTitle>
              <CardDescription>
                Customize the login experience for your distributors.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="login-title">Login Page Title</Label>
                    <Input
                      id="login-title"
                      value={brandingData.loginPageConfig.title}
                      onChange={(e) => setBrandingData({
                        ...brandingData,
                        loginPageConfig: {
                          ...brandingData.loginPageConfig,
                          title: e.target.value
                        }
                      })}
                      placeholder="Welcome to [Company Name]"
                    />
                  </div>

                  <div>
                    <Label htmlFor="login-subtitle">Login Page Subtitle</Label>
                    <Input
                      id="login-subtitle"
                      value={brandingData.loginPageConfig.subtitle}
                      onChange={(e) => setBrandingData({
                        ...brandingData,
                        loginPageConfig: {
                          ...brandingData.loginPageConfig,
                          subtitle: e.target.value
                        }
                      })}
                      placeholder="Enter your credentials to access your account"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="show-language-selector"
                      checked={brandingData.loginPageConfig.showLanguageSelector}
                      onCheckedChange={(checked) => setBrandingData({
                        ...brandingData,
                        loginPageConfig: {
                          ...brandingData.loginPageConfig,
                          showLanguageSelector: checked
                        }
                      })}
                    />
                    <Label htmlFor="show-language-selector">Show Language Selector</Label>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="background-image">Background Image</Label>
                    <div className="mt-2">
                      <Input
                        id="background-image"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setBackgroundFile(e.target.files?.[0] || null)}
                      />
                      {brandingData.loginPageConfig.backgroundImageUrl && (
                        <div className="mt-2">
                          <Image
                            src={brandingData.loginPageConfig.backgroundImageUrl}
                            alt="Login background"
                            width={100}
                            height={100}
                            className="w-full h-32 object-cover border rounded"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="authentication" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Authentication Preferences
              </CardTitle>
              <CardDescription>
                Configure how your distributors can log in to the platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow Email Login</Label>
                    <p className="text-sm text-muted-foreground">
                      Distributors can log in using their email address
                    </p>
                  </div>
                  <Switch
                    checked={authSettings.allowEmailLogin}
                    onCheckedChange={(checked) => setAuthSettings({
                      ...authSettings,
                      allowEmailLogin: checked
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow Phone Login</Label>
                    <p className="text-sm text-muted-foreground">
                      Distributors can log in using their phone number only
                    </p>
                  </div>
                  <Switch
                    checked={authSettings.allowPhoneLogin}
                    onCheckedChange={(checked) => setAuthSettings({
                      ...authSettings,
                      allowPhoneLogin: checked
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require Email Verification</Label>
                    <p className="text-sm text-muted-foreground">
                      New distributors must verify their email before accessing the platform
                    </p>
                  </div>
                  <Switch
                    checked={authSettings.requireEmailVerification}
                    onCheckedChange={(checked) => setAuthSettings({
                      ...authSettings,
                      requireEmailVerification: checked
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require Phone Verification</Label>
                    <p className="text-sm text-muted-foreground">
                      New distributors must verify their phone number before accessing the platform
                    </p>
                  </div>
                  <Switch
                    checked={authSettings.requirePhoneVerification}
                    onCheckedChange={(checked) => setAuthSettings({
                      ...authSettings,
                      requirePhoneVerification: checked
                    })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Custom CSS</CardTitle>
              <CardDescription>
                {'Add custom CSS to further customize your company\'s appearance.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={brandingData.customCss}
                onChange={(e) => setBrandingData({
                  ...brandingData,
                  customCss: e.target.value
                })}
                placeholder="/* Add your custom CSS here */"
                className="min-h-[200px] font-mono text-sm"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-4">
        <Button
          variant="outline"
          onClick={handleSaveAuthSettings}
          disabled={isLoading}
        >
          Save Auth Settings
        </Button>
        <Button
          onClick={handleSaveBranding}
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save Branding'}
        </Button>
      </div>
    </div>
  );
}