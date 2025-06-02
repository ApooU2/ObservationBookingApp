#!/bin/bash

# Observatory Booking App - Production Deployment Testing Script
# This script tests the production deployment thoroughly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN=${DOMAIN:-"localhost"}
BACKEND_PORT=${BACKEND_PORT:-"30001"}
FRONTEND_PORT=${FRONTEND_PORT:-"30002"}
TEST_EMAIL=${TEST_EMAIL:-"test@example.com"}
TEST_PASSWORD=${TEST_PASSWORD:-"testpass123"}

echo -e "${BLUE}🧪 Observatory Booking App - Production Deployment Testing${NC}"
echo "=================================================================="

# Function to test HTTP endpoint
test_endpoint() {
    local url=$1
    local expected_status=${2:-200}
    local description=$3
    
    echo -n "Testing $description... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$response" -eq "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (HTTP $response, expected $expected_status)"
        return 1
    fi
}

# Function to test JSON endpoint
test_json_endpoint() {
    local url=$1
    local description=$2
    local auth_header=${3:-""}
    
    echo -n "Testing $description... "
    
    if [ -n "$auth_header" ]; then
        response=$(curl -s -H "$auth_header" -H "Content-Type: application/json" "$url" 2>/dev/null)
    else
        response=$(curl -s -H "Content-Type: application/json" "$url" 2>/dev/null)
    fi
    
    if echo "$response" | jq . >/dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC} (Valid JSON response)"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (Invalid JSON response)"
        echo "Response: $response"
        return 1
    fi
}

# Function to test authentication
test_authentication() {
    echo -e "${YELLOW}🔐 Testing Authentication...${NC}"
    
    # Test user registration
    echo -n "Testing user registration... "
    register_response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"Test User\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
        "http://$DOMAIN:$BACKEND_PORT/api/auth/register" 2>/dev/null)
    
    if echo "$register_response" | jq -r '.token' >/dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        
        # Extract token for further tests
        TOKEN=$(echo "$register_response" | jq -r '.token')
        
        # Test user login
        echo -n "Testing user login... "
        login_response=$(curl -s -X POST \
            -H "Content-Type: application/json" \
            -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
            "http://$DOMAIN:$BACKEND_PORT/api/auth/login" 2>/dev/null)
        
        if echo "$login_response" | jq -r '.token' >/dev/null 2>&1; then
            echo -e "${GREEN}✅ PASS${NC}"
            TOKEN=$(echo "$login_response" | jq -r '.token')
        else
            echo -e "${RED}❌ FAIL${NC}"
            echo "Login response: $login_response"
        fi
        
    else
        echo -e "${RED}❌ FAIL${NC}"
        echo "Registration response: $register_response"
        
        # Try to login with existing credentials
        echo -n "Testing login with existing credentials... "
        login_response=$(curl -s -X POST \
            -H "Content-Type: application/json" \
            -d "{\"email\":\"admin@observatory.com\",\"password\":\"admin123\"}" \
            "http://$DOMAIN:$BACKEND_PORT/api/auth/login" 2>/dev/null)
        
        if echo "$login_response" | jq -r '.token' >/dev/null 2>&1; then
            echo -e "${GREEN}✅ PASS${NC}"
            TOKEN=$(echo "$login_response" | jq -r '.token')
        else
            echo -e "${RED}❌ FAIL${NC}"
            echo "Admin login response: $login_response"
        fi
    fi
}

