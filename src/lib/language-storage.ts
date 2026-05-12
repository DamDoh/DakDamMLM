/**
 * Dynamic Language Storage
 * Uses database API instead of localStorage
 */

export interface CustomLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  isRTL: boolean;
  translations: Record<string, string>;
}

const API_BASE = '/api/languages';

// Helper to get auth headers
function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
}

// Helper to get fetch options with credentials
function getFetchOptions(method: string = 'GET', body?: any): RequestInit {
  return {
    method,
    headers: getAuthHeaders(),
    credentials: 'include', // Include cookies for authentication
    ...(body && { body: JSON.stringify(body) })
  };
}

export class LanguageStorage {
  /**
   * Get all custom languages from API
   */
  static async getCustomLanguages(): Promise<CustomLanguage[]> {
    if (typeof window === 'undefined') return [];
    
    try {
      const response = await fetch(`${API_BASE}?includeTranslations=true`, {
        ...getFetchOptions('GET'),
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        console.error('Failed to fetch languages:', response.statusText);
        return [];
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        return [];
      }

      // Convert API response to CustomLanguage format
      return result.data
        .filter((lang: any) => !lang.isBuiltIn) // Only custom languages
        .map((lang: any) => ({
          code: lang.code,
          name: lang.name,
          nativeName: lang.nativeName,
          flag: lang.flag,
          isRTL: lang.isRTL,
          translations: lang.translations || {}
        }));
    } catch (error) {
      console.error('Failed to load custom languages:', error);
      return [];
    }
  }

  /**
   * Get all languages (including built-in) from API
   */
  static async getAllLanguages(): Promise<CustomLanguage[]> {
    if (typeof window === 'undefined') return [];
    
    try {
      const response = await fetch(`${API_BASE}?includeTranslations=true`, {
        ...getFetchOptions('GET'),
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        console.error('Failed to fetch languages:', response.statusText);
        return [];
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        return [];
      }

      return result.data.map((lang: any) => ({
        code: lang.code,
        name: lang.name,
        nativeName: lang.nativeName,
        flag: lang.flag,
        isRTL: lang.isRTL,
        translations: lang.translations || {}
      }));
    } catch (error) {
      console.error('Failed to load languages:', error);
      return [];
    }
  }

  /**
   * Add a new custom language
   */
  static async addLanguage(language: CustomLanguage): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          code: language.code,
          name: language.name,
          nativeName: language.nativeName,
          flag: language.flag,
          isRTL: language.isRTL,
          translations: language.translations
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to add language:', error);
        return false;
      }

      // Trigger update event
      window.dispatchEvent(new Event('languagesUpdated'));
      return true;
    } catch (error) {
      console.error('Failed to add language:', error);
      return false;
    }
  }

  /**
   * Update translations for a language
   */
  static async updateLanguageTranslations(
    code: string, 
    translations: Record<string, string>
  ): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    
    try {
      const headers = getAuthHeaders();
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      
      // Debug logging
      console.log('[LanguageStorage] Updating translations for:', code);
      console.log('[LanguageStorage] Auth token present:', !!token);
      console.log('[LanguageStorage] Translation keys count:', Object.keys(translations).length);
      
      // First check if the language exists
      const getResponse = await fetch(`${API_BASE}/${code}`, {
        headers,
        credentials: 'include'
      });

      let languageExists = getResponse.ok;
      let languageData: any = null;

      if (languageExists) {
        const result = await getResponse.json();
        if (result.success && result.data) {
          languageData = result.data;
          console.log('[LanguageStorage] Language exists in database:', {
            code: languageData.code,
            id: languageData.id,
            isBuiltIn: languageData.isBuiltIn
          });
        } else {
          languageExists = false;
          console.log('[LanguageStorage] Language response invalid, treating as not found');
        }
      } else {
        console.log('[LanguageStorage] Language not found in database (status:', getResponse.status, ')');
        // Don't log error data if it's just 404
        if (getResponse.status !== 404) {
          const errorData = await getResponse.json().catch(() => ({}));
          console.log('[LanguageStorage] GET error:', getResponse.status, errorData);
        }
      }

      // If language doesn't exist, we need to create it first
      // Get language info from SUPPORTED_LANGUAGES or use defaults
      if (!languageExists) {
        // Try to find language info from built-in languages
        const { SUPPORTED_LANGUAGES } = await import('@/lib/internationalization');
        const builtInLang = SUPPORTED_LANGUAGES.find((l: any) => l.code === code);
        
        if (!builtInLang) {
          console.error('Language not found and cannot create:', code);
          // Try to create with minimal info
          const createResponse = await fetch(API_BASE, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify({
              code: code,
              name: code.toUpperCase(),
              nativeName: code.toUpperCase(),
              flag: '🌐',
              isRTL: false,
              translations: translations
            })
          });

          if (!createResponse.ok) {
            const error = await createResponse.json();
            console.error('Failed to create language:', error);
            return false;
          }

          window.dispatchEvent(new Event('languagesUpdated'));
          return true;
        }

        // Create the language with translations
        console.log('[LanguageStorage] Creating language:', builtInLang.code);
        const createResponse = await fetch(API_BASE, {
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: 'include',
          body: JSON.stringify({
            code: builtInLang.code,
            name: builtInLang.name,
            nativeName: builtInLang.nativeName,
            flag: builtInLang.flag,
            isRTL: builtInLang.isRTL,
            translations: translations
          })
        });

        if (!createResponse.ok) {
          let errorData: any = { error: 'Unknown error' };
          try {
            errorData = await createResponse.json();
          } catch (e) {
            errorData = { error: createResponse.statusText || 'Unknown error' };
          }
          
          console.error('[LanguageStorage] Failed to create language:', {
            status: createResponse.status,
            statusText: createResponse.statusText,
            error: errorData
          });
          
          let errorMessage = errorData.error || errorData.message || 'Unknown error';
          if (createResponse.status === 401) {
            errorMessage = 'Authentication required. Please log in again.';
          } else if (createResponse.status === 403) {
            errorMessage = 'Super admin access required. You do not have permission to create languages.';
          } else if (createResponse.status === 409) {
            errorMessage = 'Language already exists. Try updating instead.';
          } else if (createResponse.status === 500) {
            errorMessage = 'Server error. Please check the console for details.';
          }
          
          throw new Error(errorMessage);
        }
        
        console.log('[LanguageStorage] Language created successfully');

        window.dispatchEvent(new Event('languagesUpdated'));
        return true;
      }

      // Language exists, update it (don't create duplicate)
      console.log('[LanguageStorage] Updating existing language:', code);
      console.log('[LanguageStorage] Language ID:', languageData?.id);
      const response = await fetch(`${API_BASE}/${code}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ 
          translations,
          // Don't send other fields to avoid creating new language
        })
      });

      if (!response.ok) {
        let errorData: any = { error: 'Unknown error' };
        let responseText = '';
        
        try {
          responseText = await response.text();
          // Try to parse as JSON
          if (responseText) {
            try {
              errorData = JSON.parse(responseText);
            } catch (e) {
              // If not JSON, use the text as error message
              errorData = { error: responseText || response.statusText || 'Unknown error' };
            }
          } else {
            errorData = { error: response.statusText || 'Unknown error' };
          }
        } catch (e) {
          // If we can't read the response, use status text
          errorData = { error: response.statusText || 'Unknown error' };
        }
        
        console.error('[LanguageStorage] Failed to update translations:', {
          status: response.status,
          statusText: response.statusText,
          responseText: responseText.substring(0, 200), // First 200 chars
          error: errorData,
          url: `${API_BASE}/${code}`
        });
        
        // Provide user-friendly error messages
        let errorMessage = errorData.error || errorData.message || errorData.responseText || 'Unknown error';
        if (response.status === 401) {
          errorMessage = 'Authentication required. Please log in again.';
        } else if (response.status === 403) {
          errorMessage = 'Super admin access required. You do not have permission to update translations.';
        } else if (response.status === 404) {
          errorMessage = 'Language not found. Please try again.';
        } else if (response.status === 500) {
          errorMessage = errorData.error || errorData.message || 'Server error. Please check the server console for details.';
        }
        
        throw new Error(errorMessage);
      }
      
      console.log('[LanguageStorage] Translations updated successfully');

      window.dispatchEvent(new Event('languagesUpdated'));
      return true;
    } catch (error) {
      console.error('[LanguageStorage] Error updating translations:', error);
      // Re-throw error so component can show proper error message
      throw error;
    }
  }

  /**
   * Remove a custom language
   */
  static async removeLanguage(code: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    
    try {
      console.log('[LanguageStorage] Attempting to delete language:', code);
      const response = await fetch(`${API_BASE}/${code}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        let errorData: any = { error: 'Unknown error' };
        let responseText = '';
        
        try {
          responseText = await response.text();
          if (responseText) {
            try {
              errorData = JSON.parse(responseText);
            } catch (e) {
              errorData = { error: responseText || response.statusText || 'Unknown error' };
            }
          } else {
            errorData = { error: response.statusText || 'Unknown error' };
          }
        } catch (e) {
          errorData = { error: response.statusText || 'Unknown error' };
        }
        
        console.error('[LanguageStorage] Failed to delete language:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        
        // Throw error with message so component can show it
        const errorMessage = errorData.error || errorData.message || 'Failed to delete language';
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('[LanguageStorage] Language deleted successfully:', code);
      
      window.dispatchEvent(new Event('languagesUpdated'));
      return true;
    } catch (error) {
      console.error('[LanguageStorage] Error deleting language:', error);
      // Re-throw so component can show the error message
      throw error;
    }
  }

  /**
   * Get translations for a specific language
   */
  static async getLanguageTranslations(code: string): Promise<Record<string, string> | null> {
    try {
      const response = await fetch(`${API_BASE}/${code}`, {
        headers: getAuthHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        return null;
      }

      return result.data.translations || {};
    } catch (error) {
      console.error('Failed to get language translations:', error);
      return null;
    }
  }

  /**
   * Check if a language exists
   */
  static async hasLanguage(code: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/${code}`, {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear all custom languages (Super Admin only)
   */
  static async clearAll(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    
    try {
      const languages = await this.getCustomLanguages();
      
      // Delete all custom languages
      const deletePromises = languages.map(lang => this.removeLanguage(lang.code));
      await Promise.all(deletePromises);

      window.dispatchEvent(new Event('languagesUpdated'));
      return true;
    } catch (error) {
      console.error('Failed to clear all languages:', error);
      return false;
    }
  }
}
