import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Component Library Project Setup', () => {
  describe('Required Dependencies', () => {
    it('should have package.json with all required dependencies', () => {
      const packageJsonPath = path.join(__dirname, '../../package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      // Check dependencies
      expect(packageJson.dependencies).toHaveProperty('@mui/icons-material');
      expect(packageJson.dependencies).toHaveProperty('@mui/x-date-pickers');
      expect(packageJson.dependencies).toHaveProperty('yup');

      // Check peer dependencies
      expect(packageJson.peerDependencies).toHaveProperty('react');
      expect(packageJson.peerDependencies).toHaveProperty('react-dom');
      expect(packageJson.peerDependencies).toHaveProperty('@mui/material');

      // Check dev dependencies
      expect(packageJson.devDependencies).toHaveProperty('@types/react');
      expect(packageJson.devDependencies).toHaveProperty('vite');
      expect(packageJson.devDependencies).toHaveProperty('vitest');
      expect(packageJson.devDependencies).toHaveProperty('fast-check');
    });

    it('should have required npm scripts', () => {
      const packageJsonPath = path.join(__dirname, '../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.scripts).toHaveProperty('build');
      expect(packageJson.scripts).toHaveProperty('test');
      expect(packageJson.scripts).toHaveProperty('lint');
    });

    it('should be configured as a library', () => {
      const packageJsonPath = path.join(__dirname, '../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.main).toBeDefined();
      expect(packageJson.module).toBeDefined();
      expect(packageJson.types).toBeDefined();
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
      expect(tsconfig.compilerOptions.declaration).toBe(true);
    });

    it('should have valid vite configuration for library build', () => {
      const viteConfigPath = path.join(__dirname, '../../vite.config.ts');
      expect(fs.existsSync(viteConfigPath)).toBe(true);

      const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8');
      expect(viteConfig).toContain('defineConfig');
      expect(viteConfig).toContain('react()');
      expect(viteConfig).toContain('build:');
      expect(viteConfig).toContain('lib:');
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

    it('should have index.ts entry point', () => {
      const indexPath = path.join(__dirname, '../../src/index.ts');
      expect(fs.existsSync(indexPath)).toBe(true);
    });
  });
});
