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
- Admin Frontend: http://localhost/admin
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

4. Run admin frontend locally:
```bash
cd packages/admin
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
docker build -t aws-framework-admin:staging -f packages/admin/Dockerfile packages/admin

# Tag for registry
docker tag aws-framework-backend:staging <registry>/aws-framework-backend:staging
docker tag aws-framework-frontend:staging <registry>/aws-framework-frontend:staging
docker tag aws-framework-admin:staging <registry>/aws-framework-admin:staging

# Push to registry
docker push <registry>/aws-framework-backend:staging
docker push <registry>/aws-framework-frontend:staging
docker push <registry>/aws-framework-admin:staging
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
docker build -t aws-framework-admin:v1.0.0 -f packages/admin/Dockerfile --target production packages/admin

# Tag and push
docker tag aws-framework-backend:v1.0.0 <registry>/aws-framework-backend:v1.0.0
docker tag aws-framework-frontend:v1.0.0 <registry>/aws-framework-frontend:v1.0.0
docker tag aws-framework-admin:v1.0.0 <registry>/aws-framework-admin:v1.0.0
docker push <registry>/aws-framework-backend:v1.0.0
docker push <registry>/aws-framework-frontend:v1.0.0
docker push <registry>/aws-framework-admin:v1.0.0
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

### Admin Frontend Environment Variables

```bash
VITE_API_BASE_URL=https://yourdomain.com/api
VITE_KEYCLOAK_URL=https://yourdomain.com/auth
VITE_KEYCLOAK_REALM=aws-framework
VITE_KEYCLOAK_CLIENT_ID=aws-framework-admin
VITE_DISABLE_AUTH=false
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

## Admin Frontend Deployment

The admin frontend is a separate React application that provides an interface for managing tenants, users, and roles. It requires proper Keycloak configuration and Nginx routing.

### Prerequisites

- Keycloak realm configured with admin client
- Service account client for backend operations
- Admin role created in Keycloak
- Nginx configured to route /admin path

### Keycloak Configuration for Admin Frontend

1. **Create Admin Client in Keycloak:**

Access Keycloak Admin Console and create a new client:

```
Client ID: aws-framework-admin
Client Protocol: openid-connect
Access Type: public
Root URL: https://yourdomain.com/admin
Valid Redirect URIs: https://yourdomain.com/admin/*
Web Origins: https://yourdomain.com
```

2. **Create Service Account Client for Backend:**

Create a confidential client for backend admin operations:

```
Client ID: aws-framework-service-account
Client Protocol: openid-connect
Access Type: confidential
Service Accounts Enabled: ON
```

After creation, go to the Service Account Roles tab and assign:
- Client: `realm-management`
- Role: `realm-admin`

3. **Get Service Account Credentials:**

Navigate to the Credentials tab and copy the Secret. Add to backend environment:

```bash
KEYCLOAK_ADMIN_CLIENT_ID=aws-framework-service-account
KEYCLOAK_ADMIN_CLIENT_SECRET=<your-secret>
```

4. **Create Admin Role:**

Navigate to Realm Roles and create:
```
Role Name: admin
Description: Administrator role for admin interface
```

5. **Assign Admin Role to Users:**

For each user who should access the admin interface:
- Navigate to Users → Select user
- Go to Role Mappings tab
- Assign the `admin` realm role

### Building Admin Frontend

1. **Set environment variables:**

Create `.env.production` in `packages/admin/`:

```bash
VITE_API_BASE_URL=https://yourdomain.com/api
VITE_KEYCLOAK_URL=https://yourdomain.com/auth
VITE_KEYCLOAK_REALM=aws-framework
VITE_KEYCLOAK_CLIENT_ID=aws-framework-admin
VITE_DISABLE_AUTH=false
```

2. **Build the application:**

```bash
cd packages/admin
npm install
npm run build
```

The built files will be in `packages/admin/dist/`.

3. **Deploy to server:**

Copy the built files to the server:

```bash
# Using SCP
scp -r packages/admin/dist/* ec2-user@<server-ip>:/var/www/admin/

# Or using Docker volume mount
# The docker-compose.prod.yml should mount the dist directory
```

### Nginx Configuration for Admin Frontend

