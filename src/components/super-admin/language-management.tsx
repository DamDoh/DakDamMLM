'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useI18n, SUPPORTED_LANGUAGES, DEFAULT_TRANSLATIONS } from '@/lib/internationalization';
import { LanguageStorage, type CustomLanguage } from '@/lib/language-storage';
import { 
  Globe, 
  Plus, 
  Edit, 
  Trash2, 
  Download, 
  Upload, 
  Languages,
  Check,
  X,
  Copy,
  FileJson
} from 'lucide-react';

interface LanguageItem {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  isRTL: boolean;
  translationCount: number;
  completionPercentage: number;
  isActive: boolean;
}

interface TranslationKey {
  key: string;
  category: string;
  english: string;
  translated: string;
}

export default function LanguageManagement() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [languages, setLanguages] = useState<LanguageItem[]>([]);

  // Load languages on mount
  useEffect(() => {
    loadLanguages();
    
    // Listen for language updates
    const handleUpdate = () => loadLanguages();
    window.addEventListener('languagesUpdated', handleUpdate);
    return () => window.removeEventListener('languagesUpdated', handleUpdate);
  }, []);

  const loadLanguages = async () => {
    try {
      // Load all languages from database API
      const allLangs = await LanguageStorage.getAllLanguages();
      const dbLanguageCodes = new Set(allLangs.map(l => l.code));
      
      // Convert database languages to LanguageItem format
      const enKeys = DEFAULT_TRANSLATIONS.en as Record<string, string>;
      const totalKeys = Object.keys(enKeys).length;
      
      // Create a map of database languages by code for deduplication
      const dbLanguageMap = new Map<string, LanguageItem>();
      
      allLangs.forEach(lang => {
        const translationCount = Object.keys(lang.translations || {}).length;
        dbLanguageMap.set(lang.code, {
          code: lang.code,
          name: lang.name,
          nativeName: lang.nativeName,
          flag: lang.flag,
          isRTL: lang.isRTL,
          translationCount,
          completionPercentage: Math.round((translationCount / totalKeys) * 100),
          isActive: true
        });
      });
      
      // Load built-in languages (only if not in database)
      // If in database, use database version; otherwise use built-in
      const allLanguageItems: LanguageItem[] = SUPPORTED_LANGUAGES.map(lang => {
        const dbVersion = dbLanguageMap.get(lang.code);
        if (dbVersion) {
          // Use database version (has user edits)
          return dbVersion;
        } else {
          // Use built-in version (no user edits yet)
          return {
            ...lang,
            translationCount: Object.keys((DEFAULT_TRANSLATIONS as any)[lang.code] || {}).length,
            completionPercentage: 100,
            isActive: true
          };
        }
      });
      
      // Add any custom languages that are not in SUPPORTED_LANGUAGES
      const customLanguages = allLangs
        .filter(lang => !SUPPORTED_LANGUAGES.some(sl => sl.code === lang.code))
        .map(lang => {
          const translationCount = Object.keys(lang.translations || {}).length;
          return {
            code: lang.code,
            name: lang.name,
            nativeName: lang.nativeName,
            flag: lang.flag,
            isRTL: lang.isRTL,
            translationCount,
            completionPercentage: Math.round((translationCount / totalKeys) * 100),
            isActive: true
          };
        });

      // Combine: built-in languages (with database overrides) + custom languages
      // Remove duplicates by code
      const uniqueLanguages = new Map<string, LanguageItem>();
      [...allLanguageItems, ...customLanguages].forEach(lang => {
        if (!uniqueLanguages.has(lang.code)) {
          uniqueLanguages.set(lang.code, lang);
        }
      });

      setLanguages(Array.from(uniqueLanguages.values()));
    } catch (error) {
      console.error('Failed to load languages:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load languages from database'
      });
    }
  };

  const [isAddLanguageOpen, setIsAddLanguageOpen] = useState(false);
  const [isTranslateOpen, setIsTranslateOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageItem | null>(null);
  const [newLanguage, setNewLanguage] = useState({
    code: '',
    name: '',
    nativeName: '',
    flag: '',
    isRTL: false
  });

  const [translationKeys, setTranslationKeys] = useState<TranslationKey[]>([]);
  const [searchKey, setSearchKey] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Available languages to add
  const availableLanguages = [
    { code: 'th', name: 'Thai', nativeName: 'ภาษาไทย', flag: '🇹🇭', isRTL: false },
    { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', isRTL: false },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', isRTL: false },
    { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', isRTL: false },
    { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', isRTL: false },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', isRTL: false },
    { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', isRTL: false },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', isRTL: false },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', isRTL: true },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', isRTL: false },
    { code: 'lo', name: 'Lao', nativeName: 'ພາສາລາວ', flag: '🇱🇦', isRTL: false },
    { code: 'my', name: 'Burmese', nativeName: 'မြန်မာဘာသာ', flag: '🇲🇲', isRTL: false },
  ];

  const handleAddLanguage = async (langData: typeof availableLanguages[0]) => {
    toast({
      title: 'Adding Language',
      description: `Creating ${langData.name} translation file...`,
    });

    try {
      // Create new language with empty translations
      const newLanguage: CustomLanguage = {
        ...langData,
        isRTL: langData.code === 'ar', // Arabic is RTL
        translations: {} // Start with empty translations
      };
      
      // Save to database via API
      const success = await LanguageStorage.addLanguage(newLanguage);
      
      if (!success) {
        throw new Error('Failed to add language');
      }
      
      // Reload languages
      await loadLanguages();
      
      toast({
        title: 'Language Added Successfully!',
        description: `${langData.name} has been added and is now available.`,
      });
      
      setIsAddLanguageOpen(false);
    } catch (error) {
      console.error('Failed to add language:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to add ${langData.name}. Please try again.`,
      });
    }
  };

  const handleOpenTranslator = async (lang: LanguageItem) => {
    setSelectedLanguage(lang);
    
    try {
      // Load English keys and existing translations
      const englishTranslations = (DEFAULT_TRANSLATIONS as any).en;
      const builtInTranslations = (DEFAULT_TRANSLATIONS as any)[lang.code] || {};
      
      // Load from database
      const dbTranslations = await LanguageStorage.getLanguageTranslations(lang.code) || {};
      
      // Merge: Database translations override built-in translations
      const mergedTranslations = { ...builtInTranslations, ...dbTranslations };
      
      const keys: TranslationKey[] = Object.entries(englishTranslations).map(([key, value]) => {
        const category = key.split('.')[0];
        return {
          key,
          category: category.charAt(0).toUpperCase() + category.slice(1),
          english: value as string,
          translated: mergedTranslations[key] || ''
        };
      });
      
      setTranslationKeys(keys);
      setIsTranslateOpen(true);
    } catch (error) {
      console.error('Failed to load translations:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load translations from database'
      });
    }
  };

  const handleAutoTranslate = async () => {
    if (!selectedLanguage) return;
    
    toast({
      title: 'Auto-translating',
      description: 'Translating all missing keys...',
    });
    
    // Auto-translate using AI-like logic (you can connect to real AI API later)
    const updated = translationKeys.map(item => {
      if (!item.translated && item.english) {
        // For now, add "[AUTO] " prefix to show it was auto-translated
        // In production, this would call a translation API
        return {
          ...item,
          translated: `[AUTO] ${item.english}`
        };
      }
      return item;
    });
    
    setTranslationKeys(updated);
    
    toast({
      title: 'Auto-Translation Complete',
      description: `${updated.filter(k => k.translated).length} keys translated`,
    });
  };

  const handleExportTranslations = (lang: LanguageItem) => {
    // Convert to TypeScript format
    const translationsObject = translationKeys.reduce((acc, item) => {
      if (item.translated) {
        acc[item.key] = item.translated;
      }
      return acc;
    }, {} as Record<string, string>);
    
    const tsContent = `export const ${lang.code} = ${JSON.stringify(translationsObject, null, 2)};`;
    
    const blob = new Blob([tsContent], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lang.code}.ts`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Exported',
      description: `${lang.name} translations exported as ${lang.code}.ts`,
    });
  };

  const handleAddNewKey = () => {
    const newKey: TranslationKey = {
      key: 'custom.' + Date.now(),
      category: 'Custom',
      english: '',
      translated: ''
    };
    setTranslationKeys([newKey, ...translationKeys]);
  };

  const handleDeleteKey = (index: number) => {
    const updated = translationKeys.filter((_, i) => i !== index);
    setTranslationKeys(updated);
  };

  const handleImportTranslations = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const text = await file.text();
      let translations: Record<string, string> = {};
      let languageCode = '';
      let languageName = '';

      // Try to parse as JSON
      if (file.name.endsWith('.json')) {
        const json = JSON.parse(text);
        
        if (json.language) {
          // Format: { language: { code, name, ... }, translations: {...} }
          languageCode = json.language.code;
          languageName = json.language.name;
          translations = json.translations || json.language.translations || {};
        } else {
          // Format: { "key": "value", ... }
          translations = json;
          languageCode = file.name.replace('.json', '').replace('-translations', '');
        }
      } 
      // Try to parse as TypeScript
      else if (file.name.endsWith('.ts')) {
        // Extract language code from filename (e.g., "zh.ts" -> "zh")
        languageCode = file.name.replace('.ts', '');
        
        // Parse TypeScript format: export const zh = { ... };
        const match = text.match(/export\s+const\s+(\w+)\s*=\s*({[\s\S]*});?/);
        if (match) {
          const objStr = match[2];
          // Convert TypeScript object to JSON
          const jsonStr = objStr
            .replace(/'/g, '"')
            .replace(/,\s*}/g, '}')
            .replace(/([{,]\s*)(\w+):/g, '$1"$2":');
          
          translations = JSON.parse(jsonStr);
        }
      }

      if (Object.keys(translations).length === 0) {
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description: 'No translations found in file. Check file format.',
        });
        setIsImporting(false);
        return;
      }

      // Find language info
      const langInfo = availableLanguages.find(l => l.code === languageCode);
      
      // Create or update language
      const displayName = langInfo?.name || languageName || languageCode.toUpperCase();
      const newLanguage = {
        code: languageCode,
        name: displayName,
        nativeName: langInfo?.nativeName || languageName || languageCode.toUpperCase(),
        flag: langInfo?.flag || '🌐',
        isRTL: langInfo?.isRTL || false,
        translations
      };

      const success = await LanguageStorage.addLanguage(newLanguage);
      if (!success) {
        throw new Error('Failed to save language');
      }
      await loadLanguages();

      toast({
        title: 'Import Successful!',
        description: `Imported ${Object.keys(translations).length} translations for ${displayName}`,
      });

    } catch (error) {
      console.error('Import error:', error);
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to parse translation file',
      });
    } finally {
      setIsImporting(false);
      if (event.target) {
        event.target.value = ''; // Reset file input
      }
    }
  };

  const handleExportAllLanguages = async () => {
    try {
      const allLanguagesData = await Promise.all(
        languages.map(async (lang) => {
          const builtInTranslations = (DEFAULT_TRANSLATIONS as any)[lang.code] || {};
          const dbTranslations = await LanguageStorage.getLanguageTranslations(lang.code) || {};
          const mergedTranslations = { ...builtInTranslations, ...dbTranslations };

          return {
            code: lang.code,
            name: lang.name,
            nativeName: lang.nativeName,
            translations: mergedTranslations
          };
        })
      );

      const blob = new Blob([JSON.stringify(allLanguagesData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'all-languages-export.json';
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Exported',
        description: `${languages.length} languages exported successfully`,
      });
    } catch (error) {
      console.error('Failed to export languages:', error);
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'Failed to export languages from database'
      });
    }
  };

  const filteredKeys = translationKeys.filter(k => 
    k.key.toLowerCase().includes(searchKey.toLowerCase()) ||
    k.english.toLowerCase().includes(searchKey.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Languages className="h-6 w-6" />
            {t('languageManagement.title')}
          </h2>
          <p className="text-muted-foreground">
            {t('languageManagement.description')}
          </p>
        </div>
        <Button onClick={() => setIsAddLanguageOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('languageManagement.addLanguage')}
        </Button>
      </div>

      {/* Languages Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('languageManagement.installedLanguages')}</CardTitle>
          <CardDescription>{t('languageManagement.installedLanguagesDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('languageManagement.tableLanguage')}</TableHead>
                <TableHead>{t('languageManagement.tableCode')}</TableHead>
                <TableHead>{t('languageManagement.tableTranslations')}</TableHead>
                <TableHead>{t('languageManagement.tableCompletion')}</TableHead>
                <TableHead>{t('languageManagement.tableStatus')}</TableHead>
                <TableHead>{t('languageManagement.tableActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {languages.map((lang) => (
                <TableRow key={lang.code}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{lang.flag}</span>
                      <div>
                        <p className="font-medium">{lang.name}</p>
                        <p className="text-sm text-muted-foreground">{lang.nativeName}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="px-2 py-1 bg-muted rounded text-sm">{lang.code}</code>
                  </TableCell>
                  <TableCell>{lang.translationCount} {t('languageManagement.keys')}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${lang.completionPercentage === 100 ? 'bg-green-500' : 'bg-yellow-500'}`}
                          style={{ width: `${lang.completionPercentage}%` }}
                        />
                      </div>
                      <span className="text-sm">{lang.completionPercentage}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={lang.isActive ? 'default' : 'secondary'}>
                      {lang.isActive ? t('languageManagement.active') : t('languageManagement.inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenTranslator(lang)}
                        title={t('languageManagement.translate')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExportTranslations(lang)}
                        title={t('languageManagement.export')}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {lang.code !== 'en' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              // Warn if it's a built-in language (but allow deletion)
                              const isBuiltIn = SUPPORTED_LANGUAGES.some(l => l.code === lang.code);
                              if (isBuiltIn) {
                                // Show warning but proceed with deletion
                                toast({
                                  variant: 'default',
                                  title: t('languageManagement.warning'),
                                  description: t('languageManagement.builtInLanguageWarning', { name: lang.name })
                                });
                              }

                              const success = await LanguageStorage.removeLanguage(lang.code);
                              if (success) {
                                await loadLanguages();
                                toast({ 
                                  title: t('languageManagement.languageRemoved'), 
                                  description: t('languageManagement.languageRemovedDesc', { name: lang.name })
                                });
                              } else {
                                throw new Error('Failed to remove language');
                              }
                            } catch (error) {
                              console.error('[LanguageManagement] Failed to remove language:', error);
                              const errorMessage = error instanceof Error 
                                ? error.message 
                                : t('languageManagement.failedToRemove', { name: lang.name });
                              
                              toast({
                                variant: 'destructive',
                                title: t('languageManagement.saveError'),
                                description: errorMessage
                              });
                            }
                          }}
                          title={t('languageManagement.remove')}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Language Dialog */}
      <Dialog open={isAddLanguageOpen} onOpenChange={setIsAddLanguageOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              {t('languageManagement.addNewLanguage')}
            </DialogTitle>
            <DialogDescription>
              {t('languageManagement.addNewLanguageDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {availableLanguages
              .filter(avail => !languages.find(l => l.code === avail.code))
              .map((lang) => (
                <Card
                  key={lang.code}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleAddLanguage(lang)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{lang.flag}</span>
                      <div>
                        <p className="font-medium">{lang.name}</p>
                        <p className="text-sm text-muted-foreground">{lang.nativeName}</p>
                        <code className="text-xs bg-muted px-1 rounded">{lang.code}</code>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddLanguageOpen(false)}>
              {t('languageManagement.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Translation Editor Dialog */}
      <Dialog open={isTranslateOpen} onOpenChange={setIsTranslateOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              {selectedLanguage && t('languageManagement.translateLanguage', { name: selectedLanguage.name, nativeName: selectedLanguage.nativeName })}
            </DialogTitle>
            <DialogDescription>
              {selectedLanguage && t('languageManagement.translateLanguageDesc', { name: selectedLanguage.name, count: translationKeys.length.toString() })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-4">
              <Input
                placeholder={t('languageManagement.searchKeys')}
                value={searchKey}
                onChange={(e) => setSearchKey(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleAddNewKey} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t('languageManagement.addKey')}
              </Button>
              <Button onClick={handleAutoTranslate} variant="outline" size="sm">
                <Languages className="h-4 w-4 mr-2" />
                {t('languageManagement.autoTranslate')}
              </Button>
              <Button 
                onClick={() => selectedLanguage && handleExportTranslations(selectedLanguage)}
                variant="outline"
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                {t('languageManagement.exportTs')}
              </Button>
            </div>

            {/* Translation Table */}
            <div className="flex-1 overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-[280px]">{t('languageManagement.tableKey')}</TableHead>
                    <TableHead className="w-[280px]">{t('languageManagement.tableEnglish')}</TableHead>
                    <TableHead>{selectedLanguage && t('languageManagement.tableTranslation', { nativeName: selectedLanguage.nativeName })}</TableHead>
                    <TableHead className="w-[80px]">{t('languageManagement.tableStatus')}</TableHead>
                    <TableHead className="w-[60px]">{t('languageManagement.tableActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredKeys.map((item, index) => {
                    const actualIndex = translationKeys.findIndex(k => k.key === item.key);
                    return (
                      <TableRow key={item.key + index}>
                        <TableCell>
                          <div>
                            <Input
                              value={item.key}
                              onChange={(e) => {
                                const updated = [...translationKeys];
                                updated[actualIndex].key = e.target.value;
                                setTranslationKeys(updated);
                              }}
                              className="text-xs font-mono mb-1"
                              placeholder={t('languageManagement.translationKeyPlaceholder')}
                            />
                            <span className="text-xs text-muted-foreground">{item.category}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.english}
                            onChange={(e) => {
                              const updated = [...translationKeys];
                              updated[actualIndex].english = e.target.value;
                              setTranslationKeys(updated);
                            }}
                            placeholder={t('languageManagement.englishTextPlaceholder')}
                            className="text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.translated}
                            onChange={(e) => {
                              const updated = [...translationKeys];
                              updated[actualIndex].translated = e.target.value;
                              setTranslationKeys(updated);
                            }}
                            placeholder={selectedLanguage ? t('languageManagement.translateToPlaceholder', { name: selectedLanguage.name }) : ''}
                            className="w-full"
                          />
                        </TableCell>
                        <TableCell>
                          {item.translated ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteKey(actualIndex)}
                            title={t('languageManagement.deleteKey')}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Stats */}
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{translationKeys.length}</p>
                  <p className="text-sm text-muted-foreground">{t('languageManagement.totalKeys')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {translationKeys.filter(k => k.translated).length}
                  </p>
                  <p className="text-sm text-muted-foreground">{t('languageManagement.translated')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">
                    {translationKeys.filter(k => !k.translated).length}
                  </p>
                  <p className="text-sm text-muted-foreground">{t('languageManagement.missing')}</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTranslateOpen(false)}>
              {t('languageManagement.cancel')}
            </Button>
            <Button onClick={async () => {
              if (selectedLanguage) {
                try {
                  // Check if user is authenticated
                  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
                  if (!token) {
                    toast({
                      variant: 'destructive',
                      title: t('languageManagement.authenticationRequired'),
                      description: t('languageManagement.authenticationRequiredDesc')
                    });
                    return;
                  }

                  // Convert translation keys to object (only save non-empty translations)
                  const translations = translationKeys.reduce((acc, item) => {
                    if (item.translated) {
                      acc[item.key] = item.translated;
                    }
                    return acc;
                  }, {} as Record<string, string>);
                  
                  console.log('[LanguageManagement] Saving translations:', {
                    code: selectedLanguage.code,
                    keyCount: Object.keys(translations).length
                  });
                  
                  // Always use updateLanguageTranslations - it will create if doesn't exist
                  const success = await LanguageStorage.updateLanguageTranslations(
                    selectedLanguage.code, 
                    translations
                  );
                  
                  if (!success) {
                    throw new Error('Failed to save translations to database. Please check your authentication and try again.');
                  }
                  
                  // Reload languages
                  await loadLanguages();
                  
                  // Trigger language update event
                  window.dispatchEvent(new Event('languagesUpdated'));
                  
                  toast({
                    title: t('languageManagement.translationsSaved'),
                    description: t('languageManagement.translationsSavedDesc', { name: selectedLanguage.name }),
                  });
                  
                  setIsTranslateOpen(false);
                } catch (error) {
                  console.error('[LanguageManagement] Failed to save translations:', error);
                  let errorMessage = 'Failed to save translations to database';
                  
                  if (error instanceof Error) {
                    errorMessage = error.message;
                    // Check for specific error types
                    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                      errorMessage = 'Authentication failed. Please log in again.';
                    } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
                      errorMessage = 'You do not have permission to save translations. Super Admin access required.';
                    } else if (error.message.includes('404')) {
                      errorMessage = 'Language not found. Please try again.';
                    } else if (error.message.includes('500')) {
                      errorMessage = 'Server error. Please check the console for details.';
                    }
                  }
                  
                  toast({
                    variant: 'destructive',
                    title: t('languageManagement.saveError'),
                    description: errorMessage
                  });
                }
              }
            }}>
              {t('languageManagement.saveTranslations')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {t('languageManagement.quickActions')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.ts"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={handleImportTranslations}
              disabled={isImporting}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isImporting ? t('languageManagement.importing') : t('languageManagement.importTranslations')}
            </Button>
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={handleExportAllLanguages}
            >
              <FileJson className="h-4 w-4 mr-2" />
              {t('languageManagement.exportAllLanguages')}
            </Button>
            <Button className="w-full justify-start" variant="outline" disabled>
              <Copy className="h-4 w-4 mr-2" />
              {t('languageManagement.duplicateLanguage')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('languageManagement.translationStatistics')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">{t('languageManagement.totalLanguages')}</span>
                <span className="font-bold">{languages.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">{t('languageManagement.activeLanguages')}</span>
                <span className="font-bold">{languages.filter(l => l.isActive).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">{t('languageManagement.fullyTranslated')}</span>
                <span className="font-bold text-green-600">
                  {languages.filter(l => l.completionPercentage === 100).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">{t('languageManagement.inProgress')}</span>
                <span className="font-bold text-yellow-600">
                  {languages.filter(l => l.completionPercentage < 100 && l.completionPercentage > 0).length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('languageManagement.aiTranslation')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('languageManagement.aiTranslationDesc')}
            </p>
            <Button 
              className="w-full" 
              variant="outline"
              onClick={async () => {
                try {
                  const enKeys = DEFAULT_TRANSLATIONS.en as Record<string, string>;
                  const totalKeys = Object.keys(enKeys).length;
                  let updatedCount = 0;
                  const updatedLanguages: string[] = [];
                  const skippedLanguages: string[] = [];

                  // Auto-translate languages with low completion
                  for (const lang of languages) {
                    if (lang.completionPercentage < 100) {
                      const langTranslations = (DEFAULT_TRANSLATIONS as any)[lang.code];
                      
                      if (langTranslations) {
                        // Get existing language from database
                        const existingTranslations = await LanguageStorage.getLanguageTranslations(lang.code) || {};
                        
                        const updatedTranslations = {
                          ...existingTranslations,
                          ...langTranslations
                        };

                        const updatedLang: CustomLanguage = {
                          code: lang.code,
                          name: lang.name,
                          nativeName: lang.nativeName,
                          flag: lang.flag,
                          isRTL: lang.isRTL,
                          translations: updatedTranslations
                        };

                        const success = await LanguageStorage.addLanguage(updatedLang);
                        if (success) {
                          updatedCount++;
                          updatedLanguages.push(lang.name);
                        }
                      } else {
                        skippedLanguages.push(lang.name);
                      }
                    }
                  }

                  if (updatedCount > 0) {
                    await loadLanguages();
                    toast({
                      title: t('languageManagement.autoTranslateComplete'),
                      description: skippedLanguages.length > 0 
                        ? t('languageManagement.autoTranslateCompleteDescSkipped', { updated: updatedLanguages.join(', '), skipped: skippedLanguages.join(', ') })
                        : t('languageManagement.autoTranslateCompleteDesc', { updated: updatedLanguages.join(', ') }),
                    });
                  } else if (skippedLanguages.length > 0) {
                    toast({
                      title: t('languageManagement.noTranslationsAvailable'),
                      description: t('languageManagement.noTranslationsAvailableDesc', { skipped: skippedLanguages.join(', ') }),
                      variant: 'destructive'
                    });
                  } else {
                    toast({
                      title: t('languageManagement.allComplete'),
                      description: t('languageManagement.allCompleteDesc'),
                    });
                  }
                } catch (error) {
                  console.error('Failed to auto-translate:', error);
                  toast({
                    variant: 'destructive',
                    title: t('languageManagement.saveError'),
                    description: t('languageManagement.autoTranslateError')
                  });
                }
              }}
            >
              <Languages className="h-4 w-4 mr-2" />
              {t('languageManagement.autoTranslateNewLanguages')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

