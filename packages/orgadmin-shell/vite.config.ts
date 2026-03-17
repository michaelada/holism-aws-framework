import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    // Bundle analyzer - generates stats.html in dist folder
    visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  
  // Base path for the application
  base: '/orgadmin',
  
  // Path resolution
  resolve: {
    alias: {
      '@aws-web-framework/components': path.resolve(__dirname, '../components/src'),
      '@aws-web-framework/orgadmin-core': path.resolve(__dirname, '../orgadmin-core/src'),
      // Use actual capability modules
      '@aws-web-framework/orgadmin-events': path.resolve(__dirname, '../orgadmin-events/src'),
      '@aws-web-framework/orgadmin-memberships': path.resolve(__dirname, '../orgadmin-memberships/src'),
      '@aws-web-framework/orgadmin-registrations': path.resolve(__dirname, '../orgadmin-registrations/src'),
      // Mock capability modules for development (they don't have built dist folders yet)
      '@aws-web-framework/orgadmin-merchandise': path.resolve(__dirname, './src/test/mocks/orgadmin-merchandise.ts'),
      '@aws-web-framework/orgadmin-calendar': path.resolve(__dirname, './src/test/mocks/orgadmin-calendar.ts'),
      '@aws-web-framework/orgadmin-ticketing': path.resolve(__dirname, './src/test/mocks/orgadmin-ticketing.ts'),
    },
    
    /**
     * Module Deduplication Configuration
     * 
     * PROBLEM: In a monorepo with source aliases, Vite may load separate instances of the same
     * module when it's imported from different packages. This breaks React context propagation
     * because context providers and consumers must use the exact same module instance.
     * 
     * SPECIFIC ISSUE: The LocalizationProvider context error occurs when:
     * 1. orgadmin-core imports @mui/x-date-pickers and wraps content in LocalizationProvider
     * 2. components package imports @mui/x-date-pickers for DateRenderer
     * 3. Vite loads two separate instances of @mui/x-date-pickers
     * 4. LocalizationProvider from instance 1 cannot provide context to DatePicker from instance 2
     * 5. Result: "Can not find utils in context" error and blank screens
     * 
     * SOLUTION: The dedupe option forces Vite to use a single module instance across all packages,
     * ensuring React context works correctly. This is critical for:
     * - react/react-dom: Core React context mechanism
     * - @mui/material: Theme and styling context
     * - @mui/x-date-pickers: LocalizationProvider context (fixes the date picker issue)
     * - date-fns: Ensures consistent date utilities across all date pickers
     * 
     * REFERENCE: See .kiro/specs/date-picker-localization-fix/design.md for full details
     * on the module resolution issue and solution architecture.
     */
    dedupe: [
      'react',
      'react-dom',
      '@mui/material',
      '@mui/x-date-pickers',
      'date-fns',
    ],
  },
  
  /**
   * Dependency Optimization Configuration
   * 
   * PROBLEM: Even with dedupe configuration, Vite's on-demand module loading in development
   * mode can still create timing issues where different parts of the application load
   * different instances of the same module before deduplication takes effect.
   * 
   * SOLUTION: Pre-bundle date picker modules during dev server startup to ensure they are
   * loaded as a single optimized dependency before any application code runs. This works
   * in conjunction with the dedupe configuration to guarantee single module instances.
   * 
   * INCLUDE: Date picker modules that must be pre-bundled to prevent context errors
   * - Main package and all subpath imports are explicitly listed
   * - This ensures LocalizationProvider and all date picker components share the same instance
   * 
   * EXCLUDE: Source packages that should remain unbundled for hot module replacement (HMR)
   * - Keeping these excluded allows fast refresh during development
   * - Changes to these packages trigger HMR without full page reload
   * 
   * REFERENCE: See .kiro/specs/date-picker-localization-fix/design.md section 1.B
   * for detailed explanation of the optimization strategy.
   */
  optimizeDeps: {
    // Pre-bundle date picker modules into a single optimized dependency
    // This ensures all date picker components use the same module instance
    // and prevents LocalizationProvider context errors in development mode
    include: [
      '@mui/x-date-pickers',
      '@mui/x-date-pickers/DatePicker',
      '@mui/x-date-pickers/TimePicker',
      '@mui/x-date-pickers/DateTimePicker',
      '@mui/x-date-pickers/LocalizationProvider',
      '@mui/x-date-pickers/AdapterDateFns',
    ],
    exclude: [
      '@aws-web-framework/components', 
      '@aws-web-framework/orgadmin-core', 
      '@aws-web-framework/orgadmin-events', 
      '@aws-web-framework/orgadmin-memberships',
      '@aws-web-framework/orgadmin-registrations'
    ],
  },
  
  /**
   * Development Server Configuration
   * 
   * PORT: Custom port to avoid conflicts with other services
   * 
   * FILE SYSTEM ACCESS: In a monorepo with source aliases, the dev server needs to serve
   * files from parent directories (../components/src, ../orgadmin-core/src, etc.).
   * Setting fs.strict to false allows Vite to serve these files without security restrictions.
   * This is safe in a development environment where all source code is trusted.
   * 
   * PROXY: API calls are proxied to the backend server to avoid CORS issues during development.
   */
  server: {
    port: 5175,
    // Allow serving files from parent directories in monorepo structure
    fs: {
      strict: false,
    },
    proxy: {
      // Proxy API calls to backend
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  
  // Build configuration
  build: {
    // Output directory
    outDir: 'dist',
    
    // Generate sourcemaps for debugging
    sourcemap: true,
    
    // Code splitting configuration for optimal bundle sizes
    rollupOptions: {
      output: {
        // Manual chunks for better code splitting
        manualChunks: (id) => {
          // Vendor chunk for React and related libraries
          if (id.includes('node_modules/react') || 
              id.includes('node_modules/react-dom') || 
              id.includes('node_modules/react-router-dom') ||
              id.includes('node_modules/scheduler')) {
            return 'vendor-react';
          }
          
          // Vendor chunk for Material-UI core
          if (id.includes('node_modules/@mui/material') ||
              id.includes('node_modules/@mui/system') ||
              id.includes('node_modules/@mui/base')) {
            return 'vendor-mui-core';
          }
          
          // Vendor chunk for Material-UI icons (separate to allow lazy loading)
          if (id.includes('node_modules/@mui/icons-material')) {
            return 'vendor-mui-icons';
          }
          
          // Vendor chunk for Material-UI date pickers
          if (id.includes('node_modules/@mui/x-date-pickers')) {
            return 'vendor-mui-pickers';
          }
          
          // Vendor chunk for Emotion styling
          if (id.includes('node_modules/@emotion')) {
            return 'vendor-emotion';
          }
          
          // Vendor chunk for utilities
          if (id.includes('node_modules/axios') ||
              id.includes('node_modules/date-fns') ||
              id.includes('node_modules/keycloak-js')) {
            return 'vendor-utils';
          }
          
          // Core modules chunk
          if (id.includes('orgadmin-core')) {
            return 'orgadmin-core';
          }
          
          // Capability modules - each in separate chunk for lazy loading
          if (id.includes('orgadmin-events')) {
            return 'module-events';
          }
          if (id.includes('orgadmin-memberships')) {
            return 'module-memberships';
          }
          if (id.includes('orgadmin-merchandise')) {
            return 'module-merchandise';
          }
          if (id.includes('orgadmin-calendar')) {
            return 'module-calendar';
          }
          if (id.includes('orgadmin-registrations')) {
            return 'module-registrations';
          }
          if (id.includes('orgadmin-ticketing')) {
            return 'module-ticketing';
          }
          
          // Shared components
          if (id.includes('packages/components')) {
            return 'shared-components';
          }
        },
        
        // Asset file naming
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.');
          const ext = info?.[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext || '')) {
            return `assets/images/[name]-[hash][extname]`;
          } else if (/woff|woff2|eot|ttf|otf/i.test(ext || '')) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        
        // Chunk file naming
        chunkFileNames: 'assets/js/[name]-[hash].js',
        
        // Entry file naming
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
    
    // Chunk size warning limit (200 KB for shell, 150 KB for modules)
    chunkSizeWarningLimit: 200,
    
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'], // Remove specific console methods
        passes: 2, // Multiple passes for better compression
      },
      mangle: {
        safari10: true, // Safari 10 compatibility
      },
      format: {
        comments: false, // Remove all comments
      },
    },
    
    // Enable CSS code splitting
    cssCodeSplit: true,
    
    // Optimize asset inlining threshold (4KB)
    assetsInlineLimit: 4096,
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