# Function to test API endpoints
test_api_endpoints() {
    echo -e "${YELLOW}🔌 Testing API Endpoints...${NC}"
    
    # Health checks
    test_endpoint "http://$DOMAIN:$BACKEND_PORT/api/health" 200 "Backend health check"
    test_endpoint "http://$DOMAIN:$BACKEND_PORT/api/auth/health" 200 "Auth health check"
    
    # Telescopes endpoint
    test_json_endpoint "http://$DOMAIN:$BACKEND_PORT/api/telescopes" "Telescopes list"
    
    if [ -n "$TOKEN" ]; then
        # Protected endpoints
        test_json_endpoint "http://$DOMAIN:$BACKEND_PORT/api/users/profile" "User profile" "Authorization: Bearer $TOKEN"
        test_json_endpoint "http://$DOMAIN:$BACKEND_PORT/api/bookings" "User bookings" "Authorization: Bearer $TOKEN"
    else
        echo -e "${YELLOW}⚠️ Skipping protected endpoint tests (no auth token)${NC}"
    fi
}

# Function to test frontend
test_frontend() {
    echo -e "${YELLOW}🌐 Testing Frontend...${NC}"
    
    test_endpoint "http://$DOMAIN:$FRONTEND_PORT" 200 "Frontend homepage"
    test_endpoint "http://$DOMAIN:$FRONTEND_PORT/static/css/main.css" 200 "Frontend CSS" || true
    test_endpoint "http://$DOMAIN:$FRONTEND_PORT/static/js/main.js" 200 "Frontend JavaScript" || true
}

# Function to test database
test_database() {
    echo -e "${YELLOW}🗄️ Testing Database...${NC}"
    
    if command -v docker &> /dev/null; then
        echo -n "Testing MongoDB connection... "
        if docker exec observatory-db mongosh --eval "db.adminCommand('ismaster')" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ PASS${NC}"
            
            echo -n "Testing database collections... "
            collections=$(docker exec observatory-db mongosh observatory-booking --eval "db.getCollectionNames()" --quiet 2>/dev/null)
            if echo "$collections" | grep -q "bookings\|telescopes\|users"; then
                echo -e "${GREEN}✅ PASS${NC}"
            else
                echo -e "${RED}❌ FAIL${NC}"
            fi
        else
            echo -e "${RED}❌ FAIL${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ Docker not available, skipping database tests${NC}"
    fi
}

