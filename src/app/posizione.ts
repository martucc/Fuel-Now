import { useSyncExternalStore } from 'react';
import type { LatLng } from '../domain/geo';
import { haversineKm } from '../domain/geo';

/**
 * Dove sei. Prima l'app, se il GPS non rispondeva, ti metteva a Milano senza
 * dirlo: tutti i consigli erano di Milano. Adesso la posizione ha uno stato
 * e la Home lo mostra.
 *
 * All'apertura si parte dall'ultima posizione nota (si vede subito qualcosa),
 * poi si chiede al GPS una posizione rapida e una precisa.
 */

export type FasePosizione =
  /** Sto chiedendo al GPS e non ho ancora niente da mostrare. */
  | 'cerco'
  /** Posizione dal GPS (anche se e quella dell'ultima volta e sto aggiornando). */
  | 'gps'
  /** Luogo scelto a mano dall'utente. */
  | 'manuale'
  /** Permesso negato e nessun luogo scelto. */
  | 'negata'
  /** GPS che non risponde e nessun luogo scelto. */
  | 'assente';

export interface StatoPosizione {
  fase: FasePosizione;
  punto: LatLng | null;
  /** Nome del luogo scelto a mano. */
  luogo: string | null;
  precisioneM: number | null;
  /** true mentre una richiesta al GPS e in corso. */
  inCorso: boolean;
}

const CHIAVE_ULTIMA = 'mf2_ultima_posizione';
const CHIAVE_LUOGO = 'mf2_luogo_scelto';
/** Sotto questo spostamento non si ricalcola niente: il GPS trema. */
const SPOSTAMENTO_MINIMO_KM = 0.05;

interface Salvata { lat: number; lng: number; luogo?: string }

function leggiSalvata(chiave: string): Salvata | null {
  try {
    const s = localStorage.getItem(chiave);
    if (!s) return null;
    const v = JSON.parse(s) as Salvata;
    return Number.isFinite(v?.lat) && Number.isFinite(v?.lng) ? v : null;
  } catch {
    return null;
  }
}

function scrivi(chiave: string, v: Salvata | null): void {
  try {
    if (v) localStorage.setItem(chiave, JSON.stringify(v));
    else localStorage.removeItem(chiave);
  } catch { /* niente spazio: pazienza */ }
}

function iniziale(): StatoPosizione {
  const luogo = leggiSalvata(CHIAVE_LUOGO);
  if (luogo) {
    return { fase: 'manuale', punto: { lat: luogo.lat, lng: luogo.lng }, luogo: luogo.luogo ?? null, precisioneM: null, inCorso: false };
  }
  const ultima = leggiSalvata(CHIAVE_ULTIMA);
  return {
    fase: ultima ? 'gps' : 'cerco',
    punto: ultima ? { lat: ultima.lat, lng: ultima.lng } : null,
    luogo: null,
    precisioneM: null,
    inCorso: false,
  };
}

let stato: StatoPosizione | null = null;
const ascoltatori = new Set<() => void>();

function corrente(): StatoPosizione {
  stato ??= iniziale();
  return stato;
}

function imposta(parziale: Partial<StatoPosizione>): void {
  stato = { ...corrente(), ...parziale };
  for (const cb of ascoltatori) cb();
}

function chiedi(opzioni: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((ok, ko) => navigator.geolocation.getCurrentPosition(ok, ko, opzioni));
}

function accetta(p: GeolocationPosition): void {
  const s = corrente();
  if (s.fase === 'manuale') return; // il luogo scelto a mano vince finche l'utente non torna al GPS
  const nuovo = { lat: p.coords.latitude, lng: p.coords.longitude };
  const precisione = Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null;
  const spostato = !s.punto || haversineKm(s.punto, nuovo) >= SPOSTAMENTO_MINIMO_KM;
  const migliore = precisione !== null && (s.precisioneM === null || precisione < s.precisioneM * 0.5);
  if (spostato || migliore || s.fase !== 'gps') {
    imposta({ fase: 'gps', punto: spostato || !s.punto ? nuovo : s.punto, precisioneM: precisione });
    scrivi(CHIAVE_ULTIMA, nuovo);
  }
}

let richiesta: Promise<void> | null = null;

/** Chiede la posizione al GPS: una rapida e poi una precisa. Chiamarla spesso non costa: si accodano. */
export function aggiornaPosizione(): Promise<void> {
  if (corrente().fase === 'manuale') return Promise.resolve();
  if (richiesta) return richiesta;
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    if (!corrente().punto) imposta({ fase: 'assente' });
    return Promise.resolve();
  }

  imposta({ inCorso: true });
  richiesta = (async () => {
    try {
      // Rapida: va bene anche una posizione di qualche minuto fa o da rete.
      const rapida = await chiedi({ enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 6000 });
      accetta(rapida);
    } catch (e) {
      const negata = (e as GeolocationPositionError)?.code === 1;
      if (negata) {
        if (!corrente().punto || corrente().fase !== 'gps') imposta({ fase: 'negata' });
        return;
      }
    }
    try {
      const precisa = await chiedi({ enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 });
      accetta(precisa);
    } catch (e) {
      const negata = (e as GeolocationPositionError)?.code === 1;
      if (!corrente().punto) imposta({ fase: negata ? 'negata' : 'assente' });
    }
  })().finally(() => {
    richiesta = null;
    imposta({ inCorso: false });
  });
  return richiesta;
}

/** L'utente sceglie un luogo a mano (es. GPS negato). */
export function scegliLuogo(punto: LatLng, nome: string): void {
  scrivi(CHIAVE_LUOGO, { ...punto, luogo: nome });
  imposta({ fase: 'manuale', punto, luogo: nome, precisioneM: null });
}

/** Torna a usare il GPS. */
export function usaGps(): Promise<void> {
  scrivi(CHIAVE_LUOGO, null);
  const ultima = leggiSalvata(CHIAVE_ULTIMA);
  imposta({ fase: ultima ? 'gps' : 'cerco', punto: ultima ? { lat: ultima.lat, lng: ultima.lng } : null, luogo: null });
  return aggiornaPosizione();
}

export function statoPosizione(): StatoPosizione {
  return corrente();
}

function iscriviti(cb: () => void): () => void {
  ascoltatori.add(cb);
  return () => { ascoltatori.delete(cb); };
}

export function usePosizione(): StatoPosizione {
  return useSyncExternalStore(iscriviti, corrente, corrente);
}
