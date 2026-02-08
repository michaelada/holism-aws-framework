# Terraform Configuration Tests

This directory contains comprehensive test scripts for validating Terraform configurations before deployment.

## Quick Start

**For local development (with Terraform installed):**
```bash
cd terraform/test
./run-all-tests.sh
```

**For CI/CD environments (auto-detects Terraform):**
```bash
cd terraform/test
./ci-test.sh
```

This will execute all available test suites and provide a comprehensive summary.

## Test Scripts

### ci-test.sh (Recommended for CI/CD)

Intelligent test runner that automatically detects available tools and runs appropriate tests.

**Features:**
- Auto-detects Terraform installation
- Runs syntax tests (always, no Terraform required)
- Runs validation tests (if Terraform available)
- Runs plan tests (if Terraform available)
- Provides clear feedback about what was tested

**Usage:**
```bash
cd terraform/test
./ci-test.sh
```

**Exit codes:**
- `0`: All available tests passed
- `1`: One or more tests failed

**Perfect for:**
- CI/CD pipelines
- Environments where Terraform may not be installed
- Quick validation during development

### run-all-tests.sh (Recommended for local development)

Master test runner that executes all test suites in sequence.

**Tests performed:**
- Syntax and structure validation
- Terraform validation
- Terraform plan verification

**Usage:**
```bash
cd terraform/test
./run-all-tests.sh
```

**Exit codes:**
- `0`: All test suites passed
- `1`: One or more test suites failed

### syntax-check.sh

Validates Terraform file structure and basic syntax without requiring Terraform installation.

**Tests performed:**
- Required file existence checks (main.tf, variables.tf, outputs.tf)
- Basic HCL syntax validation (brace matching, structure)
- Module-specific resource checks
- Environment-specific configuration checks
- Documentation file checks

**Usage:**
```bash
cd terraform/test
./syntax-check.sh
```

**Note:** This script performs static analysis and does not require Terraform to be installed.

### validate.sh

Validates Terraform syntax and formatting for all modules and environments.

**Tests performed:**
- Terraform initialization
- Configuration validation (`terraform validate`)
- Format checking (`terraform fmt -check`)
- Required file existence checks

**Usage:**
```bash
cd terraform/test
./validate.sh
```

**Requirements:** Terraform >= 1.0 must be installed

### plan.sh

Generates and verifies Terraform plans for all environments.

**Tests performed:**
- Terraform initialization
- Plan generation with test variables
- Verification of expected resources in plan:
  - VPC and networking resources
  - RDS database instance
  - Application Load Balancer
  - Auto Scaling Group
  - Secrets Manager

**Usage:**
```bash
cd terraform/test
./plan.sh
```

**Requirements:** Terraform >= 1.0 must be installed

**Note:** This script uses dummy values for sensitive variables and does not connect to AWS. It only validates that the plan can be generated successfully.

## Running Tests Individually

You can run any test script individually:

```bash
cd terraform/test

# Run only syntax checks (no Terraform required)
./syntax-check.sh

# Run only validation tests (requires Terraform)
./validate.sh

# Run only plan tests (requires Terraform)
./plan.sh
```

## Running All Tests

**Recommended approach:**
```bash
cd terraform/test
./run-all-tests.sh
```

**Alternative approach:**
```bash
cd terraform/test
./syntax-check.sh && ./validate.sh && ./plan.sh
```

## CI/CD Integration

These tests are designed for easy integration into CI/CD pipelines.

### GitHub Actions Example

**Recommended approach (using ci-test.sh):**
```yaml
name: Terraform Tests

on:
  push:
    branches: [ main, develop ]
    paths:
      - 'terraform/**'
  pull_request:
    branches: [ main ]
    paths:
      - 'terraform/**'

jobs:
  terraform-tests:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2
        with:
          terraform_version: 1.5.0
      
      - name: Run Terraform Tests
        run: |
          cd terraform/test
          ./ci-test.sh
```

**Alternative approach (explicit test suites):**
```yaml
name: Terraform Tests

on:
  push:
    branches: [ main, develop ]
    paths:
      - 'terraform/**'
  pull_request:
    branches: [ main ]
    paths:
      - 'terraform/**'

jobs:
  terraform-tests:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2
        with:
          terraform_version: 1.5.0
      
      - name: Run All Terraform Tests
        run: |
          cd terraform/test
          ./run-all-tests.sh
```

### Individual Test Suites in CI/CD

You can also run test suites as separate CI/CD steps:

```yaml
- name: Terraform Syntax Check
  run: |
    cd terraform/test
    ./syntax-check.sh

- name: Terraform Validation
  run: |
    cd terraform/test
    ./validate.sh

- name: Terraform Plan Verification
  run: |
    cd terraform/test
    ./plan.sh
```

