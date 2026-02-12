import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

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
      name: 'OrgAdminRegistrations',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react-router-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react-router-dom': 'ReactRouterDOM',
        },
      },
    },
    sourcemap: true,
  },
  
  // Test configuration
  test: {
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
