# DakDam Binary Tree MLM Application

DakDam is a modern Multi-Level Marketing (MLM) application built with Next.js, featuring a binary tree genealogy system, commission management, e-cash transfers, and comprehensive member administration. The application replicates and enhances the functionality of traditional MLM systems with a robust PostgreSQL-backed architecture.

## System Architecture

### Architecture Overview

DakDam follows a layered architecture pattern with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                 Next.js App Router                      │ │
│  │  ┌─────────────┬─────────────┬─────────────┬─────────┐ │ │
│  │  │   Auth      │   Dashboard │  Genealogy  │  Admin  │ │ │
│  │  │   Pages     │   Pages     │   Pages     │  Pages  │ │ │
│  │  └─────────────┴─────────────┴─────────────┴─────────┘ │ │
│  │                                                         │ │
│  │  React Components (UI Library)                          │ │
│  │  - Genealogy Tree, Member Nodes, Rank Badges           │ │
│  │  - Forms, Tables, Charts, Enhanced UI Components       │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                  APPLICATION LAYER                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              React Contexts & Hooks                     │ │
│  │  ┌─────────────┬─────────────┬─────────────┬─────────┐ │ │
│  │  │ AuthContext │GenealogyCtx │ CartContext │  Hooks  │ │ │
│  │  └─────────────┴─────────────┴─────────────┴─────────┘ │ │
│  │                                                         │ │
│  │  Service Layer (Business Operations)                   │ │
│  │  - Genealogy Service, Commission Service               │ │
│  │  - Analytics, Notification, Rank Services              │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                 BUSINESS LOGIC LAYER                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Core Business Rules                        │ │
│  │  ┌─────────────┬─────────────┬─────────────┬─────────┐ │ │
│  │  │Compensation │ Business    │   Search    │ Security│ │ │
│  │  │  Engine     │   Rules     │   Engine    │         │ │ │
│  │  └─────────────┴─────────────┴─────────────┴─────────┘ │ │
│  │                                                         │ │
│  │  Utilities & Types                                      │ │
│  │  - TypeScript interfaces, Database utilities           │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              PostgreSQL + Prisma ORM                     │ │
│  │  ┌─────────────┬─────────────┬─────────────┬─────────┐ │ │
│  │  │  Users      │ Commissions │   Orders    │ Products│ │ │
│  │  │  Companies  │ Rules       │   Stock     │  E-Cash │ │ │
│  │  └─────────────┴─────────────┴─────────────┴─────────┘ │ │
│  │                                                         │ │
│  │  JWT Authentication, API Routes                         │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Detailed Architecture Explanation

#### 1. Presentation Layer
**Technology Stack:** Next.js 15, React 18, TypeScript, Tailwind CSS, Radix UI

**Key Components:**
- **App Router Structure:** Organized under `src/app/` with route-based pages
  - Authentication: `/auth/login`, `/register`, `/auth/forgot-password`
  - Main App: `/dashboard`, `/genealogy`, `/commission`, `/orders`, `/profile`
  - Admin Panel: `/admin/dashboard`, `/admin/products`, `/admin/business-intelligence`
  - E-commerce: `/product`, `/cart`, `/checkout`, `/ecash`

- **UI Component Library:** Comprehensive set of reusable components in `src/components/ui/`
  - Enhanced components with accessibility features
  - Genealogy-specific components: Tree visualization, member nodes, rank badges
  - Form components, data tables, charts, and interactive elements

- **Layout System:** Responsive layouts with authentication guards and navigation

#### 2. Application Layer
**Technology Stack:** React Context API, Custom Hooks

**Key Components:**
- **Context Providers:**
  - `AuthContext`: Manages JWT authentication state and user sessions
  - `GenealogyContext`: Handles member tree data and operations
  - `CartContext`: Manages shopping cart state

- **Custom Hooks:** `useGenealogy`, `useCart`, `useMobile`, `useToast`, `useI18n`

- **Service Layer:** Business operation services in `src/services/`
  - `genealogy-service.ts`: Member management, tree operations, commissions
  - `commission-service.ts`: Commission calculations and payouts
  - `analytics-service.ts`: Business intelligence and reporting
  - `notification-service.ts`: User notifications and alerts
  - `onboarding-service.ts`: New member onboarding workflows

#### 3. Business Logic Layer
**Technology Stack:** TypeScript, Custom Algorithms

**Key Components:**
- **Compensation Engine:** (`src/lib/compensation-engine.ts`)
  - Binary tree commission calculations
  - PV (Personal Volume) tracking
  - Rank advancement rules

- **Business Rules Engine:** (`src/lib/business-rules.ts`, `src/lib/rule-engine.ts`)
  - Dynamic rule system with versioning
  - MLM-specific validation logic
  - Member qualification rules
  - Rule conflict detection and resolution

- **Core Utilities:**
  - Type definitions (`types.ts`)
  - Database configuration (`database.ts`)
  - Search functionality (`search-engine.ts`)
  - Security utilities (`security.ts`, `auth.ts`)
  - Rate limiting and performance monitoring

#### 4. Data Layer
**Technology Stack:** PostgreSQL with Prisma ORM, JWT Authentication

**Data Model:**
- **Users/Companies:** Multi-tenant support with company isolation
- **Members Collection:** User profiles, genealogy relationships, ranks, PV data
- **Commissions Collection:** Earnings, transfers, payment history
- **Orders Collection:** Purchase transactions, fulfillment status
- **Products Collection:** Catalog items, pricing, descriptions
- **Business Rules:** Dynamic rule system with versioning
- **Audit Logs:** System activity tracking for compliance
- **Stock Management:** Inventory tracking and stockist requests
- **E-Cash System:** Internal currency with top-up requests

