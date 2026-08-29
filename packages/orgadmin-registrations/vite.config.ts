import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { getModuleBuildConfig, getModuleResolveConfig, sharedOptimizeDeps } from '../vite.config.shared';

// Plugin to mock CSS imports in tests
const mockCssPlugin = () => ({
  name: 'mock-css',
  resolveId(id: string) {
    // Let react-quill CSS resolve normally
    return null;
  },
  load(id: string) {
    // Mock the CSS file content during tests
    if (id.includes('quill.snow.css')) {
      return 'export default {}';
    }
  },
  transform(code: string, id: string) {
    if (id.endsWith('.css')) {
      return {
        code: 'export default {}',
        map: null,
      };
    }
  },
});

export default defineConfig({
  plugins: [react(), mockCssPlugin()],
  
  // Path resolution
  resolve: {
    ...getModuleResolveConfig(__dirname),
    alias: {
      ...getModuleResolveConfig(__dirname).alias,
      '@aws-web-framework/orgadmin-events': path.resolve(__dirname, '../orgadmin-events/src'),
    },
  },
  
  // Optimize dependencies
  optimizeDeps: sharedOptimizeDeps,
  
  // Build configuration for library
  build: getModuleBuildConfig('OrgAdminRegistrations', __dirname),
  
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
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
    server: {
      deps: {
        inline: ['react-quill'],
      },
    },
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
  },
  
  // Environment variable prefix
  envPrefix: 'VITE_',
});
