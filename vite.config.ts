import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const appBase = (() => {
  const raw = (process.env.VITE_APP_BASE || '').trim();
  if (!raw) return '/';
  const normalized = raw.startsWith('/') ? raw : `/${raw}`;
  return `${normalized.replace(/\/+$/, '')}/`;
})();

const appBaseNoSlash = appBase === '/' ? '' : appBase.slice(0, -1);

function withBase(pathname: string): string {
  return `${appBase}${pathname.replace(/^\/+/, '')}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const scopedApiPrefix = appBase === '/' ? '/api/' : `${appBaseNoSlash}/api/`;
const apiDenylist = appBase === '/'
  ? [/^\/api\//]
  : [new RegExp(`^${escapeRegex(scopedApiPrefix)}`), /^\/api\//];

export default defineConfig({
  base: appBase,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'],
      manifest: {
        id: `${appBase}?source=pwa`,
        name: 'mzutv2',
        short_name: 'mzutv2',
        description: 'Nieoficjalny klient ZUT dla studentow - plan zajec, oceny, aktualnosci',
        start_url: `${appBase}?source=pwa`,
        scope: appBase,
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait-primary',
        background_color: '#0f172a',
        theme_color: '#3b82f6',
        lang: 'pl',
        icons: [
          {
            src: withBase('icons/icon-192.png'),
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: withBase('icons/icon-512.png'),
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: withBase('icons/icon-maskable-512.png'),
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        categories: ['education', 'utilities'],
        shortcuts: [
          {
            name: 'Plan zajec',
            short_name: 'Plan',
            description: 'Otworz plan zajec',
            url: `${appBase}?source=pwa`,
            icons: [{ src: withBase('icons/icon-192.png'), sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        navigateFallback: withBase('index.html'),
        navigateFallbackDenylist: apiDenylist,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'document',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 5,
              expiration: { maxAgeSeconds: 86400, maxEntries: 10 },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api/') ||
              url.pathname.startsWith(scopedApiPrefix),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 8,
              expiration: { maxAgeSeconds: 3600, maxEntries: 40 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxAgeSeconds: 7 * 86400, maxEntries: 80 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('zut.edu.pl'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'zut-assets',
              expiration: { maxAgeSeconds: 3600, maxEntries: 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});