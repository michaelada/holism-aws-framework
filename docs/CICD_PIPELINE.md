# CI/CD Pipeline Documentation

## Overview

This document describes the Continuous Integration and Continuous Deployment (CI/CD) pipeline for the ItsPlainSailing OrgAdmin system. The pipeline automates testing, building, and deployment processes using GitHub Actions.

## Table of Contents

1. [Pipeline Architecture](#pipeline-architecture)
2. [Workflow Triggers](#workflow-triggers)
3. [Pipeline Stages](#pipeline-stages)
4. [Environment Configuration](#environment-configuration)
5. [Secrets Management](#secrets-management)
6. [Deployment Strategies](#deployment-strategies)
7. [Rollback Procedures](#rollback-procedures)
8. [Monitoring and Alerts](#monitoring-and-alerts)
9. [Troubleshooting](#troubleshooting)

---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Code Push / PR                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                  Parallel Execution                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Lint   │  │   Unit   │  │Integration│  │ Security │   │
│  │          │  │  Tests   │  │   Tests   │  │   Scan   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                    E2E Tests                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                  Build Docker Image                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├──────────────────┬─────────────────────┐
                     ↓                  ↓                     ↓
              ┌──────────┐       ┌──────────┐        ┌──────────┐
              │ Staging  │       │Production│        │  Manual  │
              │  Deploy  │       │  Deploy  │        │  Deploy  │
              └──────────┘       └──────────┘        └──────────┘
```

---

## Workflow Triggers

### Automatic Triggers

#### 1. Push to Main Branch

```yaml
on:
  push:
    branches:
      - main
```

**Triggers**:
- Full CI pipeline (lint, test, build)
- Deployment to production
- Database migrations

**Use Case**: Production releases

#### 2. Push to Develop Branch

```yaml
on:
  push:
    branches:
      - develop
```

**Triggers**:
- Full CI pipeline
- Deployment to staging

**Use Case**: Staging deployments for testing

#### 3. Pull Requests

```yaml
on:
  pull_request:
    branches:
      - main
      - develop
```

**Triggers**:
- Lint checks
- Unit tests
- Integration tests
- E2E tests
- Security scans

**Use Case**: Code review and validation

#### 4. Path Filters

```yaml
paths:
  - 'packages/orgadmin-**/**'
  - 'packages/components/**'
  - 'packages/backend/src/**'
```

**Purpose**: Only run pipeline when relevant files change

### Manual Triggers

#### Workflow Dispatch

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options:
          - staging
          - production
```

**Usage**:
1. Go to Actions tab in GitHub
2. Select "OrgAdmin CI/CD Pipeline"
3. Click "Run workflow"
4. Choose environment
5. Click "Run workflow"

**Use Case**: Manual deployments, hotfixes, rollbacks

---

## Pipeline Stages

### Stage 1: Lint and Code Quality

**Duration**: ~2 minutes

**Jobs**:
- ESLint checks
- Prettier formatting checks
- TypeScript type checking

**Configuration**:
```yaml
lint:
  runs-on: ubuntu-latest
  steps:
    - Run ESLint
    - Run Prettier check
    - TypeScript type check
```

**Failure Handling**: Pipeline stops if linting fails

### Stage 2: Unit Tests

**Duration**: ~5 minutes

**Jobs**:
- Test all OrgAdmin packages
- Test shared components
- Generate coverage reports

**Configuration**:
```yaml
test-unit:
  runs-on: ubuntu-latest
  steps:
    - Run unit tests for each package
    - Upload coverage to Codecov
```

**Coverage Requirements**:
- Minimum 80% code coverage
- Coverage reports uploaded to Codecov

### Stage 3: Integration Tests

**Duration**: ~8 minutes

**Jobs**:
- Start PostgreSQL service
- Run database migrations
- Execute integration tests

**Configuration**:
```yaml
test-integration:
  services:
    postgres:
      image: postgres:16-alpine
  steps:
    - Run migrations
    - Run integration tests
```

**Database**: Ephemeral PostgreSQL container

### Stage 4: E2E Tests

**Duration**: ~10 minutes

**Jobs**:
- Start all services with Docker Compose
- Install Playwright browsers
- Run end-to-end tests
- Upload test results

**Configuration**:
```yaml
test-e2e:
  steps:
    - Start Docker Compose services
    - Wait for services to be ready
    - Run Playwright tests
    - Upload test artifacts
```

**Artifacts**: Playwright reports stored for 30 days

### Stage 5: Security Scanning

**Duration**: ~3 minutes

**Jobs**:
- npm audit for vulnerabilities
- Snyk security scan

**Configuration**:
```yaml
security-scan:
  steps:
    - Run npm audit
    - Run Snyk scan
```

**Thresholds**:
- npm audit: Moderate severity
- Snyk: High severity

### Stage 6: Build Docker Image

**Duration**: ~5 minutes

**Jobs**:
- Build production Docker image
- Push to GitHub Container Registry
- Tag with version and SHA

**Configuration**:
```yaml
build:
  steps:
    - Set up Docker Buildx
    - Log in to registry
    - Build and push image
```

**Image Tags**:
- `main` - Latest production
- `develop` - Latest staging
- `sha-<commit>` - Specific commit
- `v1.0.0` - Semantic version

### Stage 7: Deploy to Staging

**Duration**: ~5 minutes

**Jobs**:
- Build with staging environment variables
- Deploy to S3
- Invalidate CloudFront cache
- Run smoke tests

**Configuration**:
```yaml
deploy-staging:
  environment: staging
  steps:
    - Build for staging
    - Deploy to S3
    - Invalidate CloudFront
    - Run smoke tests
```

**Triggers**: Push to `develop` branch

### Stage 8: Deploy to Production

**Duration**: ~7 minutes

**Jobs**:
- Build with production environment variables
- Backup current deployment
- Deploy to S3
- Invalidate CloudFront cache
- Run smoke tests
- Create GitHub release

**Configuration**:
```yaml
deploy-production:
  environment: production
  steps:
    - Build for production
    - Backup current deployment
    - Deploy to S3
    - Invalidate CloudFront
    - Run smoke tests
    - Create release
```

**Triggers**: Push to `main` branch

**Approval**: Requires manual approval in GitHub

### Stage 9: Database Migrations

**Duration**: ~3 minutes

**Jobs**:
- Backup database
- Run migrations
- Verify migration status

**Configuration**:
```yaml
migrate-production:
  environment: production-db
  steps:
    - Backup database
    - Run migrations
    - Verify migrations
```

**Triggers**: After successful production deployment

---

## Environment Configuration

### GitHub Environments

#### Staging Environment

**Settings**:
- Name: `staging`
- URL: `https://staging.itsplainsailing.com/orgadmin`
- Protection rules: None
- Secrets: Staging-specific

**Deployment**:
- Automatic on push to `develop`
- No approval required

#### Production Environment

**Settings**:
- Name: `production`
- URL: `https://itsplainsailing.com/orgadmin`
- Protection rules:
  - Required reviewers: 1
  - Wait timer: 5 minutes
- Secrets: Production-specific

**Deployment**:
- Automatic on push to `main`
- Requires manual approval

#### Production Database Environment

**Settings**:
- Name: `production-db`
- Protection rules:
  - Required reviewers: 2
  - Wait timer: 10 minutes

**Purpose**: Extra protection for database operations

---

## Secrets Management

### Required Secrets

#### AWS Credentials

```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
```

**Purpose**: Deploy to S3 and CloudFront

**Setup**:
1. Create IAM user with S3 and CloudFront permissions
2. Generate access keys
3. Add to GitHub secrets

#### Staging Secrets

```
STAGING_API_URL
STAGING_KEYCLOAK_URL
STAGING_S3_BUCKET
STAGING_CLOUDFRONT_DISTRIBUTION_ID
```

**Purpose**: Staging environment configuration

#### Production Secrets

```
PRODUCTION_API_URL
PRODUCTION_KEYCLOAK_URL
PRODUCTION_S3_BUCKET
PRODUCTION_CLOUDFRONT_DISTRIBUTION_ID
PRODUCTION_DATABASE_URL
```

**Purpose**: Production environment configuration

#### Optional Secrets

```
SNYK_TOKEN              # Snyk security scanning
SLACK_WEBHOOK           # Deployment notifications
CODECOV_TOKEN           # Code coverage reporting
```

### Adding Secrets

1. Go to repository Settings
2. Navigate to Secrets and variables → Actions
3. Click "New repository secret"
4. Add name and value
5. Click "Add secret"

### Environment-Specific Secrets

1. Go to repository Settings
2. Navigate to Environments
3. Select environment (staging/production)
4. Add environment secrets

---

## Deployment Strategies

### Blue-Green Deployment

For zero-downtime deployments:

1. **Deploy to new version**
   ```bash
   aws s3 sync dist/ s3://bucket-blue/
   ```

2. **Test new version**
   ```bash
   curl -f https://blue.example.com/health
   ```

3. **Switch traffic**
   ```bash
   aws cloudfront update-distribution \
     --id DISTRIBUTION_ID \
     --origin-domain-name bucket-blue.s3.amazonaws.com
   ```

4. **Monitor**
   - Check error rates
   - Monitor performance
   - Verify functionality

5. **Rollback if needed**
   ```bash
   aws cloudfront update-distribution \
     --id DISTRIBUTION_ID \
     --origin-domain-name bucket-green.s3.amazonaws.com
   ```

### Canary Deployment

Gradual rollout to subset of users:

1. **Deploy to canary**
   - 10% of traffic to new version
   - 90% to current version

2. **Monitor metrics**
   - Error rates
   - Performance
   - User feedback

3. **Increase traffic**
   - 25% → 50% → 75% → 100%

4. **Rollback if issues**
   - Revert traffic to 0%

### Rolling Deployment

For containerized deployments:

1. **Update 1 instance**
2. **Health check**
3. **Update next instance**
4. **Repeat until all updated**

---

## Rollback Procedures

### Automatic Rollback

Pipeline automatically rolls back if:
- Smoke tests fail
- Health checks fail
- Deployment errors occur

### Manual Rollback

#### Option 1: Restore from Backup

```bash
# List backups
aws s3 ls s3://bucket-backup/

# Restore specific backup
aws s3 sync s3://bucket-backup-20240101-120000/ \
  s3://bucket/ \
  --delete

# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION_ID \
  --paths "/*"
```

#### Option 2: Redeploy Previous Version

```bash
# Checkout previous version
git checkout v1.0.0

# Trigger manual deployment
# Go to Actions → Run workflow → Select production
```

#### Option 3: Revert Commit

```bash
# Revert last commit
git revert HEAD

# Push to trigger deployment
git push origin main
```

### Database Rollback

```bash
# Rollback last migration
npm run migrate:rollback --workspace=packages/backend

# Rollback to specific version
npm run migrate:down -- 1707000000015_add-performance-indexes.js
```

**Warning**: Database rollbacks can cause data loss. Always backup first.

---

## Monitoring and Alerts

### Pipeline Monitoring

#### GitHub Actions Dashboard

- View workflow runs
- Check job status
- Download artifacts
- View logs

**URL**: `https://github.com/<org>/<repo>/actions`

#### Metrics to Monitor

- Build duration
- Test pass rate
- Deployment frequency
- Failure rate
- Mean time to recovery (MTTR)

### Deployment Monitoring

#### CloudWatch Metrics

- CloudFront requests
- Error rates (4xx, 5xx)
- Cache hit ratio
- Origin latency

#### Application Monitoring

- Page load times
- API response times
- Error rates
- User sessions

### Alerts

#### Slack Notifications

```yaml
- name: Notify deployment
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

**Triggers**:
- Deployment success/failure
- Test failures
- Security vulnerabilities

#### Email Notifications

GitHub automatically sends emails for:
- Workflow failures
- Required approvals
- Security alerts

---

## Troubleshooting

### Common Issues

#### 1. Build Failures

**Symptom**: Build job fails

**Causes**:
- Dependency installation errors
- TypeScript compilation errors
- Missing environment variables

**Solutions**:
```bash
# Check logs
# View workflow run → Select job → View logs

# Test locally
npm ci
npm run build

# Check environment variables
echo $VITE_API_BASE_URL
```

#### 2. Test Failures

**Symptom**: Tests fail in CI but pass locally

**Causes**:
- Environment differences
- Timing issues
- Missing test data

**Solutions**:
```bash
# Run tests in CI mode locally
npm test -- --run

# Check test logs
# Download test artifacts from workflow run

# Increase timeouts
# Update test configuration
```

#### 3. Deployment Failures

**Symptom**: Deployment job fails

**Causes**:
- AWS credentials invalid
- S3 bucket permissions
- CloudFront distribution issues

**Solutions**:
```bash
# Verify AWS credentials
aws sts get-caller-identity

# Check S3 permissions
aws s3 ls s3://bucket/

# Verify CloudFront distribution
aws cloudfront get-distribution --id DISTRIBUTION_ID
```

#### 4. Smoke Test Failures

**Symptom**: Smoke tests fail after deployment

**Causes**:
- CloudFront cache not invalidated
- Application errors
- Configuration issues

**Solutions**:
```bash
# Check CloudFront invalidation status
aws cloudfront get-invalidation \
  --distribution-id DISTRIBUTION_ID \
  --id INVALIDATION_ID

# Test directly
curl -v https://itsplainsailing.com/orgadmin/

# Check browser console
# Open DevTools → Console → Check for errors
```

### Debug Mode

Enable debug logging in workflow:

```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

### Re-running Workflows

1. Go to failed workflow run
2. Click "Re-run jobs"
3. Select "Re-run failed jobs" or "Re-run all jobs"

### Canceling Workflows

1. Go to running workflow
2. Click "Cancel workflow"

---

## Best Practices

### 1. Keep Pipelines Fast

- Run jobs in parallel
- Use caching for dependencies
- Optimize Docker builds
- Skip unnecessary steps

### 2. Fail Fast

- Run quick checks first (lint, type check)
- Stop pipeline on critical failures
- Provide clear error messages

### 3. Security

- Never commit secrets
- Use GitHub secrets
- Rotate credentials regularly
- Scan for vulnerabilities

### 4. Monitoring

- Track pipeline metrics
- Set up alerts
- Review failed runs
- Optimize slow jobs

### 5. Documentation

- Document pipeline changes
- Keep this document updated
- Add comments to workflow files
- Document rollback procedures

---

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [AWS Actions](https://github.com/aws-actions)
- [Deployment Guide](./ORGADMIN_DEPLOYMENT_GUIDE.md)
- [Build Documentation](./ORGADMIN_BUILD_AND_DEPLOYMENT.md)

---

## Support

For CI/CD issues:
1. Check workflow logs in GitHub Actions
2. Review this troubleshooting guide
3. Test locally with same configuration
4. Check AWS CloudWatch logs
5. Verify secrets and environment variables
