import type { PuntoSerie } from '../../domain/andamento';

/**
 * La geometria del grafico dei prezzi, in pixel: percorsi SVG, griglia e
 * posizioni dei punti. Sta fuori dal componente perche e aritmetica pura e
 * si prova senza browser; il componente si limita a disegnarla.
 */

export interface Misure {
  larghezza: number;
  altezza: number;
  /** Margini interni: lo spazio per le etichette sta qui, non sopra la linea. */
  sopra: number;
  sotto: number;
  sinistra: number;
  destra: number;
}

export interface Punto {
  x: number;
  y: number;
}

export interface Geometria {
  /** La linea dello storico. */
  linea: string;
  /** La stessa linea chiusa sul fondo, per la velatura sotto. */
  area: string;
  /** Dall'ultimo punto vero alla fine della previsione; vuota se non c'e previsione. */
  previsione: string;
  /** Un punto per ogni rilevamento, nello stesso ordine della serie. */
  punti: Punto[];
  /** I punti della previsione, dopo l'ultimo rilevamento. */
  futuri: Punto[];
  /** Le righe orizzontali della griglia, con il loro prezzo. */
  righe: Array<{ y: number; valore: number }>;
  /** Passo della griglia in euro: dice quanti decimali servono alle etichette. */
  passo: number;
  fondo: number;
}

const PASSI = [0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1];

/** Il passo di griglia piu fitto che non supera `massimo` righe. */
export function passoGriglia(lo: number, hi: number, massimo = 4): number {
  const ampiezza = Math.max(hi - lo, 1e-6);
  for (const p of PASSI) if (ampiezza / p <= massimo) return p;
  return PASSI[PASSI.length - 1]!;
}

/** I valori della griglia: multipli puliti del passo dentro l'intervallo. */
export function tacche(lo: number, hi: number, passo: number): number[] {
  const out: number[] = [];
  // Si lavora in multipli interi: 2,25 + 0,05 in virgola mobile non fa 2,30.
  for (let k = Math.ceil(lo / passo - 1e-9); k * passo <= hi + 1e-9; k++) {
    out.push(Number((k * passo).toFixed(4)));
  }
  return out;
}

function percorso(punti: readonly Punto[]): string {
  return punti.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
}

export function geometria(
  serie: readonly PuntoSerie[],
  previsione: readonly PuntoSerie[],
  m: Misure,
): Geometria | null {
  const primo = serie[0];
  const ultimo = serie[serie.length - 1];
  if (!primo || !ultimo || m.larghezza <= m.sinistra + m.destra || m.altezza <= m.sopra + m.sotto) return null;

  let lo = Infinity;
  let hi = -Infinity;
  for (const p of serie) {
    if (p.prezzo < lo) lo = p.prezzo;
    if (p.prezzo > hi) hi = p.prezzo;
  }
  for (const p of previsione) {
    if (p.prezzo < lo) lo = p.prezzo;
    if (p.prezzo > hi) hi = p.prezzo;
  }
  // Una serie piatta disegnata a tutta altezza ingigantirebbe il rumore:
  // sotto il centesimo l'intervallo si allarga attorno al centro.
  if (hi - lo < 0.01) {
    const centro = (hi + lo) / 2;
    lo = centro - 0.005;
    hi = centro + 0.005;
  }
  const margine = (hi - lo) * 0.08;
  lo -= margine;
  hi += margine;

  const t0 = primo.ts;
  const fine = previsione[previsione.length - 1]?.ts ?? ultimo.ts;
  const t1 = fine > t0 ? fine : t0 + 86_400_000;

  const larga = m.larghezza - m.sinistra - m.destra;
  const alta = m.altezza - m.sopra - m.sotto;
  const x = (ts: number) => m.sinistra + ((ts - t0) / (t1 - t0)) * larga;
  const y = (v: number) => m.sopra + (1 - (v - lo) / (hi - lo)) * alta;
  const fondo = m.sopra + alta;

  const punti = serie.map((p) => ({ x: x(p.ts), y: y(p.prezzo) }));
  const futuri = previsione.map((p) => ({ x: x(p.ts), y: y(p.prezzo) }));
  const linea = percorso(punti);
  const ultimoPunto = punti[punti.length - 1]!;
  const area = `${linea}L${ultimoPunto.x.toFixed(1)},${fondo.toFixed(1)}L${punti[0]!.x.toFixed(1)},${fondo.toFixed(1)}Z`;

  const passo = passoGriglia(lo, hi);
  const righe = tacche(lo, hi, passo).map((valore) => ({ y: y(valore), valore }));

  return {
    linea,
    area,
    previsione: futuri.length ? percorso([ultimoPunto, ...futuri]) : '',
    punti,
    futuri,
    righe,
    passo,
    fondo,
  };
}

/** L'indice del punto piu vicino in orizzontale. I punti sono in ordine di x. */
export function piuVicino(punti: readonly Punto[], x: number): number {
  if (punti.length === 0) return -1;
  let a = 0;
  let b = punti.length - 1;
  while (b - a > 1) {
    const mezzo = (a + b) >> 1;
    if (punti[mezzo]!.x < x) a = mezzo;
    else b = mezzo;
  }
  return Math.abs(punti[a]!.x - x) <= Math.abs(punti[b]!.x - x) ? a : b;
}
