'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  changeLanguage,
  getCurrentLanguage,
  getLanguageOptions,
  LANGUAGES,
  detectUserLanguage
} from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe, Check } from 'lucide-react';

interface LanguageSwitcherProps {
  variant?: 'button' | 'dropdown' | 'minimal';
  className?: string;
  showFlag?: boolean;
  showNativeName?: boolean;
}

export function LanguageSwitcher({
  variant = 'dropdown',
  className = '',
  showFlag = true,
  showNativeName = false,
}: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      setCurrentLang(lng);
    };

    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  const handleLanguageChange = async (language: string) => {
    if (language === currentLang) return;

    setIsChanging(true);
    try {
      await changeLanguage(language);
    } catch (error) {
      console.error('Failed to change language:', error);
    } finally {
      setIsChanging(false);
    }
  };

  const languageOptions = getLanguageOptions();
  const currentLanguageInfo = LANGUAGES[currentLang as keyof typeof LANGUAGES];

  if (variant === 'minimal') {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleLanguageChange(currentLang === 'en' ? 'zh' : 'en')}
        disabled={isChanging}
        className={className}
      >
        <Globe className="h-4 w-4 mr-1" />
        {currentLanguageInfo?.nativeName || currentLang.toUpperCase()}
      </Button>
    );
  }

  if (variant === 'button') {
    return (
      <div className={`flex flex-wrap gap-1 ${className}`}>
        {languageOptions.map((lang) => (
          <Button
            key={lang.code}
            variant={currentLang === lang.code ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleLanguageChange(lang.code)}
            disabled={isChanging}
            className="flex items-center space-x-1"
          >
            {showFlag && <span>{lang.flag}</span>}
            <span>{showNativeName ? lang.nativeName : lang.code.toUpperCase()}</span>
            {currentLang === lang.code && <Check className="h-3 w-3" />}
          </Button>
        ))}
      </div>
    );
  }

  // Default dropdown variant
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isChanging} className={className}>
          <Globe className="h-4 w-4 mr-2" />
          {showFlag && <span className="mr-1">{currentLanguageInfo?.flag}</span>}
          <span className="mr-1">
            {showNativeName ? currentLanguageInfo?.nativeName : currentLang.toUpperCase()}
          </span>
          <span className="text-xs text-muted-foreground">
            {isChanging ? 'Changing...' : '▼'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {languageOptions.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              {showFlag && <span>{lang.flag}</span>}
              <span>{showNativeName ? lang.nativeName : lang.name}</span>
            </div>
            {currentLang === lang.code && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Hook for language management
export function useLanguage() {
  const { i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());

  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      setCurrentLang(lng);
    };

    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  const changeLang = async (language: string) => {
    return changeLanguage(language);
  };

  const detectLanguage = () => {
    const detected = detectUserLanguage();
    if (detected !== currentLang) {
      return changeLanguage(detected);
    }
  };

  return {
    currentLanguage: currentLang,
    languageInfo: LANGUAGES[currentLang as keyof typeof LANGUAGES],
    changeLanguage: changeLang,
    detectUserLanguage: detectLanguage,
    availableLanguages: getLanguageOptions(),
  };
}

// Language context provider (optional)
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Detect and set user language on mount
    const detectedLang = detectUserLanguage();
    if (detectedLang !== getCurrentLanguage()) {
      changeLanguage(detectedLang);
    }
  }, []);

  return <>{children}</>;
}