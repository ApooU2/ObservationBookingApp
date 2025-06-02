#!/bin/bash

# Observatory Booking App - Production Monitoring & Backup Script
# This script provides monitoring, backup, and maintenance functions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="/var/backups/observatory"
LOG_DIR="/var/log/observatory-booking"
MAX_BACKUPS=7
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR
mkdir -p $LOG_DIR

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_DIR/maintenance.log
}

# Function to check service health
check_health() {
    echo -e "${BLUE}🏥 Checking application health...${NC}"
    
    # Check if containers are running
    if ! docker-compose -f $DOCKER_COMPOSE_FILE ps | grep -q "Up"; then
        echo -e "${RED}❌ Some containers are not running${NC}"
        docker-compose -f $DOCKER_COMPOSE_FILE ps
        return 1
    fi
    
    # Check backend health endpoint
    if curl -f -s http://localhost:30001/api/auth/health > /dev/null; then
        echo -e "${GREEN}✅ Backend is healthy${NC}"
    else
        echo -e "${RED}❌ Backend health check failed${NC}"
        return 1
    fi
    
    # Check frontend
    if curl -f -s http://localhost:30002 > /dev/null; then
        echo -e "${GREEN}✅ Frontend is accessible${NC}"
    else
        echo -e "${RED}❌ Frontend is not accessible${NC}"
        return 1
    fi
    
    # Check database connectivity
    if docker exec observatory-db mongosh --eval "db.adminCommand('ismaster')" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database is accessible${NC}"
    else
        echo -e "${RED}❌ Database connection failed${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ All health checks passed${NC}"
    return 0
}

# Function to backup database
backup_database() {
    echo -e "${BLUE}💾 Starting database backup...${NC}"
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/mongodb_backup_$TIMESTAMP.tar.gz"
    
    # Create MongoDB dump
    docker exec observatory-db mongodump --authenticationDatabase admin -u ${MONGO_ROOT_USER:-admin} -p ${MONGO_ROOT_PASSWORD:-password} --out /backup/dump_$TIMESTAMP
    
    # Compress the backup
    docker exec observatory-db tar -czf /backup/mongodb_backup_$TIMESTAMP.tar.gz -C /backup dump_$TIMESTAMP
    
    # Remove uncompressed dump
    docker exec observatory-db rm -rf /backup/dump_$TIMESTAMP
    
    log "Database backup created: $BACKUP_FILE"
    echo -e "${GREEN}✅ Database backup completed${NC}"
    
    # Clean up old backups
    cleanup_old_backups
}

# Function to clean up old backups
cleanup_old_backups() {
    echo -e "${YELLOW}🧹 Cleaning up old backups...${NC}"
    
    # Keep only the last MAX_BACKUPS files
    cd $BACKUP_DIR
    ls -t mongodb_backup_*.tar.gz 2>/dev/null | tail -n +$(($MAX_BACKUPS + 1)) | xargs -r rm -f
    
    log "Old backups cleaned up, keeping last $MAX_BACKUPS backups"
}

# Function to monitor disk usage
check_disk_usage() {
    echo -e "${BLUE}💾 Checking disk usage...${NC}"
    
    DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ $DISK_USAGE -gt 80 ]; then
        echo -e "${RED}⚠️ Disk usage is high: ${DISK_USAGE}%${NC}"
        log "WARNING: High disk usage detected: ${DISK_USAGE}%"
        
        # Clean up Docker images and volumes
        echo "Cleaning up Docker resources..."
        docker system prune -f
        docker volume prune -f
        
    elif [ $DISK_USAGE -gt 70 ]; then
        echo -e "${YELLOW}⚠️ Disk usage is moderate: ${DISK_USAGE}%${NC}"
        log "INFO: Moderate disk usage: ${DISK_USAGE}%"
    else
        echo -e "${GREEN}✅ Disk usage is normal: ${DISK_USAGE}%${NC}"
    fi
}

# Function to monitor memory usage
check_memory_usage() {
    echo -e "${BLUE}🧠 Checking memory usage...${NC}"
    
    MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
    
    if [ $MEMORY_USAGE -gt 90 ]; then
        echo -e "${RED}⚠️ Memory usage is critical: ${MEMORY_USAGE}%${NC}"
        log "WARNING: Critical memory usage: ${MEMORY_USAGE}%"
    elif [ $MEMORY_USAGE -gt 80 ]; then
        echo -e "${YELLOW}⚠️ Memory usage is high: ${MEMORY_USAGE}%${NC}"
        log "INFO: High memory usage: ${MEMORY_USAGE}%"
    else
        echo -e "${GREEN}✅ Memory usage is normal: ${MEMORY_USAGE}%${NC}"
    fi
}

