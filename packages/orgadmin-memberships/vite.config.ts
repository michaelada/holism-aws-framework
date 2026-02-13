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
