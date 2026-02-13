import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { getModuleBuildConfig, getModuleResolveConfig, sharedOptimizeDeps } from '../vite.config.shared';

export default defineConfig({
  plugins: [react()],
  
  // Path resolution
  resolve: getModuleResolveConfig(__dirname),
  
  // Optimize dependencies
  optimizeDeps: sharedOptimizeDeps,
  
  // Build configuration for library
  build: getModuleBuildConfig('OrgAdminCalendar', __dirname),
  
  // Test configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/*.test.{ts,tsx}',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
  
  // Environment variable prefix
  envPrefix: 'VITE_',
});