The Nginx configuration should route `/admin` to the admin frontend. This is already configured in `infrastructure/nginx/default.conf`:

```nginx
# Admin Frontend static files
location /admin {
    limit_req zone=general_limit burst=200 nodelay;
    
    alias /usr/share/nginx/html/admin;
    index index.html;
    try_files $uri $uri/ /admin/index.html;
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Don't cache HTML files
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate";
    }
}
```

### Docker Deployment

1. **Using Docker Compose:**

The `docker-compose.yml` includes the admin service (commented out by default for local development):

```yaml
admin:
  build:
    context: ./packages/admin
    dockerfile: Dockerfile
    target: production
  container_name: aws-framework-admin
  environment:
    VITE_API_BASE_URL: https://yourdomain.com/api
    VITE_KEYCLOAK_URL: https://yourdomain.com/auth
    VITE_KEYCLOAK_REALM: aws-framework
    VITE_KEYCLOAK_CLIENT_ID: aws-framework-admin
  volumes:
    - ./packages/admin/dist:/usr/share/nginx/html/admin:ro
```

2. **Build and deploy:**

```bash
# Build admin image
docker build -t aws-framework-admin:latest -f packages/admin/Dockerfile --target production packages/admin

# Start services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Terraform Infrastructure Configuration

The admin frontend requires updates to the Terraform configuration:

1. **S3 Bucket for Admin Static Files (if using S3):**

```hcl
resource "aws_s3_bucket" "admin_frontend" {
  bucket = "${var.project_name}-admin-frontend-${var.environment}"
  
  tags = {
    Name        = "${var.project_name}-admin-frontend"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_public_access_block" "admin_frontend" {
  bucket = aws_s3_bucket.admin_frontend.id
  
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}
```

2. **CloudFront Distribution (if using CloudFront):**

Update the CloudFront distribution to include admin frontend:

```hcl
resource "aws_cloudfront_distribution" "main" {
  # ... existing configuration ...
  
  # Admin frontend origin
  origin {
    domain_name = aws_s3_bucket.admin_frontend.bucket_regional_domain_name
    origin_id   = "admin-frontend"
    
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.admin.cloudfront_access_identity_path
    }
  }
  
  # Admin frontend cache behavior
  ordered_cache_behavior {
    path_pattern     = "/admin/*"
    target_origin_id = "admin-frontend"
    
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
    
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }
}
```

3. **ALB Rules for Admin API:**

Ensure the Application Load Balancer routes admin API requests:

```hcl
resource "aws_lb_listener_rule" "admin_api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100
  
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
  
  condition {
    path_pattern {
      values = ["/api/admin/*"]
    }
  }
}
```

### CI/CD Pipeline Updates

Update your CI/CD pipeline to include admin frontend:

1. **GitHub Actions Workflow:**

Add admin frontend build and deploy steps to `.github/workflows/deploy-production.yml`:

```yaml
- name: Build Admin Frontend
  run: |
    cd packages/admin
    npm install
    npm run build
    
- name: Deploy Admin Frontend to S3
  run: |
    aws s3 sync packages/admin/dist/ s3://${{ secrets.ADMIN_S3_BUCKET }}/ --delete
    
- name: Invalidate CloudFront Cache
  run: |
    aws cloudfront create-invalidation \
      --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
      --paths "/admin/*"
```

2. **GitLab CI/CD:**

Add to `.gitlab-ci.yml`:

```yaml
build-admin:
  stage: build
  script:
    - cd packages/admin
    - npm install
    - npm run build
  artifacts:
    paths:
      - packages/admin/dist/
    expire_in: 1 hour

deploy-admin:
  stage: deploy
  dependencies:
    - build-admin
  script:
    - aws s3 sync packages/admin/dist/ s3://${ADMIN_S3_BUCKET}/ --delete
    - aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_DISTRIBUTION_ID} --paths "/admin/*"
  only:
    - main
```

### Verification

After deployment, verify the admin frontend:

1. **Access the admin interface:**
```bash
curl -I https://yourdomain.com/admin
# Should return 200 OK
```

2. **Test authentication:**
- Navigate to https://yourdomain.com/admin
- Should redirect to Keycloak login
- Login with admin user
- Should access admin dashboard

3. **Test API connectivity:**
```bash
# Test admin API endpoint (requires authentication)
curl -H "Authorization: Bearer <token>" https://yourdomain.com/api/admin/tenants
```

4. **Check logs:**
```bash
# Nginx logs
docker-compose logs nginx | grep "/admin"

