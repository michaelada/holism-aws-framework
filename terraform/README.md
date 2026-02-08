# AWS Web Application Framework - Terraform Infrastructure

This directory contains Terraform configurations for provisioning the AWS infrastructure for the web application framework.

## Structure

```
terraform/
├── modules/              # Reusable Terraform modules
│   ├── networking/      # VPC, subnets, security groups
│   ├── compute/         # EC2, ALB, Auto Scaling
│   ├── database/        # RDS PostgreSQL
│   ├── monitoring/      # CloudWatch, Prometheus, Grafana
│   └── secrets/         # AWS Secrets Manager
├── environments/        # Environment-specific configurations
│   ├── staging/        # Staging environment
│   └── production/     # Production environment
└── README.md           # This file
```

## Prerequisites

1. **Terraform**: Install Terraform >= 1.0
   ```bash
   # macOS
   brew install terraform
   
   # Or download from https://www.terraform.io/downloads
   ```

2. **AWS CLI**: Configure AWS credentials
   ```bash
   aws configure
   ```

3. **S3 Backend**: Create S3 buckets and DynamoDB tables for state management
   ```bash
   # Staging
   aws s3 mb s3://aws-web-framework-terraform-state-staging
   aws dynamodb create-table \
     --table-name terraform-state-lock-staging \
     --attribute-definitions AttributeName=LockID,AttributeType=S \
     --key-schema AttributeName=LockID,KeyType=HASH \
     --billing-mode PAY_PER_REQUEST
   
   # Production
   aws s3 mb s3://aws-web-framework-terraform-state-production
   aws dynamodb create-table \
     --table-name terraform-state-lock-production \
     --attribute-definitions AttributeName=LockID,AttributeType=S \
     --key-schema AttributeName=LockID,KeyType=HASH \
     --billing-mode PAY_PER_REQUEST
   ```

## Testing

Before deploying infrastructure, run the comprehensive test suite to validate configurations:

```bash
cd terraform/test
./ci-test.sh
```

This will run:
- ✅ Syntax and structure validation (no Terraform required)
- ✅ Terraform validate (if Terraform installed)
- ✅ Terraform plan verification (if Terraform installed)

For more details on testing, see [test/README.md](test/README.md).

**Quick test commands:**
```bash
# Run all tests (requires Terraform)
cd terraform/test && ./run-all-tests.sh

# Run only syntax tests (no Terraform required)
cd terraform/test && ./syntax-check.sh

# Run validation tests
cd terraform/test && ./validate.sh

# Run plan tests
cd terraform/test && ./plan.sh
```

## Modules

### Networking Module

Creates VPC, subnets, NAT gateways, and security groups.

**Resources:**
- VPC with public and private subnets across multiple AZs
- Internet Gateway and NAT Gateways
- Route tables
- Security groups for ALB, application servers, database, monitoring, and Keycloak

### Compute Module

Creates EC2 instances, Application Load Balancer, and Auto Scaling Group.

**Resources:**
- Application Load Balancer with HTTPS listener
- Target groups for backend and frontend
- Launch template for application servers
- Auto Scaling Group with CPU-based scaling
- IAM roles and policies for EC2 instances

### Database Module

Creates RDS PostgreSQL instance with backups and monitoring.

**Resources:**
- RDS PostgreSQL instance with Multi-AZ support (production)
- DB subnet group and parameter group
- CloudWatch alarms for CPU, storage, and connections
- Automated backups with configurable retention

### Monitoring Module

Creates monitoring infrastructure with CloudWatch, Prometheus, and Grafana.

**Resources:**
- CloudWatch Log Groups for application logs
- SNS topic for alarm notifications
- CloudWatch Dashboard
- EC2 instance running Prometheus and Grafana
- CloudWatch alarms for error rates and response times

### Secrets Module

Manages application secrets using AWS Secrets Manager.

**Resources:**
- Secrets Manager secret for application credentials
- IAM policy for secret access
- Optional secret rotation configuration
- CloudWatch alarm for unusual secret access

## Deployment

### Staging Environment

1. Navigate to staging directory:
   ```bash
   cd terraform/environments/staging
   ```

2. Copy and configure variables:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your values
   ```

3. Initialize Terraform:
   ```bash
   terraform init
   ```

4. Review the plan:
   ```bash
   terraform plan
   ```

5. Apply the configuration:
   ```bash
   terraform apply
   ```

### Production Environment

1. Navigate to production directory:
   ```bash
   cd terraform/environments/production
   ```

2. Copy and configure variables:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your values
   ```

