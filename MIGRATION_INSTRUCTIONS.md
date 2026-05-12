# 🚀 DATABASE MIGRATION INSTRUCTIONS

**Critical:** You must run these commands to activate all the new features!

---

## ⚡ QUICK START (Copy & Paste)

```bash
# 1. Navigate to project directory
cd c:/dakdam

# 2. Run migration (creates 8 new tables)
npx prisma migrate dev --name add_audit_fix_models

# 3. Regenerate Prisma client (updates TypeScript types)
npx prisma generate

# 4. Restart your dev server
# Press Ctrl+C to stop current server, then:
npm run dev
```

**That's it!** All TypeScript errors will disappear and new services will be functional.

---

## 📋 DETAILED STEP-BY-STEP

### Step 1: Backup Current Database (Optional but Recommended)

```bash
# If using PostgreSQL locally:
pg_dump your_database_name > backup_before_migration.sql

# Or if using Docker:
docker exec your_postgres_container pg_dump -U postgres your_db > backup.sql
```

### Step 2: Review What Will Be Created

The migration will create these 8 new tables:

1. **commission_disputes** - Track commission disputes
2. **email_verifications** - Email verification tokens
3. **password_reset_tokens** - Password reset tokens
4. **financial_controls** - Financial holds and adjustments
5. **compliance_documents** - Regulatory documents
6. **member_agreements** - Member acceptance records
7. **inventory_transactions** - Complete inventory audit trail
8. **audit_logs** - System-wide audit logging

All with proper indexes and relationships.

### Step 3: Run Migration

```bash
npx prisma migrate dev --name add_audit_fix_models
```

**Expected Output:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "your_database"

Applying migration `20251019_add_audit_fix_models`

The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20251019_add_audit_fix_models/
      └─ migration.sql

Your database is now in sync with your schema.

✔ Generated Prisma Client (5.x.x) to ./node_modules/@prisma/client
```

**If you see errors:**
- Check DATABASE_URL is correct in .env
- Verify PostgreSQL is running
- Check database user has CREATE TABLE permissions

### Step 4: Regenerate Prisma Client

```bash
npx prisma generate
```

**Expected Output:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma

✔ Generated Prisma Client (5.x.x) to ./node_modules/@prisma/client

Start using Prisma Client in Node.js:
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
```

### Step 5: Verify in Prisma Studio (Optional)

```bash
npx prisma studio
```

This opens a browser at `http://localhost:5555` where you can:
- ✅ See all 8 new tables
- ✅ Verify table structure
- ✅ Check indexes
- ✅ View relationships

### Step 6: Restart Development Server

```bash
# Stop current server (Ctrl+C)
# Then start again:
npm run dev
```

**What Should Happen:**
- ✅ No TypeScript errors in VSCode
- ✅ Server starts without issues
- ✅ All new services accessible
- ✅ Application loads normally

---

## ✅ VERIFICATION CHECKLIST

After migration, verify these:

### In VSCode:
- [ ] No red squiggly lines in service files
- [ ] `prisma.commissionDispute` autocompletes
- [ ] `prisma.emailVerification` autocompletes
- [ ] `prisma.passwordResetToken` autocompletes
- [ ] `prisma.financialControl` autocompletes
- [ ] `prisma.complianceDocument` autocompletes
- [ ] `prisma.memberAgreement` autocompletes
- [ ] `prisma.inventoryTransaction` autocompletes
- [ ] `prisma.auditLog` autocompletes

### In Prisma Studio:
- [ ] commission_disputes table exists
- [ ] email_verifications table exists
- [ ] password_reset_tokens table exists
- [ ] financial_controls table exists
- [ ] compliance_documents table exists
- [ ] member_agreements table exists
- [ ] inventory_transactions table exists
- [ ] audit_logs table exists

### In Application:
- [ ] Login still works
- [ ] Can create commission dispute
- [ ] Can approve stock request (updates inventory)
- [ ] Can view financial controls
- [ ] Can view compliance documents

---

## 🔧 TROUBLESHOOTING

### "Migration failed" Error

**Possible Causes:**
1. PostgreSQL not running
2. DATABASE_URL incorrect
3. Database doesn't exist
4. User lacks permissions

**Solutions:**
```bash
# Check PostgreSQL is running
# Windows:
services.msc  # Look for PostgreSQL

# Check DATABASE_URL
echo %DATABASE_URL%  # Windows
# Should look like: postgresql://user:password@localhost:5432/database

# Create database if missing
psql -U postgres
CREATE DATABASE your_database_name;
\q
```

### "Property X does not exist" Errors

