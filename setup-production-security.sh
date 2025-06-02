#!/bin/bash

# Observatory Booking App - Production Security Setup Script
# This script configures security settings for production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔒 Observatory Booking App - Security Setup${NC}"
echo "=============================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ This script must be run as root${NC}"
    exit 1
fi

# Update system packages
echo -e "${YELLOW}📦 Updating system packages...${NC}"
apt-get update && apt-get upgrade -y

# Install security tools
echo -e "${YELLOW}🛠️ Installing security tools...${NC}"
apt-get install -y \
    ufw \
    fail2ban \
    logrotate \
    htop \
    iotop \
    unzip \
    curl \
    wget \
    gnupg \
    software-properties-common

# Configure UFW firewall
echo -e "${YELLOW}🔥 Configuring firewall...${NC}"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (be careful!)
ufw allow ssh
echo -e "${YELLOW}⚠️ SSH access is allowed. Make sure to secure SSH configuration!${NC}"

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Allow specific application ports (only from localhost)
ufw allow from 127.0.0.1 to any port 30001  # Backend
ufw allow from 127.0.0.1 to any port 30002  # Frontend
ufw allow from 127.0.0.1 to any port 27017  # MongoDB
ufw allow from 127.0.0.1 to any port 6379   # Redis

# Enable firewall
ufw --force enable

echo -e "${GREEN}✅ Firewall configured successfully${NC}"

# Configure fail2ban
echo -e "${YELLOW}🚫 Configuring fail2ban...${NC}"
cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 86400

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10

[nginx-botsearch]
enabled = true
filter = nginx-botsearch
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 2
EOF

# Create custom fail2ban filters
mkdir -p /etc/fail2ban/filter.d

cat > /etc/fail2ban/filter.d/nginx-botsearch.conf << EOF
[Definition]
failregex = ^<HOST> -.*"(GET|POST).*HTTP.*" (404|444) .*$
ignoreregex =
EOF

# Start and enable fail2ban
systemctl enable fail2ban
systemctl restart fail2ban

echo -e "${GREEN}✅ Fail2ban configured successfully${NC}"

# Configure log rotation
echo -e "${YELLOW}📝 Configuring log rotation...${NC}"
if [ ! -f /etc/logrotate.d/observatory-booking ]; then
    cp logrotate.conf /etc/logrotate.d/observatory-booking
    echo -e "${GREEN}✅ Log rotation configured${NC}"
else
    echo -e "${YELLOW}⚠️ Log rotation already configured${NC}"
fi

# Create backup directory with proper permissions
echo -e "${YELLOW}💾 Setting up backup directory...${NC}"
mkdir -p /var/backups/observatory
chmod 750 /var/backups/observatory
chown root:root /var/backups/observatory

# Create log directory
echo -e "${YELLOW}📋 Setting up log directory...${NC}"
mkdir -p /var/log/observatory-booking
chmod 755 /var/log/observatory-booking

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}🐳 Installing Docker...${NC}"
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Add current user to docker group
    usermod -aG docker $SUDO_USER || true
    
    echo -e "${GREEN}✅ Docker installed successfully${NC}"
else
    echo -e "${GREEN}✅ Docker is already installed${NC}"
fi

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Docker Compose...${NC}"
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✅ Docker Compose installed successfully${NC}"
else
    echo -e "${GREEN}✅ Docker Compose is already installed${NC}"
fi

# Configure SSH security (if SSH is being used)
echo -e "${YELLOW}🔐 Configuring SSH security...${NC}"
SSH_CONFIG="/etc/ssh/sshd_config"
if [ -f "$SSH_CONFIG" ]; then
    # Backup original config
    cp $SSH_CONFIG $SSH_CONFIG.backup
    
    # Configure SSH security settings
    sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' $SSH_CONFIG
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' $SSH_CONFIG
    sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' $SSH_CONFIG
    sed -i 's/#Protocol 2/Protocol 2/' $SSH_CONFIG
    
    # Add additional security settings
    echo "" >> $SSH_CONFIG
    echo "# Additional security settings" >> $SSH_CONFIG
    echo "MaxAuthTries 3" >> $SSH_CONFIG
    echo "ClientAliveInterval 300" >> $SSH_CONFIG
    echo "ClientAliveCountMax 0" >> $SSH_CONFIG
    echo "AllowUsers $SUDO_USER" >> $SSH_CONFIG
    
    # Restart SSH service
    systemctl restart sshd
    echo -e "${GREEN}✅ SSH security configured${NC}"
else
    echo -e "${YELLOW}⚠️ SSH not found, skipping SSH configuration${NC}"
