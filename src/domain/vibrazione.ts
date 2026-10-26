/**
 * Quanto vibra l'app. Su Android la «selezione» del plugin Haptics di
 * Capacitor è una vibrazione continua di 100 ms: a ogni cambio di scheda
 * arrivava un ronzio, non un tocco. Adesso il livello predefinito usa il
 * tocco di sistema di Android (lo stesso della tastiera), corto e leggero,
 * che rispetta anche l'impostazione «vibrazione al tocco» del telefono.
 */

export type LivelloVibrazione = 'spenta' | 'leggera' | 'decisa';

export const LIVELLI_VIBRAZIONE: readonly LivelloVibrazione[] = ['spenta', 'leggera', 'decisa'];

export const VIBRAZIONE_PREDEFINITA: LivelloVibrazione = 'leggera';

/** Cosa ha chiesto l'interfaccia: una scheda o un segmento, un bottone, un esito. */
export type Tocco = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'error';

/** I tocchi di sistema di Android (`HapticFeedbackConstants`), vedi VibrazionePlugin.java. */
export type ToccoSistema = 'scatto' | 'clic' | 'tasto' | 'conferma' | 'rifiuto';

/** Gli effetti del plugin Haptics, più forti: solo per chi sceglie «Decisa». */
export type ToccoPlugin = 'impatto-leggero' | 'impatto-medio' | 'impatto-forte' | 'successo' | 'errore';

export type Vibrazione = { via: 'sistema'; tipo: ToccoSistema } | { via: 'plugin'; tipo: ToccoPlugin } | null;

const LEGGERA: Record<Tocco, ToccoSistema> = {
  selection: 'scatto',
  light: 'clic',
  medium: 'tasto',
  heavy: 'tasto',
  success: 'conferma',
  error: 'rifiuto',
};

const DECISA: Record<Tocco, ToccoPlugin> = {
  // Mai la «selezione» del plugin: è quella da 100 ms.
  selection: 'impatto-leggero',
  light: 'impatto-leggero',
  medium: 'impatto-medio',
  heavy: 'impatto-forte',
  success: 'successo',
  error: 'errore',
};

export function comeVibrare(livello: LivelloVibrazione, tocco: Tocco): Vibrazione {
  switch (livello) {
    case 'spenta':
      return null;
    case 'leggera':
      return { via: 'sistema', tipo: LEGGERA[tocco] };
    case 'decisa':
      return { via: 'plugin', tipo: DECISA[tocco] };
  }
}
