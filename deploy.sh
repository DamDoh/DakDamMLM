#!/bin/bash

# DakDam MLM Platform Deployment Script
# This script handles production deployment with backup and health checks

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="dakdam-mlm"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"

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

# Check if required tools are installed
check_dependencies() {
    log_info "Checking dependencies..."

    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi

    if ! command -v psql &> /dev/null; then
        log_warning "psql is not available - database backup will be skipped"
    fi

    log_success "Dependencies check passed"
}

# Create backup directory
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        log_info "Created backup directory: $BACKUP_DIR"
    fi
}

# Backup database
backup_database() {
    if command -v psql &> /dev/null && [ -n "$DATABASE_URL" ]; then
        log_info "Creating database backup..."

        # Extract database connection details from DATABASE_URL
        # This is a simplified version - in production, use a more robust method
        if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
            DB_USER="${BASH_REMATCH[1]}"
            DB_PASS="${BASH_REMATCH[2]}"
            DB_HOST="${BASH_REMATCH[3]}"
            DB_PORT="${BASH_REMATCH[4]}"
            DB_NAME="${BASH_REMATCH[5]}"

            export PGPASSWORD="$DB_PASS"
            pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$BACKUP_FILE"

            log_success "Database backup created: $BACKUP_FILE"
        else
            log_warning "Could not parse DATABASE_URL for backup"
        fi
    else
        log_warning "Database backup skipped (psql not available or DATABASE_URL not set)"
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    npm ci --production=false
    log_success "Dependencies installed"
}

# Build application
build_application() {
    log_info "Building application..."
    npm run build
    log_success "Application built successfully"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    npx prisma migrate deploy
    log_success "Database migrations completed"
}

# Health check
health_check() {
    log_info "Performing health check..."

    # Wait for application to start (adjust URL as needed)
    local max_attempts=30
    local attempt=1
    local health_url="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}/api/health"

    while [ $attempt -le $max_attempts ]; do
        log_info "Health check attempt $attempt/$max_attempts..."

        if curl -f -s "$health_url" > /dev/null 2>&1; then
            log_success "Health check passed"
            return 0
        fi

        sleep 2
        ((attempt++))
    done

    log_error "Health check failed after $max_attempts attempts"
    return 1
}

# Main deployment function
deploy() {
    log_info "Starting DakDam deployment..."

    check_dependencies
    create_backup_dir
    backup_database
    install_dependencies
    build_application
    run_migrations

    log_success "Deployment completed successfully!"
    log_info "Backup file: $BACKUP_FILE"
    log_info "Application is ready for production use"
}

# Health check only
check_health() {
    health_check
}

# Show usage
usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  (no command)  - Full deployment with backup"
    echo "  health        - Run health check only"
    echo "  help          - Show this help"
    echo ""
    echo "Environment variables:"
    echo "  DATABASE_URL      - PostgreSQL connection string"
    echo "  NEXT_PUBLIC_APP_URL - Application URL for health checks"
}

# Main script
case "${1:-deploy}" in
    "deploy")
        deploy
        ;;
    "health")
        check_health
        ;;
    "help"|"-h"|"--help")
        usage
        ;;
    *)
        log_error "Unknown command: $1"
        usage
        exit 1
        ;;
esac