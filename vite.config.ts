import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
  // L'app vive solo nell'APK: niente PWA e niente service worker (vedi main.tsx).
  plugins: [react(), tailwindcss()],
})
