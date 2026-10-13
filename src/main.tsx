import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import './design/tema.css';
import { App } from './app/App';
import { datasetStore } from './data/dataset';

// Il download dei prezzi parte subito, in parallelo al GPS e al primo
// disegno: chi apre l'app deve vedere i prezzi di oggi il prima possibile.
void datasetStore().avvia();

/*
  Dentro l'APK niente service worker: i file stanno gia sul telefono, e un
  service worker rimasto da una versione vecchia serviva la build precedente
  (l'app sembrava non aggiornarsi mai). Se ne trova uno, lo si toglie, con
  le sue cache. I prezzi stanno in IndexedDB, che qui non si tocca.
*/
if (Capacitor.isNativePlatform()) {
  navigator.serviceWorker?.getRegistrations?.()
    .then((r) => { for (const x of r) void x.unregister(); })
    .catch(() => {});
  if ('caches' in window) {
    caches.keys().then((nomi) => { for (const n of nomi) void caches.delete(n); }).catch(() => {});
  }
}

const radice = document.getElementById('root');
if (radice) {
  createRoot(radice).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
