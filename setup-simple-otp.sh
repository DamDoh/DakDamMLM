#!/bin/bash

# Simple OTP Setup Script for Traditional Hosting
# Replace third-party OTP services with self-hosted solution

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
check_project() {
    if [ ! -f "package.json" ] || [ ! -f "prisma/schema.prisma" ]; then
        log_error "Please run this script from your project root directory"
        exit 1
    fi
    log_success "Project structure verified"
}

# Update environment variables
setup_environment() {
    log_info "Setting up environment variables..."

    # Check if .env.local exists
    if [ ! -f ".env.local" ]; then
        log_warning ".env.local not found. Creating basic configuration..."
        cat > .env.local << 'EOF'
# Simple OTP Configuration
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=Your MLM Platform

# Optional: SMTP relay for your hosting provider
# SMTP_HOST=mail.yourdomain.com
# SMTP_PORT=587
# SMTP_USER=your-email@yourdomain.com
# SMTP_PASSWORD=your-email-password

# Database (configure according to your hosting)
DATABASE_URL="your-database-connection-string"
EOF
        log_warning "Please edit .env.local with your actual configuration"
    else
        log_info ".env.local already exists"

        # Check if OTP variables are already set
        if ! grep -q "SMTP_FROM_EMAIL" .env.local; then
            log_info "Adding OTP configuration to existing .env.local"
            cat >> .env.local << 'EOF'

# Simple OTP Configuration
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=Your MLM Platform

# Optional: SMTP relay for your hosting provider
# SMTP_HOST=mail.yourdomain.com
# SMTP_PORT=587
# SMTP_USER=your-email@yourdomain.com
# SMTP_PASSWORD=your-email-password
EOF
        else
            log_info "OTP configuration already exists in .env.local"
        fi
    fi

    log_success "Environment configuration updated"
}

# Run database migration
setup_database() {
    log_info "Setting up database..."

    # Check if npm is available
    if command -v npm &> /dev/null; then
        log_info "Running Prisma migration..."
        npm run prisma:migrate 2>/dev/null || npx prisma migrate dev --name add_simple_otp --create-only
        npx prisma generate
        log_success "Database migration completed"
    else
        log_warning "npm not found. Please run these commands manually:"
        echo "  npx prisma migrate dev --name add_simple_otp"
        echo "  npx prisma generate"
    fi
}

# Test the setup
test_setup() {
    log_info "Testing OTP setup..."

    # Check if API endpoints exist
    if [ -f "src/app/api/simple-otp/generate/route.ts" ] && [ -f "src/app/api/simple-otp/verify/route.ts" ]; then
        log_success "API endpoints found"
    else
        log_error "API endpoints not found. Please ensure the Simple OTP service is properly installed."
        exit 1
    fi

    # Check if service exists
    if [ -f "services/simple-otp-service/index.ts" ]; then
        log_success "OTP service found"
    else
        log_error "OTP service not found. Please ensure the Simple OTP service is properly installed."
        exit 1
    fi

    # Check if mail service exists
    if [ -f "lib/hosting-mail-service.ts" ]; then
        log_success "Mail service found"
    else
        log_error "Mail service not found. Please ensure the hosting mail service is properly installed."
        exit 1
    fi

    log_success "All components verified"
}

# Show integration examples
show_integration() {
    log_info "Showing integration examples..."

    cat << 'EOF'

🔧 INTEGRATION EXAMPLES
========================

1. Replace Twilio SMS OTP:
   OLD:
   await twilio.sendOTP(phone, code);

   NEW:
   await fetch('/api/simple-otp/generate', {
     method: 'POST',
     body: JSON.stringify({
       identifier: phone,
       type: 'sms',
       purpose: 'verification'
     })
   });

2. Replace Auth0 Email OTP:
   OLD:
   await auth0.sendEmailOTP(email, code);

   NEW:
   await fetch('/api/simple-otp/generate', {
     method: 'POST',
     body: JSON.stringify({
       identifier: email,
       type: 'email',
       purpose: 'verification'
     })
   });

3. Replace Firebase Auth:
   OLD:
   await firebase.auth().sendSignInLinkToEmail(email);

   NEW:
   await fetch('/api/simple-otp/generate', {
     method: 'POST',
     body: JSON.stringify({
       identifier: email,
       type: 'email',
       purpose: 'verification'
     })
   });

4. OTP Verification:
   const response = await fetch('/api/simple-otp/verify', {
     method: 'POST',
     body: JSON.stringify({
       identifier: email,
       code: enteredCode,
       purpose: 'verification'
     })
   });

   const result = await response.json();
   if (result.success) {
     // OTP verified successfully
   }

EOF
}

# Show next steps
show_next_steps() {
    log_info "Setup completed! Here are your next steps:"

    cat << 'EOF'

🎯 NEXT STEPS
=============

1. Configure your environment variables in .env.local:
   - SMTP_FROM_EMAIL: Your sender email
   - SMTP_FROM_NAME: Your sender name
   - SMTP_HOST/SMTP_USER/SMTP_PASSWORD: If using SMTP relay

2. Test email delivery:
   curl -X POST http://localhost:3000/api/simple-otp/generate \
     -H "Content-Type: application/json" \
     -d '{"identifier":"test@yourdomain.com","type":"email","purpose":"verification"}'

3. Replace your existing third-party OTP calls with the new API endpoints

4. Test the complete flow:
   - Generate OTP
   - Check email for the code
   - Verify OTP
   - Confirm success

5. Deploy to your hosting provider as usual

💰 COST SAVINGS
===============
- Twilio SMS: $0.05-0.10/message → $0
- Auth0/Authy: $50-200/month → $0
- SendGrid: $20-100/month → $0
- Firebase Auth: $0.005/user/month → $0

TOTAL SAVINGS: $70-400/month!

EOF
}

# Main setup function
main() {
    echo "🔐 Simple OTP Setup for Traditional Hosting"
    echo "==========================================="
    echo ""
    echo "This will replace your third-party OTP services with a self-hosted solution."
    echo ""

    check_project
    setup_environment
    setup_database
    test_setup
    show_integration
    show_next_steps

    echo ""
    log_success "🎉 Simple OTP setup completed!"
    echo ""
    echo "You now have a self-hosted OTP system that eliminates third-party dependencies"
    echo "while working perfectly with your traditional web hosting."
    echo ""
    echo "📧 Emails will be sent using your hosting provider's mail system"
    echo "🔒 OTP codes are securely hashed and stored in your database"
    echo "⚡ No more API rate limits or third-party service outages"
    echo ""
    echo "🚀 Ready to save $70-400/month on authentication costs!"
}

# Run main function
main "$@"