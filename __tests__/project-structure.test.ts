import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('Project Structure', () => {
  describe('Monorepo Setup', () => {
    it('should have root package.json with workspaces', () => {
      const packageJsonPath = path.join(__dirname, '../package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.workspaces).toBeDefined();
      expect(packageJson.workspaces).toContain('packages/backend');
      expect(packageJson.workspaces).toContain('packages/frontend');
      expect(packageJson.workspaces).toContain('packages/components');
    });

    it('should have all package directories', () => {
      const backendPath = path.join(__dirname, '../packages/backend');
      const frontendPath = path.join(__dirname, '../packages/frontend');
      const componentsPath = path.join(__dirname, '../packages/components');

      expect(fs.existsSync(backendPath)).toBe(true);
      expect(fs.existsSync(frontendPath)).toBe(true);
      expect(fs.existsSync(componentsPath)).toBe(true);
    });
  });

  describe('Docker Configuration', () => {
    it('should have docker-compose.yml', () => {
      const dockerComposePath = path.join(__dirname, '../docker-compose.yml');
      expect(fs.existsSync(dockerComposePath)).toBe(true);

      const dockerCompose = fs.readFileSync(dockerComposePath, 'utf-8');
      expect(dockerCompose).toContain('postgres:');
      expect(dockerCompose).toContain('keycloak:');
      expect(dockerCompose).toContain('nginx:');
      expect(dockerCompose).toContain('prometheus:');
      expect(dockerCompose).toContain('grafana:');
    });

    it('should have nginx configuration', () => {
      const nginxConfPath = path.join(__dirname, '../infrastructure/nginx/nginx.conf');
      const nginxDefaultPath = path.join(__dirname, '../infrastructure/nginx/default.conf');

      expect(fs.existsSync(nginxConfPath)).toBe(true);
      expect(fs.existsSync(nginxDefaultPath)).toBe(true);
    });

    it('should have prometheus configuration', () => {
      const prometheusPath = path.join(__dirname, '../infrastructure/prometheus/prometheus.yml');
      expect(fs.existsSync(prometheusPath)).toBe(true);
    });

    it('should have grafana datasource configuration', () => {
      const grafanaPath = path.join(
        __dirname,
        '../infrastructure/grafana/provisioning/datasources/prometheus.yml'
      );
      expect(fs.existsSync(grafanaPath)).toBe(true);
    });
  });

  describe('Code Quality Tools', () => {
    it('should have ESLint configuration', () => {
      const eslintPath = path.join(__dirname, '../.eslintrc.json');
      expect(fs.existsSync(eslintPath)).toBe(true);

      const eslintConfig = JSON.parse(fs.readFileSync(eslintPath, 'utf-8'));
      expect(eslintConfig.parser).toBe('@typescript-eslint/parser');
      expect(eslintConfig.extends).toContain('prettier');
    });

    it('should have Prettier configuration', () => {
      const prettierPath = path.join(__dirname, '../.prettierrc.json');
      expect(fs.existsSync(prettierPath)).toBe(true);

      const prettierConfig = JSON.parse(fs.readFileSync(prettierPath, 'utf-8'));
      expect(prettierConfig.semi).toBeDefined();
      expect(prettierConfig.singleQuote).toBeDefined();
    });

    it('should have .gitignore', () => {
      const gitignorePath = path.join(__dirname, '../.gitignore');
      expect(fs.existsSync(gitignorePath)).toBe(true);

      const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
      expect(gitignore).toContain('node_modules');
      expect(gitignore).toContain('dist');
      expect(gitignore).toContain('.env');
    });
  });

  describe('Environment Configuration', () => {
    it('should have environment example files', () => {
      const rootEnvPath = path.join(__dirname, '../.env.example');
      const backendEnvPath = path.join(__dirname, '../packages/backend/.env.example');
      const frontendEnvPath = path.join(__dirname, '../packages/frontend/.env.example');

      expect(fs.existsSync(rootEnvPath)).toBe(true);
      expect(fs.existsSync(backendEnvPath)).toBe(true);
      expect(fs.existsSync(frontendEnvPath)).toBe(true);
    });
  });

  describe('Documentation', () => {
    it('should have README.md', () => {
      const readmePath = path.join(__dirname, '../README.md');
      expect(fs.existsSync(readmePath)).toBe(true);

      const readme = fs.readFileSync(readmePath, 'utf-8');
      expect(readme).toContain('AWS Web Application Framework');
      expect(readme).toContain('Getting Started');
    });
  });
});
