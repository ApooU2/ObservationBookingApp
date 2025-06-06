# 🔒 Observatory Booking App - Production Security Checklist

## Pre-Deployment Security Setup

### 1. Environment Configuration ✅
- [ ] Update `.env.production` with secure secrets
- [ ] Generate strong JWT secrets (minimum 32 characters)
- [ ] Configure production database credentials
- [ ] Set up production email service (SendGrid/SES)
- [ ] Configure proper CORS origins
- [ ] Set secure session secrets

### 2. Database Security ✅
- [ ] Enable MongoDB authentication
- [ ] Create dedicated application user (not root)
- [ ] Configure network access restrictions
- [ ] Enable MongoDB audit logging
- [ ] Set up regular automated backups
- [ ] Configure backup encryption

### 3. SSL/TLS Configuration ✅
- [ ] Obtain SSL certificates (Let's Encrypt recommended)
- [ ] Configure HTTPS redirects
- [ ] Enable HSTS headers
- [ ] Set secure SSL ciphers
- [ ] Disable deprecated TLS versions

### 4. Network Security ✅
- [ ] Configure firewall rules (UFW/iptables)
- [ ] Restrict database access to application only
- [ ] Set up VPN for admin access
- [ ] Configure rate limiting
- [ ] Enable DDoS protection (Cloudflare)

### 5. Application Security ✅
- [ ] Enable Helmet.js security headers
- [ ] Configure Content Security Policy
- [ ] Set up input validation and sanitization
- [ ] Enable API rate limiting
- [ ] Implement proper error handling
- [ ] Remove debug information from production

### 6. Container Security ✅
- [ ] Use non-root users in containers
- [ ] Scan images for vulnerabilities
- [ ] Configure resource limits
- [ ] Enable container logging
- [ ] Set up health checks

### 7. Monitoring & Logging ✅
- [ ] Set up application monitoring (PM2/DataDog)
- [ ] Configure error tracking (Sentry)
- [ ] Enable access logs
- [ ] Set up alerting for critical issues
- [ ] Configure log rotation

### 8. Backup & Recovery ✅
- [ ] Automated database backups
- [ ] Test restore procedures
- [ ] Offsite backup storage
- [ ] Document recovery procedures
- [ ] Set backup retention policies

## Production Deployment Commands

### Initial Setup
```bash
# 1. Copy and configure environment
cp .env.production .env
# Edit .env with your production values

# 2. Run security setup
sudo ./setup-production-security.sh

# 3. Deploy application
sudo ./deploy-production.sh

# 4. Set up monitoring
sudo ./production-maintenance.sh monitor
```

### SSL Certificate Setup (Let's Encrypt)
```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificates
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Set up auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

### Firewall Configuration
```bash
# Basic UFW setup
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

### MongoDB Security Setup
```bash
# Create application user
docker exec -it observatory-db mongosh admin
> db.createUser({
    user: "observatory_app",
    pwd: "secure_password_here",
    roles: [
      { role: "readWrite", db: "observatory-booking" }
    ]
  })
```

## Post-Deployment Verification

### Health Checks
```bash
# Run health checks
./production-maintenance.sh health

# Check all services
./production-maintenance.sh stats

# Monitor logs
./production-maintenance.sh logs
```

### Security Testing
```bash
# SSL/TLS testing
nmap --script ssl-enum-ciphers -p 443 yourdomain.com

# Security headers check
curl -I https://yourdomain.com

# Rate limiting test
for i in {1..20}; do curl https://yourdomain.com/api/auth/login; done
```

## Maintenance Schedule

### Daily (Automated)
- Health checks
- Log rotation
- Backup verification

### Weekly
- Full system backup
- Security updates
- Performance monitoring review

### Monthly
- SSL certificate renewal check
- Security audit
- Dependency updates
- Capacity planning review

## Emergency Procedures

### Service Down
```bash
# Check service status
./production-maintenance.sh health

# Restart services
./production-maintenance.sh restart

# Check logs for errors
./production-maintenance.sh logs
```

### Database Issues
```bash
# Database backup
./production-maintenance.sh backup

# Database restore (from backup)
docker exec -i observatory-db mongorestore --drop --authenticationDatabase admin -u admin -p password /backup/latest_backup
```

### Security Incident
1. Immediately change all passwords and secrets
2. Review access logs for suspicious activity
3. Update security configurations
4. Notify users if data may be compromised
5. Document incident and response

## Monitoring Endpoints

- **Application Health**: `https://yourdomain.com/api/auth/health`
- **Nginx Status**: `https://yourdomain.com/health`
- **Database Status**: Check via maintenance script

## Support Contacts

- **System Administrator**: admin@yourdomain.com
- **Database Administrator**: dba@yourdomain.com
- **Security Team**: security@yourdomain.com
- **Emergency Contact**: +1-XXX-XXX-XXXX
