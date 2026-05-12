# Fix: Duplicate Languages Issue

## ✅ What Was Fixed

### Problem
When editing and saving translations for Khmer (or any built-in language), duplicate language entries appeared in the list.

### Root Cause
1. Built-in languages (like Khmer) already exist in database (from seeding)
2. When saving, the code was checking if language exists
3. But the deduplication logic in `loadLanguages` wasn't properly handling the case where:
   - Language exists in database (from seeding)
   - Language also exists in SUPPORTED_LANGUAGES
   - Both were being shown

### Solution

1. **Improved Deduplication Logic**
   - Uses a `Map` to ensure unique languages by code
   - Database languages take priority over built-in ones
   - Only shows built-in languages if they don't exist in database

2. **Better Language Loading**
   - Creates a map of database languages first
   - For each SUPPORTED_LANGUAGE:
     - If exists in database → use database version (has user edits)
     - If not in database → use built-in version
   - Adds custom languages that aren't in SUPPORTED_LANGUAGES
   - Uses Map to deduplicate before setting state

3. **Enhanced Logging**
   - Better logging to track language existence
   - Shows language ID and isBuiltIn status

---

## 🧪 How to Test

1. **Refresh the browser page**
2. **Go to Super Admin → Languages**
3. **Check the list** - should see each language only once
4. **Click "Translate" on Khmer**
5. **Edit some translations**
6. **Click "Save Translations"**
7. **Check the list again** - should still see Khmer only once

---

## 📊 Expected Behavior

### Before Fix:
- Khmer appears twice (once from database, once from built-in)
- Or appears with different translation counts

### After Fix:
- Khmer appears only once
- Shows the database version (with your edits)
- Translation count reflects your saved translations

---

## 🔍 Debugging

If you still see duplicates, check:

1. **Browser Console** - Look for:
   ```
   [LanguageStorage] Language exists in database: { code: "km", id: "...", isBuiltIn: true }
   ```

2. **Database** - Check for duplicate entries:
   ```sql
   SELECT code, COUNT(*) FROM languages GROUP BY code HAVING COUNT(*) > 1;
   ```

3. **API Response** - Check what `/api/languages` returns:
   ```javascript
   fetch('/api/languages').then(r => r.json()).then(console.log)
   ```

---

## ✅ Status

**Fixed!** The deduplication logic now properly handles:
- Built-in languages that exist in database
- Custom languages
- Languages with user edits
- No duplicates should appear

Try it now - each language should appear only once!

