# PostgreSQL Database Setup Guide - Windows

## Quick Start Summary

You need PostgreSQL running on your Windows machine. Here are the fastest options:

1. **Docker** (Recommended - Easiest) - 5 minutes
2. **PostgreSQL Installer** (Traditional) - 10 minutes  
3. **Cloud Database** (For testing) - 5 minutes

---

## Option 1: Docker (Recommended) ⭐

### Prerequisites
- Docker Desktop for Windows installed ([Download](https://www.docker.com/products/docker-desktop/))

### Steps

1. **Create `docker-compose.yml` in project root** (I'll create this for you)

2. **Start PostgreSQL:**
```bash
docker-compose up -d
```

3. **Verify it's running:**
```bash
docker ps
```

You should see a container named `dakdam-postgres` running.

4. **Create `.env.local` file:**
```env
DATABASE_URL="postgresql://dakdam_user:dakdam_password@localhost:5432/dakdam_db?schema=public"
JWT_SECRET="test-jwt-secret-for-development-change-in-production"
```

5. **Initialize database:**
```bash
npx prisma migrate dev
```

6. **(Optional) Seed with test data:**
```bash
npx prisma db seed
```

### Docker Commands Reference

```bash
# Start database
docker-compose up -d

# Stop database
docker-compose down

# View logs
docker-compose logs -f postgres

# Stop and remove data
docker-compose down -v
```

---

## Option 2: PostgreSQL Installer (Traditional)

### Step 1: Download PostgreSQL

1. Go to: https://www.postgresql.org/download/windows/
2. Download PostgreSQL 15 or 16 installer
3. Run the installer

### Step 2: Installation Settings

During installation, note these settings:

- **Port:** 5432 (default)
- **Username:** postgres (default)
- **Password:** [Choose a strong password - REMEMBER THIS!]
- **Data Directory:** Default is fine
- **Locale:** Default is fine

### Step 3: Add PostgreSQL to PATH

1. Search "Environment Variables" in Windows
2. Edit "Path" under System Variables
3. Add: `C:\Program Files\PostgreSQL\15\bin`
4. Click OK and restart terminal

### Step 4: Create Database

Open Command Prompt or PowerShell:

```bash
# Login to PostgreSQL
psql -U postgres

# Create database user
CREATE USER dakdam_user WITH PASSWORD 'dakdam_password';

# Create database
CREATE DATABASE dakdam_db OWNER dakdam_user;

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE dakdam_db TO dakdam_user;

# Exit
\q
```

### Step 5: Configure Application

Create `.env.local`:
```env
DATABASE_URL="postgresql://dakdam_user:dakdam_password@localhost:5432/dakdam_db?schema=public"
JWT_SECRET="test-jwt-secret-for-development-change-in-production"
```

### Step 6: Initialize Database

```bash
npx prisma migrate dev
```

---

## Option 3: Cloud Database (Quick Testing)

### Supabase (Free Tier)

1. Go to: https://supabase.com/
2. Create free account
3. Create new project
4. Wait 2-3 minutes for provisioning
5. Get connection string from Settings > Database
6. Use the "Connection pooling" string for better performance

Your `.env.local`:
```env
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
JWT_SECRET="test-jwt-secret-for-development-change-in-production"
```

### Railway (Free Tier)

1. Go to: https://railway.app/
2. Create account
3. New Project > Deploy PostgreSQL
4. Copy connection URL
5. Use in `.env.local`

---

## Verify Database Connection

After setup, test the connection:

```bash
# Generate Prisma Client
npx prisma generate

# Check connection
npx prisma db pull

# Open Prisma Studio (Database GUI)
npx prisma studio
```

If Prisma Studio opens at http://localhost:5555, your database is working! ✅

---

## Initialize Database Schema

Once connected, run migrations:

```bash
# Create database tables
npx prisma migrate dev

# This will:
# 1. Read prisma/schema.prisma
# 2. Create all tables, relations, indexes
# 3. Apply to your database
```

---

## Seed Test Data (Optional)

To add sample data for testing:

```bash
npx prisma db seed
```

This creates:
- Sample company
- Test users
- Sample products
- Test commissions

---

## Running E2E Tests with Database

Once database is set up:

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test e2e/auth.spec.ts

# Run tests in UI mode
npm run test:e2e:ui
```

---

## Troubleshooting

### "Can't reach database server at localhost:5432"

**Solution 1 - Check if PostgreSQL is running:**
```bash
# Windows Services
services.msc
# Look for "postgresql-x64-15" and ensure it's running

# Or for Docker:
docker ps
```

**Solution 2 - Check port is not in use:**
```bash
netstat -ano | findstr :5432
```

**Solution 3 - Firewall:**
- Windows Defender may block PostgreSQL
- Add exception for port 5432

### "Connection refused"

- Check DATABASE_URL in `.env.local` is correct
- Ensure PostgreSQL service is running
- Verify credentials (username/password)

### "Database does not exist"

```bash
# Create it manually
psql -U postgres
CREATE DATABASE dakdam_db;
\q
```

### "Role does not exist"

```bash
# Create user manually
psql -U postgres
CREATE USER dakdam_user WITH PASSWORD 'dakdam_password';
GRANT ALL PRIVILEGES ON DATABASE dakdam_db TO dakdam_user;
\q
```

---

## Database Management Commands

### Using psql (PostgreSQL CLI)

```bash
# Connect to database
psql -U dakdam_user -d dakdam_db

# List databases
\l

# List tables
\dt

# Describe table structure
\d users

# Run SQL query
SELECT * FROM users LIMIT 5;

# Exit
\q
```

### Using Prisma Studio (GUI)

```bash
# Open graphical database browser
npx prisma studio
```

Navigate to http://localhost:5555 to browse/edit data visually.

---

## Next Steps

After database is set up:

1. ✅ Run migrations: `npx prisma migrate dev`
2. ✅ (Optional) Seed data: `npx prisma db seed`
3. ✅ Start dev server: `npm run dev`
4. ✅ Run E2E tests: `npm run test:e2e`
5. ✅ Open Prisma Studio: `npx prisma studio`

---

## Production Considerations

For production deployment, use managed PostgreSQL:

- **AWS RDS** - Industry standard, full control
- **DigitalOcean Managed Databases** - Simple, affordable
- **Heroku Postgres** - Easy deployment
- **Supabase** - PostgreSQL + extras (auth, storage)
- **Railway** - Modern deployment platform

Never use SQLite or local PostgreSQL in production!

---

## Support

If you encounter issues:

1. Check PostgreSQL is running: `pg_ctl status`
2. Verify connection string in `.env.local`
3. Check firewall settings
4. Review PostgreSQL logs
5. Test with Prisma Studio

**Common Windows Paths:**
- PostgreSQL Data: `C:\Program Files\PostgreSQL\15\data`
- PostgreSQL Logs: `C:\Program Files\PostgreSQL\15\data\log`
- Prisma Migrations: `prisma/migrations/`

---

**Setup Date:** 2025-10-18  
**System:** DakDam MLM Application  
**Database:** PostgreSQL 15+  
**ORM:** Prisma