// Dynamic Theme Engine
// Handles runtime CSS generation, theme switching, and styling application

import { BrandingConfig } from './branding-management-service';
import { logger } from '@/lib/logger';

export interface ThemeVariables {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontPrimary: string;
  fontSecondary: string;
  borderRadius: string;
  shadow: string;
  [key: string]: string;
}

export interface ThemeConfig {
  id: string;
  name: string;
  variables: ThemeVariables;
  customCss?: string;
}

class DynamicThemeEngine {
  private static instance: DynamicThemeEngine;
  private activeThemes = new Map<string, ThemeConfig>();
  private styleSheets = new Map<string, CSSStyleSheet>();
  private themeCache = new Map<string, string>();

  private constructor() {
    // Initialize with default theme
    this.initializeDefaultTheme();
  }

  static getInstance(): DynamicThemeEngine {
    if (!DynamicThemeEngine.instance) {
      DynamicThemeEngine.instance = new DynamicThemeEngine();
    }
    return DynamicThemeEngine.instance;
  }

  // Initialize default theme
  private initializeDefaultTheme(): void {
    const defaultTheme: ThemeConfig = {
      id: 'default',
      name: 'Default Theme',
      variables: {
        primaryColor: '#3B82F6',
        secondaryColor: '#64748B',
        accentColor: '#10B981',
        fontPrimary: 'Inter, sans-serif',
        fontSecondary: 'Inter, sans-serif',
        borderRadius: '8px',
        shadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      },
    };

    this.activeThemes.set('default', defaultTheme);
  }

  // Generate theme from branding config
  generateThemeFromBranding(companyId: string, branding: BrandingConfig): ThemeConfig {
    const themeId = `company-${companyId}`;

    const variables: ThemeVariables = {
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      accentColor: branding.accentColor,
      fontPrimary: branding.customFonts?.primary || 'Inter, sans-serif',
      fontSecondary: branding.customFonts?.secondary || 'Inter, sans-serif',
      borderRadius: branding.themeConfig?.borderRadius || '8px',
      shadow: branding.themeConfig?.shadow || '0 1px 3px rgba(0, 0, 0, 0.1)',
    };

    // Add custom spacing if defined
    if (branding.themeConfig?.spacing) {
      Object.entries(branding.themeConfig.spacing).forEach(([key, value]) => {
        variables[`spacing-${key}`] = value;
      });
    }

    const theme: ThemeConfig = {
      id: themeId,
      name: `Company ${companyId} Theme`,
      variables,
      customCss: branding.customCss,
    };

    return theme;
  }

  // Apply theme to document
  applyTheme(theme: ThemeConfig, target: Document | ShadowRoot = document): void {
    try {
      // Remove existing theme if any
      this.removeTheme(theme.id, target);

      // Create CSS variables
      const cssVariables = this.generateCSSVariables(theme.variables);

      // Create custom CSS if provided
      const customCss = theme.customCss ? `\n\n/* Custom CSS */\n${theme.customCss}` : '';

      // Combine all CSS
      const fullCss = `${cssVariables}\n\n${this.generateBaseStyles(theme.variables)}${customCss}`;

      // Create and insert stylesheet
      const style = target.createElement('style');
      style.setAttribute('data-theme-id', theme.id);
      style.textContent = fullCss;

      // Insert at the beginning of head to ensure proper precedence
      const head = target.head || target;
      head.insertBefore(style, head.firstChild);

      // Cache the theme
      this.activeThemes.set(theme.id, theme);
      this.themeCache.set(theme.id, fullCss);

      logger.info('Theme applied successfully', { themeId: theme.id });
    } catch (error) {
      logger.error('Failed to apply theme:', error);
    }
  }

  // Remove theme from document
  removeTheme(themeId: string, target: Document | ShadowRoot = document): void {
    try {
      const existingStyle = target.querySelector(`style[data-theme-id="${themeId}"]`);
      if (existingStyle) {
        existingStyle.remove();
      }

      this.activeThemes.delete(themeId);
      this.themeCache.delete(themeId);

      logger.info('Theme removed successfully', { themeId });
    } catch (error) {
      logger.error('Failed to remove theme:', error);
    }
  }

  // Switch between themes
  switchTheme(fromThemeId: string, toTheme: ThemeConfig, target: Document | ShadowRoot = document): void {
    this.removeTheme(fromThemeId, target);
    this.applyTheme(toTheme, target);
  }

  // Generate CSS variables from theme variables
  private generateCSSVariables(variables: ThemeVariables): string {
    const cssVars = Object.entries(variables)
      .map(([key, value]) => `  --${this.camelToKebab(key)}: ${value};`)
      .join('\n');

    return `:root {\n${cssVars}\n}`;
  }

