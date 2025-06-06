#!/bin/bash

# Observatory Booking App - Production Deployment Script
# This script deploys the application to a production environment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN=${DOMAIN:-"yourdomain.com"}
SSL_EMAIL=${SSL_EMAIL:-"admin@yourdomain.com"}
ENV_FILE=${ENV_FILE:-".env.production"}

echo -e "${BLUE}🔭 Observatory Booking App - Production Deployment${NC}"
echo "=============================================="

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Environment file $ENV_FILE not found${NC}"
    echo "Please copy .env.production to .env and configure it"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Build production images
echo -e "${YELLOW}🏗️ Building production images...${NC}"

# Build backend
echo "Building backend..."
docker build -t observatory-backend:latest -f Dockerfile.backend .

# Build frontend
echo "Building frontend..."
docker build -t observatory-frontend:latest -f Dockerfile.frontend .

echo -e "${GREEN}✅ Images built successfully${NC}"

# Setup SSL certificates (Let's Encrypt)
echo -e "${YELLOW}🔒 Setting up SSL certificates...${NC}"

# Create necessary directories
sudo mkdir -p /etc/letsencrypt/live/$DOMAIN
sudo mkdir -p /var/log/observatory-booking
sudo mkdir -p /var/uploads/observatory

# Generate self-signed certificates for initial setup (replace with Let's Encrypt in production)
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "Generating temporary self-signed certificates..."
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
        -out /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"
    
    echo -e "${YELLOW}⚠️ Using self-signed certificates. Replace with Let's Encrypt in production!${NC}"
fi

# Deploy with Docker Compose
echo -e "${YELLOW}🚀 Deploying application...${NC}"

# Copy environment file
cp $ENV_FILE .env

# Start services
docker-compose -f docker-compose.prod.yml up -d

echo -e "${GREEN}✅ Application deployed successfully!${NC}"

# Health check
echo -e "${YELLOW}🏥 Performing health checks...${NC}"

sleep 10

# Check backend health
if curl -f http://localhost:30001/api/auth/health &> /dev/null; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
fi

# Check frontend
if curl -f http://localhost:30002 &> /dev/null; then
    echo -e "${GREEN}✅ Frontend is accessible${NC}"
else
    echo -e "${RED}❌ Frontend health check failed${NC}"
fi

# Display deployment information
echo ""
echo -e "${BLUE}🎉 Deployment Complete!${NC}"
echo "=============================================="
echo "Frontend URL: https://$DOMAIN"
echo "Backend API: https://$DOMAIN/api"
echo "Admin Panel: https://$DOMAIN/admin"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Configure DNS to point $DOMAIN to this server"
echo "2. Replace self-signed certificates with Let's Encrypt"
echo "3. Configure monitoring and backups"
echo "4. Setup log rotation"
echo "5. Test all functionality"
echo ""
echo -e "${GREEN}📊 View logs: docker-compose -f docker-compose.prod.yml logs -f${NC}"
echo -e "${GREEN}🔄 Restart: docker-compose -f docker-compose.prod.yml restart${NC}"
echo -e "${GREEN}🛑 Stop: docker-compose -f docker-compose.prod.yml down${NC}"
