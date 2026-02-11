# Admin Frontend Deployment Verification Guide

This guide provides instructions for verifying the Keycloak Admin Integration deployment in various environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Verification](#local-development-verification)
3. [Staging Environment Verification](#staging-environment-verification)
4. [Production Environment Verification](#production-environment-verification)
5. [Manual Verification Steps](#manual-verification-steps)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

Before verifying the deployment, ensure:

- All services are built and deployed
- Database migrations have been run
- Keycloak is configured with the required realm and clients
- Environment variables are properly set

## Local Development Verification

### Automated Verification

Run the automated verification script:

```bash
./scripts/verify-deployment.sh
```

This script checks:
- Backend service health
- Keycloak accessibility
- Admin frontend accessibility
- Nginx routing
- Admin API endpoints
- Database connectivity (via backend health)

### Manual Verification Steps

#### 1. Start Services

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

#### 2. Verify Backend Service

```bash
# Check backend health
curl http://localhost:3000/health

# Expected response: {"status":"ok","timestamp":"..."}
```

#### 3. Verify Keycloak

```bash
# Check Keycloak is accessible
curl http://localhost:8080/auth/realms/aws-framework

# Expected: JSON response with realm configuration
```

Access Keycloak admin console:
- URL: http://localhost:8080/auth/admin
- Username: admin
- Password: admin

Verify:
- Realm `aws-framework` exists
- Client `aws-framework-admin` exists
- Service account client for backend exists

#### 4. Verify Admin Frontend

Open browser and navigate to:
- http://localhost/admin

Expected behavior:
- Admin frontend loads
- Redirects to Keycloak login if not authenticated
- After login with admin user, shows admin dashboard

#### 5. Verify Admin API Endpoints

```bash
# These should return 401/403 without authentication
curl -i http://localhost/api/admin/tenants
curl -i http://localhost/api/admin/users
curl -i http://localhost/api/admin/roles

# Expected: HTTP 401 or 403 (endpoints exist but require auth)
```

#### 6. Verify Nginx Routing

```bash
# Check Nginx health
curl http://localhost/health

# Check API routing
curl http://localhost/api/health

# Check auth routing
curl http://localhost/auth/realms/aws-framework

# Check admin routing
curl -I http://localhost/admin
```

## Staging Environment Verification

### Environment Setup

Set environment variables for staging:

```bash
export BASE_URL="https://staging.example.com"
export API_URL="${BASE_URL}/api"
export ADMIN_URL="${BASE_URL}/admin"
export KEYCLOAK_URL="${BASE_URL}/auth"
```

### Run Verification Script

```bash
./scripts/verify-deployment.sh
```

### Additional Staging Checks

1. **SSL/TLS Verification**
   ```bash
   # Check SSL certificate
   curl -vI https://staging.example.com/admin
   ```

2. **DNS Resolution**
   ```bash
   # Verify DNS is resolving correctly
   nslookup staging.example.com
   ```

3. **Load Balancer Health**
   - Check AWS ALB target group health
   - Verify all targets are healthy

4. **Database Connectivity**
   - Verify RDS instance is accessible
   - Check database migrations are applied

5. **Keycloak Configuration**
   - Verify realm configuration
   - Check client configurations
   - Verify service account has correct roles

## Production Environment Verification

### Pre-Deployment Checklist

- [ ] All tests pass in CI/CD pipeline
- [ ] Staging environment verified successfully
- [ ] Database backup completed
- [ ] Rollback plan prepared
- [ ] Monitoring alerts configured

### Deployment Verification

1. **Deploy to Production**
   ```bash
   # Using Terraform
   cd terraform/environments/production
   terraform plan
   terraform apply
   ```

2. **Run Verification Script**
   ```bash
   export BASE_URL="https://app.example.com"
   ./scripts/verify-deployment.sh
   ```

3. **Smoke Tests**
   - Login to admin frontend
   - Create a test tenant
   - Create a test user
   - Assign a role to the user
   - Delete test data

4. **Monitor Logs**
   ```bash
   # Check CloudWatch logs
   aws logs tail /aws/ecs/backend --follow
   
   # Check application logs
   docker-compose logs -f backend
   ```

5. **Verify Monitoring**
   - Check Prometheus metrics
   - Verify Grafana dashboards
   - Test alerting rules

## Manual Verification Steps

### Complete User Flow Testing

#### Tenant Management Flow

1. **Login to Admin Frontend**
   - Navigate to `${BASE_URL}/admin`
   - Login with admin credentials
   - Verify redirect to admin dashboard

2. **Create Tenant**
   - Click "Tenants" in navigation
   - Click "Create Tenant"
   - Fill in:
     - Name: `test-tenant-${timestamp}`
     - Display Name: `Test Tenant`
     - Domain: `test.example.com`
   - Click "Create"
   - Verify success message
   - Verify tenant appears in list

3. **Update Tenant**
   - Click "Edit" on the test tenant
   - Update Display Name to `Updated Test Tenant`
   - Click "Save"
   - Verify success message
   - Verify changes reflected in list

4. **Delete Tenant**
   - Click "Delete" on the test tenant
   - Confirm deletion
   - Verify success message
   - Verify tenant removed from list

#### User Management Flow

1. **Create User**
   - Click "Users" in navigation
   - Click "Create User"
   - Fill in:
     - Username: `test-user-${timestamp}`
     - Email: `test@example.com`
     - First Name: `Test`
     - Last Name: `User`
     - Password: `TestPassword123!`
     - Temporary Password: checked
     - Tenant: Select a tenant
   - Click "Create"
   - Verify success message
   - Verify user appears in list

2. **Update User**
   - Click "Edit" on the test user
   - Update First Name to `Updated`
   - Click "Save"
   - Verify success message
   - Verify changes reflected in list

3. **Reset Password**
   - Click "Reset Password" on the test user
   - Enter new password: `NewPassword456!`
   - Uncheck "Temporary Password"
   - Click "Reset"
   - Verify success message

4. **Delete User**
   - Click "Delete" on the test user
   - Confirm deletion
   - Verify success message
   - Verify user removed from list

#### Role Management Flow

1. **Create Role**
   - Click "Roles" in navigation
   - Click "Create Role"
   - Fill in:
     - Name: `test-role-${timestamp}`
     - Display Name: `Test Role`
     - Description: `Test role for verification`
   - Click "Create"
   - Verify success message
   - Verify role appears in list

2. **Assign Role to User**
   - Go to Users page
   - Click "Edit" on a user
   - Select the test role
   - Click "Save"
   - Verify success message
   - Verify role appears in user's role list

3. **Remove Role from User**
   - Click "Edit" on the user
   - Deselect the test role
   - Click "Save"
   - Verify success message
   - Verify role removed from user's role list

4. **Delete Role**
   - Go to Roles page
   - Click "Delete" on the test role
   - Confirm deletion
   - Verify success message
   - Verify role removed from list

### Authentication and Authorization Testing

1. **Unauthenticated Access**
   - Open incognito/private browser window
   - Navigate to `${BASE_URL}/admin`
   - Verify redirect to Keycloak login

2. **Non-Admin User Access**
   - Login with a user without admin role
   - Attempt to access `${BASE_URL}/admin`
   - Verify "Access Denied" message

3. **Admin User Access**
   - Login with admin user
   - Verify access to admin dashboard
   - Verify all admin features accessible

### Audit Logging Verification

1. **Check Audit Logs**
   ```bash
   # Connect to database
   psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME}
   
   # Query audit logs
   SELECT * FROM admin_audit_log 
   ORDER BY timestamp DESC 
   LIMIT 20;
   ```

2. **Verify Log Entries**
   - Check tenant creation logged
   - Check user creation logged
   - Check role assignment logged
   - Check password reset logged
   - Verify user_id, action, resource, resource_id, ip_address, timestamp

## Troubleshooting

### Admin Frontend Not Accessible

**Symptoms:**
- 404 error when accessing `/admin`
- Blank page or loading error

**Solutions:**
1. Check if admin frontend is built:
   ```bash
   ls -la packages/admin/dist
   ```

2. Build admin frontend:
   ```bash
   cd packages/admin
   npm run build
   ```

3. Check Nginx configuration:
   ```bash
   docker-compose exec nginx nginx -t
   docker-compose restart nginx
   ```

4. Check Nginx logs:
   ```bash
   docker-compose logs nginx
   ```

### Admin API Endpoints Return 404

**Symptoms:**
- API calls to `/api/admin/*` return 404

**Solutions:**
1. Check backend is running:
   ```bash
   docker-compose ps backend
   ```

2. Check backend logs:
   ```bash
   docker-compose logs backend
   ```

3. Verify admin routes are registered:
   ```bash
   curl http://localhost:3000/api/admin/tenants
   # Should return 401/403, not 404
   ```

### Keycloak Integration Issues

**Symptoms:**
- Login fails
- Token validation errors
- 401 errors on authenticated requests

**Solutions:**
1. Verify Keycloak realm configuration:
   - Check realm name matches environment variable
   - Verify client exists
   - Check client settings (redirect URIs, etc.)

2. Check Keycloak service account:
   - Verify service account client exists
   - Check service account has realm-admin role
   - Verify client secret matches environment variable

3. Check environment variables:
   ```bash
   # Backend
   docker-compose exec backend env | grep KEYCLOAK
   
   # Admin frontend (check browser console)
   # Should see VITE_KEYCLOAK_* variables
   ```

### Database Connection Issues

**Symptoms:**
- Backend health check fails
- Database errors in logs

**Solutions:**
1. Check database is running:
   ```bash
   docker-compose ps postgres
   ```

2. Check database connectivity:
   ```bash
   docker-compose exec postgres psql -U framework_user -d aws_framework -c "SELECT 1"
   ```

3. Verify migrations are applied:
   ```bash
   docker-compose exec backend npm run migrate
   ```

4. Check database logs:
   ```bash
   docker-compose logs postgres
   ```

### Nginx Routing Issues

**Symptoms:**
- API calls fail
- Admin frontend not loading
- Auth redirects fail

**Solutions:**
1. Check Nginx configuration:
   ```bash
   docker-compose exec nginx nginx -t
   ```

2. Reload Nginx configuration:
   ```bash
   docker-compose exec nginx nginx -s reload
   ```

3. Check Nginx logs:
   ```bash
   docker-compose logs nginx | grep error
   ```

4. Verify upstream services are accessible:
   ```bash
   # From Nginx container
   docker-compose exec nginx wget -O- http://host.docker.internal:3000/health
   docker-compose exec nginx wget -O- http://keycloak:8080/auth/realms/aws-framework
   ```

## Success Criteria

Deployment is considered successful when:

- ✅ All automated verification checks pass
- ✅ Admin frontend is accessible at `/admin`
- ✅ Admin API endpoints are accessible (return 401/403 without auth)
- ✅ Keycloak integration works (login/logout)
- ✅ Complete user flows work (tenant, user, role management)
- ✅ Authentication and authorization work correctly
- ✅ Audit logging is functioning
- ✅ No errors in application logs
- ✅ Monitoring dashboards show healthy metrics

## Post-Deployment

After successful verification:

1. **Monitor Application**
   - Check Grafana dashboards
   - Review CloudWatch metrics
   - Monitor error rates

2. **Notify Stakeholders**
   - Send deployment notification
   - Share admin frontend URL
   - Provide access instructions

3. **Document Issues**
   - Log any issues encountered
   - Update runbook if needed
   - Share lessons learned

4. **Schedule Follow-up**
   - Plan post-deployment review
   - Schedule monitoring check-ins
   - Plan next deployment

## References

- [Keycloak Setup Guide](./KEYCLOAK_SETUP.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Admin Integration Design](./KEYCLOAK_ADMIN_INTEGRATION_DESIGN.md)
- [Troubleshooting Guide](./KEYCLOAK_TROUBLESHOOTING.md)
