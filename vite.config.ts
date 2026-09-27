import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const DAY = 24 * 60 * 60;

/** Su GitHub Pages l'app vive in una sottocartella con il nome del repository. */
const BASE = '/rientro-prima-del-buio/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    /**
     * App installabile e usabile senza campo (service worker generato da Workbox).
     * - L'app (codice, stili, elenco dei giri, mappa d'insieme) si salva alla prima visita.
     * - Le tracce dei giri si salvano quando li apri: quelli guardati a casa funzionano anche in montagna.
     * - Il meteo prova prima la rete; senza rete usa l'ultima previsione salvata (e l'app lo dice).
     * - Dei riquadri della mappa si salvano solo quelli già visti, con un limite: le regole d'uso di
     *   OpenTopoMap vietano di scaricarli in blocco.
     */
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Rientro prima del buio',
        short_name: 'Rientro',
        description: 'Scegli un sentiero della Valtellina e l\'ora di partenza: ti dice se rientri prima del buio.',
        lang: 'it',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#f5f2ea',
        theme_color: '#f5f2ea',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // app e mappa d'insieme sempre disponibili; le tracce dei giri no, sono troppe: si salvano quando si aprono
        // dei caratteri basta l'alfabeto latino (gli altri si scaricano solo se servono): l'app resta leggibile offline
        globPatterns: ['**/*.{js,css,html,svg,png,ico}', '**/*-latin-*.woff2', 'overview.json'],
        navigateFallback: `${BASE}index.html`,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith(`${BASE}trails/`),
            handler: 'CacheFirst',
            options: { cacheName: 'tracce', expiration: { maxEntries: 400 } },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'api.open-meteo.com',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'meteo',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 60, maxAgeSeconds: 3 * DAY },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('tile.opentopomap.org'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'mappa',
              expiration: { maxEntries: 600, maxAgeSeconds: 30 * DAY },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
