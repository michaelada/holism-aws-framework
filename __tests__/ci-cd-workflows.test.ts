/**
 * Integration tests for CI/CD workflows
 * 
 * These tests verify that GitHub Actions workflows are correctly configured
 * and that failed tests properly block deployment.
 * 
 * Requirements: 22.9
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

describe('CI/CD Workflow Integration Tests', () => {
  const workflowsDir = path.join(__dirname, '..', '.github', 'workflows');

  describe('Workflow File Existence', () => {
    it('should have test workflow file', () => {
      const testWorkflowPath = path.join(workflowsDir, 'test.yml');
      expect(fs.existsSync(testWorkflowPath)).toBe(true);
    });

    it('should have staging deployment workflow file', () => {
      const stagingWorkflowPath = path.join(workflowsDir, 'deploy-staging.yml');
      expect(fs.existsSync(stagingWorkflowPath)).toBe(true);
    });

    it('should have production deployment workflow file', () => {
      const productionWorkflowPath = path.join(workflowsDir, 'deploy-production.yml');
      expect(fs.existsSync(productionWorkflowPath)).toBe(true);
    });
  });

  describe('Test Workflow Configuration', () => {
    let testWorkflow: any;

    beforeAll(() => {
      const testWorkflowPath = path.join(workflowsDir, 'test.yml');
      const content = fs.readFileSync(testWorkflowPath, 'utf8');
      testWorkflow = yaml.load(content);
    });

    it('should run on push to feature branches', () => {
      expect(testWorkflow.on.push).toBeDefined();
      expect(testWorkflow.on.push['branches-ignore']).toContain('main');
    });

    it('should run on pull requests to main', () => {
      expect(testWorkflow.on.pull_request).toBeDefined();
      expect(testWorkflow.on.pull_request.branches).toContain('main');
    });

    it('should have linting step', () => {
      const testJob = testWorkflow.jobs.test;
      const lintStep = testJob.steps.find((step: any) => 
        step.name === 'Run linting'
      );
      expect(lintStep).toBeDefined();
      expect(lintStep.run).toContain('npm run lint');
    });

    it('should have unit tests step', () => {
      const testJob = testWorkflow.jobs.test;
      const testStep = testJob.steps.find((step: any) => 
        step.name === 'Run unit tests'
      );
      expect(testStep).toBeDefined();
      expect(testStep.run).toContain('npm run test');
    });

    it('should check test coverage for backend', () => {
      const testJob = testWorkflow.jobs.test;
      const coverageStep = testJob.steps.find((step: any) => 
        step.name === 'Check test coverage - Backend'
      );
      expect(coverageStep).toBeDefined();
      expect(coverageStep.run).toContain('test:coverage');
      expect(coverageStep.run).toContain('80');
    });

    it('should check test coverage for frontend', () => {
      const testJob = testWorkflow.jobs.test;
      const coverageStep = testJob.steps.find((step: any) => 
        step.name === 'Check test coverage - Frontend'
      );
      expect(coverageStep).toBeDefined();
      expect(coverageStep.run).toContain('test:coverage');
      expect(coverageStep.run).toContain('80');
    });

    it('should check test coverage for components', () => {
      const testJob = testWorkflow.jobs.test;
      const coverageStep = testJob.steps.find((step: any) => 
        step.name === 'Check test coverage - Components'
      );
      expect(coverageStep).toBeDefined();
      expect(coverageStep.run).toContain('test:coverage');
      expect(coverageStep.run).toContain('80');
    });

    it('should build backend', () => {
      const testJob = testWorkflow.jobs.test;
      const buildStep = testJob.steps.find((step: any) => 
        step.name === 'Build backend'
      );
      expect(buildStep).toBeDefined();
      expect(buildStep.run).toContain('build:backend');
    });

    it('should build frontend', () => {
      const testJob = testWorkflow.jobs.test;
      const buildStep = testJob.steps.find((step: any) => 
        step.name === 'Build frontend'
      );
      expect(buildStep).toBeDefined();
      expect(buildStep.run).toContain('build:frontend');
    });

    it('should upload coverage reports', () => {
      const testJob = testWorkflow.jobs.test;
      const uploadStep = testJob.steps.find((step: any) => 
        step.name === 'Upload coverage reports'
      );
      expect(uploadStep).toBeDefined();
      expect(uploadStep.uses).toContain('actions/upload-artifact');
    });
  });

  describe('Staging Deployment Workflow Configuration', () => {
    let stagingWorkflow: any;

    beforeAll(() => {
      const stagingWorkflowPath = path.join(workflowsDir, 'deploy-staging.yml');
      const content = fs.readFileSync(stagingWorkflowPath, 'utf8');
      stagingWorkflow = yaml.load(content);
    });

    it('should run on push to main branch', () => {
      expect(stagingWorkflow.on.push).toBeDefined();
      expect(stagingWorkflow.on.push.branches).toContain('main');
    });

    it('should have test job that runs first', () => {
      expect(stagingWorkflow.jobs.test).toBeDefined();
      const testJob = stagingWorkflow.jobs.test;
      expect(testJob.steps).toBeDefined();
    });

    it('should run all tests before deployment', () => {
      const testJob = stagingWorkflow.jobs.test;
      const testStep = testJob.steps.find((step: any) => 
        step.name === 'Run all tests'
      );
      expect(testStep).toBeDefined();
      expect(testStep.run).toContain('npm run test');
    });

    it('should have build-and-push job that depends on test', () => {
      const buildJob = stagingWorkflow.jobs['build-and-push'];
      expect(buildJob).toBeDefined();
      expect(buildJob.needs).toBe('test');
    });

    it('should build and push Docker images', () => {
      const buildJob = stagingWorkflow.jobs['build-and-push'];
      const backendBuildStep = buildJob.steps.find((step: any) => 
        step.name === 'Build and push backend image'
      );
      const frontendBuildStep = buildJob.steps.find((step: any) => 
        step.name === 'Build and push frontend image'
      );
      expect(backendBuildStep).toBeDefined();
      expect(frontendBuildStep).toBeDefined();
    });

    it('should have deploy job that depends on build-and-push', () => {
      const deployJob = stagingWorkflow.jobs.deploy;
      expect(deployJob).toBeDefined();
      expect(deployJob.needs).toBe('build-and-push');
    });

    it('should have smoke tests job that depends on deploy', () => {
      const smokeTestsJob = stagingWorkflow.jobs['smoke-tests'];
      expect(smokeTestsJob).toBeDefined();
      expect(smokeTestsJob.needs).toBe('deploy');
    });

    it('should run health checks in smoke tests', () => {
      const smokeTestsJob = stagingWorkflow.jobs['smoke-tests'];
      const backendHealthCheck = smokeTestsJob.steps.find((step: any) => 
        step.name === 'Health check - Backend'
      );
      const frontendHealthCheck = smokeTestsJob.steps.find((step: any) => 
        step.name === 'Health check - Frontend'
      );
      expect(backendHealthCheck).toBeDefined();
      expect(frontendHealthCheck).toBeDefined();
    });
  });

  describe('Production Deployment Workflow Configuration', () => {
    let productionWorkflow: any;

    beforeAll(() => {
      const productionWorkflowPath = path.join(workflowsDir, 'deploy-production.yml');
      const content = fs.readFileSync(productionWorkflowPath, 'utf8');
      productionWorkflow = yaml.load(content);
    });

    it('should run on release tag creation', () => {
      expect(productionWorkflow.on.push).toBeDefined();
      expect(productionWorkflow.on.push.tags).toContain('v*.*.*');
    });

    it('should have test job that runs first', () => {
      expect(productionWorkflow.jobs.test).toBeDefined();
      const testJob = productionWorkflow.jobs.test;
      expect(testJob.steps).toBeDefined();
    });

    it('should run all tests before deployment', () => {
      const testJob = productionWorkflow.jobs.test;
      const testStep = testJob.steps.find((step: any) => 
        step.name === 'Run all tests'
      );
      expect(testStep).toBeDefined();
      expect(testStep.run).toContain('npm run test');
    });

    it('should have build-and-push job that depends on test', () => {
      const buildJob = productionWorkflow.jobs['build-and-push'];
      expect(buildJob).toBeDefined();
      expect(buildJob.needs).toBe('test');
    });

    it('should implement blue-green deployment', () => {
      expect(productionWorkflow.jobs['deploy-blue']).toBeDefined();
      expect(productionWorkflow.jobs['smoke-tests-blue']).toBeDefined();
      expect(productionWorkflow.jobs['switch-traffic']).toBeDefined();
    });

    it('should deploy to blue environment first', () => {
      const deployBlueJob = productionWorkflow.jobs['deploy-blue'];
      expect(deployBlueJob).toBeDefined();
      expect(deployBlueJob.needs).toBe('build-and-push');
    });

    it('should run smoke tests on blue before switching traffic', () => {
      const smokeTestsJob = productionWorkflow.jobs['smoke-tests-blue'];
      expect(smokeTestsJob).toBeDefined();
      expect(smokeTestsJob.needs).toBe('deploy-blue');
    });

    it('should switch traffic only after smoke tests pass', () => {
      const switchTrafficJob = productionWorkflow.jobs['switch-traffic'];
      expect(switchTrafficJob).toBeDefined();
      expect(switchTrafficJob.needs).toBe('smoke-tests-blue');
    });

    it('should have rollback capability', () => {
      const switchTrafficJob = productionWorkflow.jobs['switch-traffic'];
      const verifyStep = switchTrafficJob.steps.find((step: any) => 
        step.name === 'Verify production traffic'
      );
      expect(verifyStep).toBeDefined();
      expect(verifyStep.run).toContain('Rolling back');
    });

    it('should cleanup green environment after successful deployment', () => {
      const cleanupJob = productionWorkflow.jobs['cleanup-green'];
      expect(cleanupJob).toBeDefined();
      expect(cleanupJob.needs).toBe('switch-traffic');
    });
  });

  describe('Failed Tests Block Deployment', () => {
    it('staging deployment should depend on test job', () => {
      const stagingWorkflowPath = path.join(workflowsDir, 'deploy-staging.yml');
      const content = fs.readFileSync(stagingWorkflowPath, 'utf8');
      const stagingWorkflow = yaml.load(content) as any;
      
      const buildJob = stagingWorkflow.jobs['build-and-push'];
      expect(buildJob.needs).toBe('test');
    });

    it('production deployment should depend on test job', () => {
      const productionWorkflowPath = path.join(workflowsDir, 'deploy-production.yml');
      const content = fs.readFileSync(productionWorkflowPath, 'utf8');
      const productionWorkflow = yaml.load(content) as any;
      
      const buildJob = productionWorkflow.jobs['build-and-push'];
      expect(buildJob.needs).toBe('test');
    });

    it('test workflow should fail if coverage is below 80%', () => {
      const testWorkflowPath = path.join(workflowsDir, 'test.yml');
      const content = fs.readFileSync(testWorkflowPath, 'utf8');
      const testWorkflow = yaml.load(content) as any;
      
      const testJob = testWorkflow.jobs.test;
      const backendCoverageStep = testJob.steps.find((step: any) => 
        step.name === 'Check test coverage - Backend'
      );
      
      expect(backendCoverageStep.run).toContain('exit 1');
    });
  });

  describe('Workflow Dependencies', () => {
    it('staging workflow should have correct job dependency chain', () => {
      const stagingWorkflowPath = path.join(workflowsDir, 'deploy-staging.yml');
      const content = fs.readFileSync(stagingWorkflowPath, 'utf8');
      const stagingWorkflow = yaml.load(content) as any;
      
      // test -> build-and-push -> deploy -> smoke-tests
      expect(stagingWorkflow.jobs['build-and-push'].needs).toBe('test');
      expect(stagingWorkflow.jobs.deploy.needs).toBe('build-and-push');
      expect(stagingWorkflow.jobs['smoke-tests'].needs).toBe('deploy');
    });

    it('production workflow should have correct job dependency chain', () => {
      const productionWorkflowPath = path.join(workflowsDir, 'deploy-production.yml');
      const content = fs.readFileSync(productionWorkflowPath, 'utf8');
      const productionWorkflow = yaml.load(content) as any;
      
      // test -> build-and-push -> deploy-blue -> smoke-tests-blue -> switch-traffic -> cleanup-green
      expect(productionWorkflow.jobs['build-and-push'].needs).toBe('test');
      expect(productionWorkflow.jobs['deploy-blue'].needs).toBe('build-and-push');
      expect(productionWorkflow.jobs['smoke-tests-blue'].needs).toBe('deploy-blue');
      expect(productionWorkflow.jobs['switch-traffic'].needs).toBe('smoke-tests-blue');
      expect(productionWorkflow.jobs['cleanup-green'].needs).toBe('switch-traffic');
    });
  });
});
