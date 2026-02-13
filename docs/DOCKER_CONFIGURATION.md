# Docker Configuration Documentation

## Overview

This document describes the Docker configuration for the ItsPlainSailing OrgAdmin system, including container orchestration, networking, and deployment strategies.

## Table of Contents

1. [Architecture](#architecture)
2. [Services](#services)
3. [Docker Compose Configuration](#docker-compose-configuration)
4. [Dockerfile Details](#dockerfile-details)
5. [Networking](#networking)
6. [Volumes and Persistence](#volumes-and-persistence)
7. [Environment Variables](#environment-variables)
8. [Health Checks](#health-checks)
9. [Development Workflow](#development-workflow)
10. [Production Deployment](#production-deployment)
11. [Troubleshooting](#troubleshooting)

---

## Architecture

The system uses a microservices architecture with the following containers:

```
┌─────────────────────────────────────────────────────────────┐
│                         Nginx (Port 80/443)                  │
│                    Reverse Proxy & Load Balancer             │
└────────┬────────────────────────────────────────────────────┘
         │
         ├─────────────────────────────────────────────────────┐
         │                                                      │
         ↓                                                      ↓
┌────────────────┐                                    ┌────────────────┐
│   Backend      │                                    │   Keycloak     │
│   (Port 3000)  │←──────────────────────────────────│   (Port 8080)  │
│   Node.js API  │        Authentication              │   Auth Server  │
└────────┬───────┘                                    └────────┬───────┘
         │                                                      │
         ↓                                                      ↓
┌────────────────┐                                    ┌────────────────┐
│   PostgreSQL   │                                    │   Monitoring   │
│   (Port 5432)  │                                    │   Prometheus   │
│   Database     │                                    │   Grafana      │
└────────────────┘                                    └────────────────┘

Frontend Applications (Development - run on host):
- Frontend (Port 5173)
- Admin (Port 5174)
- OrgAdmin (Port 5175)
```

---

## Services

### Core Services

#### 1. PostgreSQL Database

```yaml
postgres:
  image: postgres:16-alpine
  ports: 5432:5432
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./infrastructure/init-db.sql:/docker-entrypoint-initdb.d/init.sql
```

**Purpose**: Primary database for all application data

**Key Features**:
- PostgreSQL 16 with Alpine Linux (lightweight)
- Persistent data storage via Docker volume
- Automatic initialization with init-db.sql
- Health checks for service readiness

#### 2. Keycloak Authentication

```yaml
keycloak:
  image: quay.io/keycloak/keycloak:23.0
  ports: 8080:8080
  depends_on:
    - postgres
```

**Purpose**: Authentication and authorization server

**Key Features**:
- OpenID Connect and OAuth 2.0 support
- User management and SSO
- Role-based access control
- Integration with PostgreSQL for persistence

#### 3. Backend API

```yaml
backend:
  build: ./packages/backend
  ports: 3000:3000
  depends_on:
    - postgres
    - keycloak
```

**Purpose**: Node.js REST API server

**Key Features**:
- Express.js application
- Database migrations
- Keycloak integration
- Health check endpoint

#### 4. Nginx Reverse Proxy

```yaml
nginx:
  image: nginx:alpine
  ports: 80:80, 443:443
  volumes:
    - ./infrastructure/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - ./infrastructure/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
```

**Purpose**: Reverse proxy and load balancer

**Key Features**:
- Routes requests to appropriate services
- SSL/TLS termination
- Static file serving
- Rate limiting and security headers

### Frontend Services (Optional in Docker)

#### 5. OrgAdmin Shell

```yaml
orgadmin:
  build: ./packages/orgadmin-shell
  ports: 5175:5175
  depends_on:
    - backend
    - keycloak
```

**Purpose**: Organization administration interface

**Key Features**:
- React + Vite development server
- Hot module replacement (HMR)
- Modular architecture
- Capability-based UI

**Note**: For local development, it's recommended to run frontend applications outside Docker to access monorepo packages efficiently.

### Monitoring Services

#### 6. Prometheus

```yaml
prometheus:
  image: prom/prometheus:latest
  ports: 9090:9090
  volumes:
    - ./infrastructure/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
```

**Purpose**: Metrics collection and monitoring

#### 7. Grafana

```yaml
grafana:
  image: grafana/grafana:latest
  ports: 3001:3000
  depends_on:
    - prometheus
```

**Purpose**: Metrics visualization and dashboards

---

## Docker Compose Configuration

### Development Configuration (docker-compose.yml)

The base configuration for local development:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Rebuild services
docker-compose up -d --build
```

**Key Features**:
- Development mode for all services
- Hot reload enabled
- Debug logging
- Source code mounted as volumes
- Authentication disabled for easier testing

### Production Configuration (docker-compose.prod.yml)

Production overrides:

```bash
# Start with production configuration
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# View production logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f
```

**Key Features**:
- Production builds
- SSL/TLS enabled
- Optimized logging
- Restart policies
- Security hardening

---

## Dockerfile Details

### OrgAdmin Shell Dockerfile

The OrgAdmin Dockerfile uses multi-stage builds for optimization:

#### Stage 1: Base

```dockerfile
FROM node:18-alpine AS base
WORKDIR /app
RUN apk add --no-cache git python3 make g++
COPY package*.json ./
```

**Purpose**: Common base layer with system dependencies

#### Stage 2: Dependencies

```dockerfile
FROM base AS dependencies
RUN npm ci
```

**Purpose**: Install all npm dependencies

#### Stage 3: Development

```dockerfile
FROM dependencies AS development
COPY . .
EXPOSE 5175
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5175"]
```

**Purpose**: Development server with hot reload

**Usage**:
```bash
docker build --target development -t orgadmin:dev .
docker run -p 5175:5175 -v $(pwd)/src:/app/src:ro orgadmin:dev
```

#### Stage 4: Builder

```dockerfile
FROM dependencies AS builder
COPY . .
ARG VITE_API_BASE_URL
ARG VITE_KEYCLOAK_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build
```

**Purpose**: Build production assets

**Usage**:
```bash
docker build \
  --target builder \
  --build-arg VITE_API_BASE_URL=https://api.example.com/api \
  --build-arg VITE_KEYCLOAK_URL=https://auth.example.com \
  -t orgadmin:builder .
```

#### Stage 5: Production

```dockerfile
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html/orgadmin
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Purpose**: Production-ready Nginx server

**Usage**:
```bash
docker build --target production -t orgadmin:prod .
docker run -p 80:80 orgadmin:prod
```

### Build Arguments

Pass environment variables at build time:

```bash
docker build \
  --build-arg VITE_API_BASE_URL=https://api.example.com/api \
  --build-arg VITE_KEYCLOAK_URL=https://auth.example.com \
  --build-arg VITE_KEYCLOAK_REALM=production \
  --build-arg VITE_KEYCLOAK_CLIENT_ID=orgadmin-prod \
  --build-arg VITE_APP_NAME=ItsPlainSailing \
  --build-arg VITE_APP_VERSION=1.0.0 \
  -t orgadmin:prod \
  .
```

---

## Networking

### Default Network

All services run on a custom bridge network:

```yaml
networks:
  default:
    name: aws-framework-network
```

**Benefits**:
- Service discovery by name
- Isolated from other Docker networks
- Automatic DNS resolution

### Service Communication

Services communicate using service names:

```bash
# Backend connects to PostgreSQL
DATABASE_HOST=postgres

# Backend connects to Keycloak
KEYCLOAK_URL=http://keycloak:8080

# Frontend connects to backend via Nginx
VITE_API_BASE_URL=http://localhost/api
```

### Host Network Access

For local development, Nginx can access services on the host:

```yaml
nginx:
  extra_hosts:
    - "host.docker.internal:host-gateway"
```

This allows Nginx to proxy to frontend dev servers running on the host machine.

---

## Volumes and Persistence

### Named Volumes

```yaml
volumes:
  postgres_data:        # PostgreSQL data
  prometheus_data:      # Prometheus metrics
  grafana_data:         # Grafana dashboards
```

**Management**:

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect aws-framework_postgres_data

# Backup volume
docker run --rm -v aws-framework_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres_backup.tar.gz /data

# Restore volume
docker run --rm -v aws-framework_postgres_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/postgres_backup.tar.gz -C /
```

### Bind Mounts

Development uses bind mounts for hot reload:

```yaml
volumes:
  - ./packages/orgadmin-shell/src:/app/src:ro  # Read-only source code
  - ./packages/backend/src:/app/src:ro         # Read-only source code
```

**Note**: `:ro` flag makes mounts read-only for security.

---

## Environment Variables

### Backend Environment Variables

```yaml
environment:
  NODE_ENV: development
  DATABASE_HOST: postgres
  DATABASE_PORT: 5432
  DATABASE_NAME: aws_framework
  DATABASE_USER: framework_user
  DATABASE_PASSWORD: framework_password
  KEYCLOAK_URL: http://keycloak:8080
  KEYCLOAK_REALM: aws-framework
  KEYCLOAK_CLIENT_ID: aws-framework-client
  API_PORT: 3000
  LOG_LEVEL: debug
  DISABLE_AUTH: true  # Development only
```

### OrgAdmin Environment Variables

```yaml
environment:
  VITE_API_BASE_URL: http://localhost/api
  VITE_KEYCLOAK_URL: http://localhost/auth
  VITE_KEYCLOAK_REALM: aws-framework
  VITE_KEYCLOAK_CLIENT_ID: aws-framework-orgadmin
  VITE_APP_NAME: ItsPlainSailing
```

### Using .env Files

Create `.env` file in project root:

```bash
# Database
POSTGRES_PASSWORD=secure_password_here

# Keycloak
KEYCLOAK_ADMIN_PASSWORD=admin_password_here
KEYCLOAK_ADMIN_CLIENT_SECRET=client_secret_here

# Backend
SESSION_SECRET=session_secret_here
```

Docker Compose automatically loads `.env` file:

```yaml
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

---

## Health Checks

### PostgreSQL Health Check

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U framework_user -d aws_framework"]
  interval: 10s
  timeout: 5s
  retries: 5
```

### Backend Health Check

```yaml
healthcheck:
  test: ["CMD-SHELL", "wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1"]
  interval: 10s
  timeout: 5s
  retries: 5
```

### Nginx Health Check

```yaml
healthcheck:
  test: ["CMD-SHELL", "wget --quiet --tries=1 --spider http://localhost:80/health || exit 1"]
  interval: 10s
  timeout: 5s
  retries: 3
```

### OrgAdmin Health Check (Production)

```yaml
healthcheck:
  test: ["CMD-SHELL", "curl -f http://localhost/orgadmin/ || exit 1"]
  interval: 30s
  timeout: 3s
  start_period: 5s
  retries: 3
```

**Check Health Status**:

```bash
# View health status
docker-compose ps

# Check specific service
docker inspect --format='{{json .State.Health}}' aws-framework-backend | jq
```

---

## Development Workflow

### Initial Setup

```bash
# 1. Clone repository
git clone <repository-url>
cd project

# 2. Create environment file
cp .env.example .env

# 3. Start infrastructure services
docker-compose up -d postgres keycloak nginx

# 4. Wait for services to be healthy
docker-compose ps

# 5. Run database migrations
docker-compose exec backend npm run migrate

# 6. Start backend
docker-compose up -d backend

# 7. Run frontend applications on host (recommended)
cd packages/orgadmin-shell
npm install
npm run dev
```

### Daily Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Restart a service
docker-compose restart backend

# Rebuild after dependency changes
docker-compose up -d --build backend

# Stop all services
docker-compose down
```

### Running Frontend in Docker (Optional)

```bash
# Uncomment orgadmin service in docker-compose.yml
# Then start the service
docker-compose up -d orgadmin

# View logs
docker-compose logs -f orgadmin

# Access at http://localhost:5175
```

### Database Operations

```bash
# Access PostgreSQL
docker-compose exec postgres psql -U framework_user -d aws_framework

# Run migrations
docker-compose exec backend npm run migrate

# Rollback migration
docker-compose exec backend npm run migrate:rollback

# Backup database
docker-compose exec postgres pg_dump -U framework_user aws_framework > backup.sql

# Restore database
docker-compose exec -T postgres psql -U framework_user aws_framework < backup.sql
```

---

## Production Deployment

### Building Production Images

```bash
# Build all production images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Build specific service
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build orgadmin

# Tag for registry
docker tag aws-framework-orgadmin:latest registry.example.com/orgadmin:1.0.0

# Push to registry
docker push registry.example.com/orgadmin:1.0.0
```

### Deploying to Production

```bash
# 1. Pull latest images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml pull

# 2. Stop old containers
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# 3. Start new containers
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 4. Run migrations
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec backend npm run migrate

# 5. Verify deployment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps
curl https://yourdomain.com/health
```

### Zero-Downtime Deployment

For production, use rolling updates:

```bash
# Scale up new version
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale backend=2

# Wait for health checks
sleep 30

# Scale down old version
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale backend=1
```

### Container Orchestration (Kubernetes/ECS)

For production at scale, consider:

- **Kubernetes**: Use Helm charts for deployment
- **AWS ECS**: Use ECS task definitions
- **Docker Swarm**: Use stack files

Example Kubernetes deployment in `kubernetes/` directory (not included in this spec).

---

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

```bash
# Error: port 5432 is already allocated
# Solution: Stop conflicting service or change port

# Find process using port
lsof -i :5432

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml
ports:
  - "5433:5432"  # Use 5433 on host
```

#### 2. Container Won't Start

```bash
# Check logs
docker-compose logs backend

# Check container status
docker-compose ps

# Inspect container
docker inspect aws-framework-backend

# Check health
docker inspect --format='{{json .State.Health}}' aws-framework-backend | jq
```

#### 3. Database Connection Issues

```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres psql -U framework_user -d aws_framework -c "SELECT 1"

# Verify environment variables
docker-compose exec backend env | grep DATABASE
```

#### 4. Keycloak Not Accessible

```bash
# Check Keycloak logs
docker-compose logs keycloak

# Verify Keycloak is healthy
docker-compose ps keycloak

# Access Keycloak admin
open http://localhost:8080
```

#### 5. Frontend Can't Connect to Backend

```bash
# Check Nginx configuration
docker-compose exec nginx nginx -t

# Check Nginx logs
docker-compose logs nginx

# Verify backend is accessible
curl http://localhost/api/health

# Check CORS settings
curl -H "Origin: http://localhost:5175" -v http://localhost/api/health
```

#### 6. Build Failures

```bash
# Clear Docker cache
docker-compose build --no-cache

# Remove old images
docker image prune -a

# Check disk space
docker system df

# Clean up
docker system prune -a --volumes
```

### Debugging Commands

```bash
# Enter container shell
docker-compose exec backend sh

# View container processes
docker-compose top backend

# View resource usage
docker stats

# View network
docker network inspect aws-framework-network

# View volumes
docker volume ls
docker volume inspect aws-framework_postgres_data
```

### Performance Optimization

```bash
# Limit container resources
docker-compose.yml:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

# Monitor resource usage
docker stats --no-stream

# Analyze image size
docker images
docker history aws-framework-orgadmin:latest
```

---

## Best Practices

### Security

1. **Never commit secrets**
   - Use `.env` files (add to `.gitignore`)
   - Use Docker secrets in production
   - Rotate credentials regularly

2. **Use read-only mounts**
   ```yaml
   volumes:
     - ./src:/app/src:ro
   ```

3. **Run as non-root user**
   ```dockerfile
   USER node
   ```

4. **Scan images for vulnerabilities**
   ```bash
   docker scan aws-framework-orgadmin:latest
   ```

### Performance

1. **Use multi-stage builds**
   - Reduces final image size
   - Separates build and runtime dependencies

2. **Leverage build cache**
   - Order Dockerfile commands by change frequency
   - Copy package files before source code

3. **Use .dockerignore**
   - Exclude unnecessary files from build context
   - Speeds up builds

### Maintenance

1. **Regular updates**
   ```bash
   # Update base images
   docker-compose pull
   docker-compose up -d
   ```

2. **Clean up regularly**
   ```bash
   # Remove unused images
   docker image prune -a

   # Remove unused volumes
   docker volume prune

   # Full cleanup
   docker system prune -a --volumes
   ```

3. **Monitor logs**
   ```bash
   # Rotate logs
   docker-compose logs --tail=1000 > logs.txt

   # Use log drivers
   logging:
     driver: "json-file"
     options:
       max-size: "10m"
       max-file: "3"
   ```

---

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Dockerfile Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- [OrgAdmin Deployment Guide](./ORGADMIN_DEPLOYMENT_GUIDE.md)
- [Build and Deployment Documentation](./ORGADMIN_BUILD_AND_DEPLOYMENT.md)

---

## Support

For Docker-related issues:
1. Check the troubleshooting section above
2. Review Docker logs: `docker-compose logs -f`
3. Verify configuration: `docker-compose config`
4. Check system resources: `docker system df`
