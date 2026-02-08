# AWS Staging Environment - Monthly Cost Estimate

## Overview

This document provides a detailed cost estimate for running the staging environment in AWS based on the Terraform configuration.

**Region**: eu-west-1 (US East - N. Virginia)  
**Pricing Date**: February 2026 (estimates based on current AWS pricing)

---

## Infrastructure Components

### 1. EC2 Instances (Application Servers)

**Configuration**:
- Instance Type: `t3.small` (2 vCPU, 2 GB RAM)
- Auto Scaling Group: 1 instance (desired), 1-3 instances (min-max)
- Running: 24/7

**Cost Calculation**:
- t3.small On-Demand: $0.0208/hour
- Monthly hours: 730 hours
- Cost per instance: $0.0208 × 730 = **$15.18/month**
- Total (1 instance): **$15.18/month**

**Potential Savings**:
- With 1-year Reserved Instance: ~$10/month (34% savings)
- With Savings Plans: ~$11/month (27% savings)

---

### 2. RDS PostgreSQL Database

**Configuration**:
- Instance Class: `db.t3.small` (2 vCPU, 2 GB RAM)
- Storage: 50 GB General Purpose SSD (gp3)
- Multi-AZ: Disabled (single AZ for staging)
- Backup Retention: 7 days

**Cost Calculation**:
- db.t3.small On-Demand: $0.034/hour
- Monthly hours: 730 hours
- Instance cost: $0.034 × 730 = **$24.82/month**
- Storage (gp3): 50 GB × $0.115/GB = **$5.75/month**
- Backup storage (estimated 50 GB): $0.095/GB × 50 = **$4.75/month**
- Total RDS: **$35.32/month**

**Potential Savings**:
- With 1-year Reserved Instance: ~$17/month (52% savings)

---

### 3. Application Load Balancer (ALB)

**Configuration**:
- 1 ALB in 2 availability zones
- Estimated traffic: 1 GB/month processed

**Cost Calculation**:
- ALB hourly: $0.0225/hour × 730 = **$16.43/month**
- LCU (Load Balancer Capacity Units): ~$5.84/month (minimal traffic)
- Total ALB: **$22.27/month**

---

### 4. Monitoring Instance (Prometheus + Grafana)

**Configuration**:
- Instance Type: `t3.small` (2 vCPU, 2 GB RAM)
- Running: 24/7

**Cost Calculation**:
- t3.small: $0.0208/hour × 730 = **$15.18/month**

---

### 5. VPC and Networking

**Configuration**:
- 1 VPC
- 2 Public Subnets
- 2 Private Subnets
- 1 NAT Gateway (for private subnet internet access)
- 1 Internet Gateway (free)

**Cost Calculation**:
- NAT Gateway: $0.045/hour × 730 = **$32.85/month**
- NAT Gateway data processing: $0.045/GB × 10 GB = **$0.45/month**
- Total Networking: **$33.30/month**

---

### 6. EBS Volumes

**Configuration**:
- Application server: 20 GB gp3 root volume
- Monitoring server: 20 GB gp3 root volume

**Cost Calculation**:
- gp3 storage: $0.08/GB-month
- App server: 20 GB × $0.08 = **$1.60/month**
- Monitoring server: 20 GB × $0.08 = **$1.60/month**
- Total EBS: **$3.20/month**

---

### 7. AWS Secrets Manager

**Configuration**:
- 4 secrets (database password, Keycloak secret, JWT key, session secret)
- Estimated API calls: 10,000/month

**Cost Calculation**:
- Secret storage: $0.40/secret/month × 4 = **$1.60/month**
- API calls: $0.05 per 10,000 calls = **$0.05/month**
- Total Secrets Manager: **$1.65/month**

---

### 8. CloudWatch

**Configuration**:
- Log ingestion: ~5 GB/month
- Log storage: 30 days retention
- Metrics: ~50 custom metrics
- Alarms: ~10 alarms

**Cost Calculation**:
- Log ingestion: 5 GB × $0.50/GB = **$2.50/month**
- Log storage: 5 GB × $0.03/GB = **$0.15/month**
- Custom metrics: 50 × $0.30 = **$15.00/month**
- Alarms: 10 × $0.10 = **$1.00/month**
- Total CloudWatch: **$18.65/month**

---

### 9. S3 (Terraform State)

**Configuration**:
- Terraform state files: ~1 MB
- Minimal access

**Cost Calculation**:
- Storage: negligible (~$0.02/month)
- Requests: negligible (~$0.01/month)
- Total S3: **$0.03/month**

---

### 10. DynamoDB (Terraform State Lock)

**Configuration**:
- On-demand pricing
- Minimal read/write operations

