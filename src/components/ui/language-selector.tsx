
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n } from '@/lib/internationalization';
import { Languages, Check } from 'lucide-react';
import { Skeleton } from './skeleton';


export function LanguageSelector() {
  const i18n = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!i18n) {
    // This can happen during server-side rendering before the context is available.
    return <Skeleton className="h-9 w-24" />;
  }

  const { language: currentLang, setLanguage, getSupportedLanguages, getCurrentLanguageInfo } = i18n;
  const allLanguages = getSupportedLanguages();
  
  // Deduplicate by code (safety check)
  const uniqueLanguagesMap = new Map<string, typeof allLanguages[0]>();
  allLanguages.forEach(lang => {
    if (!uniqueLanguagesMap.has(lang.code)) {
      uniqueLanguagesMap.set(lang.code, lang);
    }
  });
  const supportedLanguages = Array.from(uniqueLanguagesMap.values());
  
  const currentLanguage = getCurrentLanguageInfo();

  if (!isMounted || !currentLanguage) {
    return (
       <Button variant="outline" size="sm" className="w-auto px-3">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4" />
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-12 hidden sm:inline-block" />
          </div>
       </Button>
    )
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-auto px-3" data-testid="language-selector">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4" />
            <span className="text-lg">{currentLanguage?.flag}</span>
            <span className="hidden sm:inline-block text-sm font-medium">
              {currentLanguage?.nativeName || currentLanguage?.name}
            </span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {supportedLanguages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{language.flag}</span>
              <div>
                <div className="font-medium">{language.nativeName}</div>
                <div className="text-xs text-muted-foreground">{language.name}</div>
              </div>
            </div>
            {currentLang === language.code && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  function handleLanguageChange(languageCode: string) {
    setLanguage(languageCode);
    setIsOpen(false);
  }
}

// Compact version for mobile
export function CompactLanguageSelector() {
  const i18n = useI18n();

  if (!i18n) {
    return null;
  }

  const { language: currentLang, setLanguage, getSupportedLanguages } = i18n;
  const supportedLanguages = getSupportedLanguages();

  return (
    <div className="flex items-center gap-1">
      {supportedLanguages.slice(0, 6).map((language) => (
        <Button
          key={language.code}
          variant={currentLang === language.code ? "default" : "ghost"}
          size="sm"
          onClick={() => setLanguage(language.code)}
          className="w-8 h-8 p-0 text-lg"
          title={language.nativeName}
        >
          {language.flag}
        </Button>
      ))}
      {supportedLanguages.length > 6 && (
        <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
          +{supportedLanguages.length - 6}
        </Button>
      )}
    </div>
  );
}