**Cause:** Prisma client not regenerated  
**Solution:**
```bash
npx prisma generate
# Restart TypeScript server in VSCode: Ctrl+Shift+P > "TypeScript: Restart TS Server"
```

### "Cannot find module" Errors

**Cause:** Import paths incorrect  
**Solution:** Check imports use correct paths:
```typescript
import { prisma } from '@/lib/database';
import * as inventoryService from '@/services/inventory-service';
```

### Tables Already Exist

**Cause:** Migration was partially run  
**Solution:**
```bash
# Reset and re-migrate
npx prisma migrate reset
npx prisma migrate dev --name add_audit_fix_models
```

**⚠️ WARNING:** This deletes all data!

---

## 📊 WHAT HAPPENS DURING MIGRATION

### 1. Prisma Creates Migration File:
Location: `prisma/migrations/[timestamp]_add_audit_fix_models/migration.sql`

Contains SQL like:
```sql
CREATE TABLE "commission_disputes" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "commissionId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  ...
);

CREATE INDEX "commission_disputes_memberId_idx" ON "commission_disputes"("memberId");
CREATE INDEX "commission_disputes_status_idx" ON "commission_disputes"("status");
...
```

### 2. Executes Migration:
- Connects to PostgreSQL
- Runs all CREATE TABLE statements
- Creates all indexes
- Sets up foreign keys (if any)
- Records migration in `_prisma_migrations` table

### 3. Updates Prisma Client:
- Generates TypeScript types
- Updates `@prisma/client` package
- Adds new model methods
- Updates autocomplete

---

## 🎯 POST-MIGRATION TASKS

### Immediate (Next 10 Minutes):

1. **Test Basic Functionality:**
```bash
# Open your app
http://localhost:3000

# Try to login
# Check if account lockout works after 5 wrong passwords

# Try creating a dispute (if you have UI for it)
# Check if it saves to commission_disputes table
```

2. **Verify in Prisma Studio:**
```bash
npx prisma studio
# Browse to each new table
# Verify structure matches expectations
```

### Soon (Next Hour):

3. **Test New Services:**
- Create a test script to exercise each service
- Verify inventory updates work
- Test email verification flow
- Test password reset flow

4. **Update .env for Email:**
```env
# Add these for production email:
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_api_key_here
SMTP_FROM=noreply@yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

## 📞 NEED HELP?

### If Migration Fails:

1. **Check the error message carefully**
2. **Look in `prisma/migrations/` folder** for the generated SQL
3. **Verify DATABASE_URL** environment variable
4. **Check PostgreSQL logs** for detailed errors
5. **Try running migration SQL manually** in pgAdmin or psql

### Common Error Messages:

**"Can't reach database server"**
- Solution: Start PostgreSQL service

**"Database does not exist"**
- Solution: Create database first

**"Permission denied"**
- Solution: Grant CREATE permissions to database user

**"Syntax error in migration"**
- Solution: Check Prisma version compatibility

---

## ✅ SUCCESS INDICATORS

You'll know migration succeeded when:

1. ✅ Command completes with "Your database is now in sync"
2. ✅ No red errors in terminal
3. ✅ TypeScript errors disappear in VSCode
4. ✅ Prisma Studio shows 8 new tables
5. ✅ Application starts without errors
6. ✅ Can import and use new services

---

## 🎓 UNDERSTANDING THE MIGRATION

### What's Safe:
- ✅ Adding new tables (what we're doing)
- ✅ Adding new indexes
- ✅ Adding new columns with defaults
- ✅ Creating new relations

### What Requires Care:
- ⚠️ Dropping tables (not doing this)
- ⚠️ Modifying existing columns (not doing this)
- ⚠️ Changing data types (not doing this)
- ⚠️ Removing relations (not doing this)

**This migration is 100% safe** - only adding new structures, not modifying existing ones.

---

## 🚀 AFTER MIGRATION

### Your app will have:

**New Capabilities:**
- ✅ Email verification system
- ✅ Secure password resets
- ✅ Account lockout protection
- ✅ Complete inventory management
- ✅ Commission dispute resolution
- ✅ Financial controls
- ✅ Compliance document system
- ✅ System-wide audit logging

**Enhanced Security:**
- ✅ Cryptographic tokens
- ✅ Rate limiting
- ✅ IP tracking
- ✅ Input sanitization
- ✅ XSS prevention

**Better Operations:**
- ✅ Complete audit trails
- ✅ Proper workflow approvals
- ✅ Transaction safety
- ✅ Statistics dashboards

---

**Ready? Run the commands at the top of this file!**

**Questions?** Check [`FINAL_AUDIT_AND_FIXES_SUMMARY.md`](FINAL_AUDIT_AND_FIXES_SUMMARY.md:1) for complete details.