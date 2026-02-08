#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Terraform Syntax and Structure Tests"
echo "=========================================="
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

# Function to check file syntax
check_file_syntax() {
    local file=$1
    
    # Check for basic Terraform syntax issues
    # Look for common errors like unmatched braces, quotes, etc.
    
    # Count opening and closing braces
    local open_braces=$(grep -o '{' "$file" | wc -l)
    local close_braces=$(grep -o '}' "$file" | wc -l)
    
    if [ "$open_braces" -ne "$close_braces" ]; then
        return 1
    fi
    
    # Check for basic HCL structure
    if ! grep -qE '(resource|variable|output|module|data|locals|terraform)' "$file"; then
        return 1
    fi
    
    return 0
}

# Function to validate a module structure
validate_module_structure() {
    local module_name=$1
    local module_path=$2
    
    echo ""
    echo "Validating module: $module_name"
    echo "----------------------------------------"
    
    # Check required files exist
    run_test "  main.tf exists" "test -f $module_path/main.tf"
    run_test "  variables.tf exists" "test -f $module_path/variables.tf"
    run_test "  outputs.tf exists" "test -f $module_path/outputs.tf"
    
    # Check file syntax
    if [ -f "$module_path/main.tf" ]; then
        run_test "  main.tf syntax" "check_file_syntax $module_path/main.tf"
    fi
    
    if [ -f "$module_path/variables.tf" ]; then
        run_test "  variables.tf syntax" "check_file_syntax $module_path/variables.tf"
    fi
    
    if [ -f "$module_path/outputs.tf" ]; then
        run_test "  outputs.tf syntax" "check_file_syntax $module_path/outputs.tf"
    fi
    
    # Check for required resource types
    case $module_name in
        networking)
            run_test "  Contains VPC resource" "grep -q 'resource \"aws_vpc\"' $module_path/main.tf"
            run_test "  Contains subnet resources" "grep -q 'resource \"aws_subnet\"' $module_path/main.tf"
            run_test "  Contains security groups" "grep -q 'resource \"aws_security_group\"' $module_path/security_groups.tf"
            ;;
        compute)
            run_test "  Contains ALB resource" "grep -q 'resource \"aws_lb\"' $module_path/main.tf"
            run_test "  Contains ASG resource" "grep -q 'resource \"aws_autoscaling_group\"' $module_path/main.tf"
            run_test "  Contains launch template" "grep -q 'resource \"aws_launch_template\"' $module_path/main.tf"
            ;;
        database)
            run_test "  Contains RDS resource" "grep -q 'resource \"aws_db_instance\"' $module_path/main.tf"
            run_test "  Contains subnet group" "grep -q 'resource \"aws_db_subnet_group\"' $module_path/main.tf"
            ;;
        monitoring)
            run_test "  Contains CloudWatch resources" "grep -q 'resource \"aws_cloudwatch' $module_path/main.tf"
            run_test "  Contains SNS topic" "grep -q 'resource \"aws_sns_topic\"' $module_path/main.tf"
            ;;
        secrets)
            run_test "  Contains Secrets Manager" "grep -q 'resource \"aws_secretsmanager_secret\"' $module_path/main.tf"
            ;;
    esac
}

# Function to validate environment structure
validate_environment_structure() {
    local env_name=$1
    local env_path=$2
    
    echo ""
    echo "Validating environment: $env_name"
    echo "----------------------------------------"
    
    # Check required files exist
    run_test "  main.tf exists" "test -f $env_path/main.tf"
    run_test "  variables.tf exists" "test -f $env_path/variables.tf"
    run_test "  outputs.tf exists" "test -f $env_path/outputs.tf"
    run_test "  terraform.tfvars.example exists" "test -f $env_path/terraform.tfvars.example"
    
    # Check file syntax
    if [ -f "$env_path/main.tf" ]; then
        run_test "  main.tf syntax" "check_file_syntax $env_path/main.tf"
    fi
    
    # Check for module references
    run_test "  References networking module" "grep -q 'module \"networking\"' $env_path/main.tf"
    run_test "  References compute module" "grep -q 'module \"compute\"' $env_path/main.tf"
    run_test "  References database module" "grep -q 'module \"database\"' $env_path/main.tf"
    run_test "  References monitoring module" "grep -q 'module \"monitoring\"' $env_path/main.tf"
    run_test "  References secrets module" "grep -q 'module \"secrets\"' $env_path/main.tf"
    
    # Check for backend configuration
    run_test "  Has backend configuration" "grep -q 'backend \"s3\"' $env_path/main.tf"
    
    # Environment-specific checks
    case $env_name in
        production)
            run_test "  Multi-AZ enabled" "grep -q 'multi_az.*=.*true' $env_path/main.tf"
            run_test "  Uses 3 availability zones" "grep -q 'slice.*0, 3' $env_path/main.tf"
            ;;
        staging)
            run_test "  Uses 2 availability zones" "grep -q 'slice.*0, 2' $env_path/main.tf"
            ;;
    esac
}

# Get the terraform directory
TERRAFORM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TERRAFORM_DIR"

echo "Testing from directory: $TERRAFORM_DIR"
echo ""

# Validate all modules
echo "=========================================="
echo "Module Structure Validation"
echo "=========================================="

validate_module_structure "networking" "$TERRAFORM_DIR/modules/networking"
validate_module_structure "compute" "$TERRAFORM_DIR/modules/compute"
validate_module_structure "database" "$TERRAFORM_DIR/modules/database"
validate_module_structure "monitoring" "$TERRAFORM_DIR/modules/monitoring"
validate_module_structure "secrets" "$TERRAFORM_DIR/modules/secrets"

# Validate all environments
echo ""
echo "=========================================="
echo "Environment Structure Validation"
echo "=========================================="

validate_environment_structure "staging" "$TERRAFORM_DIR/environments/staging"
validate_environment_structure "production" "$TERRAFORM_DIR/environments/production"

# Check README exists
echo ""
echo "=========================================="
echo "Documentation Validation"
echo "=========================================="

run_test "Main README exists" "test -f $TERRAFORM_DIR/README.md"
run_test "Test README exists" "test -f $TERRAFORM_DIR/test/README.md"

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
    echo ""
    echo "Note: These tests validate file structure and basic syntax."
    echo "Run 'terraform validate' and 'terraform plan' for full validation."
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
