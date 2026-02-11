#!/bin/bash

# Deployment Verification Script for Keycloak Admin Integration
# This script verifies that all components are properly deployed and accessible

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost}"
API_URL="${API_URL:-${BASE_URL}/api}"
ADMIN_URL="${ADMIN_URL:-${BASE_URL}/admin}"
KEYCLOAK_URL="${KEYCLOAK_URL:-${BASE_URL}/auth}"
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://localhost:3000/health}"

echo "========================================="
echo "Deployment Verification Script"
echo "========================================="
echo ""
echo "Configuration:"
echo "  Base URL: ${BASE_URL}"
echo "  API URL: ${API_URL}"
echo "  Admin URL: ${ADMIN_URL}"
echo "  Keycloak URL: ${KEYCLOAK_URL}"
echo ""

# Function to check HTTP endpoint
check_endpoint() {
    local url=$1
    local name=$2
    local expected_status=${3:-200}
    
    echo -n "Checking ${name}... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "${url}" 2>/dev/null || echo "000")
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✓ OK${NC} (HTTP ${response})"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP ${response}, expected ${expected_status})"
        return 1
    fi
}

# Function to check if service is accessible
check_service() {
    local url=$1
    local name=$2
    
    echo -n "Checking ${name} accessibility... "
    
    if curl -s -f -o /dev/null "${url}" 2>/dev/null; then
        echo -e "${GREEN}✓ Accessible${NC}"
        return 0
    else
        echo -e "${RED}✗ Not accessible${NC}"
        return 1
    fi
}

# Track failures
FAILURES=0

echo "========================================="
echo "1. Backend Service Verification"
echo "========================================="

# Check backend health endpoint
if ! check_endpoint "${BACKEND_HEALTH_URL}" "Backend health endpoint"; then
    ((FAILURES++))
fi

# Check backend API endpoints (without auth)
if ! check_endpoint "${API_URL}/health" "Backend API health" 200; then
    ((FAILURES++))
fi

echo ""
echo "========================================="
echo "2. Keycloak Service Verification"
echo "========================================="

# Check Keycloak accessibility
if ! check_service "${KEYCLOAK_URL}" "Keycloak"; then
    ((FAILURES++))
fi

# Check Keycloak realm endpoint
if ! check_service "${KEYCLOAK_URL}/realms/aws-framework" "Keycloak realm"; then
    ((FAILURES++))
fi

echo ""
echo "========================================="
echo "3. Admin Frontend Verification"
echo "========================================="

# Check admin frontend is accessible
if ! check_endpoint "${ADMIN_URL}" "Admin frontend" 200; then
    ((FAILURES++))
fi

# Check admin frontend static assets
if ! check_service "${ADMIN_URL}/index.html" "Admin frontend index.html"; then
    ((FAILURES++))
fi

echo ""
echo "========================================="
echo "4. Nginx Routing Verification"
echo "========================================="

# Check Nginx health endpoint
if ! check_endpoint "${BASE_URL}/health" "Nginx health endpoint"; then
    ((FAILURES++))
fi

# Check API routing through Nginx
if ! check_service "${API_URL}/health" "API routing through Nginx"; then
    ((FAILURES++))
fi

# Check auth routing through Nginx
if ! check_service "${KEYCLOAK_URL}/realms/aws-framework" "Auth routing through Nginx"; then
    ((FAILURES++))
fi

# Check admin routing through Nginx
if ! check_endpoint "${ADMIN_URL}" "Admin routing through Nginx" 200; then
    ((FAILURES++))
fi

echo ""
echo "========================================="
echo "5. Admin API Endpoints Verification"
echo "========================================="

echo -e "${YELLOW}Note: Admin API endpoints require authentication.${NC}"
echo -e "${YELLOW}These checks verify the endpoints are accessible (will return 401/403 without auth).${NC}"
echo ""

# Check admin API endpoints (should return 401 or 403 without auth)
check_admin_endpoint() {
    local endpoint=$1
    local name=$2
    
    echo -n "Checking ${name}... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/admin${endpoint}" 2>/dev/null || echo "000")
    
    # Accept 401 (unauthorized) or 403 (forbidden) as success - means endpoint exists
    if [ "$response" = "401" ] || [ "$response" = "403" ] || [ "$response" = "200" ]; then
        echo -e "${GREEN}✓ Endpoint exists${NC} (HTTP ${response})"
        return 0
    else
        echo -e "${RED}✗ Endpoint not found${NC} (HTTP ${response})"
        return 1
    fi
}

if ! check_admin_endpoint "/tenants" "GET /api/admin/tenants"; then
    ((FAILURES++))
fi

if ! check_admin_endpoint "/users" "GET /api/admin/users"; then
    ((FAILURES++))
fi

if ! check_admin_endpoint "/roles" "GET /api/admin/roles"; then
    ((FAILURES++))
fi

echo ""
echo "========================================="
echo "6. Database Connectivity Verification"
echo "========================================="

echo -e "${YELLOW}Note: Database connectivity is verified through backend health checks.${NC}"
echo -e "${YELLOW}If backend health checks pass, database is accessible.${NC}"

echo ""
echo "========================================="
echo "Summary"
echo "========================================="

if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Deployment is ready for use."
    echo ""
    echo "Access points:"
    echo "  - Admin Frontend: ${ADMIN_URL}"
    echo "  - API: ${API_URL}"
    echo "  - Keycloak: ${KEYCLOAK_URL}"
    echo ""
    exit 0
else
    echo -e "${RED}✗ ${FAILURES} check(s) failed!${NC}"
    echo ""
    echo "Please review the failures above and ensure all services are running."
    echo ""
    echo "Common issues:"
    echo "  - Services not started: Run 'docker-compose up -d'"
    echo "  - Services still starting: Wait a few moments and try again"
    echo "  - Port conflicts: Check if ports 80, 3000, 8080 are available"
    echo "  - Build issues: Run 'npm run build' in packages/admin and packages/frontend"
    echo ""
    exit 1
fi
