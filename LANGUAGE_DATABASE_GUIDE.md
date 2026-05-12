# Language Database Storage Guide

## ✅ What Was Created

### 1. Database Schema
- **`languages` table**: Stores language metadata (code, name, nativeName, flag, isRTL, etc.)
- **`translations` table**: Stores translation key-value pairs for each language
- Both tables support multi-tenancy (companyId)

### 2. API Endpoints
- **`GET /api/languages`**: Get all languages (with optional translations)
- **`POST /api/languages`**: Create a new language (Super Admin only)
- **`GET /api/languages/[code]`**: Get a specific language with translations
- **`PUT /api/languages/[code]`**: Update a language and its translations
- **`DELETE /api/languages/[code]`**: Delete a custom language (cannot delete built-in)

### 3. Updated Storage Layer
- **`src/lib/language-storage.ts`**: Now uses API calls instead of localStorage
- All methods are now `async` and use `fetch` to communicate with the database

### 4. Seed Script
- **`prisma/seed-languages.ts`**: Populates database with all existing translations from TypeScript files

---

## 🚀 How to Use

### Step 1: Run Database Migration

```bash
# Apply the migration to create the tables
npx prisma migrate deploy
# OR if you want to create a new migration:
npx prisma migrate dev --name add_languages_and_translations
```

### Step 2: Seed Initial Translations

```bash
# Seed all languages and translations from existing TypeScript files
npm run db:seed:languages
```

This will:
- Create all 12 languages (en, km, fil, zh, ko, ja, th, id, es, vi, fr, de)
- Import all translations from `src/lib/translations/*.ts` files
- Mark them as `isBuiltIn: true`

### Step 3: Regenerate Prisma Client

```bash
# Generate Prisma client with new models
npx prisma generate
```

### Step 4: Update Your Code

The `LanguageStorage` class now uses async methods. Update any code that uses it:

**Before (localStorage):**
```typescript
const languages = LanguageStorage.getCustomLanguages();
LanguageStorage.addLanguage(language);
```

**After (API/Database):**
```typescript
const languages = await LanguageStorage.getAllLanguages();
await LanguageStorage.addLanguage(language);
```

---

## 📊 Database Structure

### Languages Table
```sql
CREATE TABLE languages (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,        -- ISO 639-1 code (e.g., 'en', 'km')
  name TEXT NOT NULL,                -- English name
  nativeName TEXT NOT NULL,          -- Native name
  flag TEXT NOT NULL,                -- Flag emoji
  isRTL BOOLEAN DEFAULT false,
  isActive BOOLEAN DEFAULT true,
  isBuiltIn BOOLEAN DEFAULT false,   -- Built-in vs custom
  companyId TEXT,                    -- Multi-tenant support
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

### Translations Table
```sql
CREATE TABLE translations (
  id TEXT PRIMARY KEY,
  languageId TEXT NOT NULL,          -- Foreign key to languages
  key TEXT NOT NULL,                 -- Translation key (e.g., 'common.loading')
  value TEXT NOT NULL,               -- Translated text
  companyId TEXT,                    -- Multi-tenant support
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP,
  UNIQUE(languageId, key, companyId) -- One translation per key per language
);
```

---

## 🔧 API Usage Examples

### Get All Languages
```typescript
const response = await fetch('/api/languages?includeTranslations=true');
const { data } = await response.json();
```

### Create New Language
```typescript
const response = await fetch('/api/languages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    code: 'my',
    name: 'Burmese',
    nativeName: 'မြန်မာဘာသာ',
    flag: '🇲🇲',
    isRTL: false,
    translations: {
      'common.loading': 'ဖွင့်နေသည်...',
      'common.error': 'အမှား'
    }
  })
});
```

### Update Language Translations
```typescript
const response = await fetch('/api/languages/km', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    translations: {
      'common.loading': 'កំពុងផ្ទុក...',
      'common.error': 'កំហុស'
    }
  })
});
```

---

## 🔐 Security

- All write operations (POST, PUT, DELETE) require **Super Admin** authentication
- Read operations (GET) are public but can be filtered by `companyId`
- Built-in languages cannot be deleted

---

## 📝 Notes

1. **Migration**: The migration file is already created at:
   `prisma/migrations/20241206_add_language_translation_tables/migration.sql`

2. **Prisma Client**: After running migration, regenerate Prisma client:
   ```bash
   npx prisma generate
   ```

3. **Multi-tenancy**: Languages can be company-specific by setting `companyId`

4. **Backward Compatibility**: The `LanguageStorage` interface remains the same, just async now

---

## 🐛 Troubleshooting

### "Property 'language' does not exist on PrismaClient"
**Solution**: Run `npx prisma generate` to regenerate the Prisma client

### "Migration already exists"
**Solution**: The migration directory might be empty. Delete it and run:
```bash
npx prisma migrate dev --name add_languages_and_translations
```

### "Failed to fetch languages"
**Solution**: 
1. Check that the API server is running
2. Verify authentication token is valid
3. Check database connection

---

## ✅ Next Steps

1. Run the migration: `npx prisma migrate deploy`
2. Seed the database: `npm run db:seed:languages`
3. Regenerate Prisma client: `npx prisma generate`
4. Test the API endpoints
5. Update any components that use `LanguageStorage` to use async/await

---

**All done! Languages are now stored in the database instead of localStorage!** 🎉

