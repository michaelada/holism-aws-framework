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
      // Mock capability modules for tests (they don't have built dist folders)
      '@aws-web-framework/orgadmin-events': path.resolve(__dirname, './src/test/mocks/orgadmin-events.ts'),
      '@aws-web-framework/orgadmin-memberships': path.resolve(__dirname, './src/test/mocks/orgadmin-memberships.ts'),
      '@aws-web-framework/orgadmin-merchandise': path.resolve(__dirname, './src/test/mocks/orgadmin-merchandise.ts'),
      '@aws-web-framework/orgadmin-calendar': path.resolve(__dirname, './src/test/mocks/orgadmin-calendar.ts'),
      '@aws-web-framework/orgadmin-registrations': path.resolve(__dirname, './src/test/mocks/orgadmin-registrations.ts'),
      '@aws-web-framework/orgadmin-ticketing': path.resolve(__dirname, './src/test/mocks/orgadmin-ticketing.ts'),
    },
  },
  
  // Optimize dependencies
  optimizeDeps: {
    exclude: ['@aws-web-framework/components', '@aws-web-framework/orgadmin-core'],
  },
  
  // Development server configuration
  server: {
    port: 5175,
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
