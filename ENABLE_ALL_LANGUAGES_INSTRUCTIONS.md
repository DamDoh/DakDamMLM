# Enable All New Languages Permanently

## Quick Instructions

To enable all 6 new languages (Thai, Indonesian, Japanese, Korean, Spanish, Chinese) permanently:

### Update `src/lib/internationalization.ts`

**1. Add imports at the top (after line 6):**
```typescript
import { th } from './translations/th';
import { id } from './translations/id';
import { ja } from './translations/ja';
import { ko } from './translations/ko';
import { es } from './translations/es';
```

**2. Add to SUPPORTED_LANGUAGES array (after line 21):**
```typescript
{ code: 'th', name: 'Thai', nativeName: 'ภาษาไทย', flag: '🇹🇭', isRTL: false },
{ code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', isRTL: false },
{ code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', isRTL: false },
{ code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', isRTL: false },
{ code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', isRTL: false },
```

**3. Add to DEFAULT_TRANSLATIONS object (after line 38):**
```typescript
th,
id,
ja,
ko,
es
```

### Result:

All 9 languages will be permanently available in the Localization dropdown without needing to add them through the UI!

---

**Or just say: "enable all languages permanently" and I'll do it for you!** 😊

