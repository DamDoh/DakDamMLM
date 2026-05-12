#!/bin/bash

echo "🔍 DakDam MLM Production Readiness Check"
echo "========================================"
echo ""

ERRORS=0
WARNINGS=0

# Check 1: Database Configuration
echo "✓ Checking database configuration..."
if grep -q "postgresql" /app/prisma/schema.prisma; then
    echo "  ✅ PostgreSQL configured"
else
    echo "  ❌ ERROR: Database not set to PostgreSQL"
    ERRORS=$((ERRORS + 1))
fi

# Check 2: Port Configuration
echo "✓ Checking port configuration..."
if grep -q "3000" /app/package.json; then
    echo "  ✅ Port 3000 configured"
else
    echo "  ⚠️  WARNING: Port might not be 3000"
    WARNINGS=$((WARNINGS + 1))
fi

# Check 3: ML Dependencies
echo "✓ Checking for ML dependencies..."
if grep -q "tensorflow\|ml-regression\|ml-matrix" /app/package.json; then
    echo "  ❌ ERROR: ML dependencies still present"
    ERRORS=$((ERRORS + 1))
else
    echo "  ✅ ML dependencies removed"
fi

# Check 4: Enhanced Files
echo "✓ Checking enhanced security files..."
if grep -q "ENHANCEMENT" /app/src/services/commission-calculation-engine.ts; then
    echo "  ✅ Commission engine enhanced"
else
    echo "  ❌ ERROR: Commission engine not enhanced"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "ENHANCEMENT" /app/src/services/wallet-service.ts; then
    echo "  ✅ Wallet service enhanced"
else
    echo "  ❌ ERROR: Wallet service not enhanced"
    ERRORS=$((ERRORS + 1))
fi

# Check 5: Environment Files
echo "✓ Checking environment configuration..."
if [ -f "/app/.env.example" ]; then
    echo "  ✅ .env.example exists"
else
    echo "  ⚠️  WARNING: .env.example missing"
    WARNINGS=$((WARNINGS + 1))
fi

# Check 6: Company Branding
echo "✓ Checking company branding system..."
if [ -f "/app/src/components/branding/CompanyLogo.tsx" ]; then
    echo "  ✅ Company branding components exist"
else
    echo "  ⚠️  WARNING: Branding components missing"
    WARNINGS=$((WARNINGS + 1))
fi

if [ -d "/app/public/uploads/company-logos" ]; then
    echo "  ✅ Logo upload directory exists"
else
    echo "  ⚠️  WARNING: Logo upload directory missing"
    WARNINGS=$((WARNINGS + 1))
fi

# Check 7: Critical API Routes
echo "✓ Checking critical API routes..."
if [ -f "/app/src/app/api/wallet/transfer/route.ts" ]; then
    echo "  ✅ Wallet transfer API exists"
else
    echo "  ❌ ERROR: Wallet transfer API missing"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "/app/src/app/api/company/branding/upload/route.ts" ]; then
    echo "  ✅ Branding upload API exists"
else
    echo "  ⚠️  WARNING: Branding API missing"
    WARNINGS=$((WARNINGS + 1))
fi

# Check 8: Package.json scripts
echo "✓ Checking build scripts..."
if grep -q "\"build\":" /app/package.json; then
    echo "  ✅ Build script configured"
else
    echo "  ❌ ERROR: Build script missing"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "========================================"
echo "SUMMARY:"
echo "  ❌ Critical Errors: $ERRORS"
echo "  ⚠️  Warnings: $WARNINGS"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo "🎉 ✅ PRODUCTION READY!"
    echo ""
    echo "Next steps:"
    echo "1. Read VERCEL_DEPLOYMENT_GUIDE.md"
    echo "2. Commit and push to GitHub"
    echo "3. Deploy to Vercel"
    echo "4. Configure environment variables"
    echo "5. Run database migrations"
    echo "6. Go live! 🚀"
    exit 0
else
    echo "❌ NOT READY FOR PRODUCTION"
    echo ""
    echo "Please fix the errors above before deploying."
    exit 1
fi
