# System Settings - Language Change Feature

## Overview
The Super Admin System Settings modal now includes **two language features** in the Localization tab:

### 1. **Current Language Switcher** ✅
- **Purpose:** Change the interface language for the current user session
- **Takes effect:** Immediately when changed
- **Persists:** Saved to localStorage as `preferred-language`
- **Scope:** Affects only the current user

**Available Languages:**
- 🇺🇸 English
- 🇰🇭 Khmer (ភាសាខ្មែរ)
- 🇻🇳 Vietnamese (Tiếng Việt)
- 🇵🇭 Filipino
- 🇫🇷 French (Français)
- 🇩🇪 German (Deutsch)

### 2. **System Default Language**
- **Purpose:** Set the default language for new users
- **Takes effect:** When saved in system settings
- **Scope:** Affects new user registrations

## How to Use

### Change Your Language:
1. Click **System Settings** button in Super Admin dashboard
2. Navigate to **Localization** tab
3. Under "Your Language", select your preferred language from the dropdown
4. The interface will change immediately
5. A toast notification confirms the change

### Set System Default:
1. Same as above, but scroll to "System Default Language" section
2. Select the default language for new users
3. Click **Save Settings** button at the bottom

## Technical Implementation

### Frontend Changes
**File:** `src/components/super-admin/system-settings-modal.tsx`

```typescript
// Access i18n context
const t = useI18n();

// Change language on selection
onChange={(e) => {
  t.setLanguage(e.target.value);
  toast({
    title: 'Language Changed',
    description: `Interface language changed to ${e.target.options[e.target.selectedIndex].text}`,
  });
}}
```

### How It Works
1. Uses the `useI18n()` hook from `src/lib/internationalization.ts`
2. Accesses `setLanguage()` function to change the current language
3. Language preference is stored in `localStorage` under key `preferred-language`
4. The entire application re-renders with the new language translations
5. All text using the `t()` function is automatically translated

## Features

✅ **Immediate Effect** - No page reload required
✅ **Persistent** - Language preference saved across sessions
✅ **User Feedback** - Toast notification confirms the change
✅ **Multiple Languages** - Support for 6 languages
✅ **Flag Icons** - Visual representation of each language
✅ **Native Names** - Shows language names in their native script

## Testing

### Test Language Change:
1. Login as super admin (`admin@dakdam.com`)
2. Navigate to `/super-admin`
3. Click "System Settings"
4. Go to "Localization" tab
5. Change "Current Language" to any language
6. Verify interface text changes immediately
7. Refresh the page - language should persist

### Verify Persistence:
1. Change language to Vietnamese
2. Close the modal
3. Navigate to different pages
4. All pages should be in Vietnamese
5. Open browser DevTools → Application → Local Storage
6. Check `preferred-language` key is set to `vi`

## Browser Storage

The language preference is stored in localStorage:
```javascript
localStorage.getItem('preferred-language') // Returns: 'en', 'km', 'vi', etc.
```

## Translation Coverage

The system supports translations for:
- Navigation menus
- Dashboard labels
- Form fields
- Error messages
- Success messages
- Button labels
- Super Admin interface
- And more...

All translation keys are defined in:
- `src/lib/internationalization.ts`
- `src/lib/translations/en.ts`
- `src/lib/translations/km.ts`
- `src/lib/translations/vi.ts`
- `src/lib/translations/fil.ts`

## Answer to Your Question

**YES**, the System Settings modal **DOES** have a function to change language:

✅ **Current Language** - Changes the interface language immediately for the current user
✅ **System Default Language** - Sets the default for new users

Both are in the **Localization** tab of the System Settings modal.

