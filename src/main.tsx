import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Capacitor } from '@capacitor/core'

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("Critical Error: Root element #root not found!");
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

/**
 * Il service worker serve sul web e da fastidio dentro l'app.
 *
 * Nell'APK i file stanno gia sul telefono: il service worker non aggiunge
 * niente e in cambio serve la build precedente, cosi ogni aggiornamento
 * sembrava non essere mai arrivato. Sul web invece e lui a far funzionare
 * l'app senza rete, e li va tenuto.
 *
 * L'iniezione automatica di registerSW e spenta in vite.config.ts: la
 * decisione sta tutta qui, in un posto solo.
 */
if (Capacitor.isNativePlatform()) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrazioni) => {
      for (const r of registrazioni) r.unregister();
    }).catch(() => { /* niente da disfare */ });
  }
  // Le cache di una versione precedente dell'app, quando il service worker
  // c'era: se restassero, continuerebbero a servire i file vecchi.
  if ('caches' in window) {
    caches.keys().then((nomi) => {
      for (const n of nomi) caches.delete(n);
    }).catch(() => { /* niente da svuotare */ });
  }
} else if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Solo nella build: in sviluppo sw.js non esiste e il server risponde
  // con l'index, che il browser rifiuta con un errore di MIME nella console.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Senza cache offline l'app resta pienamente utilizzabile.
    });
  });
}
