import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
  // Path resolution
  resolve: {
    alias: {
      '@aws-web-framework/components': path.resolve(__dirname, '../components/src'),
      '@aws-web-framework/orgadmin-shell': path.resolve(__dirname, '../orgadmin-shell/src'),
    },
  },
  
  // Optimize dependencies
  optimizeDeps: {
    exclude: ['@aws-web-framework/components', '@aws-web-framework/orgadmin-shell'],
  },
  
  // Build configuration for library
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'OrgAdminEvents',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react-router-dom',
        'date-fns',
        /^date-fns\/.*/,
        '@mui/material',
        '@mui/icons-material',
        '@mui/x-date-pickers',
        'react-quill',
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react-router-dom': 'ReactRouterDOM',
        },
      },
    },
    sourcemap: true,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
  
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
