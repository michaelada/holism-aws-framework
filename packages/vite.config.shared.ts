import { BuildOptions } from 'vite';
import path from 'path';

/**
 * Shared Vite build configuration for orgadmin modules
 * Optimizes bundle sizes and enables tree-shaking
 */
export function getModuleBuildConfig(moduleName: string, dirname: string): BuildOptions {
  return {
    lib: {
      entry: path.resolve(dirname, 'src/index.ts'),
      name: moduleName,
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
        '@emotion/react',
        '@emotion/styled',
        'react-quill',
        'axios',
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react-router-dom': 'ReactRouterDOM',
        },
        // Preserve module structure for better tree-shaking
        preserveModules: true,
        preserveModulesRoot: 'src',
      },
    },
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  };
}

/**
 * Shared resolve configuration for orgadmin modules
 */
export function getModuleResolveConfig(dirname: string) {
  return {
    alias: {
      '@aws-web-framework/components': path.resolve(dirname, '../components/src'),
      '@aws-web-framework/orgadmin-shell': path.resolve(dirname, '../orgadmin-shell/src'),
    },
  };
}

/**
 * Shared optimize deps configuration
 */
export const sharedOptimizeDeps = {
  exclude: ['@aws-web-framework/components', '@aws-web-framework/orgadmin-shell'],
};
