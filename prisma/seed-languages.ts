import { PrismaClient } from '@prisma/client';
import { en } from '../src/lib/translations/en';
import { km } from '../src/lib/translations/km';
import { fil } from '../src/lib/translations/fil';
import { zh } from '../src/lib/translations/zh';
import { ko } from '../src/lib/translations/ko';
import { ja } from '../src/lib/translations/ja';
import { th } from '../src/lib/translations/th';
import { id } from '../src/lib/translations/id';
import { es } from '../src/lib/translations/es';
import { vi } from '../src/lib/translations/vi';
import { fr } from '../src/lib/translations/fr';
import { de } from '../src/lib/translations/de';

const prisma = new PrismaClient();

// Language definitions
const languages = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', isRTL: false },
  { code: 'km', name: 'Khmer', nativeName: 'ភាសាខ្មែរ', flag: '🇰🇭', isRTL: false },
  { code: 'fil', name: 'Filipino', nativeName: 'Filipino', flag: '🇵🇭', isRTL: false },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', isRTL: false },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', isRTL: false },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', isRTL: false },
  { code: 'th', name: 'Thai', nativeName: 'ภาษาไทย', flag: '🇹🇭', isRTL: false },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', isRTL: false },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', isRTL: false },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', isRTL: false },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', isRTL: false },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', isRTL: false },
];

// Translation objects
const translations: Record<string, Record<string, string>> = {
  en,
  km,
  fil,
  zh,
  ko,
  ja,
  th,
  id,
  es,
  vi,
  fr,
  de,
};

async function main() {
  console.log('🌱 Seeding languages and translations...');

  for (const lang of languages) {
    const translationData = translations[lang.code];
    
    if (!translationData) {
      console.warn(`⚠️  No translations found for ${lang.code}`);
      continue;
    }

    console.log(`📝 Seeding ${lang.name} (${lang.code})...`);

    // Check if language already exists
    const existing = await (prisma as any).language.findUnique({
      where: { code: lang.code }
    });

    if (existing) {
      console.log(`   ⏭️  Language ${lang.code} already exists, updating...`);
      
      // Update language
      await (prisma as any).language.update({
        where: { code: lang.code },
        data: {
          name: lang.name,
          nativeName: lang.nativeName,
          flag: lang.flag,
          isRTL: lang.isRTL,
          isBuiltIn: true
        }
      });

      // Delete existing translations
      await (prisma as any).translation.deleteMany({
        where: { languageId: existing.id }
      });

      // Create new translations
      const translationEntries = Object.entries(translationData).map(([key, value]) => ({
        languageId: existing.id,
        key,
        value: value as string
      }));

      await (prisma as any).translation.createMany({
        data: translationEntries
      });

      console.log(`   ✅ Updated ${translationEntries.length} translations`);
    } else {
      // Create new language with translations
      const language = await (prisma as any).language.create({
        data: {
          code: lang.code,
          name: lang.name,
          nativeName: lang.nativeName,
          flag: lang.flag,
          isRTL: lang.isRTL,
          isBuiltIn: true,
          translations: {
            create: Object.entries(translationData).map(([key, value]) => ({
              key,
              value: value as string
            }))
          }
        }
      });

      console.log(`   ✅ Created with ${Object.keys(translationData).length} translations`);
    }
  }

  console.log('✨ Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

