import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { leggiRilascio } from '../domain/versione';
import type { Rilascio } from '../domain/versione';

/**
 * L'ultimo rilascio su GitHub e l'apertura del suo APK.
 *
 * Nessuna intestazione fatta a mano: api.github.com risponde al CORS, ma
 * una richiesta semplice evita anche il preflight.
 */

const URL_ULTIMO = 'https://api.github.com/repos/martucc/Fuel-Now/releases/latest';
const TIMEOUT_MS = 15_000;

interface PluginLink {
  apriLink(opzioni: { url: string }): Promise<void>;
}
const Navigazione = registerPlugin<PluginLink>('Navigazione');

/** L'ultimo rilascio con un APK, o null se non c'è (404) o non si legge. Lancia se la rete non va. */
export async function chiediUltimoRilascio(): Promise<Rilascio | null> {
  const r = await fetch(URL_ULTIMO, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-cache' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return leggiRilascio(await r.json());
}

/** La versione installata («2.2.0»), letta da Android. Null nel browser. */
export async function versioneInstallata(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    return (await App.getInfo()).version;
  } catch {
    return null;
  }
}

/** Apre il download nel browser del telefono, che poi chiede di installare. */
export async function apriDownload(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Navigazione.apriLink({ url });
      return;
    } catch {
      // Plugin vecchio o nessun browser: si prova dalla WebView.
    }
  }
  window.open(url, '_blank', 'noopener');
}
