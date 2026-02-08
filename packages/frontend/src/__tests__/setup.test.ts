import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Frontend Project Setup', () => {
  describe('Required Dependencies', () => {
    it('should have package.json with all required dependencies', () => {
      const packageJsonPath = path.join(__dirname, '../../package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      // Check core dependencies
      expect(packageJson.dependencies).toHaveProperty('react');
      expect(packageJson.dependencies).toHaveProperty('react-dom');
      expect(packageJson.dependencies).toHaveProperty('@mui/material');
      expect(packageJson.dependencies).toHaveProperty('@mui/icons-material');
      expect(packageJson.dependencies).toHaveProperty('yup');
      expect(packageJson.dependencies).toHaveProperty('axios');
      expect(packageJson.dependencies).toHaveProperty('keycloak-js');

      // Check dev dependencies
      expect(packageJson.devDependencies).toHaveProperty('@types/react');
      expect(packageJson.devDependencies).toHaveProperty('@types/react-dom');
      expect(packageJson.devDependencies).toHaveProperty('vite');
      expect(packageJson.devDependencies).toHaveProperty('vitest');
      expect(packageJson.devDependencies).toHaveProperty('fast-check');
    });

    it('should have required npm scripts', () => {
      const packageJsonPath = path.join(__dirname, '../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.scripts).toHaveProperty('dev');
      expect(packageJson.scripts).toHaveProperty('build');
      expect(packageJson.scripts).toHaveProperty('test');
      expect(packageJson.scripts).toHaveProperty('lint');
    });
  });

  describe('TypeScript Configuration', () => {
    it('should have valid tsconfig.json', () => {
      const tsconfigPath = path.join(__dirname, '../../tsconfig.json');
      expect(fs.existsSync(tsconfigPath)).toBe(true);

      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));

      // Check compiler options
      expect(tsconfig.compilerOptions).toBeDefined();
      expect(tsconfig.compilerOptions.target).toBe('ES2020');
      expect(tsconfig.compilerOptions.jsx).toBe('react-jsx');
      expect(tsconfig.compilerOptions.strict).toBe(true);
      expect(tsconfig.compilerOptions.esModuleInterop).toBe(true);
    });

    it('should have valid vite configuration', () => {
      const viteConfigPath = path.join(__dirname, '../../vite.config.ts');
      expect(fs.existsSync(viteConfigPath)).toBe(true);

      const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8');
      expect(viteConfig).toContain('defineConfig');
      expect(viteConfig).toContain('react()');
      expect(viteConfig).toContain('test:');
      expect(viteConfig).toContain('coverage:');
    });

    it('should have coverage thresholds configured', () => {
      const viteConfigPath = path.join(__dirname, '../../vite.config.ts');
      const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8');

      expect(viteConfig).toContain('thresholds');
      expect(viteConfig).toContain('lines: 80');
      expect(viteConfig).toContain('functions: 80');
      expect(viteConfig).toContain('branches: 80');
      expect(viteConfig).toContain('statements: 80');
    });
  });

  describe('Project Structure', () => {
    it('should have src directory', () => {
      const srcPath = path.join(__dirname, '../../src');
      expect(fs.existsSync(srcPath)).toBe(true);
      expect(fs.statSync(srcPath).isDirectory()).toBe(true);
    });

    it('should have main.tsx entry point', () => {
      const mainPath = path.join(__dirname, '../../src/main.tsx');
      expect(fs.existsSync(mainPath)).toBe(true);
    });

    it('should have index.html', () => {
      const indexPath = path.join(__dirname, '../../index.html');
      expect(fs.existsSync(indexPath)).toBe(true);
    });
  });
});
