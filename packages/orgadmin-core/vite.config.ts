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
  build: getModuleBuildConfig('OrgAdminCore', __dirname),
  
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
    /**
     * Inline the date-picker packages so Vitest transforms them itself.
     *
     * Without this the ESM build supplies LocalizationProvider while the CJS
     * build under @mui/x-date-pickers/node supplies useLocalizationContext —
     * two module instances of a single install, so the provider's React context
     * never reaches the picker and it throws "Can not find the date and time
     * pickers localization context".
     *
     * This was previously written as `deps.inline`, which Vitest deprecated and
     * now ignores; the option only takes effect under `server.deps`.
     */
    server: {
      deps: {
        inline: [
          '@mui/x-date-pickers',
          'date-fns',
        ],
      },
    },
  },
  
  // Environment variable prefix
  envPrefix: 'VITE_',
});