3. Initialize Terraform:
   ```bash
   terraform init
   ```

4. Review the plan:
   ```bash
   terraform plan
   ```

5. Apply the configuration:
   ```bash
   terraform apply
   ```

## Environment Differences

### Staging
- **Database**: Single-AZ, db.t3.small, 50GB storage
- **Compute**: 1-3 instances, t3.small
- **Monitoring**: t3.small instance
- **Backups**: 7 days retention
- **Logs**: 30 days retention
- **Secret Rotation**: Disabled

### Production
- **Database**: Multi-AZ, db.r5.large, 200GB storage
- **Compute**: 3-10 instances, t3.medium
- **Monitoring**: t3.medium instance
- **Backups**: 30 days retention
- **Logs**: 90 days retention
- **Secret Rotation**: Enabled (30 days)
- **Deletion Protection**: Enabled

## Managing Secrets

Secrets should never be committed to version control. Use one of these methods:

### Option 1: Environment Variables
```bash
export TF_VAR_database_password="your-password"
export TF_VAR_keycloak_client_secret="your-secret"
export TF_VAR_jwt_signing_key="your-key"
export TF_VAR_session_secret="your-secret"
terraform apply
```

### Option 2: Terraform Variables File (Not Committed)
```bash
# Create terraform.tfvars (add to .gitignore)
cat > terraform.tfvars <<EOF
database_password      = "your-password"
keycloak_client_secret = "your-secret"
jwt_signing_key        = "your-key"
session_secret         = "your-secret"
EOF

terraform apply
```

### Option 3: Interactive Input
```bash
# Terraform will prompt for sensitive variables
terraform apply
```

## Outputs

After successful deployment, Terraform will output:

- **vpc_id**: VPC identifier
- **alb_dns_name**: Load balancer DNS name (use for DNS configuration)
- **database_endpoint**: Database connection string
- **monitoring_instance_ip**: Prometheus/Grafana instance IP
- **cloudwatch_dashboard_name**: CloudWatch dashboard name
- **secrets_arn**: Secrets Manager ARN

## Accessing Services

### Application
```
https://<alb_dns_name>
```

### Grafana Dashboard
Access via ALB or SSH tunnel to monitoring instance:
```bash
ssh -L 3001:localhost:3001 ec2-user@<monitoring-instance-ip>
# Then access http://localhost:3001
```

### Prometheus
Access via ALB or SSH tunnel to monitoring instance:
```bash
ssh -L 9090:localhost:9090 ec2-user@<monitoring-instance-ip>
# Then access http://localhost:9090
```

## Maintenance

### Updating Infrastructure

1. Modify Terraform files
2. Run `terraform plan` to review changes
3. Run `terraform apply` to apply changes

### Destroying Infrastructure

**WARNING**: This will delete all resources including databases!

```bash
# Staging
cd terraform/environments/staging
terraform destroy

# Production (requires additional confirmation)
cd terraform/environments/production
terraform destroy
```

## Troubleshooting

### State Lock Issues
If Terraform state is locked:
```bash
# List locks
aws dynamodb scan --table-name terraform-state-lock-staging

# Force unlock (use with caution)
terraform force-unlock <lock-id>
```

### Database Connection Issues
Check security group rules and ensure application servers can reach RDS:
```bash
aws ec2 describe-security-groups --group-ids <db-security-group-id>
```

### Monitoring Access Issues
Verify monitoring instance is running and security groups allow access:
```bash
aws ec2 describe-instances --filters "Name=tag:Name,Values=staging-monitoring"
```

## Best Practices

1. **Always run tests before deployment**: `cd terraform/test && ./ci-test.sh`
2. **Always run `terraform plan` before `apply`**
3. **Use separate AWS accounts for staging and production**
4. **Enable MFA for production AWS accounts**
5. **Regularly review and rotate secrets**
6. **Monitor CloudWatch alarms and respond promptly**
7. **Keep Terraform state secure (encrypted S3 bucket)**
8. **Use version control for all Terraform changes**
9. **Test infrastructure changes in staging first**
10. **Run the test suite in CI/CD pipelines**

## Support

For issues or questions:
1. Check CloudWatch logs for application errors
2. Review Terraform plan output for configuration issues
3. Consult AWS documentation for service-specific issues
