// Branding Management Service
// Handles logo uploads, theme configuration, and branding validation

import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export interface BrandingConfig {
  logoUrl?: string;
  faviconUrl?: string;
  headerLogoUrl?: string;
  footerLogoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  customFonts?: {
    primary?: string;
    secondary?: string;
  };
  themeConfig?: {
    borderRadius?: string;
    shadow?: string;
    spacing?: Record<string, string>;
  };
}

export interface BrandingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

class BrandingManagementService {
  private static instance: BrandingManagementService;

  private constructor() {}

  static getInstance(): BrandingManagementService {
    if (!BrandingManagementService.instance) {
      BrandingManagementService.instance = new BrandingManagementService();
    }
    return BrandingManagementService.instance;
  }

  // Get branding configuration for a company
  async getBrandingConfig(companyId: string): Promise<BrandingConfig | null> {
    try {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
          logoUrl: true,
          faviconUrl: true,
          headerLogoUrl: true,
          footerLogoUrl: true,
          primaryColor: true,
          secondaryColor: true,
          accentColor: true,
          customFonts: true,
          themeConfig: true,
        },
      });

      if (!company) {
        return null;
      }

      return {
        logoUrl: company.logoUrl || undefined,
        faviconUrl: company.faviconUrl || undefined,
        headerLogoUrl: company.headerLogoUrl || undefined,
        footerLogoUrl: company.footerLogoUrl || undefined,
        primaryColor: company.primaryColor || '#3B82F6',
        secondaryColor: company.secondaryColor || '#64748B',
        accentColor: company.accentColor || '#10B981',
        customFonts: company.customFonts as any || undefined,
        themeConfig: company.themeConfig as any || undefined,
      };
    } catch (error) {
      logger.error('Failed to get branding config:', error);
      throw new Error('Failed to retrieve branding configuration');
    }
  }

  // Update branding configuration
  async updateBrandingConfig(
    companyId: string,
    config: Partial<BrandingConfig>,
    updatedBy: string
  ): Promise<BrandingConfig> {
    try {
      // Validate the configuration
      const validation = await this.validateBrandingConfig(config);
      if (!validation.isValid) {
        throw new Error(`Invalid branding configuration: ${validation.errors.join(', ')}`);
      }

      // Update the company record
      const updatedCompany = await prisma.company.update({
        where: { id: companyId },
        data: {
          logoUrl: config.logoUrl,
          faviconUrl: config.faviconUrl,
          headerLogoUrl: config.headerLogoUrl,
          footerLogoUrl: config.footerLogoUrl,
          primaryColor: config.primaryColor,
          secondaryColor: config.secondaryColor,
          accentColor: config.accentColor,
          customFonts: config.customFonts,
          themeConfig: config.themeConfig,
          updatedAt: new Date(),
        },
        select: {
          logoUrl: true,
          faviconUrl: true,
          headerLogoUrl: true,
          footerLogoUrl: true,
          primaryColor: true,
          secondaryColor: true,
          accentColor: true,
          customFonts: true,
          themeConfig: true,
        },
      });

      // Log the change
      logger.info('Branding configuration updated', {
        companyId,
        updatedBy,
        changes: Object.keys(config),
      });

      return {
        logoUrl: updatedCompany.logoUrl || undefined,
        faviconUrl: updatedCompany.faviconUrl || undefined,
        headerLogoUrl: updatedCompany.headerLogoUrl || undefined,
        footerLogoUrl: updatedCompany.footerLogoUrl || undefined,
        primaryColor: updatedCompany.primaryColor || '#3B82F6',
        secondaryColor: updatedCompany.secondaryColor || '#64748B',
        accentColor: updatedCompany.accentColor || '#10B981',
        customFonts: updatedCompany.customFonts as any || undefined,
        themeConfig: updatedCompany.themeConfig as any || undefined,
      };
    } catch (error) {
      logger.error('Failed to update branding config:', error);
      throw error;
    }
  }

  // Validate branding configuration
  async validateBrandingConfig(config: Partial<BrandingConfig>): Promise<BrandingValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate colors
    const colorFields = ['primaryColor', 'secondaryColor', 'accentColor'];
    for (const field of colorFields) {
      const color = config[field as keyof BrandingConfig] as string;
      if (color && !this.isValidColor(color)) {
        errors.push(`${field} must be a valid hex color code (e.g., #FF0000)`);
      }
    }

    // Validate URLs
    const urlFields = ['logoUrl', 'faviconUrl', 'headerLogoUrl', 'footerLogoUrl'];
    for (const field of urlFields) {
      const url = config[field as keyof BrandingConfig] as string;
      if (url && !this.isValidUrl(url)) {
        errors.push(`${field} must be a valid URL`);
      }
    }

    // Validate font configuration
    if (config.customFonts) {
      const allowedFonts = [
        'Arial', 'Helvetica', 'Times New Roman', 'Courier New',
        'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Bookman',
        'Comic Sans MS', 'Trebuchet MS', 'Arial Black', 'Impact',
        'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins'
      ];

      if (config.customFonts.primary && !allowedFonts.includes(config.customFonts.primary)) {
        warnings.push(`Primary font "${config.customFonts.primary}" is not in the recommended font list`);
      }
      if (config.customFonts.secondary && !allowedFonts.includes(config.customFonts.secondary)) {
        warnings.push(`Secondary font "${config.customFonts.secondary}" is not in the recommended font list`);
      }
    }

    // Validate theme config
    if (config.themeConfig) {
      if (config.themeConfig.borderRadius && !/^\d+px$/.test(config.themeConfig.borderRadius)) {
        errors.push('borderRadius must be in format "8px"');
      }

      if (config.themeConfig.shadow && !config.themeConfig.shadow.includes('box-shadow:')) {
        warnings.push('Shadow should be a valid CSS box-shadow value');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // Upload and store logo file
  async uploadLogo(
    companyId: string,
    file: Buffer,
    fileName: string,
    type: 'logo' | 'favicon' | 'header' | 'footer',
    uploadedBy: string
  ): Promise<string> {
    try {
      // Validate file type and size
      const validation = this.validateImageFile(file, fileName);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Generate unique filename
      const extension = fileName.split('.').pop()?.toLowerCase();
      const uniqueName = `${companyId}_${type}_${Date.now()}.${extension}`;

      // In a real implementation, you would upload to S3/Cloudinary/CDN
      // For now, we'll simulate with a local path
      const fileUrl = `/uploads/branding/${companyId}/${uniqueName}`;

      // Store file metadata in database
      const fieldMap = {
        logo: 'logoUrl',
        favicon: 'faviconUrl',
        header: 'headerLogoUrl',
        footer: 'footerLogoUrl',
      };

      await prisma.company.update({
        where: { id: companyId },
        data: {
          [fieldMap[type]]: fileUrl,
          updatedAt: new Date(),
        },
      });

      logger.info('Logo uploaded successfully', {
        companyId,
        type,
        fileName: uniqueName,
        uploadedBy,
      });

      return fileUrl;
    } catch (error) {
      logger.error('Failed to upload logo:', error);
      throw error;
    }
  }

  // Delete branding asset
  async deleteBrandingAsset(
    companyId: string,
    type: 'logo' | 'favicon' | 'header' | 'footer',
    deletedBy: string
  ): Promise<void> {
    try {
      const fieldMap = {
        logo: 'logoUrl',
        favicon: 'faviconUrl',
        header: 'headerLogoUrl',
        footer: 'footerLogoUrl',
      };

      // Get current URL for cleanup
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { [fieldMap[type]]: true },
      });

      if (company && company[fieldMap[type] as keyof typeof company]) {
        // In a real implementation, delete from S3/Cloudinary/CDN
        // For now, just update the database
        await prisma.company.update({
          where: { id: companyId },
          data: {
            [fieldMap[type]]: null,
            updatedAt: new Date(),
          },
        });

        logger.info('Branding asset deleted', {
          companyId,
          type,
          deletedBy,
        });
      }
    } catch (error) {
      logger.error('Failed to delete branding asset:', error);
      throw error;
    }
  }

  // Generate CSS variables for theming
  generateThemeCSS(config: BrandingConfig): string {
    const css = `
      :root {
        --primary-color: ${config.primaryColor};
        --secondary-color: ${config.secondaryColor};
        --accent-color: ${config.accentColor};
        --font-primary: ${config.customFonts?.primary || 'Inter, sans-serif'};
        --font-secondary: ${config.customFonts?.secondary || 'Inter, sans-serif'};
        --border-radius: ${config.themeConfig?.borderRadius || '8px'};
        --shadow: ${config.themeConfig?.shadow || '0 1px 3px rgba(0, 0, 0, 0.1)'};
      }

      body {
        font-family: var(--font-primary);
      }

      h1, h2, h3, h4, h5, h6 {
        font-family: var(--font-secondary);
      }
    `;

    return css;
  }

  // Private helper methods
  private isValidColor(color: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private validateImageFile(file: Buffer, fileName: string): { isValid: boolean; error?: string } {
    // Check file size (max 5MB)
    if (file.length > 5 * 1024 * 1024) {
      return { isValid: false, error: 'File size must be less than 5MB' };
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    const extension = fileName.split('.').pop()?.toLowerCase();

    if (!extension || !['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(extension)) {
      return { isValid: false, error: 'File must be a valid image format (JPG, PNG, WebP, SVG)' };
    }

    return { isValid: true };
  }
}

export const brandingManagementService = BrandingManagementService.getInstance();
export default brandingManagementService;