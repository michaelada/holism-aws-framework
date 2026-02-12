import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
  // Base path for the application
  base: '/orgadmin',
  
  // Path resolution
  resolve: {
    alias: {
      '@aws-web-framework/components': path.resolve(__dirname, '../components/src'),
      '@aws-web-framework/orgadmin-core': path.resolve(__dirname, '../orgadmin-core/src'),
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
        manualChunks: {
          // Vendor chunk for React and related libraries
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          
          // Vendor chunk for Material-UI
          'vendor-mui': [
            '@mui/material',
            '@mui/icons-material',
            '@emotion/react',
            '@emotion/styled',
          ],
          
          // Vendor chunk for utilities
          'vendor-utils': ['axios', 'date-fns', 'keycloak-js'],
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
    
    // Chunk size warning limit (500 KB)
    chunkSizeWarningLimit: 500,
    
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
      },
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
