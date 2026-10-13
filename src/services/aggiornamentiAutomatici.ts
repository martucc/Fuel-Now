import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';
import type { NegozioDataset } from '../data/dataset';

/** Con l'app aperta e in vista, ogni quanto si chiede al negozio se e ora. */
const CONTROLLO_MS = 5 * 60_000;

/**
 * Collega il riscaricamento dei prezzi alla vita dell'app.
 *
 * Su Android l'app quasi mai si riavvia: resta dietro e viene ripresa. La
 * ripresa la dice il plugin App di Capacitor; `visibilitychange` copre il
 * web e le WebView che non lo inoltrano, e il negozio scarta il doppione.
 * Anche il ritorno della rete conta come ripresa: e il momento in cui un
 * download fallito puo finalmente riuscire.
 */
export function avviaAggiornamentiAutomatici(negozio: NegozioDataset): () => void {
  const ripresa = () => { void negozio.aggiorna('ripresa'); };
  const visibilita = () => {
    if (document.visibilityState === 'visible') ripresa();
  };

  document.addEventListener('visibilitychange', visibilita);
  window.addEventListener('online', ripresa);

  let maniglia: PluginListenerHandle | null = null;
  let spento = false;
  if (Capacitor.isNativePlatform()) {
    App.addListener('resume', ripresa)
      .then((h) => { if (spento) void h.remove(); else maniglia = h; })
      .catch(() => { /* resta visibilitychange */ });
  }

  const timer = setInterval(() => {
    if (document.visibilityState === 'visible') void negozio.aggiorna('intervallo');
  }, CONTROLLO_MS);

  return () => {
    spento = true;
    document.removeEventListener('visibilitychange', visibilita);
    window.removeEventListener('online', ripresa);
    clearInterval(timer);
    if (maniglia) void maniglia.remove();
  };
}
