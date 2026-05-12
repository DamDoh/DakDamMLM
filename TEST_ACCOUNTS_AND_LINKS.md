# DakDam MLM Application - Test Accounts & Access Information

## 🌐 Application Access

**Main Application URL:** http://localhost:9002

### Available Pages & Routes

#### Public Pages
- **Home/Landing:** http://localhost:9002
- **Login:** http://localhost:9002/auth/login
- **Register:** http://localhost:9002/register
- **Company Registration:** http://localhost:9002/company-register

#### Authenticated Pages (require login)
- **Dashboard:** http://localhost:9002/dashboard
- **Profile:** http://localhost:9002/profile
- **Profile Edit:** http://localhost:9002/profile/edit
- **Genealogy/Tree:** http://localhost:9002/genealogy
- **Commission:** http://localhost:9002/commission
- **Orders:** http://localhost:9002/orders
- **Products:** http://localhost:9002/product
- **E-Cash:** http://localhost:9002/ecash
- **Shopping Cart:** http://localhost:9002/cart
- **Checkout:** http://localhost:9002/checkout
- **Invite:** http://localhost:9002/invite

#### Admin Pages (require admin role)
- **Super Admin Dashboard:** http://localhost:9002/super-admin

---

## 👥 Test User Accounts

All test accounts use the password: **`password123`**

### 1. Admin Account (Super User)
```
Email: admin@dakdam.com
Phone: +1234567890
Password: password123
Member ID: ADM001
Role: Administrator
Rank: Diamond
PV: 10,000
Team Size: 295 (150 left, 145 right)
```

**Use this account for:**
- Full system access
- Admin panel testing
- User management
- Business rules configuration
- System settings

---

### 2. John Doe (Gold Member)
```
Email: john.doe@dakdam.com
Phone: +1234567891
Password: password123
Member ID: MEM001
Role: Distributor
Rank: Gold
PV: 2,500
Team Size: 55 (25 left, 30 right)
Position: Left child of Admin
Sponsor: Admin (ADM001)
```

**Use this account for:**
- Mid-level distributor testing
- Team management
- Commission calculations
- Genealogy tree viewing

---

### 3. Jane Smith (Silver Member)
```
Email: jane.smith@dakdam.com
Phone: +1234567892
Password: password123
Member ID: MEM002
Role: Distributor
Rank: Silver
PV: 1,200
Team Size: 35 (15 left, 20 right)
Position: Right child of Admin
Sponsor: Admin (ADM001)
```

**Use this account for:**
- Mid-level distributor testing
- Commission tracking
- Product orders
- Team recruitment

---

### 4. Mike Johnson (Basic Member)
```
Email: mike.johnson@dakdam.com
Phone: +1234567893
Password: 1234
Member ID: MEM003
Role: Customer
Rank: Member
PV: 450
Team Size: 0
Position: Left child of John Doe
Sponsor: John Doe (MEM001)
```

**Use this account for:**
- New member experience
- Basic user functionality
- Product purchasing
- Commission earning

---

### 5. Sarah Williams (Basic Member)
```
Email: sarah.williams@dakdam.com
Phone: +1234567894
Password: password123
Member ID: MEM004
Role: Customer
Rank: Member
PV: 380
Team Size: 0
Position: Right child of Jane Smith
Sponsor: Jane Smith (MEM002)
```

**Use this account for:**
- New member testing
- Customer journey
- Product catalog browsing
- Order placement

---

## 📦 Sample Products (Seeded)

### 1. Vitamin C Supplement
- **Price:** $25.99
- **PV:** 20
- **Category:** Health & Wellness
- **Stock:** 100 units

### 2. Protein Powder
- **Price:** $45.99
- **PV:** 35
- **Category:** Fitness
- **Stock:** 50 units

### 3. Essential Oils Set
- **Price:** $35.99
- **PV:** 28
- **Category:** Wellness
- **Stock:** 30 units

### 4. Herbal Tea Collection
- **Price:** $19.99
- **PV:** 15
- **Category:** Beverages
- **Stock:** 75 units