  // Generate base component styles
  private generateBaseStyles(variables: ThemeVariables): string {
    return `

/* Base Component Styles */

* {
  box-sizing: border-box;
}

body {
  font-family: var(--font-primary);
  color: #1f2937;
  line-height: 1.5;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-secondary);
  font-weight: 600;
  line-height: 1.25;
  margin: 0 0 0.5rem 0;
}

h1 { font-size: 2.25rem; }
h2 { font-size: 1.875rem; }
h3 { font-size: 1.5rem; }
h4 { font-size: 1.25rem; }
h5 { font-size: 1.125rem; }
h6 { font-size: 1rem; }

/* Button Styles */
.btn-primary {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.btn-primary:hover {
  background-color: color-mix(in srgb, var(--primary-color) 90%, black);
  border-color: color-mix(in srgb, var(--primary-color) 90%, black);
}

.btn-secondary {
  background-color: var(--secondary-color);
  border-color: var(--secondary-color);
  color: white;
}

.btn-secondary:hover {
  background-color: color-mix(in srgb, var(--secondary-color) 90%, black);
  border-color: color-mix(in srgb, var(--secondary-color) 90%, black);
}

.btn-accent {
  background-color: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}

.btn-accent:hover {
  background-color: color-mix(in srgb, var(--accent-color) 90%, black);
  border-color: color-mix(in srgb, var(--accent-color) 90%, black);
}

/* Form Elements */
.form-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 15%, white);
}

.form-select:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 15%, white);
}

/* Card Styles */
.card {
  border-radius: var(--border-radius);
  box-shadow: var(--shadow);
  border: 1px solid #e5e7eb;
}

.card-header {
  border-bottom: 1px solid #e5e7eb;
  background-color: #f9fafb;
}

/* Navigation */
.nav-link:hover {
  color: var(--primary-color);
}

.nav-link.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}

/* Links */
a {
  color: var(--primary-color);
}

a:hover {
  color: color-mix(in srgb, var(--primary-color) 80%, black);
}

/* Utilities */
.rounded {
  border-radius: var(--border-radius);
}

.shadow {
  box-shadow: var(--shadow);
}

.bg-primary { background-color: var(--primary-color); }
.bg-secondary { background-color: var(--secondary-color); }
.bg-accent { background-color: var(--accent-color); }

.text-primary { color: var(--primary-color); }
.text-secondary { color: var(--secondary-color); }
.text-accent { color: var(--accent-color); }

.border-primary { border-color: var(--primary-color); }
.border-secondary { border-color: var(--secondary-color); }
.border-accent { border-color: var(--accent-color); }
`;
  }

  // Get active theme
  getActiveTheme(themeId: string): ThemeConfig | undefined {
    return this.activeThemes.get(themeId);
  }

  // Get all active themes
  getAllActiveThemes(): ThemeConfig[] {
    return Array.from(this.activeThemes.values());
  }

  // Export theme as CSS string
  exportThemeAsCSS(theme: ThemeConfig): string {
    const cached = this.themeCache.get(theme.id);
    if (cached) return cached;

    const css = this.generateCSSVariables(theme.variables) +
                '\n\n' +
                this.generateBaseStyles(theme.variables) +
                (theme.customCss ? `\n\n/* Custom CSS */\n${theme.customCss}` : '');

    this.themeCache.set(theme.id, css);
    return css;
  }

  // Import theme from CSS string
  importThemeFromCSS(css: string, themeId: string, name: string): ThemeConfig {
    // Parse CSS variables from the CSS string
    const variables: ThemeVariables = {
      primaryColor: '#3B82F6',
      secondaryColor: '#64748B',
      accentColor: '#10B981',
      fontPrimary: 'Inter, sans-serif',
      fontSecondary: 'Inter, sans-serif',
      borderRadius: '8px',
      shadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    };

    // Simple CSS variable extraction (could be enhanced)
    const varRegex = /--([\w-]+):\s*([^;]+);/g;
    let match;
    while ((match = varRegex.exec(css)) !== null) {
      const [, varName, varValue] = match;
      const camelName = this.kebabToCamel(varName);
      if (camelName in variables) {
        variables[camelName] = varValue.trim();
      }
    }

    // Extract custom CSS (everything after the :root block)
    const customCssMatch = css.match(/\/\* Custom CSS \*\/\s*([\s\S]*)$/);
    const customCss = customCssMatch ? customCssMatch[1].trim() : undefined;

    return {
      id: themeId,
      name,
      variables,
      customCss,
    };
  }

  // Utility: Convert camelCase to kebab-case
  private camelToKebab(str: string): string {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  }

  // Utility: Convert kebab-case to camelCase
  private kebabToCamel(str: string): string {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  // Preview theme in a sandboxed environment
  createThemePreview(theme: ThemeConfig, container: HTMLElement): void {
    try {
      // Create a shadow DOM for isolated preview
      const shadow = container.attachShadow({ mode: 'open' });

      // Clone the necessary DOM elements for preview
      const previewHTML = `
        <div style="padding: 20px; font-family: Arial, sans-serif;">
          <h1>Theme Preview</h1>
          <p>This is how your theme will look.</p>
          <button class="btn-primary" style="padding: 10px 20px; margin: 5px; border: none; border-radius: 4px; cursor: pointer;">Primary Button</button>
          <button class="btn-secondary" style="padding: 10px 20px; margin: 5px; border: none; border-radius: 4px; cursor: pointer;">Secondary Button</button>
          <button class="btn-accent" style="padding: 10px 20px; margin: 5px; border: none; border-radius: 4px; cursor: pointer;">Accent Button</button>
          <div class="card" style="padding: 20px; margin: 20px 0; background: white;">
            <h3>Sample Card</h3>
            <p>Card content with sample text.</p>
          </div>
          <input type="text" class="form-input" placeholder="Sample input" style="padding: 8px; margin: 5px 0; border: 1px solid #ccc; border-radius: 4px; width: 200px;">
        </div>
      `;

      shadow.innerHTML = previewHTML;

      // Apply theme to shadow DOM
      this.applyTheme(theme, shadow);
    } catch (error) {
      logger.error('Failed to create theme preview:', error);
    }
  }

  // Cleanup resources
  cleanup(): void {
    this.activeThemes.clear();
    this.styleSheets.clear();
    this.themeCache.clear();
  }
}

export const dynamicThemeEngine = DynamicThemeEngine.getInstance();
export default dynamicThemeEngine;