**Key Features:**
- Transactional operations for data integrity
- Multi-tenancy with company-level isolation
- Financial controls and escrow systems
- Automated tree compression for inactive members
- Comprehensive audit logging

### Data Flow Architecture

```
User Interaction → Page Component → UI Component → Hook/Context → Service → API Route → Prisma → PostgreSQL
      ↑               ↓              ↓             ↓          ↓          ↓         ↓         ↓
   Response     State Update    Data Display  State Mgmt  Business Logic  Validation  DB Operation  Persistence
```

### Technology Stack Details

- **Frontend Framework:** Next.js 15 with App Router
- **Language:** TypeScript for type safety
- **Styling:** Tailwind CSS with custom design system
- **UI Components:** Radix UI primitives with custom enhancements
- **State Management:** React Context API
- **Backend:** Next.js API Routes with Prisma ORM
- **Database:** PostgreSQL (production-ready relational database)
- **Authentication:** JWT-based with bcrypt password hashing
- **Charts & Visualization:** Recharts for analytics
- **Forms:** React Hook Form with Zod validation
- **Icons:** Lucide React
- **Internationalization:** Custom i18n system (EN, TH, KM, VI)
- **Testing:** Playwright for E2E tests

### Security & Compliance Features

- JWT Authentication with secure token management
- bcrypt password hashing (12 rounds)
- Rate limiting for authentication endpoints
- Financial controls and audit logging
- Compliance document management
- Secure e-cash transfer system with escrow for large amounts
- Data validation and business rule enforcement
- Multi-tenant data isolation
- Input sanitization and SQL injection prevention via Prisma

### Performance Optimizations

- Server-side rendering with Next.js
- Lazy loading for genealogy tree components
- Mobile-optimized responsive design
- Performance monitoring utilities
- Efficient Prisma queries with proper indexing
- Database connection pooling
- Request caching where appropriate

## Core Features

- **Genealogy Tree Viewer:** Interactive binary tree visualization with member details
- **Commission Management:** Automated calculation and payout system
- **E-cash Transfers:** Secure peer-to-peer fund transfers
- **Rank Advancement:** Multi-level ranking system with requirements tracking
- **Admin Dashboard:** Business intelligence and system management
- **Product Catalog:** E-commerce functionality for MLM products
- **Multi-Company Support:** Multiple MLM companies in one platform
- **Business Rules Engine:** Dynamic, versioned rule system
- **Mobile Responsive:** Optimized for all device sizes
- **Multi-Language:** Support for English, Thai, Khmer, Vietnamese

## Running Locally

### Prerequisites

1. **Node.js 18+** and npm installed
2. **PostgreSQL database** (local or cloud-hosted)

### Setup Instructions

1. **Clone the repository:**
```bash
git clone <repository-url>
cd dakdam
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up your database:**

Create a PostgreSQL database and note the connection string. Your database URL should look like:
```
postgresql://username:password@localhost:5432/database_name
```

4. **Configure environment variables:**

Create a `.env.local` file in the root directory:

```env
# Database Configuration (REQUIRED)
DATABASE_URL="postgresql://username:password@localhost:5432/dakdam_db?schema=public"

# JWT Secret (REQUIRED - Generate a secure 256-bit key)
JWT_SECRET="your-super-secret-256-bit-key-change-this-in-production"

# Application URL (Optional)
NEXT_PUBLIC_APP_URL="http://localhost:9002"
```

**Important Security Notes:**
- Never commit your `.env.local` file to version control
- Generate a strong, random JWT_SECRET for production
- Use environment-specific secrets for dev/staging/prod

5. **Initialize the database:**

```bash
# Generate Prisma Client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# (Optional) Seed the database with sample data
npx prisma db seed
```

6. **Run the development server:**

```bash
npm run dev
```

The application will be available at `http://localhost:9002`.

### Additional Commands

```bash
# Run production build
npm run build
npm run start

# Run E2E tests
npm run test:e2e

# Open Prisma Studio (database GUI)
npx prisma studio

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Database Schema

The application uses Prisma ORM with PostgreSQL. Key entities include:

- **Company:** Multi-tenant company information
- **User:** Member profiles with genealogy relationships
- **Product:** MLM product catalog
- **Order:** Purchase transactions
- **Commission:** Earnings and payouts
- **BusinessRule:** Dynamic rule system
- **StockItem:** Inventory management
- **EcashTopupRequest:** E-cash top-up workflows

View the complete schema in [`prisma/schema.prisma`](prisma/schema.prisma).

## Deployment

### Production Deployment

1. **Database:** Use managed PostgreSQL (AWS RDS, DigitalOcean, Heroku Postgres)
2. **Application:** Deploy to Vercel, Netlify, or any Node.js hosting
3. **Environment Variables:** Set all production secrets securely
4. **SSL/TLS:** Ensure HTTPS is enabled
5. **Monitoring:** Set up error tracking (Sentry) and performance monitoring

See [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) for detailed instructions.

## Documentation

- **[API Documentation](API_DOCUMENTATION.md)** - Complete API reference
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Production deployment instructions
- **[Business Rules System](BUSINESS_RULES_SYSTEM_README.md)** - Dynamic rules engine
- **[Microservices](MICROSERVICES_README.md)** - Microservice architecture details
- **[Pre-Launch Checklist](PRE_LAUNCH_CHECKLIST.md)** - Production readiness checklist

## License

Proprietary - All rights reserved

## Support

For technical support or questions, please contact the development team.
