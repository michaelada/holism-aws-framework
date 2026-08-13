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
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
