import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
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
  resolve: getModuleResolveConfig(__dirname),
  
  // Optimize dependencies
  optimizeDeps: sharedOptimizeDeps,
  
  // Build configuration for library
  build: getModuleBuildConfig('OrgAdminMemberships', __dirname),
  
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
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
  
  // Environment variable prefix
  envPrefix: 'VITE_',
});
