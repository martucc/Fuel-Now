import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/Fuel-Now/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'favicon.svg', 'icon.svg', 'cars.json', 'news.json'],
      manifest: {
        name: 'Martucc Fuel',
        short_name: 'Martucc Fuel',
        description: 'Prezzi carburanti reali, mappa, viaggio, garage e analisi AI in una sola PWA',
        theme_color: '#050607',
        background_color: '#050607',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'it',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Modalita guida',
            short_name: 'Guida',
            url: '/?drive=1',
            description: 'Avvia Martucc Fuel con controlli grandi e mappa pronta.'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        globIgnores: ['stations.json'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => ['/stations.json'].some(path => url.pathname.endsWith(path)),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'stations-data',
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: ({ url }) => ['/news.json', '/cars.json'].some(path => url.pathname.endsWith(path)),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'general-data',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              }
            }
          }
        ]
      }
    })
  ],
})
