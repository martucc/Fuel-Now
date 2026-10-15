import { Capacitor, registerPlugin } from '@capacitor/core';

interface PluginNavigazione {
  apri(opzioni: { lat: number; lng: number; nome: string }): Promise<void>;
}

const Navigazione = registerPlugin<PluginNavigazione>('Navigazione');

/**
 * «Portami lì». Su Android apre il selettore dei navigatori ogni volta
 * (vedi NavigazionePlugin.java); sul web apre le indicazioni di Google Maps.
 */
export async function portamiLi(p: { lat: number; lng: number; nome: string }): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Navigazione.apri(p);
      return;
    } catch {
      // Nessun navigatore o plugin assente: si ripiega sul link web qui sotto.
    }
  }
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`, '_blank', 'noopener');
}
