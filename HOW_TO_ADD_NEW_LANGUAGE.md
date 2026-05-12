# How to Add New Languages to DakDam MLM

## Complete Guide to Adding Languages

### Step 1: Add Language to SUPPORTED_LANGUAGES

**File:** `src/lib/internationalization.ts`

Add your language to the `SUPPORTED_LANGUAGES` array:

```typescript
export const SUPPORTED_LANGUAGES: Language[] = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', isRTL: false },
    { code: 'km', name: 'Khmer', nativeName: 'ភាសាខ្មែរ', flag: '🇰🇭', isRTL: false },
    { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', isRTL: false },
    { code: 'fil', name: 'Filipino', nativeName: 'Filipino', flag: '🇵🇭', isRTL: false },
    { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', isRTL: false },
    { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', isRTL: false },
    
    // ADD NEW LANGUAGE HERE:
    { code: 'th', name: 'Thai', nativeName: 'ภาษาไทย', flag: '🇹🇭', isRTL: false },
    { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', isRTL: false },
    { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', isRTL: false },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', isRTL: false },
    { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', isRTL: false },
    { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', isRTL: false },
];
```

**Parameters:**
- `code`: ISO 639-1 language code (2 letters)
- `name`: English name of the language
- `nativeName`: Name in the native language
- `flag`: Country flag emoji
- `isRTL`: `true` for right-to-left languages (Arabic, Hebrew), `false` for others

### Step 2: Create Translation File

Create a new file in `src/lib/translations/` with the language code:

**Example:** `src/lib/translations/th.ts` (Thai)

```typescript
export const th = {
  // Common
  'common.loading': 'กำลังโหลด...',
  'common.error': 'ข้อผิดพลาด',
  'common.success': 'สำเร็จ',
  'common.previous': 'ก่อนหน้า',
  'common.next': 'ถัดไป',
  'common.columns': 'คอลัมน์',
  'common.actions': 'การดำเนินการ',
  'common.noResults': 'ไม่มีผลลัพธ์',
  'common.cancel': 'ยกเลิก',
  'common.delete': 'ลบ',
  'common.save': 'บันทึกการเปลี่ยนแปลง',
  
  // Navigation
  'nav.dashboard': 'แดชบอร์ด',
  'nav.binaryTree': 'ไบนารีทรี',
  'nav.commissions': 'ค่าคอมมิชชั่น',
  'nav.products': 'สินค้า',
  'nav.profile': 'โปรไฟล์',
  'nav.logout': 'ออกจากระบบ',
  
  // Login Page
  'login.title': 'เข้าสู่ระบบสมาชิก',
  'login.emailOrPhoneLabel': 'อีเมลหรือเบอร์โทรศัพท์',
  'login.passwordLabel': 'รหัสผ่าน',
  'login.signIn': 'เข้าสู่ระบบ',
  
  // Dashboard
  'dashboard.welcome': 'ยินดีต้อนรับ',
  'dashboard.totalEarnings': 'รายได้ทั้งหมด',
  'dashboard.currentBalance': 'ยอดคงเหลือปัจจุบัน',
  
  // Add all other translations...
};
```

### Step 3: Import Translation in Main File

**File:** `src/lib/internationalization.ts`

At the top, add the import:

```typescript
import { en } from './translations/en';
import { km } from './translations/km';
import { vi } from './translations/vi';
import { fil } from './translations/fil';
import { fr } from './translations/fr';
import { de } from './translations/de';
// ADD NEW IMPORTS:
import { th } from './translations/th';
import { id } from './translations/id';
```

Then add to `DEFAULT_TRANSLATIONS` object:

```typescript
export const DEFAULT_TRANSLATIONS = {
  en,
  km,
  vi,
  fil,
  fr,
  de,
  // ADD NEW TRANSLATIONS:
  th,
  id,
};
```

### Step 4: Update System Settings Modal

**File:** `src/components/super-admin/system-settings-modal.tsx`

Add the new language to both dropdowns:

```typescript
<select>
  <option value="en">🇺🇸 English</option>
  <option value="km">🇰🇭 Khmer (ភាសាខ្មែរ)</option>
  <option value="vi">🇻🇳 Vietnamese (Tiếng Việt)</option>
  <option value="fil">🇵🇭 Filipino</option>
  <option value="fr">🇫🇷 French (Français)</option>
  <option value="de">🇩🇪 German (Deutsch)</option>
  
  {/* ADD NEW LANGUAGES: */}
  <option value="th">🇹🇭 Thai (ภาษาไทย)</option>
  <option value="id">🇮🇩 Indonesian (Bahasa Indonesia)</option>
  <option value="zh">🇨🇳 Chinese (中文)</option>
  <option value="ja">🇯🇵 Japanese (日本語)</option>
  <option value="ko">🇰🇷 Korean (한국어)</option>
  <option value="es">🇪🇸 Spanish (Español)</option>
</select>
```

## Translation Keys You Need

Here are all the translation keys used in the application. Copy this template:

### Complete Translation Template

```typescript
export const LANGUAGE_CODE = {
  // Common (Required)
  'common.loading': '',
  'common.error': '',
  'common.success': '',
  'common.previous': '',
  'common.next': '',
  'common.cancel': '',
  'common.delete': '',
  'common.save': '',
  
  // Navigation (Required)
  'nav.dashboard': '',
  'nav.profile': '',
  'nav.logout': '',
  'nav.products': '',
  'nav.commissions': '',
  
  // Login Page
  'login.title': '',
  'login.emailOrPhoneLabel': '',
  'login.passwordLabel': '',
  'login.signIn': '',
  
  // Dashboard
  'dashboard.welcome': '',
  'dashboard.totalEarnings': '',
  'dashboard.currentBalance': '',
  
  // Super Admin (Important!)
  'superAdmin.title': '',
  'superAdmin.systemSettings': '',
  'superAdmin.totalCompanies': '',
  'superAdmin.totalUsers': '',
  
  // ... (See src/lib/translations/en.ts for complete list)
};
```

## I Can Help Translate!

### Languages I Can Translate:

✅ **Thai (ไทย)** - Full translation
✅ **Indonesian (Bahasa Indonesia)** - Full translation  
✅ **Chinese (中文)** - Simplified Chinese
✅ **Japanese (日本語)** - Full translation
✅ **Korean (한국어)** - Full translation
✅ **Spanish (Español)** - Full translation
✅ **Portuguese (Português)** - Full translation
✅ **Arabic (العربية)** - Full translation (RTL)
✅ **Russian (Русский)** - Full translation
✅ **Hindi (हिन्दी)** - Full translation

### What Languages Do You Need?

Tell me which language you want to add, and I will:
1. Create the complete translation file
2. Update all necessary files
3. Add it to the system settings
4. Test that it works

## Example: Adding Thai Language

Would you like me to create a complete Thai translation file now? Just say:
- "Add Thai language"
- "Add Indonesian"
- "Add Spanish"
- Or any other language you need!

## Testing Your New Language

1. Add the language files as described above
2. Restart your development server: `npm run dev`
3. Go to Super Admin → System Settings → Localization
4. Select your new language
5. The interface should update immediately!

## Tips for Translation

✅ **Keep it short** - UI text should be concise
✅ **Use native terms** - Don't translate technical terms if they're commonly used
✅ **Test UI fit** - Some languages are longer/shorter than English
✅ **Cultural context** - Adapt meanings, not just words
✅ **Consistency** - Use the same terms throughout

## Need Help?

Just tell me:
1. Which language you want to add
2. I'll create the complete translation file for you
3. You just copy and paste!

