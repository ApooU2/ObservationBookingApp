#!/bin/bash

# Observatory Booking App - Disaster Recovery Script
# This script handles backup, restore, and disaster recovery procedures

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="/var/backups/observatory"
REMOTE_BACKUP_DIR=${REMOTE_BACKUP_DIR:-""}
S3_BUCKET=${S3_BUCKET:-""}
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"
LOG_FILE="/var/log/observatory-booking/disaster-recovery.log"

# Database credentials
MONGO_ROOT_USER=${MONGO_ROOT_USER:-"admin"}
MONGO_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD:-"password"}
MONGO_DB_NAME=${MONGO_DB_NAME:-"observatory-booking"}

# Create directories
mkdir -p $BACKUP_DIR
mkdir -p "$(dirname $LOG_FILE)"

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

echo -e "${BLUE}🚨 Observatory Booking App - Disaster Recovery${NC}"
echo "================================================="

# Function to create full system backup
create_full_backup() {
    echo -e "${YELLOW}💾 Creating full system backup...${NC}"
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_NAME="observatory_full_backup_$TIMESTAMP"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
    
    log "Starting full backup: $BACKUP_NAME"
    
    # Create backup directory
    mkdir -p "$BACKUP_PATH"
    
    # 1. Database backup
    echo -e "${BLUE}📊 Backing up database...${NC}"
    docker exec observatory-db mongodump \
        --authenticationDatabase admin \
        -u $MONGO_ROOT_USER \
        -p $MONGO_ROOT_PASSWORD \
        --db $MONGO_DB_NAME \
        --out "/backup/db_$TIMESTAMP"
    
    # Copy database backup to backup path
    docker cp observatory-db:/backup/db_$TIMESTAMP "$BACKUP_PATH/database"
    
    # 2. Application files backup
    echo -e "${BLUE}📁 Backing up application files...${NC}"
    tar -czf "$BACKUP_PATH/application.tar.gz" \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='*.log' \
        .
    
    # 3. Docker volumes backup
    echo -e "${BLUE}🐳 Backing up Docker volumes...${NC}"
    mkdir -p "$BACKUP_PATH/volumes"
    
    # Backup uploaded files
    if docker volume inspect observatory-uploads >/dev/null 2>&1; then
        docker run --rm -v observatory-uploads:/data -v "$BACKUP_PATH/volumes":/backup \
            busybox tar -czf /backup/uploads.tar.gz -C /data .
    fi
    
    # Backup logs
    if docker volume inspect observatory-logs >/dev/null 2>&1; then
        docker run --rm -v observatory-logs:/data -v "$BACKUP_PATH/volumes":/backup \
            busybox tar -czf /backup/logs.tar.gz -C /data .
    fi
    
    # 4. Configuration files backup
    echo -e "${BLUE}⚙️ Backing up configuration files...${NC}"
    mkdir -p "$BACKUP_PATH/config"
    
    # Copy environment files
    cp .env* "$BACKUP_PATH/config/" 2>/dev/null || true
    cp docker-compose*.yml "$BACKUP_PATH/config/" 2>/dev/null || true
    cp nginx*.conf "$BACKUP_PATH/config/" 2>/dev/null || true
    
    # Copy SSL certificates
    if [ -d "/etc/ssl/observatory" ]; then
        cp -r /etc/ssl/observatory "$BACKUP_PATH/config/ssl" 2>/dev/null || true
    fi
    
    # 5. Create backup manifest
    echo -e "${BLUE}📋 Creating backup manifest...${NC}"
    cat > "$BACKUP_PATH/manifest.json" << EOF
{
    "backup_name": "$BACKUP_NAME",
    "timestamp": "$TIMESTAMP",
    "date": "$(date -Iseconds)",
    "hostname": "$(hostname)",
    "components": {
        "database": true,
        "application": true,
        "volumes": true,
        "configuration": true
    },
    "versions": {
        "docker": "$(docker --version 2>/dev/null || echo 'Not installed')",
        "node": "$(node --version 2>/dev/null || echo 'Not installed')",
        "mongodb": "$(docker exec observatory-db mongosh --eval 'db.version()' --quiet 2>/dev/null || echo 'Not available')"
    },
    "checksums": {
        "database": "$(find $BACKUP_PATH/database -type f -exec md5sum {} \; | md5sum | cut -d' ' -f1)",
        "application": "$(md5sum $BACKUP_PATH/application.tar.gz | cut -d' ' -f1)"
    }
}
EOF
    
    # 6. Create compressed archive
    echo -e "${BLUE}🗜️ Creating compressed archive...${NC}"
    cd $BACKUP_DIR
    tar -czf "$BACKUP_NAME.tar.gz" "$BACKUP_NAME"
    rm -rf "$BACKUP_NAME"
    
    BACKUP_SIZE=$(du -h "$BACKUP_NAME.tar.gz" | cut -f1)
    
    log "Full backup completed: $BACKUP_NAME.tar.gz ($BACKUP_SIZE)"
    
    # 7. Upload to remote storage (if configured)
    if [ -n "$S3_BUCKET" ] && command -v aws &> /dev/null; then
        echo -e "${BLUE}☁️ Uploading to S3...${NC}"
        aws s3 cp "$BACKUP_NAME.tar.gz" "s3://$S3_BUCKET/observatory-backups/"
        log "Backup uploaded to S3: s3://$S3_BUCKET/observatory-backups/$BACKUP_NAME.tar.gz"
    fi
    
    if [ -n "$REMOTE_BACKUP_DIR" ]; then
        echo -e "${BLUE}📤 Copying to remote location...${NC}"
        cp "$BACKUP_NAME.tar.gz" "$REMOTE_BACKUP_DIR/"
        log "Backup copied to remote location: $REMOTE_BACKUP_DIR/$BACKUP_NAME.tar.gz"
    fi
    
    echo -e "${GREEN}✅ Full backup completed successfully${NC}"
    echo "Backup file: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
    echo "Size: $BACKUP_SIZE"
}