## Test Requirements

### For All Tests
- Bash shell (available on macOS, Linux, WSL on Windows)

### For Syntax Tests Only
- No additional requirements
- Can run without Terraform installed

### For Validate and Plan Tests
- Terraform >= 1.0 installed
- No AWS credentials required (tests run in local mode)

## Installation

### Installing Terraform

**macOS:**
```bash
brew install terraform
```

**Linux (Ubuntu/Debian):**
```bash
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform
```

**Windows:**
```powershell
choco install terraform
```

**Verify installation:**
```bash
terraform version
```

## Exit Codes

All test scripts use standard exit codes:
- `0`: All tests passed
- `1`: One or more tests failed

This makes them suitable for use in CI/CD pipelines and automated testing workflows.

## Test Output

Test scripts provide color-coded output:
- 🟢 **GREEN**: Tests passed
- 🔴 **RED**: Tests failed
- 🟡 **YELLOW**: Warnings or informational messages

Each test script provides:
1. Individual test results as they run
2. A summary of passed/failed tests
3. Clear error messages for failures
4. Suggestions for fixing common issues

## Troubleshooting

### Terraform Not Found
```bash
# Check if Terraform is installed
terraform version

# If not installed, see Installation section above
```

### Permission Denied
```bash
# Make scripts executable
chmod +x terraform/test/*.sh
```

### Module Not Found Errors
Ensure you're running the scripts from the `terraform/test` directory:
```bash
cd terraform/test
./run-all-tests.sh
```

### Validation Errors
If `terraform validate` fails:
1. Check the error message for specific issues
2. Verify all required files exist (main.tf, variables.tf, outputs.tf)
3. Ensure module references are correct
4. Run `terraform fmt` to fix formatting issues

### Plan Generation Errors
If `terraform plan` fails:
1. Check that all required variables are defined
2. Verify module source paths are correct
3. Ensure provider configuration is valid
4. Review the plan.log file for detailed error messages

## Adding New Tests

To add new tests to the test suite:

### Adding Tests to Existing Scripts

1. **Create a new test function:**
```bash
test_new_feature() {
    local test_name=$1
    echo -n "Testing $test_name... "
    
    if some_test_command; then
        echo -e "${GREEN}PASSED${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}FAILED${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}
```

2. **Call the function in the main test flow:**
```bash
test_new_feature "my new feature"
```

3. **Update test counters** to track results

4. **Document the new test** in this README

### Creating New Test Scripts

1. Create a new `.sh` file in `terraform/test/`
2. Make it executable: `chmod +x new-test.sh`
3. Follow the existing script structure:
   - Use color-coded output
   - Track TESTS_PASSED and TESTS_FAILED
   - Provide clear error messages
   - Return appropriate exit codes
4. Add the new script to `run-all-tests.sh`
5. Document it in this README

### Test Script Template

```bash
#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "My New Test Suite"
echo "=========================================="
echo ""

TESTS_PASSED=0
TESTS_FAILED=0

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

# Add your tests here
run_test "Test 1" "test -f somefile.txt"
run_test "Test 2" "grep -q 'pattern' somefile.txt"

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
```

## Test Coverage

The current test suite validates:

### Module Tests
- ✅ Networking module (VPC, subnets, security groups)
- ✅ Compute module (EC2, ALB, Auto Scaling)
- ✅ Database module (RDS PostgreSQL)
- ✅ Monitoring module (CloudWatch, SNS)
- ✅ Secrets module (AWS Secrets Manager)

### Environment Tests
- ✅ Staging environment configuration
- ✅ Production environment configuration

### Validation Types
- ✅ File structure and existence
- ✅ Basic syntax validation
- ✅ Terraform validate (full HCL validation)
- ✅ Terraform plan generation
- ✅ Resource verification in plans
- ✅ Format checking (terraform fmt)

## Best Practices

1. **Run tests before committing:** Always run `./run-all-tests.sh` before pushing changes
2. **Fix formatting issues:** Run `terraform fmt -recursive` from the terraform directory
3. **Test incrementally:** Run individual test scripts during development
4. **Keep tests fast:** Tests should complete in under 2 minutes
5. **Use dummy values:** Never use real credentials in test scripts
6. **Document changes:** Update this README when adding new tests

## Related Documentation

- [Main Terraform README](../README.md) - Overview of Terraform infrastructure
- [Deployment Guide](../../DEPLOYMENT.md) - How to deploy to AWS
- [Monitoring Guide](../../MONITORING.md) - Observability and monitoring setup
