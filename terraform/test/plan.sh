#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Terraform Plan Verification Tests"
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

# Function to test plan for an environment
test_plan() {
    local env_name=$1
    local env_path=$2
    
    echo ""
    echo "Testing plan for: $env_name"
    echo "----------------------------------------"
    
    cd "$env_path"
    
    # Create a temporary tfvars file with dummy values
    cat > test.tfvars <<EOF
aws_region             = "eu-west-1"
project_name           = "test-project"
database_password      = "test-password-123"
keycloak_client_secret = "test-secret-123"
jwt_signing_key        = "test-jwt-key-123"
session_secret         = "test-session-secret-123"
alarm_email_addresses  = ["test@example.com"]
EOF

    # For production, add required SSL certificate
    if [ "$env_name" == "production" ]; then
        echo 'ssl_certificate_arn = "arn:aws:acm:eu-west-1:123456789012:certificate/test"' >> test.tfvars
        echo 'keycloak_url = "https://auth.example.com"' >> test.tfvars
    fi
    
    # Initialize Terraform (without backend)
    run_test "  Terraform init" "terraform init -backend=false"
    
    # Run plan with dummy variables
    echo -n "  Terraform plan... "
    if terraform plan -var-file=test.tfvars -out=test.tfplan > plan.log 2>&1; then
        echo -e "${GREEN}PASSED${NC}"
        ((TESTS_PASSED++))
        
        # Verify plan contains expected resources
        echo -n "  Verify VPC in plan... "
        if grep -q "aws_vpc.main" plan.log; then
            echo -e "${GREEN}PASSED${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}FAILED${NC}"
            ((TESTS_FAILED++))
        fi
        
        echo -n "  Verify RDS in plan... "
        if grep -q "aws_db_instance.postgres" plan.log; then
            echo -e "${GREEN}PASSED${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}FAILED${NC}"
            ((TESTS_FAILED++))
        fi
        
        echo -n "  Verify ALB in plan... "
        if grep -q "aws_lb.main" plan.log; then
            echo -e "${GREEN}PASSED${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}FAILED${NC}"
            ((TESTS_FAILED++))
        fi
        
        echo -n "  Verify Auto Scaling Group in plan... "
        if grep -q "aws_autoscaling_group.app" plan.log; then
            echo -e "${GREEN}PASSED${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}FAILED${NC}"
            ((TESTS_FAILED++))
        fi
        
        echo -n "  Verify Secrets Manager in plan... "
        if grep -q "aws_secretsmanager_secret.app_secrets" plan.log; then
            echo -e "${GREEN}PASSED${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}FAILED${NC}"
            ((TESTS_FAILED++))
        fi
    else
        echo -e "${RED}FAILED${NC}"
        ((TESTS_FAILED++))
        echo "Plan output:"
        cat plan.log
    fi
    
    # Cleanup
    rm -f test.tfvars test.tfplan plan.log
    rm -rf .terraform
    
    cd - > /dev/null
}

# Get the terraform directory
TERRAFORM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TERRAFORM_DIR"

echo "Testing from directory: $TERRAFORM_DIR"
echo ""

# Test plans for all environments
echo "=========================================="
echo "Environment Plan Tests"
echo "=========================================="

test_plan "staging" "$TERRAFORM_DIR/environments/staging"
test_plan "production" "$TERRAFORM_DIR/environments/production"

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
