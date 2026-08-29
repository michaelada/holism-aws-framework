import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'AWSWebFrameworkComponents',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'esm' : format}.js`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', '@mui/material', '@emotion/react', '@emotion/styled', 'react-window'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          '@mui/material': 'MaterialUI',
          'react-window': 'ReactWindow',
        },
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
    /*
     * The pickers and their LocalizationProvider must come from one build: left
     * externalised, the provider is loaded as ESM and the pickers as CJS, and
     * the pickers then report the context as missing.
     */
    server: {
      deps: {
        inline: ['@mui/x-date-pickers'],
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
      /*
       * 60% is the floor for the package as a whole, and 80% where the logic
       * lives. v8 counts every JSX line as a statement, so a package-wide 80%
       * would mostly buy render-only tests over presentational components;
       * services, hooks and utils are where a missed branch is a real defect.
       */
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
        'src/{services,api,hooks,utils}/**': {
          lines: 80,
          functions: 80,
          branches: 70,
          statements: 80,
        },
      },
    },
  },
});
