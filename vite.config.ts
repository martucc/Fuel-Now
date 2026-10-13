import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  // maplibre-gl decodifica le tessere vettoriali in un worker. Pre-ottimizzato
  // da Vite quel worker parte ma non risponde mai: le tessere si scaricano,
  // la sorgente resta a zero feature e la mappa e nera senza un solo errore.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  // Il worker di maplibre e ESM. Vite lo impacchetta come iife per difetto e
  // il worker parte ma non risponde: nessun errore, tessere scaricate,
  // sorgente a zero feature, mappa nera. Vale per la build, non solo per dev.
  worker: { format: 'es' },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // La registrazione la fa main.tsx, non lo script iniettato: dentro la
      // WebView di Capacitor il service worker serviva la build vecchia e
      // l'app sembrava non aggiornarsi mai. Lasciando iniettare registerSW
      // qui, quello registrava e main.tsx cancellava, a ogni avvio, con esito
      // diverso ogni volta.
      injectRegister: false,
      includeAssets: ['favicon.png', 'favicon.svg', 'icon.svg', 'cars.json', 'news.json'],
      manifest: {
        name: 'Martucc Fuel',
        short_name: 'Martucc Fuel',
        description: 'Prezzi carburanti reali, mappa, viaggio, garage e analisi AI in una sola PWA',
        theme_color: '#08090b',
        background_color: '#08090b',
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
            name: 'Mappa stazioni',
            short_name: 'Mappa',
            url: '/?tab=map',
            description: 'Apri la mappa delle pompe vicine.',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'Miglior Diesel',
            short_name: 'Diesel',
            url: '/?tab=home&fuel=Diesel',
            description: 'Vai dritto al miglior prezzo diesel in zona.',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'Miglior Benzina',
            short_name: 'Benzina',
            url: '/?tab=home&fuel=Benzina',
            description: 'Vai dritto al miglior prezzo benzina in zona.',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'Analisi mercato',
            short_name: 'Intel',
            url: '/?tab=analysis',
            description: 'Apri il dashboard prezzi e analisi IA.',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'Modalita guida',
            short_name: 'Guida',
            url: '/?drive=1',
            description: 'Avvia Martucc Fuel con controlli grandi e mappa pronta.',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        globIgnores: ['stations.json'],
        /*
          Il service worker dirotta ogni navigazione sull'index, perche l'app
          e una pagina sola. Va bene per le sue rotte, non per i file che
          stanno accanto al sito: chiedendo l'APK dal telefono si apriva
          MartuccFuel invece di scaricarlo, e da fuori (curl, un'altra
          origine) sembrava tutto a posto perche li il service worker non
          c'e. Qualunque indirizzo che finisce con un'estensione non e una
          rotta dell'app e va lasciato passare.
        */
        navigateFallbackDenylist: [/\.[^/]+$/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => !url.href.includes('raw.githubusercontent') && url.pathname.endsWith('/stations.json'),
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
