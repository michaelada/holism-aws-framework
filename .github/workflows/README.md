# CI/CD Workflows

This directory contains GitHub Actions workflows for automated testing and deployment of the AWS Web Application Framework.

## Workflows

### 1. Test Workflow (`test.yml`)

**Trigger**: Push to feature branches (excluding main) and pull requests to main

**Purpose**: Run comprehensive tests on every code change to ensure quality before merging.

**Steps**:
1. Checkout code
2. Setup Node.js (tests on versions 18.x and 20.x)
3. Install dependencies
4. Run linting
5. Run unit tests
6. Check test coverage (minimum 80% for backend, frontend, and components)
7. Build all packages (backend, frontend, components)
8. Upload coverage reports and build artifacts

**Coverage Requirements**:
- Backend: ≥ 80%
- Frontend: ≥ 80%
- Components: ≥ 80%

If coverage falls below 80% for any package, the workflow fails and blocks merging.

### 2. Staging Deployment Workflow (`deploy-staging.yml`)

**Trigger**: Push to main branch

**Purpose**: Automatically deploy to staging environment after code is merged to main.

**Steps**:
1. **Test Job**: Run all tests and check coverage
2. **Build and Push Job**: Build Docker images and push to registry
   - Backend image with tags: `main`, `staging-{sha}`
   - Frontend image with tags: `main`, `staging-{sha}`
3. **Deploy Job**: Deploy to staging AWS environment
   - Initialize Terraform
   - Apply infrastructure changes
   - Deploy to EC2 instances via SSH
4. **Smoke Tests Job**: Verify deployment
   - Health check backend API
   - Health check frontend
   - Test metadata service endpoint

**Environment**: `staging`

**Required Secrets**:
- `DOCKER_USERNAME`: Docker Hub username
- `DOCKER_PASSWORD`: Docker Hub password
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `AWS_REGION`: AWS region
- `SSH_PRIVATE_KEY`: SSH key for EC2 access

### 3. Production Deployment Workflow (`deploy-production.yml`)

**Trigger**: Push of version tags (e.g., `v1.0.0`, `v2.1.3`)

**Purpose**: Deploy to production using blue-green deployment strategy for zero-downtime releases.

**Steps**:
1. **Test Job**: Run all tests and check coverage
2. **Build and Push Job**: Build production Docker images
   - Tags: `{version}`, `{major}.{minor}`, `{major}`, `latest`
3. **Deploy Blue Job**: Deploy to blue environment
   - Deploy new version to blue instances
   - Wait for deployment to complete
   - Health check blue instances
4. **Smoke Tests Blue Job**: Test blue environment
   - Health check via blue ALB
   - Test metadata service
5. **Switch Traffic Job**: Route production traffic to blue
   - Update ALB listener to point to blue target group
   - Verify production traffic
   - Rollback to green if health check fails
6. **Cleanup Green Job**: Tag old green environment as previous

**Blue-Green Deployment**:
- New version deployed to "blue" environment
- Smoke tests run on blue before switching traffic
- Traffic switched from "green" to "blue" only if tests pass
- Automatic rollback if production health check fails
- Old "green" environment kept as backup

**Environment**: `production`

**Required Secrets**:
- Same as staging deployment
- Additional production-specific secrets as needed

## Workflow Dependencies

### Test Workflow
```
checkout → setup → install → lint → test → coverage → build → upload
```

### Staging Deployment
```
test → build-and-push → deploy → smoke-tests
```

If any job fails, subsequent jobs are skipped.

### Production Deployment
```
test → build-and-push → deploy-blue → smoke-tests-blue → switch-traffic → cleanup-green
```

If any job fails, deployment stops and production remains on the current version.

## Failed Tests Block Deployment

Both staging and production deployment workflows depend on the test job. If tests fail:
- Linting errors block deployment
- Unit test failures block deployment
- Coverage below 80% blocks deployment
- Build failures block deployment

This ensures only tested, high-quality code reaches staging and production.

## Setting Up Secrets

To use these workflows, configure the following secrets in your GitHub repository:

1. Go to Settings → Secrets and variables → Actions
2. Add the following repository secrets:

**Docker Hub**:
- `DOCKER_USERNAME`: Your Docker Hub username
- `DOCKER_PASSWORD`: Your Docker Hub password or access token

**AWS**:
- `AWS_ACCESS_KEY_ID`: AWS IAM access key with deployment permissions
- `AWS_SECRET_ACCESS_KEY`: AWS IAM secret key
- `AWS_REGION`: AWS region (e.g., `eu-west-1`)

**SSH**:
- `SSH_PRIVATE_KEY`: Private SSH key for EC2 instance access

## Local Testing

You can test workflow syntax locally using [act](https://github.com/nektos/act):

```bash
# Install act
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash  # Linux

# Test the test workflow
act push -W .github/workflows/test.yml

# Test staging deployment (requires secrets)
act push -W .github/workflows/deploy-staging.yml --secret-file .secrets
```

## Monitoring Workflows

View workflow runs in the GitHub Actions tab:
- https://github.com/YOUR_ORG/YOUR_REPO/actions

Each workflow run shows:
- Job status and duration
- Step-by-step logs
- Artifacts (coverage reports, build outputs)
- Deployment status

## Troubleshooting

### Test Workflow Fails
- Check linting errors: `npm run lint`
- Run tests locally: `npm run test`
- Check coverage: `npm run test:backend -- --coverage`

### Staging Deployment Fails
- Verify AWS credentials are correct
- Check Terraform state in S3
- Review EC2 instance logs
- Verify Docker images were pushed

### Production Deployment Fails
- Check blue environment health
- Review ALB target group health
- Verify smoke tests pass
- Check rollback was successful

## Best Practices

1. **Always create feature branches** - Never push directly to main
2. **Wait for tests to pass** - Don't merge PRs with failing tests
3. **Use semantic versioning** - Tag releases as `v{major}.{minor}.{patch}`
4. **Monitor deployments** - Watch workflow runs during deployment
5. **Test in staging first** - Verify changes in staging before releasing
6. **Keep secrets secure** - Never commit secrets to the repository

## Maintenance

### Updating Node.js Version
Edit the `node-version` in each workflow:
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20.x'  # Update this
```

### Updating Terraform Version
Edit the `terraform_version` in deployment workflows:
```yaml
- name: Install Terraform
  uses: hashicorp/setup-terraform@v3
  with:
    terraform_version: 1.5.0  # Update this
```

### Adding New Tests
Tests are automatically run by the workflows. Just add them to the appropriate package:
- Backend: `packages/backend/src/__tests__/`
- Frontend: `packages/frontend/src/__tests__/`
- Components: `packages/components/src/__tests__/`
