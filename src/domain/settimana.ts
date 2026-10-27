import type { RawHistoryPoint } from './raw';

/**
 * C'e un giorno della settimana in cui conviene fare il pieno?
 *
 * La domanda se la fanno tutti e in giro si trovano solo leggende. Qui si
 * risponde con i dati: un anno di medie nazionali, un punto al giorno.
 *
 * Il trucco sta nel togliere la tendenza prima di guardare i giorni. In un
 * anno di prezzi in salita il sabato risulterebbe piu caro del lunedi solo
 * perche arriva dopo: confrontare ogni giorno con la media della sua stessa
 * settimana toglie di mezzo l'inganno.
 */

export interface GiornoSettimana {
  /** 0 = domenica, come getDay(). */
  giorno: number;
  nome: string;
  /** Scarto medio dalla settimana, in centesimi al litro. Negativo = costa meno. */
  scartoC: number;
  campione: number;
  /** Errore standard dello scarto, in centesimi: quanto e solido il numero. */
  erroreC: number;
}

export interface RitmoSettimanale {
  giorni: GiornoSettimana[];
  migliore: GiornoSettimana | null;
  peggiore: GiornoSettimana | null;
  /** Distanza fra il giorno migliore e il peggiore, in centesimi. */
  ampiezzaC: number;
  /**
   * true solo quando il ritmo e insieme abbastanza largo da contare e
   * abbastanza solido da non essere rumore. Con poche settimane di dati
   * giornalieri qualunque giorno sembra il migliore: qui serve che lo
   * scarto stia almeno a due errori standard da zero.
   *
   * Quando e false la risposta onesta e «non c'e un giorno migliore», che
   * e a sua volta una risposta utile: e la leggenda piu diffusa fra chi
   * fa benzina.
   */
  significativo: boolean;
}

const NOMI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

/** Sotto questo scarto fra migliore e peggiore non e un consiglio, e rumore. */
export const SOGLIA_AMPIEZZA_C = 0.3;
/** Servono almeno tanti punti giornalieri perche la domanda abbia senso. */
const MIN_PUNTI = 60;
/** Sotto tanti campioni per giorno la media di quel giorno non e una media. */
const MIN_PER_GIORNO = 8;
/** Quanti errori standard deve distare da zero prima di essere un fatto. */
const SIGMA = 2;
/** La finestra su cui si misura «la settimana intorno a questo giorno». */
const FINESTRA = 7;

export function ritmoSettimanale(storico: RawHistoryPoint[]): RitmoSettimanale {
  const vuoto: RitmoSettimanale = {
    giorni: [],
    migliore: null,
    peggiore: null,
    ampiezzaC: 0,
    significativo: false,
  };
  if (storico.length < MIN_PUNTI) return vuoto;

  const punti = storico
    .map((p) => ({ ts: Date.parse(`${p.date}T00:00:00Z`), avg: p.avg }))
    .filter((p) => Number.isFinite(p.ts) && p.avg > 0)
    .sort((a, b) => a.ts - b.ts);

  if (punti.length < MIN_PUNTI) return vuoto;

  const meta = Math.floor(FINESTRA / 2);
  const scarti: number[][] = Array.from({ length: 7 }, () => []);

  for (let i = meta; i < punti.length - meta; i++) {
    // Media centrata sui sette giorni intorno: e la «settimana» di questo punto.
    let somma = 0;
    let n = 0;
    let buco = false;
    for (let k = i - meta; k <= i + meta; k++) {
      const p = punti[k]!;
      // Una settimana con un buco non e una settimana: si salta il punto
      // invece di confrontarlo con una media di giorni non contigui.
      if (k > i - meta && p.ts - punti[k - 1]!.ts > 2 * 86400_000) buco = true;
      somma += p.avg;
      n++;
    }
    if (buco || n < FINESTRA) continue;

    const media = somma / n;
    const p = punti[i]!;
    const g = new Date(p.ts).getUTCDay();
    scarti[g]!.push((p.avg - media) * 100);
  }

  const giorni: GiornoSettimana[] = [];
  for (let g = 0; g < 7; g++) {
    const v = scarti[g]!;
    if (v.length === 0) continue;
    const media = v.reduce((a, x) => a + x, 0) / v.length;
    const varianza = v.length > 1
      ? v.reduce((a, x) => a + (x - media) ** 2, 0) / (v.length - 1)
      : 0;
    giorni.push({
      giorno: g,
      nome: NOMI[g]!,
      scartoC: media,
      campione: v.length,
      erroreC: v.length > 1 ? Math.sqrt(varianza / v.length) : Infinity,
    });
  }

  if (giorni.length < 7) return { ...vuoto, giorni };

  let migliore = giorni[0]!;
  let peggiore = giorni[0]!;
  for (const g of giorni) {
    if (g.scartoC < migliore.scartoC) migliore = g;
    if (g.scartoC > peggiore.scartoC) peggiore = g;
  }

  const ampiezzaC = peggiore.scartoC - migliore.scartoC;

  // Tre condizioni, tutte necessarie: campione decente su ogni giorno,
  // scarto abbastanza largo da contare, e il giorno migliore lontano da
  // zero piu di due errori standard. Basta che una salti e la risposta e
  // «non c'e un giorno migliore».
  const campioneSufficiente = giorni.every((g) => g.campione >= MIN_PER_GIORNO);
  const solido = Math.abs(migliore.scartoC) >= SIGMA * migliore.erroreC;

  return {
    giorni,
    migliore,
    peggiore,
    ampiezzaC,
    significativo: campioneSufficiente && ampiezzaC >= SOGLIA_AMPIEZZA_C && solido,
  };
}
