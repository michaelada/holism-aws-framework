import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@aws-web-framework/components': path.resolve(__dirname, '../components/src'),
    },
  },
  optimizeDeps: {
    exclude: ['@aws-web-framework/components'],
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
      /*
       * 127.0.0.1, not `localhost`. On macOS `localhost` resolves to ::1
       * first, so any other dev server holding [::1]:3000 answers the proxy
       * instead of the backend — returning its own index.html with a 200 for
       * every /api call, which the app then parses as JSON. Naming the IPv4
       * address is what the target actually means and removes the ambiguity.
       */
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
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
        '**/mockData',
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
});
