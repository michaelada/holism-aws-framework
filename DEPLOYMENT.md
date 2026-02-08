# Deployment Guide

This guide covers deploying the AWS Web Application Framework in different environments.

## Table of Contents

- [Local Development](#local-development)
- [Staging Deployment](#staging-deployment)
- [Production Deployment](#production-deployment)
- [SSL Certificate Setup](#ssl-certificate-setup)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

## Local Development

### Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ (for local development without Docker)
- Git

### Quick Start

1. Clone the repository:
```bash
git clone <repository-url>
cd aws-web-app-framework
```

2. Copy environment files:
```bash
cp .env.example .env
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env
```

3. Start all services:
```bash
docker-compose up -d
```

4. Wait for services to be healthy:
```bash
docker-compose ps
```

5. Access the application:
- Frontend: http://localhost
- Backend API: http://localhost/api
- Keycloak: http://localhost/auth
- Grafana: http://localhost:3001
- Prometheus: http://localhost:9090

### Development Workflow

For active development, you may want to run backend and frontend outside Docker:

1. Start infrastructure services only:
```bash
docker-compose up -d postgres keycloak nginx prometheus grafana
```

2. Run backend locally:
```bash
cd packages/backend
npm install
npm run dev
```

3. Run frontend locally:
```bash
cd packages/frontend
npm install
npm run dev
```

### Running Migrations

```bash
# Inside backend container
docker-compose exec backend npm run migrate

# Or locally
cd packages/backend
npm run migrate
```

## Staging Deployment

### Prerequisites

- AWS account with appropriate permissions
- Terraform installed
- Docker registry (ECR or Docker Hub)
- Domain name with DNS configured
- SSL certificate (Let's Encrypt or ACM)

### Steps

1. **Build and push Docker images:**

```bash
# Build images
docker build -t aws-framework-backend:staging -f packages/backend/Dockerfile packages/backend
docker build -t aws-framework-frontend:staging -f packages/frontend/Dockerfile packages/frontend

# Tag for registry
docker tag aws-framework-backend:staging <registry>/aws-framework-backend:staging
docker tag aws-framework-frontend:staging <registry>/aws-framework-frontend:staging

# Push to registry
docker push <registry>/aws-framework-backend:staging
docker push <registry>/aws-framework-frontend:staging
```

2. **Provision infrastructure with Terraform:**

```bash
cd terraform/environments/staging
terraform init
terraform plan
terraform apply
```

3. **Deploy application:**

```bash
# SSH to EC2 instance
ssh -i <key.pem> ec2-user@<staging-ip>

# Pull images
docker pull <registry>/aws-framework-backend:staging
docker pull <registry>/aws-framework-frontend:staging

# Start services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

4. **Verify deployment:**

```bash
# Check service health
curl https://staging.yourdomain.com/health

# Check API
curl https://staging.yourdomain.com/api/health
```

## Production Deployment

### Prerequisites

Same as staging, plus:
- Production SSL certificate
- Backup strategy configured
- Monitoring and alerting configured
- Blue-green deployment setup (optional but recommended)

### Steps

1. **Build and push production images:**

```bash
# Build with production target
docker build -t aws-framework-backend:v1.0.0 -f packages/backend/Dockerfile --target production packages/backend
docker build -t aws-framework-frontend:v1.0.0 -f packages/frontend/Dockerfile --target production packages/frontend

# Tag and push
docker tag aws-framework-backend:v1.0.0 <registry>/aws-framework-backend:v1.0.0
docker tag aws-framework-frontend:v1.0.0 <registry>/aws-framework-frontend:v1.0.0
docker push <registry>/aws-framework-backend:v1.0.0
docker push <registry>/aws-framework-frontend:v1.0.0
```

2. **Provision production infrastructure:**

```bash
cd terraform/environments/production
terraform init
terraform plan
terraform apply
```

3. **Deploy with zero downtime (blue-green):**

```bash
# Deploy to green environment
ssh -i <key.pem> ec2-user@<green-instance>
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Run smoke tests
./scripts/smoke-tests.sh https://green.yourdomain.com

# Switch load balancer to green
aws elbv2 modify-target-group --target-group-arn <arn> --health-check-path /health

# Monitor for issues
# If successful, decommission blue environment
# If issues, rollback by switching load balancer back to blue
```

4. **Run database migrations:**

```bash
# Backup database first
docker-compose exec postgres pg_dump -U framework_user aws_framework > backup.sql

# Run migrations
docker-compose exec backend npm run migrate
```

5. **Verify production deployment:**

```bash
# Health checks
curl https://yourdomain.com/health
curl https://yourdomain.com/api/health

# Monitor logs
docker-compose logs -f backend
docker-compose logs -f nginx

# Check Grafana dashboards
open https://yourdomain.com:3001
```

## SSL Certificate Setup

### Option 1: Let's Encrypt (Recommended for most deployments)

1. **Install Certbot:**

```bash
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx
```

2. **Obtain certificate:**

```bash
sudo certbot certonly --nginx -d yourdomain.com -d www.yourdomain.com
```

3. **Update docker-compose.prod.yml:**

```yaml
nginx:
  volumes:
    - /etc/letsencrypt/live/yourdomain.com/fullchain.pem:/etc/nginx/ssl/cert.pem:ro
    - /etc/letsencrypt/live/yourdomain.com/privkey.pem:/etc/nginx/ssl/key.pem:ro
```

4. **Set up auto-renewal:**

```bash
sudo certbot renew --dry-run
sudo systemctl enable certbot.timer
```

### Option 2: AWS Certificate Manager (ACM)

If using Application Load Balancer:

1. Request certificate in ACM
2. Validate domain ownership
3. Attach certificate to ALB listener
4. Configure ALB to forward to Nginx on port 80
5. Nginx handles internal routing (no SSL needed in Nginx)

### Option 3: Custom Certificate

1. Obtain certificate from your CA
2. Copy certificate files to server:

```bash
scp cert.pem key.pem ec2-user@<instance>:/etc/ssl/
```

3. Update docker-compose.prod.yml with correct paths

## Environment Variables

### Backend Environment Variables

```bash
# Database
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=aws_framework
DATABASE_USER=framework_user
DATABASE_PASSWORD=<secure-password>

# Keycloak
KEYCLOAK_URL=https://yourdomain.com/auth
KEYCLOAK_REALM=aws-framework
KEYCLOAK_CLIENT_ID=aws-framework-client
KEYCLOAK_CLIENT_SECRET=<secret>

# Application
NODE_ENV=production
API_PORT=3000
LOG_LEVEL=info

# AWS (for production)
AWS_REGION=eu-west-1
AWS_SECRETS_ARN=arn:aws:secretsmanager:...
```

### Frontend Environment Variables

```bash
VITE_API_URL=https://yourdomain.com/api
VITE_KEYCLOAK_URL=https://yourdomain.com/auth
VITE_KEYCLOAK_REALM=aws-framework
VITE_KEYCLOAK_CLIENT_ID=aws-framework-client
```

### Secrets Management

For production, use AWS Secrets Manager:

1. Store secrets in AWS Secrets Manager
2. Grant EC2 instance IAM role access to secrets
3. Backend retrieves secrets on startup
4. Never commit secrets to version control

## Troubleshooting

### Nginx Returns 502 Bad Gateway

**Cause:** Backend service is not running or not reachable

**Solution:**
```bash
# Check backend status
docker-compose ps backend

# Check backend logs
docker-compose logs backend

# Verify backend is listening
docker-compose exec backend netstat -tlnp | grep 3000

# Test backend directly
curl http://localhost:3000/health
```

### SSL Certificate Errors

**Cause:** Certificate not found or invalid

**Solution:**
```bash
# Verify certificate files exist
ls -la /etc/nginx/ssl/

# Check certificate validity
openssl x509 -in /etc/nginx/ssl/cert.pem -text -noout

# Check Nginx configuration
docker-compose exec nginx nginx -t

# Check Nginx error logs
docker-compose logs nginx | grep -i ssl
```

### Rate Limiting Issues

**Cause:** Legitimate traffic exceeds rate limits

**Solution:**
```bash
# Temporarily disable rate limiting for testing
# Edit infrastructure/nginx/default.conf and comment out limit_req lines

# Or increase limits
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=50r/s;

# Reload Nginx
docker-compose exec nginx nginx -s reload
```

### Database Connection Errors

**Cause:** Database not ready or credentials incorrect

**Solution:**
```bash
# Check database status
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Test database connection
docker-compose exec postgres psql -U framework_user -d aws_framework -c "SELECT 1"

# Verify environment variables
docker-compose exec backend env | grep DATABASE
```

### Frontend Not Loading

**Cause:** Frontend build not mounted or Nginx misconfigured

**Solution:**
```bash
# Build frontend
cd packages/frontend
npm run build

# Verify build output
ls -la dist/

# Check Nginx is serving files
docker-compose exec nginx ls -la /usr/share/nginx/html/

# Check Nginx access logs
docker-compose logs nginx | grep "GET /"
```

## Monitoring and Maintenance

### Log Aggregation

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f nginx

# Export logs
docker-compose logs --no-color > logs.txt
```

### Database Backups

```bash
# Manual backup
docker-compose exec postgres pg_dump -U framework_user aws_framework > backup-$(date +%Y%m%d).sql

# Automated backups (add to crontab)
0 2 * * * docker-compose exec postgres pg_dump -U framework_user aws_framework > /backups/backup-$(date +\%Y\%m\%d).sql
```

### Health Monitoring

```bash
# Check all service health
docker-compose ps

# Automated health check script
#!/bin/bash
curl -f https://yourdomain.com/health || exit 1
curl -f https://yourdomain.com/api/health || exit 1
```

### Scaling

```bash
# Scale backend horizontally
docker-compose up -d --scale backend=3

# Update Nginx upstream to include all backend instances
# Edit infrastructure/nginx/default.conf:
upstream backend {
    server backend-1:3000;
    server backend-2:3000;
    server backend-3:3000;
}
```

## CI/CD Integration

The framework includes GitHub Actions workflows for automated deployment:

- `.github/workflows/test.yml` - Runs on every push
- `.github/workflows/deploy-staging.yml` - Deploys to staging on merge to main
- `.github/workflows/deploy-production.yml` - Deploys to production on release tag

See `.github/workflows/` directory for workflow definitions.