fi

# Set up system monitoring
echo -e "${YELLOW}📊 Setting up system monitoring...${NC}"

# Create monitoring script
cat > /usr/local/bin/observatory-monitor << 'EOF'
#!/bin/bash

# Observatory system monitoring script
LOG_FILE="/var/log/observatory-booking/monitor.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Function to log messages
log_message() {
    echo "[$TIMESTAMP] $1" >> $LOG_FILE
}

# Check disk usage
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 90 ]; then
    log_message "CRITICAL: Disk usage is $DISK_USAGE%"
elif [ $DISK_USAGE -gt 80 ]; then
    log_message "WARNING: Disk usage is $DISK_USAGE%"
fi

# Check memory usage
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ $MEMORY_USAGE -gt 90 ]; then
    log_message "CRITICAL: Memory usage is $MEMORY_USAGE%"
elif [ $MEMORY_USAGE -gt 80 ]; then
    log_message "WARNING: Memory usage is $MEMORY_USAGE%"
fi

# Check load average
LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
if (( $(echo "$LOAD_AVG > 4.0" | bc -l) )); then
    log_message "WARNING: High load average: $LOAD_AVG"
fi

# Check if Docker services are running
if ! docker-compose -f /opt/observatory-booking/docker-compose.prod.yml ps | grep -q "Up"; then
    log_message "CRITICAL: Some Docker services are down"
fi
EOF

chmod +x /usr/local/bin/observatory-monitor

# Set up cron job for monitoring
echo -e "${YELLOW}⏰ Setting up monitoring cron job...${NC}"
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/observatory-monitor") | crontab -

# Create SSL certificate directory
echo -e "${YELLOW}🔒 Setting up SSL certificate directory...${NC}"
mkdir -p /etc/ssl/observatory
chmod 700 /etc/ssl/observatory

# Generate self-signed certificate for development
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/observatory/private.key \
    -out /etc/ssl/observatory/certificate.crt \
    -subj "/C=US/ST=State/L=City/O=Observatory/OU=IT/CN=localhost"

chmod 600 /etc/ssl/observatory/private.key
chmod 644 /etc/ssl/observatory/certificate.crt

echo -e "${GREEN}✅ Self-signed SSL certificate generated${NC}"

# Set up automatic security updates
echo -e "${YELLOW}🔄 Configuring automatic security updates...${NC}"
apt-get install -y unattended-upgrades
echo 'Unattended-Upgrade::Automatic-Reboot "false";' >> /etc/apt/apt.conf.d/50unattended-upgrades

# Create system status script
cat > /usr/local/bin/observatory-status << 'EOF'
#!/bin/bash

echo "Observatory Booking App - System Status"
echo "========================================"
echo "Date: $(date)"
echo "Uptime: $(uptime)"
echo ""

echo "Disk Usage:"
df -h / | tail -1
echo ""

echo "Memory Usage:"
free -h
echo ""

echo "Docker Services:"
docker-compose -f /opt/observatory-booking/docker-compose.prod.yml ps 2>/dev/null || echo "Docker services not found"
echo ""

echo "Network Connections:"
ss -tuln | grep -E ':(80|443|30001|30002|27017|6379)'
echo ""

echo "Security Status:"
ufw status
echo ""

echo "Recent Security Events:"
tail -5 /var/log/fail2ban.log 2>/dev/null || echo "No fail2ban logs found"
EOF

chmod +x /usr/local/bin/observatory-status

echo ""
echo -e "${GREEN}🎉 Security setup completed successfully!${NC}"
echo "=============================================="
echo ""
echo -e "${YELLOW}📋 Security Summary:${NC}"
echo "✅ Firewall (UFW) configured and enabled"
echo "✅ Fail2ban configured for intrusion prevention"
echo "✅ Log rotation configured"
echo "✅ SSH security hardened"
echo "✅ Docker and Docker Compose installed"
echo "✅ System monitoring configured"
echo "✅ SSL certificates generated"
echo "✅ Automatic security updates enabled"
echo ""
echo -e "${YELLOW}🔑 Next Steps:${NC}"
echo "1. Review and test firewall rules"
echo "2. Set up proper SSL certificates (Let's Encrypt)"
echo "3. Configure backup encryption keys"
echo "4. Test fail2ban rules"
echo "5. Set up monitoring alerts"
echo ""
echo -e "${BLUE}📊 Check system status: /usr/local/bin/observatory-status${NC}"
echo -e "${BLUE}🔍 Monitor system: /usr/local/bin/observatory-monitor${NC}"