**Cost Calculation**:
- Storage: negligible
- Read/Write requests: **$0.10/month**

---

### 11. Data Transfer

**Configuration**:
- Outbound data transfer: ~10 GB/month (estimated)
- Inbound: Free

**Cost Calculation**:
- First 10 GB/month: Free
- Total Data Transfer: **$0.00/month**

---

## Total Monthly Cost Summary

| Component | Monthly Cost |
|-----------|--------------|
| EC2 Application Servers (1 instance) | $15.18 |
| RDS PostgreSQL | $35.32 |
| Application Load Balancer | $22.27 |
| Monitoring Instance | $15.18 |
| VPC & NAT Gateway | $33.30 |
| EBS Volumes | $3.20 |
| AWS Secrets Manager | $1.65 |
| CloudWatch | $18.65 |
| S3 (Terraform State) | $0.03 |
| DynamoDB (State Lock) | $0.10 |
| Data Transfer | $0.00 |
| **TOTAL** | **$144.88/month** |

---

## Cost Optimization Opportunities

### Immediate Savings (No Architecture Changes)

1. **Reserved Instances** (1-year commitment):
   - EC2 savings: ~$5/month
   - RDS savings: ~$8/month
   - **Total savings: ~$13/month (9%)**
   - **New total: ~$132/month**

2. **Savings Plans** (1-year commitment):
   - Similar to Reserved Instances but more flexible
   - **Savings: ~$10-15/month**

### Moderate Savings (Minor Changes)

3. **Remove NAT Gateway** (use VPC endpoints instead):
   - Savings: $33/month
   - Trade-off: More complex networking setup
   - **New total: ~$112/month**

4. **Reduce CloudWatch Metrics**:
   - Use fewer custom metrics (keep essential ones)
   - Savings: ~$10/month
   - **New total: ~$135/month**

5. **Use Smaller Instances**:
   - t3.micro for app server: Save ~$8/month
   - db.t3.micro for database: Save ~$15/month
   - Trade-off: Lower performance
   - **Savings: ~$23/month**

### Aggressive Savings (Significant Changes)

6. **Shut Down During Off-Hours**:
   - Run only during business hours (12 hours/day, 5 days/week)
   - Savings: ~60% on compute costs
   - **Savings: ~$40/month**
   - **New total: ~$105/month**

7. **Use Aurora Serverless v2** instead of RDS:
   - Pay only for actual usage
   - Potential savings: ~$20/month for low-traffic staging
   - **New total: ~$125/month**

---

## Recommended Configuration for Cost-Conscious Staging

If you want to minimize costs while maintaining functionality:

```hcl
# Recommended staging configuration
instance_type              = "t3.micro"      # $7.59/month
db_instance_class          = "db.t3.micro"   # $12.41/month
monitoring_instance_type   = "t3.micro"      # $7.59/month
asg_desired_capacity       = 1               # Single instance
```

**Estimated cost with optimizations**: **~$95-110/month**

---

## Scaling Considerations

### If Traffic Increases:

| Scenario | Configuration | Estimated Cost |
|----------|---------------|----------------|
| Low traffic (current) | 1 × t3.small | $145/month |
| Medium traffic | 2 × t3.small | $160/month |
| High traffic | 3 × t3.medium | $250/month |

### Production Environment:

Production would typically cost **2-3x more** due to:
- Multi-AZ RDS (~$70/month)
- Multiple EC2 instances (2-3 minimum)
- Larger instance types
- Blue-green deployment infrastructure
- Enhanced monitoring and logging

**Estimated production cost**: **$350-500/month**

---

## Cost Monitoring Recommendations

1. **Set up AWS Budgets**:
   - Alert at $100/month (70% of estimate)
   - Alert at $130/month (90% of estimate)
   - Hard limit at $200/month

2. **Enable Cost Explorer**:
   - Review costs weekly
   - Identify unexpected charges

3. **Tag all resources**:
   - Environment: staging
   - Project: aws-web-framework
   - Track costs by tag

4. **Use AWS Cost Anomaly Detection**:
   - Automatic alerts for unusual spending

---

## Conclusion

**Expected Monthly Cost**: **$145/month** (±10%)

**With Basic Optimizations**: **$95-110/month**

**Annual Cost**: **~$1,740/year** (or ~$1,140-1,320 with optimizations)

This is a reasonable cost for a staging environment that mirrors production architecture. The main cost drivers are:
1. NAT Gateway (23%)
2. RDS Database (24%)
3. ALB (15%)
4. CloudWatch (13%)

For a minimal viable staging environment, you could get costs down to around $95-110/month by using smaller instances and optimizing networking.