# Backend logs for admin API
docker-compose logs backend | grep "admin"
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

### Admin Frontend Issues

**Issue: Admin frontend returns 404**

**Cause:** Admin frontend not built or not mounted correctly

**Solution:**
```bash
# Build admin frontend
cd packages/admin
npm run build

# Verify build output
ls -la dist/

# Check Nginx is serving admin files
docker-compose exec nginx ls -la /usr/share/nginx/html/admin/

# Check Nginx configuration
docker-compose exec nginx nginx -t

# Reload Nginx
docker-compose exec nginx nginx -s reload
```

**Issue: "Access Denied" in admin interface**

**Cause:** User doesn't have admin role

**Solution:**
```bash
# Verify user has admin role in Keycloak
# 1. Access Keycloak Admin Console: http://localhost:8080/auth/admin
# 2. Navigate to Users → Select user
# 3. Go to Role Mappings tab
# 4. Ensure 'admin' realm role is assigned

# Check backend logs for authorization errors
docker-compose logs backend | grep "403\|Forbidden"
```

**Issue: Admin API calls return 403 Forbidden**

**Cause:** Backend not configured with service account or user lacks admin role

**Solution:**
```bash
# Verify backend environment variables
docker-compose exec backend env | grep KEYCLOAK_ADMIN

# Check service account configuration in Keycloak
# 1. Navigate to Clients → aws-framework-service-account
# 2. Verify Service Accounts Enabled is ON
# 3. Go to Service Account Roles tab
# 4. Ensure realm-admin role from realm-management is assigned

# Test service account authentication
curl -X POST "http://localhost:8080/auth/realms/aws-framework/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=aws-framework-service-account" \
  -d "client_secret=<your-secret>"
```

**Issue: Admin frontend authentication loop**

**Cause:** Keycloak client misconfigured

**Solution:**
```bash
# Verify Keycloak client configuration
# 1. Navigate to Clients → aws-framework-admin
# 2. Check Valid Redirect URIs includes: https://yourdomain.com/admin/*
# 3. Check Web Origins includes: https://yourdomain.com
# 4. Verify Access Type is 'public'

# Check browser console for errors
# Look for CORS or redirect errors

# Verify environment variables
cat packages/admin/.env
# Ensure VITE_KEYCLOAK_URL and VITE_KEYCLOAK_CLIENT_ID are correct
```

**Issue: Admin API returns 401 Unauthorized**

**Cause:** Service account token expired or invalid credentials

**Solution:**
```bash
# Check backend logs for authentication errors
docker-compose logs backend | grep "401\|Unauthorized\|Keycloak"

# Verify service account credentials
# 1. Navigate to Keycloak Admin Console
# 2. Go to Clients → aws-framework-service-account → Credentials
# 3. Regenerate secret if needed
# 4. Update backend .env with new secret
# 5. Restart backend: docker-compose restart backend

# Test service account manually
curl -X POST "http://localhost:8080/auth/realms/aws-framework/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=aws-framework-service-account" \
  -d "client_secret=<your-secret>"
```

**Issue: Audit logs not being created**

**Cause:** Database migration not run or audit log service not configured

**Solution:**
```bash
# Check if admin_audit_log table exists
docker-compose exec postgres psql -U framework_user -d aws_framework -c "\dt admin_audit_log"

# Run migrations if table doesn't exist
docker-compose exec backend npm run migrate

# Check backend logs for audit log errors
docker-compose logs backend | grep "audit"

# Verify audit log service is being called
# Check backend code for auditLogService.logAdminAction() calls
```

## CI/CD Integration

The framework includes GitHub Actions workflows for automated deployment:

- `.github/workflows/test.yml` - Runs on every push
- `.github/workflows/deploy-staging.yml` - Deploys to staging on merge to main
- `.github/workflows/deploy-production.yml` - Deploys to production on release tag

See `.github/workflows/` directory for workflow definitions.
