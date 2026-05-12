#!/bin/bash

# DakDam Database Backup Script
# Automates PostgreSQL database backups with rotation

set -e

# Configuration
BACKUP_DIR="./backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql.gz"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Functions
log_info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Create backup directory
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        log_info "Created backup directory: $BACKUP_DIR"
    fi
}

# Extract database connection details from DATABASE_URL
parse_database_url() {
    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL environment variable is not set"
        exit 1
    fi

    # Parse DATABASE_URL: postgresql://user:pass@host:port/db?params
    if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASS="${BASH_REMATCH[2]}"
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
        DB_NAME="${BASH_REMATCH[5]}"
        DB_NAME="${DB_NAME%%\?*}"  # Remove query parameters
    else
        log_error "Invalid DATABASE_URL format"
        exit 1
    fi
}

# Create database backup
create_backup() {
    log_info "Starting database backup..."

    export PGPASSWORD="$DB_PASS"

    # Create compressed backup
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --no-owner --no-privileges --clean --if-exists | gzip > "$BACKUP_FILE"

    local backup_size=$(du -h "$BACKUP_FILE" | cut -f1)
    log_success "Database backup created: $BACKUP_FILE (${backup_size})"
}

# Clean up old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than $RETENTION_DAYS days..."

    local deleted_count=0
    local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y%m%d)

    # Find and delete old backups
    for backup_file in "$BACKUP_DIR"/backup_*.sql.gz; do
        if [ -f "$backup_file" ]; then
            local file_date=$(basename "$backup_file" | sed 's/backup_\([0-9]\{8\}\).*/\1/')
            if [ "$file_date" -lt "$cutoff_date" ] 2>/dev/null; then
                rm -f "$backup_file"
                ((deleted_count++))
            fi
        fi
    done

    if [ $deleted_count -gt 0 ]; then
        log_info "Cleaned up $deleted_count old backup files"
    else
        log_info "No old backups to clean up"
    fi
}

# Verify backup integrity
verify_backup() {
    log_info "Verifying backup integrity..."

    if ! gunzip -c "$BACKUP_FILE" | head -n 10 > /dev/null; then
        log_error "Backup file is corrupted or invalid"
        rm -f "$BACKUP_FILE"
        exit 1
    fi

    log_success "Backup integrity verified"
}

# Send notification (placeholder for email/Slack integration)
send_notification() {
    local status="$1"
    local message="$2"

    # TODO: Integrate with email service or Slack webhook
    log_info "Backup $status: $message"

    # Example email notification (requires mail command or SMTP setup):
    # echo "$message" | mail -s "DakDam Backup $status" admin@yourdomain.com
}

# Main backup function
perform_backup() {
    log_info "=== DakDam Database Backup Started ==="

    create_backup_dir
    parse_database_url
    create_backup
    verify_backup
    cleanup_old_backups

    log_success "=== DakDam Database Backup Completed ==="
    send_notification "SUCCESS" "Database backup completed successfully: $BACKUP_FILE"
}

# Restore function
restore_backup() {
    local backup_file="$1"

    if [ -z "$backup_file" ]; then
        log_error "Please specify a backup file to restore"
        echo "Usage: $0 restore <backup_file.sql.gz>"
        exit 1
    fi

    if [ ! -f "$backup_file" ]; then
        log_error "Backup file does not exist: $backup_file"
        exit 1
    fi

    log_info "Starting database restore from: $backup_file"

    export PGPASSWORD="$DB_PASS"

    # Confirm before restore
    read -p "This will overwrite the current database. Are you sure? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        log_info "Restore cancelled"
        exit 0
    fi

    # Perform restore
    gunzip -c "$backup_file" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"

    log_success "Database restore completed"
}

# List available backups
list_backups() {
    log_info "Available backups in $BACKUP_DIR:"

    if [ ! -d "$BACKUP_DIR" ]; then
        log_info "No backup directory found"
        return
    fi

    local count=0
    for backup_file in "$BACKUP_DIR"/backup_*.sql.gz; do
        if [ -f "$backup_file" ]; then
            local size=$(du -h "$backup_file" | cut -f1)
            local date=$(stat -c %y "$backup_file" 2>/dev/null || stat -f %Sm -t "%Y-%m-%d %H:%M:%S" "$backup_file")
            echo "  $(basename "$backup_file") (${size}) - ${date}"
            ((count++))
        fi
    done

    if [ $count -eq 0 ]; then
        log_info "No backup files found"
    else
        log_info "Total backups: $count"
    fi
}

# Show usage
usage() {
    echo "DakDam Database Backup Script"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  backup    - Create a new database backup (default)"
    echo "  restore   - Restore from a backup file"
    echo "  list      - List available backups"
    echo "  help      - Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 backup"
    echo "  $0 restore ./backups/backup_20231201_120000.sql.gz"
    echo "  $0 list"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_URL - PostgreSQL connection string (required)"
    echo "  RETENTION_DAYS - Number of days to keep backups (default: 30)"
}

# Main script
case "${1:-backup}" in
    "backup")
        perform_backup
        ;;
    "restore")
        parse_database_url
        restore_backup "$2"
        ;;
    "list")
        list_backups
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