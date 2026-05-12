// Translation Management System
// Utilities for managing, validating, and completing translations

import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';

export interface TranslationStats {
  language: string;
  totalKeys: number;
  translatedKeys: number;
  missingKeys: number;
  completionPercentage: number;
  missingKeyList: string[];
}

export interface TranslationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class TranslationManager {
  private translationsPath: string;
  private baseLanguage = 'en';

  constructor() {
    this.translationsPath = path.join(process.cwd(), 'src/lib/translations');
  }

  // Get all available languages
  getAvailableLanguages(): string[] {
    const files = fs.readdirSync(this.translationsPath);
    return files
      .filter(file => file.endsWith('.ts'))
      .map(file => file.replace('.ts', ''));
  }

  // Load translation for a specific language
  loadTranslation(language: string): Record<string, any> {
    try {
      const filePath = path.join(this.translationsPath, `${language}.ts`);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Translation file for ${language} not found`);
      }

      // Dynamic import would be better, but for now we'll use require
      // Note: This assumes the translation files export a default object
      const translation = require(filePath);
      return translation[language] || translation.default || {};
    } catch (error) {
      logger.error(`Failed to load translation for ${language}:`, error);
      return {};
    }
  }

  // Get translation statistics
  getTranslationStats(language: string): TranslationStats {
    const baseTranslation = this.loadTranslation(this.baseLanguage);
    const targetTranslation = this.loadTranslation(language);

    const baseKeys = this.getAllKeys(baseTranslation);
    const targetKeys = this.getAllKeys(targetTranslation);

    const missingKeys = baseKeys.filter(key => !targetKeys.includes(key));
    const translatedKeys = baseKeys.length - missingKeys.length;

    return {
      language,
      totalKeys: baseKeys.length,
      translatedKeys,
      missingKeys: missingKeys.length,
      completionPercentage: Math.round((translatedKeys / baseKeys.length) * 100),
      missingKeyList: missingKeys,
    };
  }

  // Get statistics for all languages
  getAllTranslationStats(): TranslationStats[] {
    const languages = this.getAvailableLanguages();
    return languages.map(lang => this.getTranslationStats(lang));
  }

  // Find missing keys for a language
  getMissingKeys(language: string): string[] {
    return this.getTranslationStats(language).missingKeyList;
  }

  // Generate missing keys template for a language
  generateMissingKeysTemplate(language: string, format: 'json' | 'typescript' = 'typescript'): string {
    const missingKeys = this.getMissingKeys(language);
    const baseTranslation = this.loadTranslation(this.baseLanguage);

    const missingTranslations: Record<string, string> = {};

    missingKeys.forEach(key => {
      const englishValue = this.getNestedValue(baseTranslation, key);
      missingTranslations[key] = englishValue || `[TRANSLATE: ${key}]`;
    });

    if (format === 'json') {
      return JSON.stringify(missingTranslations, null, 2);
    } else {
      // TypeScript format
      const entries = Object.entries(missingTranslations)
        .map(([key, value]) => `  '${key}': '${value.replace(/'/g, "\\'")}',`)
        .join('\n');

      return `export const ${language}Missing = {\n${entries}\n};`;
    }
  }

  // Validate translation structure
  validateTranslation(language: string): TranslationValidationResult {
    const result: TranslationValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    try {
      const translation = this.loadTranslation(language);

      // Check for basic structure
      if (!translation || typeof translation !== 'object') {
        result.errors.push('Invalid translation structure');
        result.isValid = false;
        return result;
      }

      // Check for placeholder values
      const allKeys = this.getAllKeys(translation);
      const placeholderKeys = allKeys.filter(key => {
        const value = this.getNestedValue(translation, key);
        return typeof value === 'string' && (
          value.includes('[TRANSLATE:') ||
          value.includes('[TODO]') ||
          value === ''
        );
      });

      if (placeholderKeys.length > 0) {
        result.warnings.push(`${placeholderKeys.length} keys contain placeholder values`);
      }

      // Check for syntax issues (basic)
      allKeys.forEach(key => {
        const value = this.getNestedValue(translation, key);
        if (typeof value === 'string') {
          // Check for unclosed quotes or brackets
          if (value.includes("'") && !value.includes("\\'")) {
            // This is a basic check - more sophisticated validation would be needed
          }
        }
      });

    } catch (error) {
      result.errors.push(`Failed to validate translation: ${error}`);
      result.isValid = false;
    }

    return result;
  }

  // Merge missing translations into existing file
  async mergeMissingTranslations(language: string, newTranslations: Record<string, string>): Promise<void> {
    try {
      const filePath = path.join(this.translationsPath, `${language}.ts`);
      let content = fs.readFileSync(filePath, 'utf-8');

      // Parse existing translation object
      const existingTranslation = this.loadTranslation(language);
      const mergedTranslation = { ...existingTranslation, ...newTranslations };

      // Generate new content
      const entries = Object.entries(mergedTranslation)
        .map(([key, value]) => {
          if (typeof value === 'string') {
            return `  '${key}': '${value.replace(/'/g, "\\'").replace(/\n/g, '\\n')}',`;
          } else {
            return `  '${key}': ${JSON.stringify(value)},`;
          }
        })
        .join('\n');

      const newContent = `export const ${language} = {\n${entries}\n};\n`;

      // Write back to file
      fs.writeFileSync(filePath, newContent, 'utf-8');

      logger.info(`Merged ${Object.keys(newTranslations).length} translations for ${language}`);
    } catch (error) {
      logger.error(`Failed to merge translations for ${language}:`, error);
      throw error;
    }
  }

  // Create translation file from template
  async createTranslationFile(language: string, template: Record<string, string>): Promise<void> {
    try {
      const filePath = path.join(this.translationsPath, `${language}.ts`);

      if (fs.existsSync(filePath)) {
        throw new Error(`Translation file for ${language} already exists`);
      }

      const entries = Object.entries(template)
        .map(([key, value]) => `  '${key}': '${value.replace(/'/g, "\\'")}',`)
        .join('\n');

      const content = `export const ${language} = {\n${entries}\n};\n`;

      fs.writeFileSync(filePath, content, 'utf-8');

      logger.info(`Created translation file for ${language}`);
    } catch (error) {
      logger.error(`Failed to create translation file for ${language}:`, error);
      throw error;
    }
  }

  // Get translation completion report
  generateCompletionReport(): {
    summary: Record<string, number>;
    detailed: TranslationStats[];
    mostComplete: string;
    leastComplete: string;
  } {
    const stats = this.getAllTranslationStats();

    const summary = stats.reduce((acc, stat) => {
      acc[stat.language] = stat.completionPercentage;
      return acc;
    }, {} as Record<string, number>);

    const mostComplete = stats.reduce((prev, current) =>
      prev.completionPercentage > current.completionPercentage ? prev : current
    ).language;

    const leastComplete = stats.reduce((prev, current) =>
      prev.completionPercentage < current.completionPercentage ? prev : current
    ).language;

    return {
      summary,
      detailed: stats,
      mostComplete,
      leastComplete,
    };
  }

  // Private helper methods

  private getAllKeys(obj: any, prefix = ''): string[] {
    const keys: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        keys.push(...this.getAllKeys(value, fullKey));
      } else {
        keys.push(fullKey);
      }
    }

    return keys;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

export const translationManager = new TranslationManager();
export default translationManager;