# ItsPlainSailing OrgAdmin - Build and Deployment Documentation

## Table of Contents

1. [Build Process](#build-process)
2. [Environment Variables](#environment-variables)
3. [Keycloak Configuration](#keycloak-configuration)
4. [Database Migrations](#database-migrations)
5. [Deployment Workflows](#deployment-workflows)

---

## Build Process

### Prerequisites

- Node.js 18+ installed
- npm 9+ installed
- Docker and Docker Compose (for containerized builds)
- AWS CLI configured (for production deployments)
- Terraform installed (for infrastructure management)

### Local Development Build

#### 1. Install Dependencies

```bash
# From project root
npm install

# Install workspace dependencies
npm run bootstrap
```

#### 2. Build Shared Components

```bash
# Build the shared components package first
cd packages/components
npm run build

# Build orgadmin-core package
cd ../orgadmin-core
npm run build
```

#### 3. Build Capability Modules

```bash
# Build each capability module
cd packages/orgadmin-events
npm run build

cd ../orgadmin-memberships
npm run build

cd ../orgadmin-merchandise
npm run build

cd ../orgadmin-calendar
npm run build

cd ../orgadmin-registrations
npm run build

cd ../orgadmin-ticketing
npm run build
```

#### 4. Build OrgAdmin Shell

```bash
cd packages/orgadmin-shell
npm run build
```

The build output will be in `packages/orgadmin-shell/dist/`.

### Development Server

```bash
# Start development server with hot reload
cd packages/orgadmin-shell
npm run dev

# Access at http://localhost:5175
```

### Production Build

#### 1. Set Production Environment Variables

Create `packages/orgadmin-shell/.env.production`:

```bash
VITE_API_BASE_URL=https://api.yourdomain.com/api
VITE_KEYCLOAK_URL=https://auth.yourdomain.com
VITE_KEYCLOAK_REALM=production
VITE_KEYCLOAK_CLIENT_ID=orgadmin-production
VITE_APP_NAME=ItsPlainSailing
VITE_APP_VERSION=1.0.0
```

#### 2. Build for Production

```bash
cd packages/orgadmin-shell
npm run build

# Output will be optimized and minified in dist/
```

#### 3. Build Verification

```bash
# Check build output
ls -lh dist/

# Verify bundle sizes
du -sh dist/assets/*

# Test production build locally
npm run preview
```

### Docker Build

#### Development Build

```bash
# Build development image
docker build -t orgadmin-shell:dev \
  --target development \
  -f packages/orgadmin-shell/Dockerfile \
  packages/orgadmin-shell

# Run development container
docker run -p 5175:5175 \
  -v $(pwd)/packages/orgadmin-shell/src:/app/src:ro \
  orgadmin-shell:dev
```

#### Production Build

```bash
# Build production image
docker build -t orgadmin-shell:prod \
  --target production \
  -f packages/orgadmin-shell/Dockerfile \
  packages/orgadmin-shell

# Run production container
docker run -p 80:80 orgadmin-shell:prod
```

### Build Optimization

#### Code Splitting

The build process automatically splits code by:
- Vendor libraries (React, MUI, etc.)
- Core modules (always loaded)
- Capability modules (lazy loaded)
- Shared components

#### Bundle Analysis

```bash
# Generate bundle analysis report
cd packages/orgadmin-shell
npm run build -- --mode analyze

# View report in browser
open dist/stats.html
```

#### Performance Targets

- Shell bundle: < 200KB gzipped
- Module bundles: < 150KB gzipped each
- Total initial load: < 500KB gzipped
- Lazy-loaded modules: < 100KB gzipped each

---

## Environment Variables

### Required Variables

#### API Configuration

```bash
# Backend API base URL
VITE_API_BASE_URL=http://localhost/api
# Example production: https://api.itsplainsailing.com/api
```

#### Keycloak Configuration

```bash
# Keycloak server URL
VITE_KEYCLOAK_URL=http://localhost/auth
# Example production: https://auth.itsplainsailing.com

# Keycloak realm name
VITE_KEYCLOAK_REALM=aws-framework
# Example production: production

# Keycloak client ID for OrgAdmin
VITE_KEYCLOAK_CLIENT_ID=aws-framework-orgadmin
# Example production: orgadmin-production
```

### Optional Variables

#### Application Configuration

```bash
# Application name (displayed in UI)
VITE_APP_NAME=ItsPlainSailing

# Application version
VITE_APP_VERSION=1.0.0

# Environment name (development, staging, production)
VITE_ENVIRONMENT=development
```

#### Feature Flags

```bash
# Enable analytics tracking
VITE_ENABLE_ANALYTICS=false

# Enable debug mode (verbose logging)
VITE_ENABLE_DEBUG=true

# Enable performance monitoring
VITE_ENABLE_PERFORMANCE_MONITORING=false
```

#### CDN Configuration

```bash
# CloudFront CDN URL (production only)
VITE_CDN_URL=https://d1234example.cloudfront.net

# S3 bucket for file uploads
VITE_S3_BUCKET_URL=https://s3.amazonaws.com/your-bucket
```

### Environment-Specific Configuration

#### Local Development (.env.local)

```bash
VITE_API_BASE_URL=http://localhost/api
VITE_KEYCLOAK_URL=http://localhost/auth
VITE_KEYCLOAK_REALM=aws-framework
VITE_KEYCLOAK_CLIENT_ID=aws-framework-orgadmin
VITE_ENABLE_DEBUG=true
```

#### Staging (.env.staging)

```bash
VITE_API_BASE_URL=https://api-staging.itsplainsailing.com/api
VITE_KEYCLOAK_URL=https://auth-staging.itsplainsailing.com
VITE_KEYCLOAK_REALM=staging
VITE_KEYCLOAK_CLIENT_ID=orgadmin-staging
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_DEBUG=false
```

#### Production (.env.production)

```bash
VITE_API_BASE_URL=https://api.itsplainsailing.com/api
VITE_KEYCLOAK_URL=https://auth.itsplainsailing.com
VITE_KEYCLOAK_REALM=production
VITE_KEYCLOAK_CLIENT_ID=orgadmin-production
VITE_CDN_URL=https://d1234example.cloudfront.net
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_DEBUG=false
VITE_ENABLE_PERFORMANCE_MONITORING=true
```

### Backend Environment Variables

The backend also requires configuration for OrgAdmin:

```bash
# Database connection
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Keycloak configuration
KEYCLOAK_URL=http://localhost/auth
KEYCLOAK_REALM=aws-framework
KEYCLOAK_CLIENT_ID=backend-service
KEYCLOAK_CLIENT_SECRET=your-secret-here

# AWS S3 configuration for file uploads
AWS_REGION=us-east-1
AWS_S3_BUCKET=itsplainsailing-files
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# CORS configuration
CORS_ORIGIN=http://localhost,http://localhost:5175

# Session configuration
SESSION_SECRET=your-session-secret-here
```

---

## Keycloak Configuration

### Overview

OrgAdmin uses Keycloak for authentication and authorization. Each organization administrator must:
1. Be authenticated via Keycloak
2. Have the `org-admin` role assigned
3. Be associated with an organization
4. Have appropriate capabilities enabled for their organization

### Keycloak Client Setup

#### 1. Create OrgAdmin Client

In Keycloak Admin Console:

1. Navigate to **Clients** → **Create**
2. Configure client:
   - **Client ID**: `aws-framework-orgadmin` (or `orgadmin-production` for prod)
   - **Client Protocol**: `openid-connect`
   - **Access Type**: `public`
   - **Standard Flow Enabled**: `ON`
   - **Direct Access Grants Enabled**: `ON`
   - **Valid Redirect URIs**:
     - Local: `http://localhost/*`, `http://localhost:5175/*`
     - Staging: `https://staging.itsplainsailing.com/*`
     - Production: `https://itsplainsailing.com/*`
   - **Web Origins**: Same as redirect URIs
   - **Base URL**: `/orgadmin`

3. Save the client configuration

#### 2. Configure Client Scopes

Add the following client scopes:

```
- openid (default)
- profile (default)
- email (default)
- roles (default)
- organization (custom - see below)
```

#### 3. Create Custom Organization Scope

1. Navigate to **Client Scopes** → **Create**
2. Configure scope:
   - **Name**: `organization`
   - **Protocol**: `openid-connect`
   - **Display On Consent Screen**: `ON`
   - **Include In Token Scope**: `ON`

3. Add Mapper:
   - **Name**: `organization-id`
   - **Mapper Type**: `User Attribute`
   - **User Attribute**: `organizationId`
   - **Token Claim Name**: `organizationId`
   - **Claim JSON Type**: `String`
   - **Add to ID token**: `ON`
   - **Add to access token**: `ON`
   - **Add to userinfo**: `ON`

#### 4. Create Roles

Create the following realm roles:

1. **org-admin**
   - Description: "Organization Administrator"
   - Composite: false

2. **super-admin**
   - Description: "Super Administrator"
   - Composite: false

#### 5. Configure Role Mappers

Add role mapper to OrgAdmin client:

1. Navigate to **Clients** → **aws-framework-orgadmin** → **Mappers**
2. Create mapper:
   - **Name**: `realm-roles`
   - **Mapper Type**: `User Realm Role`
   - **Token Claim Name**: `realm_access.roles`
   - **Claim JSON Type**: `String`
   - **Add to ID token**: `ON`
   - **Add to access token**: `ON`

### User Setup

#### 1. Create Organization Admin User

1. Navigate to **Users** → **Add user**
2. Configure user:
   - **Username**: `admin@organization.com`
   - **Email**: `admin@organization.com`
   - **First Name**: `Admin`
   - **Last Name**: `User`
   - **Email Verified**: `ON`
   - **Enabled**: `ON`

3. Set password:
   - Navigate to **Credentials** tab
   - Set password
   - **Temporary**: `OFF` (for production users)

#### 2. Assign Roles

1. Navigate to **Role Mappings** tab
2. Select **org-admin** from Available Roles
3. Click **Add selected**

#### 3. Set Organization Attribute

1. Navigate to **Attributes** tab
2. Add attribute:
   - **Key**: `organizationId`
   - **Value**: `<organization-uuid>`
3. Click **Save**

### Testing Keycloak Configuration

#### 1. Test Authentication Flow

```bash
# Get access token
curl -X POST "http://localhost/auth/realms/aws-framework/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=aws-framework-orgadmin" \
  -d "username=admin@organization.com" \
  -d "password=your-password" \
  -d "grant_type=password"
```

#### 2. Verify Token Claims

```bash
# Decode JWT token (use jwt.io or jwt-cli)
jwt decode <access_token>

# Verify claims include:
# - sub (user ID)
# - realm_access.roles (includes "org-admin")
# - organizationId (organization UUID)
# - email, name, etc.
```

#### 3. Test API Access

```bash
# Call protected API endpoint
curl -X GET "http://localhost/api/orgadmin/organizations/me" \
  -H "Authorization: Bearer <access_token>"
```

### Keycloak Security Best Practices

1. **Use HTTPS in production**
   - Never use HTTP for Keycloak in production
   - Configure SSL certificates

2. **Secure client secrets**
   - Store client secrets in environment variables
   - Never commit secrets to version control
   - Rotate secrets regularly

3. **Configure session timeouts**
   - Access Token Lifespan: 5 minutes
   - SSO Session Idle: 30 minutes
   - SSO Session Max: 10 hours

4. **Enable brute force detection**
   - Navigate to **Realm Settings** → **Security Defenses**
   - Enable **Brute Force Detection**
   - Configure failure thresholds

5. **Configure password policies**
   - Navigate to **Authentication** → **Password Policy**
   - Add policies:
     - Minimum Length: 8
     - Uppercase Characters: 1
     - Lowercase Characters: 1
     - Digits: 1
     - Special Characters: 1

---

## Database Migrations

### Overview

The OrgAdmin system uses database migrations to manage schema changes. Migrations are located in `packages/backend/migrations/` and are executed using a migration tool.

### Migration Files

#### Core Migrations

1. **1707000000000_create-metadata-tables.js**
   - Creates object_definitions, field_definitions, object_fields tables
   - Foundation for dynamic form system

2. **1707000000001_remove-field-mandatory.js**
   - Removes mandatory field from field_definitions
   - Adds validation_rules JSONB column

3. **1707000000002_create-keycloak-admin-tables.js**
   - Creates keycloak integration tables
   - Manages user synchronization

4. **1707000000003_create-organization-management-tables.js**
   - Creates organizations, organization_types tables
   - Creates organization_users, organization_admin_roles tables
   - Creates capabilities table

5. **1707000000004_seed-capabilities.js**
   - Seeds initial capabilities:
     - event-management
     - memberships
     - merchandise
     - calendar-bookings
     - registrations
     - event-ticketing

#### OrgAdmin Migrations

6. **1707000000005_create-events-tables.js**
   - Creates events table with enhanced attributes
   - Creates event_activities table
   - Creates event_entries table
   - Adds indexes for performance

7. **1707000000006_create-membership-tables.js**
   - Creates membership_types table
   - Creates members table
   - Creates member_filters table
   - Supports both single and group memberships

8. **1707000000007_create-merchandise-tables.js**
   - Creates merchandise_types table
   - Creates merchandise_option_types table
   - Creates merchandise_option_values table
   - Creates delivery_rules table
   - Creates merchandise_orders table
   - Creates merchandise_order_history table

9. **1707000000008_create-calendar-tables.js**
   - Creates calendars table
   - Creates time_slot_configurations table
   - Creates duration_options table
   - Creates blocked_periods table
   - Creates bookings table
   - Creates booking_history table
   - Creates schedule_rules table

10. **1707000000009_create-registration-tables.js**
    - Creates registration_types table
    - Creates registrations table
    - Creates registration_filters table

11. **1707000000010_create-ticketing-tables.js**
    - Creates ticketed_events table
    - Creates tickets table
    - Creates ticket_scans table

12. **1707000000011_create-application-forms-tables.js**
    - Creates application_forms table
    - Creates application_fields table
    - Creates application_form_fields table
    - Creates form_submissions table (unified)
    - Creates form_submission_files table

13. **1707000000012_create-payments-tables.js**
    - Creates payments table
    - Creates refunds table
    - Creates payment_methods table

14. **1707000000013_create-user-management-tables.js**
    - Creates org_admin_users table
    - Creates account_users table

15. **1707000000014_create-reports-table.js**
    - Creates reports table
    - Creates report_schedules table

16. **1707000000015_add-performance-indexes.js**
    - Adds indexes for frequently queried columns
    - Optimizes join performance
    - Adds composite indexes

### Running Migrations

#### Local Development

```bash
# Run all pending migrations
cd packages/backend
npm run migrate

# Check migration status
npm run migrate:status

# Rollback last migration
npm run migrate:rollback

# Rollback all migrations
npm run migrate:rollback:all
```

#### Docker Environment

```bash
# Run migrations in Docker
docker-compose exec backend npm run migrate

# Check status
docker-compose exec backend npm run migrate:status
```

#### Production Deployment

```bash
# SSH into production server
ssh user@production-server

# Navigate to backend directory
cd /app/packages/backend

# Backup database before migration
pg_dump -h localhost -U dbuser -d dbname > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations
npm run migrate

# Verify migration success
npm run migrate:status

# Test application
curl http://localhost/api/health
```

### Creating New Migrations

#### 1. Generate Migration File

```bash
cd packages/backend
npm run migrate:create -- create-new-feature-tables
```

This creates a new file: `migrations/TIMESTAMP_create-new-feature-tables.js`

#### 2. Write Migration

```javascript
exports.up = async function(knex) {
  // Create tables
  await knex.schema.createTable('new_table', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('organisation_id').notNullable();
    table.string('name').notNullable();
    table.text('description');
    table.timestamps(true, true);

    // Foreign keys
    table.foreign('organisation_id')
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');

    // Indexes
    table.index('organisation_id');
    table.index('name');
  });
};

exports.down = async function(knex) {
  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('new_table');
};
```

#### 3. Test Migration

```bash
# Run migration
npm run migrate

# Verify table created
psql -d dbname -c "\dt new_table"

# Test rollback
npm run migrate:rollback

# Verify table dropped
psql -d dbname -c "\dt new_table"

# Re-run migration
npm run migrate
```

### Migration Best Practices

1. **Always provide rollback**
   - Every `up` migration must have a corresponding `down`
   - Test rollback before deploying

2. **Use transactions**
   - Migrations run in transactions by default
   - Ensures atomic operations

3. **Backup before production migrations**
   - Always backup database before running migrations
   - Test migrations on staging first

4. **Add indexes for performance**
   - Index foreign keys
   - Index frequently queried columns
   - Use composite indexes for multi-column queries

5. **Handle data migrations carefully**
   - Separate schema and data migrations
   - Use batch processing for large datasets
   - Test with production-like data volumes

6. **Document breaking changes**
   - Add comments to migration files
   - Update API documentation
   - Notify team of schema changes

### Troubleshooting Migrations

#### Migration Fails

```bash
# Check error message
npm run migrate

# Check database connection
psql -d dbname -c "SELECT 1"

# Check migration lock
SELECT * FROM knex_migrations_lock;

# Force unlock if stuck
DELETE FROM knex_migrations_lock;
```

#### Rollback Issues

```bash
# Check which migrations have run
npm run migrate:status

# Manually rollback specific migration
npm run migrate:down -- 1707000000015_add-performance-indexes.js

# Check for orphaned tables
psql -d dbname -c "\dt"
```

#### Performance Issues

```bash
# Analyze query performance
EXPLAIN ANALYZE SELECT * FROM events WHERE organisation_id = 'uuid';

# Check missing indexes
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

# Add missing indexes via new migration
npm run migrate:create -- add-missing-indexes
```

---

## Deployment Workflows

### Local Development Workflow

1. **Setup**
   ```bash
   # Clone repository
   git clone <repository-url>
   cd project

   # Install dependencies
   npm install

   # Setup environment
   cp packages/orgadmin-shell/.env.example packages/orgadmin-shell/.env

   # Start services
   docker-compose up -d
   ```

2. **Development**
   ```bash
   # Start development server
   cd packages/orgadmin-shell
   npm run dev

   # Access at http://localhost:5175
   ```

3. **Testing**
   ```bash
   # Run unit tests
   npm test

   # Run integration tests
   npm run test:integration

   # Run e2e tests
   npm run test:e2e
   ```

### Staging Deployment Workflow

1. **Build**
   ```bash
   # Checkout staging branch
   git checkout staging

   # Pull latest changes
   git pull origin staging

   # Install dependencies
   npm install

   # Build for staging
   cd packages/orgadmin-shell
   npm run build -- --mode staging
   ```

2. **Deploy**
   ```bash
   # Deploy to staging server
   scp -r dist/* user@staging-server:/var/www/orgadmin/

   # Or use deployment script
   ./scripts/deploy-staging.sh
   ```

3. **Verify**
   ```bash
   # Check deployment
   curl https://staging.itsplainsailing.com/orgadmin

   # Run smoke tests
   npm run test:smoke -- --env=staging
   ```

### Production Deployment Workflow

1. **Pre-Deployment**
   ```bash
   # Create release branch
   git checkout -b release/v1.0.0

   # Update version
   npm version 1.0.0

   # Tag release
   git tag v1.0.0

   # Push to repository
   git push origin release/v1.0.0 --tags
   ```

2. **Build**
   ```bash
   # Build for production
   cd packages/orgadmin-shell
   npm run build -- --mode production

   # Verify build
   npm run preview
   ```

3. **Database Migration**
   ```bash
   # Backup production database
   ./scripts/backup-production-db.sh

   # Run migrations
   ssh user@production-server
   cd /app/packages/backend
   npm run migrate
   ```

4. **Deploy to S3/CloudFront**
   ```bash
   # Sync to S3
   aws s3 sync dist/ s3://itsplainsailing-orgadmin-ui-production/ \
     --delete \
     --cache-control "public, max-age=31536000, immutable"

   # Invalidate CloudFront cache
   aws cloudfront create-invalidation \
     --distribution-id E1234EXAMPLE \
     --paths "/*"
   ```

5. **Post-Deployment**
   ```bash
   # Verify deployment
   curl https://itsplainsailing.com/orgadmin

   # Run smoke tests
   npm run test:smoke -- --env=production

   # Monitor logs
   aws cloudwatch tail /aws/cloudfront/orgadmin --follow
   ```

6. **Rollback (if needed)**
   ```bash
   # Rollback to previous version
   aws s3 sync s3://itsplainsailing-orgadmin-ui-production-backup/ \
     s3://itsplainsailing-orgadmin-ui-production/ \
     --delete

   # Invalidate cache
   aws cloudfront create-invalidation \
     --distribution-id E1234EXAMPLE \
     --paths "/*"
   ```

### CI/CD Pipeline (GitHub Actions Example)

See [CI/CD Pipeline Configuration](#cicd-pipeline-configuration) in the next section for automated deployment workflows.

---

## Additional Resources

- [OrgAdmin Deployment Guide](./ORGADMIN_DEPLOYMENT_GUIDE.md)
- [Keycloak Setup Guide](./KEYCLOAK_SETUP.md)
- [Database Schema Documentation](../packages/backend/migrations/README.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)

---

## Support

For deployment issues:
1. Check the troubleshooting sections above
2. Review application logs
3. Verify environment variables
4. Check Keycloak configuration
5. Verify database migrations have run successfully