# Function to test security
test_security() {
    echo -e "${YELLOW}🔒 Testing Security...${NC}"
    
    # Test rate limiting
    echo -n "Testing rate limiting... "
    rate_limit_test=0
    for i in {1..25}; do
        response=$(curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN:$BACKEND_PORT/api/telescopes" 2>/dev/null)
        if [ "$response" -eq "429" ]; then
            rate_limit_test=1
            break
        fi
        sleep 0.1
    done
    
    if [ $rate_limit_test -eq 1 ]; then
        echo -e "${GREEN}✅ PASS${NC} (Rate limiting active)"
    else
        echo -e "${YELLOW}⚠️ PARTIAL${NC} (Rate limiting not triggered in test)"
    fi
    
    # Test security headers
    echo -n "Testing security headers... "
    headers=$(curl -s -I "http://$DOMAIN:$BACKEND_PORT/api/health" 2>/dev/null)
    
    security_headers=("X-Frame-Options" "X-XSS-Protection" "X-Content-Type-Options")
    headers_found=0
    
    for header in "${security_headers[@]}"; do
        if echo "$headers" | grep -qi "$header"; then
            headers_found=$((headers_found + 1))
        fi
    done
    
    if [ $headers_found -ge 2 ]; then
        echo -e "${GREEN}✅ PASS${NC} ($headers_found/3 security headers found)"
    else
        echo -e "${YELLOW}⚠️ PARTIAL${NC} ($headers_found/3 security headers found)"
    fi
}

# Function to test performance
test_performance() {
    echo -e "${YELLOW}⚡ Testing Performance...${NC}"
    
    echo -n "Testing response time... "
    response_time=$(curl -s -o /dev/null -w "%{time_total}" "http://$DOMAIN:$BACKEND_PORT/api/health" 2>/dev/null)
    
    # Convert to milliseconds
    response_time_ms=$(echo "$response_time * 1000" | bc -l)
    response_time_int=${response_time_ms%.*}
    
    if [ "$response_time_int" -lt 1000 ]; then
        echo -e "${GREEN}✅ PASS${NC} (${response_time_int}ms)"
    elif [ "$response_time_int" -lt 3000 ]; then
        echo -e "${YELLOW}⚠️ SLOW${NC} (${response_time_int}ms)"
    else
        echo -e "${RED}❌ FAIL${NC} (${response_time_int}ms - too slow)"
    fi
    
    # Test concurrent requests
    echo -n "Testing concurrent requests... "
    start_time=$(date +%s)
    
    for i in {1..10}; do
        curl -s "http://$DOMAIN:$BACKEND_PORT/api/health" >/dev/null &
    done
    wait
    
    end_time=$(date +%s)
    total_time=$((end_time - start_time))
    
    if [ "$total_time" -lt 5 ]; then
        echo -e "${GREEN}✅ PASS${NC} (${total_time}s for 10 concurrent requests)"
    else
        echo -e "${YELLOW}⚠️ SLOW${NC} (${total_time}s for 10 concurrent requests)"
    fi
}

# Function to test monitoring
test_monitoring() {
    echo -e "${YELLOW}📊 Testing Monitoring...${NC}"
    
    if [ -n "$TOKEN" ]; then
        # Try to access metrics endpoint
        echo -n "Testing metrics endpoint... "
        metrics_response=$(curl -s -H "Authorization: Bearer $TOKEN" \
            "http://$DOMAIN:$BACKEND_PORT/api/metrics" 2>/dev/null)
        
        if echo "$metrics_response" | jq . >/dev/null 2>&1; then
            echo -e "${GREEN}✅ PASS${NC}"
        else
            echo -e "${YELLOW}⚠️ PARTIAL${NC} (Metrics endpoint may require admin access)"
        fi
    else
        echo -e "${YELLOW}⚠️ Skipping metrics test (no auth token)${NC}"
    fi
    
    # Check log files
    if [ -d "/var/log/observatory-booking" ]; then
        echo -n "Testing log files... "
        if ls /var/log/observatory-booking/*.log >/dev/null 2>&1; then
            echo -e "${GREEN}✅ PASS${NC}"
        else
            echo -e "${RED}❌ FAIL${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ Log directory not found${NC}"
    fi
}

# Main test execution
main() {
    echo -e "${BLUE}Starting comprehensive deployment tests...${NC}"
    echo ""
    
    # Wait for services to be ready
    echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
    sleep 5
    
    test_authentication
    echo ""
    
    test_api_endpoints
    echo ""
    
    test_frontend
    echo ""
    
    test_database
    echo ""
    
    test_security
    echo ""
    
    test_performance
    echo ""
    
    test_monitoring
    echo ""
    
    # Final summary
    echo -e "${BLUE}🎯 Test Summary${NC}"
    echo "=================================================================="
    echo -e "${GREEN}✅ Tests completed${NC}"
    echo ""
    echo -e "${YELLOW}📋 Manual verification needed:${NC}"
    echo "1. Check SSL certificate configuration"
    echo "2. Verify firewall rules"
    echo "3. Test email notifications"
    echo "4. Verify backup procedures"
    echo "5. Test disaster recovery"
    echo ""
    echo -e "${BLUE}🔗 Access URLs:${NC}"
    echo "Frontend: http://$DOMAIN:$FRONTEND_PORT"
    echo "Backend API: http://$DOMAIN:$BACKEND_PORT/api"
    echo "Health Check: http://$DOMAIN:$BACKEND_PORT/api/health"
}

# Check if required tools are available
if ! command -v curl &> /dev/null; then
    echo -e "${RED}❌ curl is required but not installed${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️ jq is not installed, JSON tests will be limited${NC}"
fi

if ! command -v bc &> /dev/null; then
    echo -e "${YELLOW}⚠️ bc is not installed, performance calculations will be limited${NC}"
fi

# Run main test function
main "$@"
