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
    /*
     * Twenty seconds, not the five-second default.
     *
     * This repository's property-based tests mount a whole page once per
     * generated case, and under coverage instrumentation that is slower again.
     * The default is sized for a unit test, so these failed intermittently —
     * always the same class of test, never the same one twice, and only when
     * the machine was busy. Raising the ceiling fixes the whole class without
     * cutting any property's run count, which is what actually buys coverage.
     */
    testTimeout: 20000,
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
        /*
         * Vite's virtual modules. Their ids begin with a null byte, and the
         * html reporter tries to write a file named after each one — which Node
         * refuses, taking the whole coverage run down with
         * `ERR_INVALID_ARG_VALUE` after the summary has already printed.
         */
        '**/\u0000*',
      ],
      /*
       * 60% is the floor for the package as a whole, and 80% where the logic
       * lives. v8 counts every JSX line as a statement, so a package-wide 80%
       * would mostly buy render-only tests over presentational components;
       * services, hooks and utils are where a missed branch is a real defect.
       */
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
        'src/{services,api,hooks,utils}/**': {
          lines: 80,
          functions: 80,
          branches: 70,
          statements: 80,
        },
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
