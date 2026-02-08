#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}=========================================="
echo "Terraform Test Suite"
echo "==========================================${NC}"
echo ""
echo "This script runs all Terraform configuration tests:"
echo "  1. Syntax and structure validation"
echo "  2. Terraform validate"
echo "  3. Terraform plan verification"
echo ""

# Get the test directory
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$TEST_DIR"

# Track overall results
TOTAL_SUITES=3
PASSED_SUITES=0
FAILED_SUITES=0

# Function to run a test suite
run_suite() {
    local suite_name=$1
    local script_name=$2
    
    echo ""
    echo -e "${BLUE}=========================================="
    echo "Running: $suite_name"
    echo "==========================================${NC}"
    echo ""
    
    if bash "$script_name"; then
        echo ""
        echo -e "${GREEN}✓ $suite_name PASSED${NC}"
        ((PASSED_SUITES++))
        return 0
    else
        echo ""
        echo -e "${RED}✗ $suite_name FAILED${NC}"
        ((FAILED_SUITES++))
        return 1
    fi
}

# Run all test suites
run_suite "Syntax and Structure Tests" "syntax-check.sh"
SYNTAX_RESULT=$?

run_suite "Terraform Validate Tests" "validate.sh"
VALIDATE_RESULT=$?

run_suite "Terraform Plan Tests" "plan.sh"
PLAN_RESULT=$?

# Final summary
echo ""
echo -e "${BLUE}=========================================="
echo "Final Test Summary"
echo "==========================================${NC}"
echo ""
echo -e "Test Suites Passed: ${GREEN}$PASSED_SUITES${NC} / $TOTAL_SUITES"
echo -e "Test Suites Failed: ${RED}$FAILED_SUITES${NC} / $TOTAL_SUITES"
echo ""

if [ $FAILED_SUITES -eq 0 ]; then
    echo -e "${GREEN}=========================================="
    echo "✓ ALL TESTS PASSED"
    echo "==========================================${NC}"
    echo ""
    echo "Your Terraform configurations are valid and ready for deployment!"
    exit 0
else
    echo -e "${RED}=========================================="
    echo "✗ SOME TESTS FAILED"
    echo "==========================================${NC}"
    echo ""
    echo "Please review the errors above and fix the issues."
    echo ""
    echo "Failed suites:"
    [ $SYNTAX_RESULT -ne 0 ] && echo "  - Syntax and Structure Tests"
    [ $VALIDATE_RESULT -ne 0 ] && echo "  - Terraform Validate Tests"
    [ $PLAN_RESULT -ne 0 ] && echo "  - Terraform Plan Tests"
    echo ""
    exit 1
fi