# Function to update SSL certificates
update_ssl() {
    echo -e "${BLUE}🔒 Updating SSL certificates...${NC}"
    
    # This would typically use Let's Encrypt
    # certbot renew --nginx
    
    # For now, just check certificate expiration
    CERT_FILE="/etc/letsencrypt/live/yourdomain.com/fullchain.pem"
    if [ -f "$CERT_FILE" ]; then
        EXPIRY_DATE=$(openssl x509 -enddate -noout -in "$CERT_FILE" | cut -d= -f2)
        EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
        CURRENT_EPOCH=$(date +%s)
        DAYS_UNTIL_EXPIRY=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))
        
        if [ $DAYS_UNTIL_EXPIRY -lt 30 ]; then
            echo -e "${YELLOW}⚠️ SSL certificate expires in $DAYS_UNTIL_EXPIRY days${NC}"
            log "WARNING: SSL certificate expires in $DAYS_UNTIL_EXPIRY days"
        else
            echo -e "${GREEN}✅ SSL certificate is valid for $DAYS_UNTIL_EXPIRY days${NC}"
        fi
    else
        echo -e "${RED}❌ SSL certificate not found${NC}"
    fi
}

# Function to restart services
restart_services() {
    echo -e "${BLUE}🔄 Restarting services...${NC}"
    
    docker-compose -f $DOCKER_COMPOSE_FILE restart
    
    # Wait for services to come back up
    sleep 30
    
    if check_health; then
        echo -e "${GREEN}✅ Services restarted successfully${NC}"
        log "Services restarted successfully"
    else
        echo -e "${RED}❌ Service restart failed${NC}"
        log "ERROR: Service restart failed"
        exit 1
    fi
}

# Function to show logs
show_logs() {
    echo -e "${BLUE}📋 Showing recent logs...${NC}"
    
    echo "=== Application Logs ==="
    docker-compose -f $DOCKER_COMPOSE_FILE logs --tail=50 backend
    
    echo "=== Nginx Logs ==="
    docker-compose -f $DOCKER_COMPOSE_FILE logs --tail=20 nginx
}

# Function to show system stats
show_stats() {
    echo -e "${BLUE}📊 System Statistics${NC}"
    echo "======================"
    
    echo "Uptime: $(uptime)"
    echo "Load Average: $(uptime | awk -F'load average:' '{print $2}')"
    echo "Memory Usage: $(free -h | grep Mem)"
    echo "Disk Usage: $(df -h / | tail -1)"
    echo ""
    
    echo "Docker Container Status:"
    docker-compose -f $DOCKER_COMPOSE_FILE ps
    echo ""
    
    echo "Database Statistics:"
    docker exec observatory-db mongosh --eval "
        db.adminCommand('serverStatus').connections;
        db.stats();
        db.bookings.countDocuments();
    " 2>/dev/null || echo "Database connection failed"
}

# Main function
main() {
    case "${1:-help}" in
        "health")
            check_health
            ;;
        "backup")
            backup_database
            ;;
        "monitor")
            check_health
            check_disk_usage
            check_memory_usage
            update_ssl
            ;;
        "restart")
            restart_services
            ;;
        "logs")
            show_logs
            ;;
        "stats")
            show_stats
            ;;
        "full-maintenance")
            echo -e "${BLUE}🔧 Running full maintenance...${NC}"
            check_health
            check_disk_usage
            check_memory_usage
            backup_database
            update_ssl
            echo -e "${GREEN}✅ Full maintenance completed${NC}"
            ;;
        "help"|*)
            echo "Observatory Booking App - Production Maintenance Script"
            echo "Usage: $0 {health|backup|monitor|restart|logs|stats|full-maintenance}"
            echo ""
            echo "Commands:"
            echo "  health           - Check application health"
            echo "  backup           - Backup database"
            echo "  monitor          - Run all monitoring checks"
            echo "  restart          - Restart all services"
            echo "  logs             - Show recent logs"
            echo "  stats            - Show system statistics"
            echo "  full-maintenance - Run complete maintenance cycle"
            ;;
    esac
}

# Run main function with all arguments
main "$@"
