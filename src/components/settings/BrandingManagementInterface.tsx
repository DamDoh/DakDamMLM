'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { brandingManagementService, BrandingConfig } from '@/services/branding-management-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, X, Eye, Palette, Type, Settings } from 'lucide-react';

interface BrandingManagementInterfaceProps {
  companyId?: string;
}

export function BrandingManagementInterface({ companyId }: BrandingManagementInterfaceProps) {
  const { data: session } = useSession();
  const [brandingConfig, setBrandingConfig] = useState<BrandingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const fileInputRefs = {
    logo: useRef<HTMLInputElement>(null),
    favicon: useRef<HTMLInputElement>(null),
    header: useRef<HTMLInputElement>(null),
    footer: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    loadBrandingConfig();
  }, [companyId, session]);

  const loadBrandingConfig = async () => {
    if (!companyId || !session?.user?.id) return;

    try {
      setLoading(true);
      const config = await brandingManagementService.getBrandingConfig(companyId);
      setBrandingConfig(config);
    } catch (error) {
      console.error('Failed to load branding config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleColorChange = (field: keyof BrandingConfig, value: string) => {
    if (!brandingConfig) return;

    setBrandingConfig({
      ...brandingConfig,
      [field]: value,
    });
  };

  const handleFontChange = (type: 'primary' | 'secondary', value: string) => {
    if (!brandingConfig) return;

    setBrandingConfig({
      ...brandingConfig,
      customFonts: {
        ...brandingConfig.customFonts,
        [type]: value,
      },
    });
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: 'logo' | 'favicon' | 'header' | 'footer'
  ) => {
    const file = event.target.files?.[0];
    if (!file || !companyId || !session?.user?.id) return;

    try {
      const fileUrl = await brandingManagementService.uploadLogo(
        companyId,
        Buffer.from(await file.arrayBuffer()),
        file.name,
        type,
        session.user.id
      );

      setBrandingConfig(prev => prev ? {
        ...prev,
        [type === 'logo' ? 'logoUrl' :
         type === 'favicon' ? 'faviconUrl' :
         type === 'header' ? 'headerLogoUrl' : 'footerLogoUrl']: fileUrl,
      } : null);
    } catch (error) {
      console.error('Failed to upload file:', error);
      // Show error to user
    }
  };

  const handleDeleteAsset = async (type: 'logo' | 'favicon' | 'header' | 'footer') => {
    if (!companyId || !session?.user?.id) return;

    try {
      await brandingManagementService.deleteBrandingAsset(companyId, type, session.user.id);

      setBrandingConfig(prev => prev ? {
        ...prev,
        [type === 'logo' ? 'logoUrl' :
         type === 'favicon' ? 'faviconUrl' :
         type === 'header' ? 'headerLogoUrl' : 'footerLogoUrl']: undefined,
      } : null);
    } catch (error) {
      console.error('Failed to delete asset:', error);
    }
  };

  const handleSave = async () => {
    if (!brandingConfig || !companyId || !session?.user?.id) return;

    try {
      setSaving(true);
      setValidationErrors([]);
      setValidationWarnings([]);

      const updatedConfig = await brandingManagementService.updateBrandingConfig(
        companyId,
        brandingConfig,
        session.user.id
      );

      setBrandingConfig(updatedConfig);
    } catch (error: any) {
      if (error.message.includes('Invalid branding configuration')) {
        const errors = error.message.replace('Invalid branding configuration: ', '').split(', ');
        setValidationErrors(errors);
      } else {
        console.error('Failed to save branding config:', error);
      }
    } finally {
      setSaving(false);
    }
  };

  const generatePreviewCSS = () => {
    if (!brandingConfig) return '';
    return brandingManagementService.generateThemeCSS(brandingConfig);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!brandingConfig) {
    return (
      <Alert>
        <AlertDescription>
          Unable to load branding configuration. Please ensure you have the necessary permissions.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Branding Management</h2>
          <p className="text-gray-600">Customize your company's visual identity</p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => setPreviewMode(!previewMode)}
            className="flex items-center space-x-2"
          >
            <Eye className="h-4 w-4" />
            <span>{previewMode ? 'Exit Preview' : 'Preview'}</span>
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2"
          >
            {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
            <span>Save Changes</span>
          </Button>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <ul className="list-disc list-inside">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Validation Warnings */}
      {validationWarnings.length > 0 && (
        <Alert>
          <AlertDescription>
            <ul className="list-disc list-inside">
              {validationWarnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Preview CSS */}
      {previewMode && (
        <style dangerouslySetInnerHTML={{ __html: generatePreviewCSS() }} />
      )}

      <Tabs defaultValue="logos" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="logos" className="flex items-center space-x-2">
            <Upload className="h-4 w-4" />
            <span>Logos</span>
          </TabsTrigger>
          <TabsTrigger value="colors" className="flex items-center space-x-2">
            <Palette className="h-4 w-4" />
            <span>Colors</span>
          </TabsTrigger>
          <TabsTrigger value="fonts" className="flex items-center space-x-2">
            <Type className="h-4 w-4" />
            <span>Fonts</span>
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Advanced</span>
          </TabsTrigger>
        </TabsList>

        {/* Logos Tab */}
        <TabsContent value="logos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Logo Assets</CardTitle>
              <CardDescription>
                Upload and manage your company's logo files. Recommended sizes: Logo (200x80px), Favicon (32x32px)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Main Logo */}
              <div className="space-y-2">
                <Label htmlFor="logo">Main Logo</Label>
                <div className="flex items-center space-x-4">
                  {brandingConfig.logoUrl ? (
                    <div className="relative">
                      <img
                        src={brandingConfig.logoUrl}
                        alt="Company Logo"
                        className="h-16 w-auto border rounded"
                      />
                      <button
                        onClick={() => handleDeleteAsset('logo')}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-16 w-32 border-2 border-dashed border-gray-300 rounded flex items-center justify-center">
                      <span className="text-gray-500">No logo</span>
                    </div>
                  )}
                  <div>
                    <input
                      ref={fileInputRefs.logo}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'logo')}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRefs.logo.current?.click()}
                    >
                      Upload Logo
                    </Button>
                  </div>
                </div>
              </div>

              {/* Favicon */}
              <div className="space-y-2">
                <Label htmlFor="favicon">Favicon</Label>
                <div className="flex items-center space-x-4">
                  {brandingConfig.faviconUrl ? (
                    <div className="relative">
                      <img
                        src={brandingConfig.faviconUrl}
                        alt="Favicon"
                        className="h-8 w-8 border rounded"
                      />
                      <button
                        onClick={() => handleDeleteAsset('favicon')}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-8 w-8 border-2 border-dashed border-gray-300 rounded flex items-center justify-center">
                      <span className="text-gray-500 text-xs">Fav</span>
                    </div>
                  )}
                  <div>
                    <input
                      ref={fileInputRefs.favicon}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'favicon')}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRefs.favicon.current?.click()}
                    >
                      Upload Favicon
                    </Button>
                  </div>
                </div>
              </div>

              {/* Header Logo */}
              <div className="space-y-2">
                <Label htmlFor="header">Header Logo</Label>
                <div className="flex items-center space-x-4">
                  {brandingConfig.headerLogoUrl ? (
                    <div className="relative">
                      <img
                        src={brandingConfig.headerLogoUrl}
                        alt="Header Logo"
                        className="h-12 w-auto border rounded"
                      />
                      <button
                        onClick={() => handleDeleteAsset('header')}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-12 w-24 border-2 border-dashed border-gray-300 rounded flex items-center justify-center">
                      <span className="text-gray-500 text-sm">Header</span>
                    </div>
                  )}
                  <div>
                    <input
                      ref={fileInputRefs.header}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'header')}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRefs.header.current?.click()}
                    >
                      Upload Header Logo
                    </Button>
                  </div>
                </div>
              </div>

              {/* Footer Logo */}
              <div className="space-y-2">
                <Label htmlFor="footer">Footer Logo</Label>
                <div className="flex items-center space-x-4">
                  {brandingConfig.footerLogoUrl ? (
                    <div className="relative">
                      <img
                        src={brandingConfig.footerLogoUrl}
                        alt="Footer Logo"
                        className="h-12 w-auto border rounded"
                      />
                      <button
                        onClick={() => handleDeleteAsset('footer')}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-12 w-24 border-2 border-dashed border-gray-300 rounded flex items-center justify-center">
                      <span className="text-gray-500 text-sm">Footer</span>
                    </div>
                  )}
                  <div>
                    <input
                      ref={fileInputRefs.footer}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'footer')}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRefs.footer.current?.click()}
                    >
                      Upload Footer Logo
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Colors Tab */}
        <TabsContent value="colors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Color Palette</CardTitle>
              <CardDescription>
                Define your brand colors. These will be used throughout the platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Primary Color */}
              <div className="space-y-2">
                <Label htmlFor="primary">Primary Color</Label>
                <div className="flex items-center space-x-4">
                  <input
                    type="color"
                    id="primary"
                    value={brandingConfig.primaryColor}
                    onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                    className="w-12 h-12 border rounded cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={brandingConfig.primaryColor}
                    onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                    placeholder="#3B82F6"
                    className="font-mono"
                  />
                  <div
                    className="w-8 h-8 rounded border"
                    style={{ backgroundColor: brandingConfig.primaryColor }}
                  />
                </div>
              </div>

              {/* Secondary Color */}
              <div className="space-y-2">
                <Label htmlFor="secondary">Secondary Color</Label>
                <div className="flex items-center space-x-4">
                  <input
                    type="color"
                    id="secondary"
                    value={brandingConfig.secondaryColor}
                    onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                    className="w-12 h-12 border rounded cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={brandingConfig.secondaryColor}
                    onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                    placeholder="#64748B"
                    className="font-mono"
                  />
                  <div
                    className="w-8 h-8 rounded border"
                    style={{ backgroundColor: brandingConfig.secondaryColor }}
                  />
                </div>
              </div>

              {/* Accent Color */}
              <div className="space-y-2">
                <Label htmlFor="accent">Accent Color</Label>
                <div className="flex items-center space-x-4">
                  <input
                    type="color"
                    id="accent"
                    value={brandingConfig.accentColor}
                    onChange={(e) => handleColorChange('accentColor', e.target.value)}
                    className="w-12 h-12 border rounded cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={brandingConfig.accentColor}
                    onChange={(e) => handleColorChange('accentColor', e.target.value)}
                    placeholder="#10B981"
                    className="font-mono"
                  />
                  <div
                    className="w-8 h-8 rounded border"
                    style={{ backgroundColor: brandingConfig.accentColor }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fonts Tab */}
        <TabsContent value="fonts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Typography</CardTitle>
              <CardDescription>
                Choose fonts for your brand. Primary font is used for body text, secondary for headings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Primary Font */}
              <div className="space-y-2">
                <Label htmlFor="primary-font">Primary Font (Body Text)</Label>
                <select
                  id="primary-font"
                  value={brandingConfig.customFonts?.primary || ''}
                  onChange={(e) => handleFontChange('primary', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Default (Inter)</option>
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Inter">Inter</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Open Sans">Open Sans</option>
                  <option value="Lato">Lato</option>
                  <option value="Montserrat">Montserrat</option>
                  <option value="Poppins">Poppins</option>
                </select>
              </div>

              {/* Secondary Font */}
              <div className="space-y-2">
                <Label htmlFor="secondary-font">Secondary Font (Headings)</Label>
                <select
                  id="secondary-font"
                  value={brandingConfig.customFonts?.secondary || ''}
                  onChange={(e) => handleFontChange('secondary', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Default (Inter)</option>
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Inter">Inter</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Open Sans">Open Sans</option>
                  <option value="Lato">Lato</option>
                  <option value="Montserrat">Montserrat</option>
                  <option value="Poppins">Poppins</option>
                </select>
              </div>

              {/* Font Preview */}
              <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                <h3 className="text-lg font-medium">Preview</h3>
                <div
                  style={{
                    fontFamily: brandingConfig.customFonts?.primary || 'Inter, sans-serif',
                  }}
                >
                  <p className="text-base">This is body text using the primary font.</p>
                  <p className="text-sm text-gray-600">This is smaller body text.</p>
                </div>
                <div
                  style={{
                    fontFamily: brandingConfig.customFonts?.secondary || 'Inter, sans-serif',
                  }}
                >
                  <h1 className="text-2xl font-bold">Heading 1</h1>
                  <h2 className="text-xl font-semibold">Heading 2</h2>
                  <h3 className="text-lg font-medium">Heading 3</h3>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Tab */}
        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Theme Settings</CardTitle>
              <CardDescription>
                Fine-tune your theme with custom CSS variables and styling options.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Border Radius */}
              <div className="space-y-2">
                <Label htmlFor="border-radius">Border Radius</Label>
                <Input
                  id="border-radius"
                  type="text"
                  value={brandingConfig.themeConfig?.borderRadius || '8px'}
                  onChange={(e) => setBrandingConfig(prev => prev ? {
                    ...prev,
                    themeConfig: {
                      ...prev.themeConfig,
                      borderRadius: e.target.value,
                    },
                  } : null)}
                  placeholder="8px"
                />
                <p className="text-sm text-gray-600">Controls the roundness of corners (e.g., 8px, 12px)</p>
              </div>

              {/* Shadow */}
              <div className="space-y-2">
                <Label htmlFor="shadow">Box Shadow</Label>
                <Input
                  id="shadow"
                  type="text"
                  value={brandingConfig.themeConfig?.shadow || '0 1px 3px rgba(0, 0, 0, 0.1)'}
                  onChange={(e) => setBrandingConfig(prev => prev ? {
                    ...prev,
                    themeConfig: {
                      ...prev.themeConfig,
                      shadow: e.target.value,
                    },
                  } : null)}
                  placeholder="0 1px 3px rgba(0, 0, 0, 0.1)"
                />
                <p className="text-sm text-gray-600">CSS box-shadow value for depth and elevation</p>
              </div>

              {/* Custom CSS */}
              <div className="space-y-2">
                <Label htmlFor="custom-css">Custom CSS</Label>
                <textarea
                  id="custom-css"
                  value={brandingConfig.customCss || ''}
                  onChange={(e) => setBrandingConfig(prev => prev ? {
                    ...prev,
                    customCss: e.target.value,
                  } : null)}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
                  placeholder="/* Add custom CSS here */"
                />
                <p className="text-sm text-gray-600">Additional CSS that will be applied to your branded pages</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}