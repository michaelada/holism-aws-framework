#!/bin/bash

# CI/CD Test Runner
# This script automatically detects available tools and runs appropriate tests

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}=========================================="
echo "OpenTofu CI/CD Test Runner"
echo "==========================================${NC}"
echo ""

# Get the test directory
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$TEST_DIR"

# Check if OpenTofu is installed
TOFU_AVAILABLE=false
if command -v tofu &> /dev/null; then
    TOFU_AVAILABLE=true
    echo -e "${GREEN}✓ OpenTofu detected:${NC} $(tofu version | head -1 | awk '{print $2}')"
else
    echo -e "${YELLOW}⚠ OpenTofu not detected${NC}"
    echo "  Only syntax tests will be run."
    echo "  Install OpenTofu to run full validation and plan tests."
fi
echo ""

# Track results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Always run syntax tests (no OpenTofu required)
echo -e "${BLUE}=========================================="
echo "Running: Syntax and Structure Tests"
echo "==========================================${NC}"
echo ""

if bash syntax-check.sh; then
    echo ""
    echo -e "${GREEN}✓ Syntax Tests PASSED${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo ""
    echo -e "${RED}✗ Syntax Tests FAILED${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Run OpenTofu tests if available
if [ "$TOFU_AVAILABLE" = true ]; then
    # Run validate tests
    echo ""
    echo -e "${BLUE}=========================================="
    echo "Running: OpenTofu Validate Tests"
    echo "==========================================${NC}"
    echo ""
    
    if bash validate.sh; then
        echo ""
        echo -e "${GREEN}✓ Validate Tests PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo ""
        echo -e "${RED}✗ Validate Tests FAILED${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Run plan tests
    echo ""
    echo -e "${BLUE}=========================================="
    echo "Running: OpenTofu Plan Tests"
    echo "==========================================${NC}"
    echo ""
    
    if bash plan.sh; then
        echo ""
        echo -e "${GREEN}✓ Plan Tests PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo ""
        echo -e "${RED}✗ Plan Tests FAILED${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
fi

# Final summary
echo ""
echo -e "${BLUE}=========================================="
echo "CI/CD Test Summary"
echo "==========================================${NC}"
echo ""
echo -e "Tests Passed: ${GREEN}$PASSED_TESTS${NC} / $TOTAL_TESTS"
echo -e "Tests Failed: ${RED}$FAILED_TESTS${NC} / $TOTAL_TESTS"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}=========================================="
    echo "✓ ALL TESTS PASSED"
    echo "==========================================${NC}"
    echo ""
    if [ "$TOFU_AVAILABLE" = true ]; then
        echo "All OpenTofu configurations are valid and ready for deployment!"
    else
        echo "Syntax tests passed. Install Terraform for full validation."
    fi
    exit 0
else
    echo -e "${RED}=========================================="
    echo "✗ SOME TESTS FAILED"
    echo "==========================================${NC}"
    echo ""
    echo "Please review the errors above and fix the issues."
    exit 1
fi