# Function to restore from backup
restore_from_backup() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        echo -e "${RED}❌ Backup file not specified${NC}"
        echo "Usage: $0 restore /path/to/backup.tar.gz"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}❌ Backup file not found: $backup_file${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}🔄 Restoring from backup: $backup_file${NC}"
    log "Starting restore from: $backup_file"
    
    # Create temporary restore directory
    RESTORE_DIR="/tmp/observatory_restore_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$RESTORE_DIR"
    
    # Extract backup
    echo -e "${BLUE}📦 Extracting backup...${NC}"
    cd "$RESTORE_DIR"
    tar -xzf "$backup_file"
    
    # Find the backup directory
    BACKUP_CONTENT_DIR=$(find . -maxdepth 1 -type d -name "observatory_full_backup_*" | head -1)
    
    if [ -z "$BACKUP_CONTENT_DIR" ]; then
        echo -e "${RED}❌ Invalid backup format${NC}"
        exit 1
    fi
    
    cd "$BACKUP_CONTENT_DIR"
    
    # Verify backup integrity
    echo -e "${BLUE}🔍 Verifying backup integrity...${NC}"
    if [ ! -f "manifest.json" ]; then
        echo -e "${YELLOW}⚠️ Backup manifest not found, proceeding anyway${NC}"
    else
        echo -e "${GREEN}✅ Backup manifest found${NC}"
    fi
    
    # Stop current services
    echo -e "${YELLOW}🛑 Stopping current services...${NC}"
    docker-compose -f "$DOCKER_COMPOSE_FILE" down
    
    # Restore database
    if [ -d "database" ]; then
        echo -e "${BLUE}📊 Restoring database...${NC}"
        
        # Start only database service
        docker-compose -f "$DOCKER_COMPOSE_FILE" up -d mongodb
        sleep 10
        
        # Copy database backup to container
        docker cp "database" observatory-db:/backup/restore_db
        
        # Restore database
        docker exec observatory-db mongorestore \
            --authenticationDatabase admin \
            -u $MONGO_ROOT_USER \
            -p $MONGO_ROOT_PASSWORD \
            --db $MONGO_DB_NAME \
            --drop \
            "/backup/restore_db/$MONGO_DB_NAME"
        
        log "Database restored successfully"
    fi
    
    # Restore configuration files
    if [ -d "config" ]; then
        echo -e "${BLUE}⚙️ Restoring configuration files...${NC}"
        
        # Backup current configs
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
        
        # Restore configs
        cp config/*.env . 2>/dev/null || true
        cp config/*.yml . 2>/dev/null || true
        cp config/*.conf . 2>/dev/null || true
        
        # Restore SSL certificates
        if [ -d "config/ssl" ]; then
            sudo mkdir -p /etc/ssl/observatory
            sudo cp -r config/ssl/* /etc/ssl/observatory/
        fi
        
        log "Configuration files restored"
    fi
    
    # Restore Docker volumes
    if [ -d "volumes" ]; then
        echo -e "${BLUE}🐳 Restoring Docker volumes...${NC}"
        
        # Restore uploads
        if [ -f "volumes/uploads.tar.gz" ]; then
            docker volume create observatory-uploads 2>/dev/null || true
            docker run --rm -v observatory-uploads:/data -v "$PWD/volumes":/backup \
                busybox tar -xzf /backup/uploads.tar.gz -C /data
        fi
        
        # Restore logs
        if [ -f "volumes/logs.tar.gz" ]; then
            docker volume create observatory-logs 2>/dev/null || true
            docker run --rm -v observatory-logs:/data -v "$PWD/volumes":/backup \
                busybox tar -xzf /backup/logs.tar.gz -C /data
        fi
        
        log "Docker volumes restored"
    fi
    
    # Start all services
    echo -e "${BLUE}🚀 Starting all services...${NC}"
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    
    # Wait for services to be ready
    echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
    sleep 30
    
    # Verify restoration
    echo -e "${BLUE}🔍 Verifying restoration...${NC}"
    if curl -f http://localhost:30001/api/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend service is running${NC}"
    else
        echo -e "${RED}❌ Backend service failed to start${NC}"
    fi
    
    if curl -f http://localhost:30002 >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend service is running${NC}"
    else
        echo -e "${RED}❌ Frontend service failed to start${NC}"
    fi
    
    # Cleanup
    rm -rf "$RESTORE_DIR"
    
    log "Restore completed successfully"
    echo -e "${GREEN}✅ Restore completed successfully${NC}"
}

# Function to create database-only backup
create_db_backup() {
    echo -e "${YELLOW}📊 Creating database backup...${NC}"
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    DB_BACKUP_NAME="observatory_db_backup_$TIMESTAMP"
    
    # Create MongoDB dump
    docker exec observatory-db mongodump \
        --authenticationDatabase admin \
        -u $MONGO_ROOT_USER \
        -p $MONGO_ROOT_PASSWORD \
        --db $MONGO_DB_NAME \
        --out "/backup/$DB_BACKUP_NAME"
    
    # Compress the backup
    docker exec observatory-db tar -czf "/backup/$DB_BACKUP_NAME.tar.gz" -C "/backup" "$DB_BACKUP_NAME"
    
    # Copy to host
    docker cp "observatory-db:/backup/$DB_BACKUP_NAME.tar.gz" "$BACKUP_DIR/"
    
    # Clean up container backup
    docker exec observatory-db rm -rf "/backup/$DB_BACKUP_NAME" "/backup/$DB_BACKUP_NAME.tar.gz"
    
    log "Database backup created: $DB_BACKUP_NAME.tar.gz"
    echo -e "${GREEN}✅ Database backup completed${NC}"
}

# Function to verify backup integrity
verify_backup() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        echo -e "${RED}❌ Backup file not specified${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}🔍 Verifying backup: $backup_file${NC}"
    
    # Check if file exists
    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}❌ Backup file not found${NC}"
        exit 1
    fi
    
    # Check if file is valid tar.gz
    if ! tar -tzf "$backup_file" >/dev/null 2>&1; then
        echo -e "${RED}❌ Invalid backup file format${NC}"
        exit 1
    fi
    
    # Extract and verify contents
    TEMP_DIR="/tmp/backup_verify_$$"
    mkdir -p "$TEMP_DIR"
    
    cd "$TEMP_DIR"
    tar -xzf "$backup_file"
    
    # Check for expected directories
    BACKUP_DIR_NAME=$(find . -maxdepth 1 -type d -name "observatory_full_backup_*" | head -1)
    
    if [ -n "$BACKUP_DIR_NAME" ]; then
        cd "$BACKUP_DIR_NAME"
        
        # Check manifest
        if [ -f "manifest.json" ]; then
            echo -e "${GREEN}✅ Manifest file found${NC}"
            
            # Verify checksums if available
            if command -v jq &> /dev/null; then
                DB_CHECKSUM=$(jq -r '.checksums.database' manifest.json)
                APP_CHECKSUM=$(jq -r '.checksums.application' manifest.json)
                
                if [ "$DB_CHECKSUM" != "null" ] && [ -d "database" ]; then
                    CURRENT_DB_CHECKSUM=$(find database -type f -exec md5sum {} \; | md5sum | cut -d' ' -f1)
                    if [ "$DB_CHECKSUM" = "$CURRENT_DB_CHECKSUM" ]; then
                        echo -e "${GREEN}✅ Database checksum verified${NC}"
                    else
                        echo -e "${RED}❌ Database checksum mismatch${NC}"
                    fi
                fi
                
                if [ "$APP_CHECKSUM" != "null" ] && [ -f "application.tar.gz" ]; then
                    CURRENT_APP_CHECKSUM=$(md5sum application.tar.gz | cut -d' ' -f1)
                    if [ "$APP_CHECKSUM" = "$CURRENT_APP_CHECKSUM" ]; then
                        echo -e "${GREEN}✅ Application checksum verified${NC}"
                    else
                        echo -e "${RED}❌ Application checksum mismatch${NC}"
                    fi
                fi
            fi
        fi
        
        # Check components
        [ -d "database" ] && echo -e "${GREEN}✅ Database backup present${NC}" || echo -e "${YELLOW}⚠️ Database backup missing${NC}"
        [ -f "application.tar.gz" ] && echo -e "${GREEN}✅ Application backup present${NC}" || echo -e "${YELLOW}⚠️ Application backup missing${NC}"
        [ -d "config" ] && echo -e "${GREEN}✅ Configuration backup present${NC}" || echo -e "${YELLOW}⚠️ Configuration backup missing${NC}"
        [ -d "volumes" ] && echo -e "${GREEN}✅ Volumes backup present${NC}" || echo -e "${YELLOW}⚠️ Volumes backup missing${NC}"
    else
        echo -e "${RED}❌ Invalid backup structure${NC}"
    fi
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    echo -e "${GREEN}✅ Backup verification completed${NC}"
}

# Function to list available backups
list_backups() {
    echo -e "${YELLOW}📋 Available backups:${NC}"
    echo ""
    
    if [ -d "$BACKUP_DIR" ]; then
        for backup in "$BACKUP_DIR"/*.tar.gz; do
            if [ -f "$backup" ]; then
                SIZE=$(du -h "$backup" | cut -f1)
                DATE=$(stat -c %y "$backup" 2>/dev/null || stat -f %Sm "$backup" 2>/dev/null)
                echo "$(basename "$backup") - $SIZE - $DATE"
            fi
        done
    else
        echo -e "${YELLOW}No backup directory found${NC}"
    fi
    
    # Check S3 backups if configured
    if [ -n "$S3_BUCKET" ] && command -v aws &> /dev/null; then
        echo ""
        echo -e "${YELLOW}S3 backups:${NC}"
        aws s3 ls "s3://$S3_BUCKET/observatory-backups/" 2>/dev/null || echo "No S3 backups found"
    fi
}

# Main function
main() {
    case "${1:-help}" in
        "backup"|"full-backup")
            create_full_backup
            ;;
        "db-backup")
            create_db_backup
            ;;
        "restore")
            restore_from_backup "$2"
            ;;
        "verify")
            verify_backup "$2"
            ;;
        "list")
            list_backups
            ;;
        "help"|*)
            echo "Observatory Booking App - Disaster Recovery Script"
            echo "Usage: $0 {backup|db-backup|restore|verify|list}"
            echo ""
            echo "Commands:"
            echo "  backup                - Create full system backup"
            echo "  db-backup            - Create database-only backup"
            echo "  restore <file>       - Restore from backup file"
            echo "  verify <file>        - Verify backup integrity"
            echo "  list                 - List available backups"
            echo ""
            echo "Environment variables:"
            echo "  S3_BUCKET           - S3 bucket for remote backups"
            echo "  REMOTE_BACKUP_DIR   - Remote directory for backups"
            echo "  MONGO_ROOT_USER     - MongoDB root username"
            echo "  MONGO_ROOT_PASSWORD - MongoDB root password"
            ;;
    esac
}

# Run main function with all arguments
main "$@"
