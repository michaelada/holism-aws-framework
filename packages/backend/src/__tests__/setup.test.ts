import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('Backend Project Setup', () => {
  describe('Required Dependencies', () => {
    it('should have package.json with all required dependencies', () => {
      const packageJsonPath = path.join(__dirname, '../../package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      // Check core dependencies
      expect(packageJson.dependencies).toHaveProperty('express');
      expect(packageJson.dependencies).toHaveProperty('pg');
      expect(packageJson.dependencies).toHaveProperty('yup');
      expect(packageJson.dependencies).toHaveProperty('jsonwebtoken');
      expect(packageJson.dependencies).toHaveProperty('dotenv');
      expect(packageJson.dependencies).toHaveProperty('winston');
      expect(packageJson.dependencies).toHaveProperty('cors');
      expect(packageJson.dependencies).toHaveProperty('helmet');
      expect(packageJson.dependencies).toHaveProperty('prom-client');

      // Check dev dependencies
      expect(packageJson.devDependencies).toHaveProperty('@types/express');
      expect(packageJson.devDependencies).toHaveProperty('@types/node');
      expect(packageJson.devDependencies).toHaveProperty('jest');
      expect(packageJson.devDependencies).toHaveProperty('ts-jest');
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
      expect(tsconfig.compilerOptions.target).toBe('ES2022');
      expect(tsconfig.compilerOptions.module).toBe('commonjs');
      expect(tsconfig.compilerOptions.strict).toBe(true);
      expect(tsconfig.compilerOptions.esModuleInterop).toBe(true);
      expect(tsconfig.compilerOptions.outDir).toBe('./dist');
      expect(tsconfig.compilerOptions.rootDir).toBe('./src');
    });

    it('should have valid jest configuration', () => {
      const jestConfigPath = path.join(__dirname, '../../jest.config.js');
      expect(fs.existsSync(jestConfigPath)).toBe(true);

      const jestConfig = require(jestConfigPath);

      expect(jestConfig.preset).toBe('ts-jest');
      expect(jestConfig.testEnvironment).toBe('node');
      expect(jestConfig.coverageThreshold).toBeDefined();
      expect(jestConfig.coverageThreshold.global.lines).toBe(80);
      expect(jestConfig.coverageThreshold.global.functions).toBe(80);
      expect(jestConfig.coverageThreshold.global.branches).toBe(80);
      expect(jestConfig.coverageThreshold.global.statements).toBe(80);
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
