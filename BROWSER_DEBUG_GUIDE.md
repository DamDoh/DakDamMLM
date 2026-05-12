# Browser Debugging Guide for Language Management

## 🔍 How to Debug in Browser

### Step 1: Open Browser Console
1. Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
2. Go to **Console** tab
3. Keep it open while testing

### Step 2: Check Authentication
In the console, type:
```javascript
localStorage.getItem('auth_token')
```

**Expected:** Should return a JWT token string
**If null:** You need to log in first

### Step 3: Test API Directly
In the console, type:
```javascript
fetch('/api/languages', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
    'Content-Type': 'application/json'
  },
  credentials: 'include'
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

**Expected:** Should return `{ success: true, data: [...] }`
**If 401/403:** Authentication issue
**If 500:** Server error

### Step 4: Test Saving Translations
1. Go to Super Admin → Languages
2. Click "Translate" on any language
3. Edit a translation
4. Click "Save Translations"
5. Watch the console for logs starting with `[LanguageStorage]` and `[LanguageManagement]`

### Step 5: Check Network Tab
1. Open **Network** tab in DevTools
2. Filter by "languages"
3. Try to save translations
4. Click on the request to see:
   - **Request Headers** - Check if Authorization header is present
   - **Request Payload** - Check if translations are being sent
   - **Response** - Check the error message

---

## 🐛 Common Issues & Solutions

### Issue 1: "Authentication Required"
**Symptoms:**
- Error: "Please log in again to save translations"
- `localStorage.getItem('auth_token')` returns `null`

**Solution:**
1. Log out and log back in
2. Make sure you're logged in as Super Admin
3. Check that `SUPER_ADMIN_EMAIL` in `.env` matches your email

### Issue 2: "403 Forbidden"
**Symptoms:**
- Error: "You do not have permission"
- API returns 403 status

**Solution:**
1. Verify you're logged in as Super Admin
2. Check your email matches `SUPER_ADMIN_EMAIL` in `.env`
3. Check that your user has `isAdmin: true` in database

### Issue 3: "Failed to create language"
**Symptoms:**
- Error when saving translations for new language
- Console shows POST request failed

**Solution:**
1. Check console for detailed error message
2. Verify database connection
3. Check if language already exists

### Issue 4: No Error but Not Saving
**Symptoms:**
- No error message
- Translations don't persist after refresh

**Solution:**
1. Check Network tab - is the request successful?
2. Check console for `[LanguageStorage]` logs
3. Verify database has the translations:
   ```sql
   SELECT * FROM translations WHERE language_id = (SELECT id FROM languages WHERE code = 'en');
   ```

---

## 📊 Console Logs to Look For

### Successful Save:
```
[LanguageManagement] Saving translations: {code: "en", keyCount: 900}
[LanguageStorage] Updating translations for: en
[LanguageStorage] Auth token present: true
[LanguageStorage] Translation keys count: 900
[LanguageStorage] Language exists in database
[LanguageStorage] Updating existing language: en
[LanguageStorage] Translations updated successfully
```

### Failed Save:
```
[LanguageStorage] Failed to update translations: 401 {error: "Unauthorized"}
```
or
```
[LanguageStorage] Failed to update translations: 403 {error: "Forbidden"}
```

---

## ✅ Verification Checklist

- [ ] Auth token exists in localStorage
- [ ] User is logged in as Super Admin
- [ ] Console shows `[LanguageStorage]` logs
- [ ] Network tab shows successful API call (200 status)
- [ ] No CORS errors in console
- [ ] Database has updated translations

---

## 🔧 Quick Fixes

### If token is missing:
```javascript
// In browser console, manually set a test token (not recommended for production)
localStorage.setItem('auth_token', 'your-token-here');
```

### If you need to check API response:
```javascript
// Test the API endpoint directly
fetch('/api/languages/en', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
    'Content-Type': 'application/json'
  },
  credentials: 'include'
})
.then(async r => {
  const data = await r.json();
  console.log('Status:', r.status);
  console.log('Response:', data);
})
```

---

**Remember:** Always check the browser console first! The detailed logs will tell you exactly what's happening.