---

## 🗄️ Database Information

### PostgreSQL Connection
```
Host: localhost
Port: 5432
Database: dakdam_db
Username: dakdam_user
Password: dakdam_password
```

### Database Management Tools

**Prisma Studio** (Database GUI)
```bash
npx prisma studio
```
Access at: http://localhost:5555

**Direct PostgreSQL Access**
```bash
docker exec -it dakdam-postgres psql -U dakdam_user -d dakdam_db
```

---

## 🔧 Development Commands

### Start Development Server
```bash
npm run dev
```
Application runs on: http://localhost:9002

### Database Commands
```bash
# View database schema
npx prisma studio

# Run migrations
npx prisma migrate dev

# Seed database
npm run seed

# Reset database (WARNING: Deletes all data)
npx prisma migrate reset
```

### Build & Production
```bash
# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Testing
```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

---

## 🧪 Testing Scenarios

### Scenario 1: New User Registration & Login
1. Visit http://localhost:9002/register
2. Create a new account
3. Login at http://localhost:9002/auth/login
4. Explore dashboard

### Scenario 2: Product Purchase Flow
1. Login as any user
2. Browse products at http://localhost:9002/product
3. Add items to cart
4. Complete checkout process

### Scenario 3: Binary Tree Genealogy
1. Login as Admin (admin@dakdam.com)
2. View genealogy tree
3. Check team members
4. View placement structure

### Scenario 4: Commission Tracking
1. Login as John Doe or Jane Smith
2. Navigate to commission page
3. View earnings and bonuses
4. Check commission history

### Scenario 5: Admin Management
1. Login as Admin (admin@dakdam.com)
2. Access super-admin dashboard
3. Manage users, products, and business rules
4. View analytics and reports

---

## 🔐 Security Notes

### Development Environment
- JWT Secret is set for development
- Database credentials are default (change in production)
- All test accounts use simple passwords for testing only

### Production Deployment
⚠️ **Before deploying to production:**
1. Change all default passwords
2. Generate a secure 256-bit JWT_SECRET
3. Use strong database credentials
4. Enable HTTPS/SSL
5. Configure proper environment variables
6. Review PRE_LAUNCH_CHECKLIST.md

---

## 📊 System Architecture

### Technology Stack
- **Frontend:** Next.js 15, React 18, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Prisma ORM
- **Database:** PostgreSQL 15
- **Authentication:** JWT with bcrypt
- **UI Components:** Radix UI

### Key Features
- Binary tree MLM structure
- Multi-level commission system
- E-cash internal wallet
- Product catalog & e-commerce
- Real-time notifications
- Multi-language support (EN, TH, KM, VI)
- Admin dashboard & analytics
- Mobile responsive design

---

## 🆘 Troubleshooting

### Server Won't Start
- Check if port 9002 is available
- Verify DATABASE_URL in .env.local
- Ensure PostgreSQL is running: `docker ps`

### Database Connection Issues
- Start PostgreSQL: `docker-compose up -d`
- Check connection string
- Run migrations: `npx prisma migrate dev`

### Login Issues
- Verify user exists in database
- Check password is `password123` for test accounts
- Clear browser cache/cookies
- Check JWT_SECRET is set in .env.local

### Need to Reset Everything?
```bash
# Stop server (Ctrl+C)
# Reset database
npx prisma migrate reset
# Reseed data
npm run seed
# Restart server
npm run dev
```

---

## 📞 Support & Documentation

- **Main Documentation:** README.md
- **Quick Start Guide:** QUICK_START.md
- **API Documentation:** API_DOCUMENTATION.md
- **Deployment Guide:** DEPLOYMENT_GUIDE.md
- **Pre-Launch Checklist:** PRE_LAUNCH_CHECKLIST.md

---

**Last Updated:** October 19, 2025
**System Status:** ✅ Running on http://localhost:9002
**Database:** ✅ PostgreSQL Connected
**Test Data:** ✅ Seeded with 5 users and 4 products