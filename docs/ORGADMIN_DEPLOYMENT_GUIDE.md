# OrgAdmin UI Deployment Guide

## Overview

This guide covers the deployment configuration updates required to incorporate the ItsPlainSailing OrgAdmin UI into the existing infrastructure. The OrgAdmin UI is a modular, capability-driven interface for organization administrators.

## Architecture Overview

The system now includes four frontend applications:
1. **Frontend** (`/`) - Public-facing application for end users
2. **Admin** (`/admin`) - Super admin interface for system administrators
3. **OrgAdmin** (`/orgadmin`) - Organization admin interface (NEW)
4. **AccountUser** (`/accountuser`) - Organization member interface (future)

## Table of Contents

1. [Local Development (Docker Compose)](#local-development-docker-compose)
2. [Nginx Configuration](#nginx-configuration)
3. [Terraform Infrastructure](#terraform-infrastructure)
4. [AWS CloudFront (Production)](#aws-cloudfront-production)
5. [Environment Variables](#environment-variables)
6. [Deployment Checklist](#deployment-checklist)

---

## Local Development (Docker Compose)

### 1. Update `docker-compose.yml`

Add the OrgAdmin service to your `docker-compose.yml`:

```yaml
services:
  # ... existing services (postgres, keycloak, backend, etc.) ...

  # OrgAdmin Frontend - For local development
  orgadmin:
    build:
      context: ./packages/orgadmin-shell
      dockerfile: Dockerfile
      target: development
    container_name: aws-framework-orgadmin
    environment:
      VITE_API_BASE_URL: http://localhost/api
      VITE_KEYCLOAK_URL: http://localhost/auth
      VITE_KEYCLOAK_REALM: aws-framework
      VITE_KEYCLOAK_CLIENT_ID: aws-framework-orgadmin
    ports:
      - "5175:5175"
    volumes:
      - ./packages/orgadmin-shell/src:/app/src:ro
    command: npm run dev
    depends_on:
      - backend
      - keycloak

  # ... rest of services ...
```

### 2. Update `docker-compose.prod.yml`

Add production overrides for OrgAdmin:

```yaml
services:
  orgadmin:
    build:
      target: production
    restart: unless-stopped
```

### 3. Create OrgAdmin Dockerfile

Create `packages/orgadmin-shell/Dockerfile`:


```dockerfile
# Multi-stage build for OrgAdmin Shell
FROM node:18-alpine AS base
WORKDIR /app

# Development stage
FROM base AS development
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5175
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Build stage
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html/orgadmin
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 4. Running Locally

Start all services including OrgAdmin:

```bash
# Start all services
docker-compose up -d

# View OrgAdmin logs
docker-compose logs -f orgadmin

# Access OrgAdmin UI
open http://localhost/orgadmin
```

---

## Nginx Configuration

### 1. Update `infrastructure/nginx/default.conf`

Add routing for OrgAdmin UI and API endpoints:

```nginx
# ... existing configuration ...

# OrgAdmin API endpoints - proxy to backend service
location /api/orgadmin/ {
    limit_req zone=api_limit burst=20 nodelay;
    limit_req_status 429;
    
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    
    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    
    # Buffer settings
    proxy_buffering on;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
    proxy_busy_buffers_size 8k;
}

# OrgAdmin Frontend - proxy to development server (local dev)
location /orgadmin {
    limit_req zone=general_limit burst=200 nodelay;
    
    proxy_pass http://host.docker.internal:5175;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    
    # WebSocket support for HMR
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# ... rest of configuration ...
```

### 2. Update `infrastructure/nginx/default-ssl.conf`

For production with SSL, add similar configuration with HTTPS:


```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # ... existing SSL configuration ...

    # OrgAdmin API endpoints
    location /api/orgadmin/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://backend;
        # ... same proxy settings as above ...
    }

    # OrgAdmin Frontend - serve static files in production
    location /orgadmin {
        alias /usr/share/nginx/html/orgadmin;
        try_files $uri $uri/ /orgadmin/index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

### 3. Test Nginx Configuration

```bash
# Test configuration syntax
docker-compose exec nginx nginx -t

# Reload Nginx
docker-compose exec nginx nginx -s reload
```

---

## Terraform Infrastructure

### 1. Update `terraform/modules/compute/main.tf`

Add target group and listener rules for OrgAdmin:

```hcl
# Target Group for OrgAdmin Frontend
resource "aws_lb_target_group" "orgadmin" {
  name     = "${var.environment}-orgadmin-tg"
  port     = 5175
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/orgadmin"
    matcher             = "200"
  }

  deregistration_delay = 30

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-orgadmin-tg"
    }
  )
}

# Listener Rule for OrgAdmin API requests
resource "aws_lb_listener_rule" "orgadmin_api" {
  count        = var.ssl_certificate_arn != "" ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 85

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/orgadmin/*"]
    }
  }

  tags = var.tags
}

# Listener Rule for OrgAdmin Frontend
resource "aws_lb_listener_rule" "orgadmin" {
  count        = var.ssl_certificate_arn != "" ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 75

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.orgadmin.arn
  }

  condition {
    path_pattern {
      values = ["/orgadmin", "/orgadmin/*"]
    }
  }

  tags = var.tags
}

# Update Auto Scaling Group to include orgadmin target group
resource "aws_autoscaling_group" "app" {
  name                = "${var.environment}-app-asg"
  vpc_zone_identifier = var.private_subnet_ids
  target_group_arns   = [
    aws_lb_target_group.backend.arn,
    aws_lb_target_group.frontend.arn,
    aws_lb_target_group.admin.arn,
    aws_lb_target_group.orgadmin.arn  # ADD THIS LINE
  ]
  
  # ... rest of configuration ...
}
```

### 2. Update `terraform/modules/compute/outputs.tf`

Add OrgAdmin target group output:

```hcl
output "orgadmin_target_group_arn" {
  description = "ARN of the OrgAdmin target group"
  value       = aws_lb_target_group.orgadmin.arn
}
```

### 3. Apply Terraform Changes

```bash
# Navigate to environment directory
cd terraform/environments/staging  # or production

# Plan changes
terraform plan

# Apply changes
terraform apply

# Verify target groups
aws elbv2 describe-target-groups --names staging-orgadmin-tg
```

---

## AWS CloudFront (Production)

For production deployment, OrgAdmin UI should be served via CloudFront CDN for optimal performance.

### 1. Create CloudFront Terraform Module

Create `terraform/modules/cloudfront-orgadmin/main.tf`:


```hcl
# S3 Bucket for OrgAdmin UI Static Assets
resource "aws_s3_bucket" "orgadmin_ui" {
  bucket = "itsplainsailing-orgadmin-ui-${var.environment}"

  tags = merge(
    var.tags,
    {
      Name        = "ItsPlainSailing OrgAdmin UI"
      Environment = var.environment
    }
  )
}

# S3 Bucket Versioning
resource "aws_s3_bucket_versioning" "orgadmin_ui" {
  bucket = aws_s3_bucket.orgadmin_ui.id

  versioning_configuration {
    status = "Enabled"
  }
}

# S3 Bucket Public Access Block
resource "aws_s3_bucket_public_access_block" "orgadmin_ui" {
  bucket = aws_s3_bucket.orgadmin_ui.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront Origin Access Identity
resource "aws_cloudfront_origin_access_identity" "orgadmin_ui" {
  comment = "OrgAdmin UI OAI for ${var.environment}"
}

# S3 Bucket Policy for CloudFront
resource "aws_s3_bucket_policy" "orgadmin_ui" {
  bucket = aws_s3_bucket.orgadmin_ui.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.orgadmin_ui.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.orgadmin_ui.arn}/*"
      }
    ]
  })
}

# CloudFront Distribution for OrgAdmin UI
resource "aws_cloudfront_distribution" "orgadmin_ui" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "ItsPlainSailing OrgAdmin UI Distribution - ${var.environment}"
  default_root_object = "index.html"
  price_class         = var.cloudfront_price_class

  origin {
    domain_name = aws_s3_bucket.orgadmin_ui.bucket_regional_domain_name
    origin_id   = "S3-orgadmin-ui"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.orgadmin_ui.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-orgadmin-ui"

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
    compress               = true
  }

  # Custom error response for SPA routing
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = merge(
    var.tags,
    {
      Name        = "ItsPlainSailing OrgAdmin UI"
      Environment = var.environment
    }
  )
}
```

### 2. Create CloudFront Variables

Create `terraform/modules/cloudfront-orgadmin/variables.tf`:

```hcl
variable "environment" {
  description = "Environment name"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ARN of ACM certificate for CloudFront"
  type        = string
}

variable "cloudfront_price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_100"  # US, Canada, Europe
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
```

### 3. Create CloudFront Outputs

Create `terraform/modules/cloudfront-orgadmin/outputs.tf`:

```hcl
output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.orgadmin_ui.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.orgadmin_ui.domain_name
}

output "s3_bucket_name" {
  description = "S3 bucket name for OrgAdmin UI"
  value       = aws_s3_bucket.orgadmin_ui.id
}
```

### 4. Deploy to CloudFront

```bash
# Build OrgAdmin UI
cd packages/orgadmin-shell
npm run build

# Sync to S3
aws s3 sync dist/ s3://itsplainsailing-orgadmin-ui-production/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id E1234EXAMPLE \
  --paths "/*"
```

---

## Environment Variables

### OrgAdmin Shell Environment Variables

Create `packages/orgadmin-shell/.env.example`:

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost/api

# Keycloak Configuration
VITE_KEYCLOAK_URL=http://localhost/auth
VITE_KEYCLOAK_REALM=aws-framework
VITE_KEYCLOAK_CLIENT_ID=aws-framework-orgadmin

# Application Configuration
VITE_APP_NAME=ItsPlainSailing
VITE_APP_VERSION=1.0.0

# Feature Flags (optional)
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG=false
```

### Production Environment Variables

For production deployment:

```bash
# API Configuration
VITE_API_BASE_URL=https://api.yourdomain.com/api

# Keycloak Configuration
VITE_KEYCLOAK_URL=https://auth.yourdomain.com
VITE_KEYCLOAK_REALM=production
VITE_KEYCLOAK_CLIENT_ID=orgadmin-production

# CloudFront Configuration
VITE_CDN_URL=https://d1234example.cloudfront.net
```

---

## Deployment Checklist

### Local Development Setup

- [ ] Add OrgAdmin service to `docker-compose.yml`
- [ ] Create `packages/orgadmin-shell/Dockerfile`
- [ ] Update Nginx configuration with `/orgadmin` routes
- [ ] Configure environment variables in `.env`
- [ ] Start services: `docker-compose up -d`
- [ ] Verify OrgAdmin UI accessible at `http://localhost/orgadmin`
- [ ] Verify API endpoints at `http://localhost/api/orgadmin/*`

### Staging Deployment

- [ ] Update Terraform compute module with OrgAdmin target group
- [ ] Apply Terraform changes: `terraform apply`
- [ ] Build OrgAdmin UI: `npm run build`
- [ ] Deploy to EC2 instances or container service
- [ ] Update Nginx configuration on staging servers
- [ ] Configure Keycloak client for staging
- [ ] Test authentication flow
- [ ] Verify all modules load correctly
- [ ] Test capability-based access control

### Production Deployment

- [ ] Create CloudFront Terraform module
- [ ] Request ACM certificate for custom domain
- [ ] Apply CloudFront Terraform: `terraform apply`
- [ ] Build production OrgAdmin UI with production env vars
- [ ] Deploy to S3: `aws s3 sync dist/ s3://bucket-name/`
- [ ] Invalidate CloudFront cache
- [ ] Configure DNS (Route53) to point to CloudFront
- [ ] Update Keycloak client for production
- [ ] Configure SSL certificates
- [ ] Test HTTPS access
- [ ] Verify SPA routing works (404 → index.html)
- [ ] Monitor CloudFront metrics
- [ ] Set up CloudWatch alarms

### Post-Deployment Verification

- [ ] Test user authentication via Keycloak
- [ ] Verify organization loading
- [ ] Test capability-based module visibility
- [ ] Verify all core modules accessible
- [ ] Test capability modules (events, memberships, etc.)
- [ ] Verify form builder functionality
- [ ] Test file upload to S3
- [ ] Verify API endpoints respond correctly
- [ ] Check application logs for errors
- [ ] Monitor performance metrics
- [ ] Test on multiple browsers
- [ ] Verify mobile responsiveness

---

## Troubleshooting

### OrgAdmin UI Not Loading

1. Check Nginx logs: `docker-compose logs nginx`
2. Verify OrgAdmin service is running: `docker-compose ps orgadmin`
3. Check browser console for errors
4. Verify environment variables are set correctly

### Authentication Issues

1. Check Keycloak configuration
2. Verify client ID matches environment variable
3. Check CORS settings in backend
4. Verify JWT token is being sent in requests

### CloudFront Issues

1. Check S3 bucket policy allows CloudFront access
2. Verify Origin Access Identity is configured
3. Check custom error responses for SPA routing
4. Invalidate cache after deployment

### API Endpoint Issues

1. Verify backend routes are registered
2. Check capability middleware is configured
3. Verify organization has required capabilities
4. Check database migrations have run

---

## Additional Resources

- [OrgAdmin System Requirements](.kiro/specs/orgadmin-system/requirements.md)
- [OrgAdmin System Design](.kiro/specs/orgadmin-system/design.md)
- [OrgAdmin Implementation Tasks](.kiro/specs/orgadmin-system/tasks.md)
- [Keycloak Setup Guide](./KEYCLOAK_SETUP.md)
- [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the spec documents in `.kiro/specs/orgadmin-system/`
3. Check application logs: `docker-compose logs -f orgadmin`
4. Verify infrastructure with: `terraform plan`

