#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Terraform Configuration Validation Tests"
echo "=========================================="
echo ""

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}ERROR: Terraform is not installed${NC}"
    echo ""
    echo "Please install Terraform to run these tests:"
    echo "  macOS:   brew install terraform"
    echo "  Linux:   https://www.terraform.io/downloads"
    echo "  Windows: choco install terraform"
    echo ""
    exit 1
fi

echo "Terraform version: $(terraform version -json | grep -o '"terraform_version":"[^"]*"' | cut -d'"' -f4)"
echo ""

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -n "Running: $test_name... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}PASSED${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}FAILED${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Function to validate a module
validate_module() {
    local module_name=$1
    local module_path=$2
    
    echo ""
    echo "Validating module: $module_name"
    echo "----------------------------------------"
    
    cd "$module_path"
    
    # Initialize Terraform
    run_test "  Terraform init" "terraform init -backend=false"
    
    # Validate configuration
    run_test "  Terraform validate" "terraform validate"
    
    # Format check
    run_test "  Terraform format check" "terraform fmt -check -recursive"
    
    cd - > /dev/null
}

# Function to validate an environment
validate_environment() {
    local env_name=$1
    local env_path=$2
    
    echo ""
    echo "Validating environment: $env_name"
    echo "----------------------------------------"
    
    cd "$env_path"
    
    # Initialize Terraform (without backend to avoid state issues)
    run_test "  Terraform init" "terraform init -backend=false"
    
    # Validate configuration
    run_test "  Terraform validate" "terraform validate"
    
    # Format check
    run_test "  Terraform format check" "terraform fmt -check"
    
    # Check for required variables
    run_test "  Check variables file exists" "test -f variables.tf"
    run_test "  Check outputs file exists" "test -f outputs.tf"
    run_test "  Check example tfvars exists" "test -f terraform.tfvars.example"
    
    cd - > /dev/null
}

# Get the terraform directory
TERRAFORM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TERRAFORM_DIR"

echo "Testing from directory: $TERRAFORM_DIR"
echo ""

# Validate all modules
echo "=========================================="
echo "Module Validation"
echo "=========================================="

validate_module "networking" "$TERRAFORM_DIR/modules/networking"
validate_module "compute" "$TERRAFORM_DIR/modules/compute"
validate_module "database" "$TERRAFORM_DIR/modules/database"
validate_module "monitoring" "$TERRAFORM_DIR/modules/monitoring"
validate_module "secrets" "$TERRAFORM_DIR/modules/secrets"

# Validate all environments
echo ""
echo "=========================================="
echo "Environment Validation"
echo "=========================================="

validate_environment "staging" "$TERRAFORM_DIR/environments/staging"
validate_environment "production" "$TERRAFORM_DIR/environments/production"

# Summary
echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
