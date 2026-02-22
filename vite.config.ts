import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'],
      manifest: {
        id: '/?source=pwa',
        name: 'mzutv2',
        short_name: 'mzutv2',
        description: 'Nieoficjalny klient ZUT dla studentów – plan zajęć, oceny, aktualności',
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait-primary',
        background_color: '#0f172a',
        theme_color: '#3b82f6',
        lang: 'pl',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        categories: ['education', 'utilities'],
        shortcuts: [
          {
            name: 'Plan zajęć',
            short_name: 'Plan',
            description: 'Otwórz plan zajęć',
            url: '/?source=pwa',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Cache all app shell assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          // HTML pages – network first
          {
            urlPattern: ({ request }) => request.destination === 'document',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 5,
              expiration: { maxAgeSeconds: 86400, maxEntries: 10 },
            },
          },
          // API proxy – network first with fallback to cache
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 8,
              expiration: { maxAgeSeconds: 3600, maxEntries: 40 },
              cacheableResponse: { statuses: [200] },
            },
          },
          // Images – cache first (long TTL)
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxAgeSeconds: 7 * 86400, maxEntries: 80 },
              cacheableResponse: { statuses: [200] },
            },
          },
          // External resources (ZUT images, RSS thumbnails)
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
        enabled: false, // Enable in dev if you want to test SW
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
