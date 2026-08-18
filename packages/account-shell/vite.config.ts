import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),

    /**
     * The app itself, available with no connection.
     *
     * The strongest case is a ticket at a gate: `TicketPage` already renders its
     * QR on the device from the stored payload rather than fetching an image,
     * and the ticket list is cached by `useAccountApi` — but neither helps if
     * the application cannot boot. Precaching the shell is what makes a cold
     * start offline possible at all.
     */
    VitePWA({
      registerType: 'autoUpdate',
      // The app is served under /account; the service worker's scope must match
      // or it will not control the pages it is meant to serve.
      base: '/account/',
      scope: '/account/',
      includeAssets: [
        'icon.svg',
        'icon-maskable.svg',
        'favicon.png',
        'apple-touch-icon.png',
      ],

      manifest: {
        name: 'Club account',
        short_name: 'Club',
        description: 'Your entries, memberships, bookings and tickets.',
        // Not "/" — a club's short link lands on /account/:orgCode, and starting
        // anywhere else would open the installed app on the directory.
        start_url: '/account',
        scope: '/account/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1976d2',
        /*
         * PNG as well as SVG, and `any` kept apart from `maskable`.
         *
         * Android's install prompt wants a raster icon of at least 192 and does
         * not reliably accept SVG; and one artwork cannot serve both purposes —
         * a platform applying a mask crops to the central 80%, which would take
         * the head and shoulders off the unmasked mark. `icon-maskable` is the
         * same mark drawn into that safe zone.
         */
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },

      workbox: {
        /*
         * The shell only. API responses are deliberately **not** cached here:
         * `useAccountApi` already keeps them per member and per organisation and
         * clears them on sign-out, and a second copy in the service worker's
         * cache would outlive that clearing — a shared device would leak one
         * member's payment history to the next.
         */
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/account/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },

      devOptions: {
        // Off in dev: a service worker caching a dev server's modules is a
        // reliable way to spend an afternoon debugging a stale bundle.
        enabled: false,
      },
    }),
  ],

  // The account app is served under /account, matching the routes in
  // docs/ACCOUNT_USER_APP_WIREFRAMES.md (A1 is /account, A2 is /account/:orgCode).
  base: '/account',

  resolve: {
    alias: {
      '@aws-web-framework/components': path.resolve(__dirname, '../components/src'),
    },

    /**
     * A single instance of each of these must exist across the aliased source
     * packages, because React context identity is per module instance. Aliasing
     * `components` to its source is what makes duplication possible in the first
     * place — without dedupe, a provider here cannot reach a consumer there.
     */
    dedupe: ['react', 'react-dom', '@mui/material', '@mui/x-date-pickers', 'date-fns'],
  },

  optimizeDeps: {
    // Left unbundled so edits to the shared library hot-reload.
    exclude: ['@aws-web-framework/components'],
  },

  server: {
    // 5173 frontend, 5174 admin, 5175 orgadmin — this is the next free port.
    port: 5176,
    fs: {
      // Required to serve ../components/src through the alias above.
      strict: false,
    },
    proxy: {
      '/api': {
      /*
       * 127.0.0.1, not `localhost`. On macOS `localhost` resolves to ::1
       * first, so any other dev server holding [::1]:3000 answers the proxy
       * instead of the backend — returning its own index.html with a 200 for
       * every /api call, which the app then parses as JSON. Naming the IPv4
       * address is what the target actually means and removes the ambiguity.
       */
        target: process.env.VITE_API_URL || 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: true,

    /**
     * Split the vendor libraries out of the app chunk.
     *
     * This app is used on phones over mobile data more than the admin apps are,
     * so the split is worth more here: React and MUI change far less often than
     * the application code, and separating them lets a returning member reuse
     * the cached copies instead of re-downloading everything on each deploy.
     */
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|react-router|scheduler)\//.test(id)) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/@mui/icons-material')) return 'vendor-mui-icons';
          if (id.includes('node_modules/@mui/') || id.includes('node_modules/@emotion/')) {
            return 'vendor-mui';
          }
          /*
           * `date-fns` is deliberately NOT listed. It is the date pickers'
           * dependency, and naming it here splits MUI's own graph across two
           * manual chunks, which leaves them importing each other:
           *
           *     vendor-utils -> vendor-mui -> vendor-utils
           *
           * Chunks in a cycle are evaluated with one side uninitialised, and a
           * module reading the other's export at module scope then sees
           * `undefined`. That is what turned `/orgadmin` into a blank page.
           * Rollup places it correctly when left alone — see
           * `scripts/check-chunk-cycles.mjs`.
           */
          if (/node_modules\/(keycloak-js|axios|i18next|react-i18next)\//.test(id)) {
            return 'vendor-utils';
          }
          return undefined;
        },
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
      exclude: ['node_modules/', 'src/test/', '**/*.d.ts', '**/*.config.*', '**/*.test.{ts,tsx}'],
    },
    /**
     * See CLAUDE.md §3.4 — this must be `server.deps.inline`, not the
     * deprecated `deps.inline`, which Vitest silently ignores. Without it the
     * ESM and CJS builds of a package can both load, and any React context they
     * carry stops working.
     */
    server: {
      deps: {
        inline: ['@mui/x-date-pickers', 'date-fns'],
      },
    },
  },

  envPrefix: 'VITE_',
});
