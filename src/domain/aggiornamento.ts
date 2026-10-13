import type { RawDataset } from './raw';

/**
 * Quando riscaricare i prezzi e come dirlo all'utente.
 *
 * Regola di Nico: ogni volta che l'app si apre i prezzi si aggiornano da
 * soli. «Si apre» vuol dire sia l'avvio a freddo sia il ritorno in primo
 * piano: su Android l'app resta quasi sempre viva dietro, e chi la riapre
 * dal launcher non la sta avviando, la sta riprendendo.
 */

export type MotivoAggiornamento = 'avvio' | 'ripresa' | 'rete' | 'intervallo' | 'manuale';

/**
 * Fra due riprese ravvicinate non serve riscaricare: la ripresa scatta
 * anche tornando dal selettore del navigatore o dal dialogo dei permessi.
 */
export const PAUSA_MINIMA_RIPRESA_MS = 60_000;
/** Ad app aperta e ferma, un controllo ogni mezz'ora basta: il MIMIT pubblica una volta al giorno. */
export const INTERVALLO_CONTROLLO_MS = 30 * 60_000;

export interface StatoAggiornamento {
  /** Ultimo controllo riuscito (ms epoch), anche di una sessione precedente. */
  ultimoSuccesso: number | null;
  /** Ultimo tentativo, riuscito o no, di questa sessione. */
  ultimoTentativo: number | null;
  /** Com'e andato l'ultimo tentativo. */
  ultimoEsito: 'ok' | 'errore' | null;
  inCorso: boolean;
}

export function serveAggiornare(
  motivo: MotivoAggiornamento,
  stato: StatoAggiornamento,
  adesso: number,
): boolean {
  if (stato.inCorso) return false;
  switch (motivo) {
    case 'avvio':
    case 'manuale':
      return true;
    case 'rete':
      // La rete e tornata: se l'ultimo tentativo era fallito e il momento giusto.
      if (stato.ultimoEsito === 'errore') return true;
      return stato.ultimoTentativo === null || adesso - stato.ultimoTentativo >= PAUSA_MINIMA_RIPRESA_MS;
    case 'ripresa':
      return stato.ultimoTentativo === null || adesso - stato.ultimoTentativo >= PAUSA_MINIMA_RIPRESA_MS;
    case 'intervallo':
      return stato.ultimoSuccesso === null || adesso - stato.ultimoSuccesso >= INTERVALLO_CONTROLLO_MS;
  }
}

/** Le attese prima di ogni tentativo: all'apertura la rete del telefono spesso arriva un attimo dopo l'app. */
export function attesePerTentativo(motivo: MotivoAggiornamento): number[] {
  return motivo === 'intervallo' ? [0] : [0, 1500, 5000];
}

/* ── Confronto fra due file ──────────────────────────────────────────── */

/** Quando la pipeline ha prodotto il file: e cio che dice se uno e piu nuovo di un altro. */
export function generatoIl(d: RawDataset): number | null {
  const g = d.source?.generated_at;
  if (g) {
    const t = Date.parse(g);
    if (Number.isFinite(t)) return t;
  }
  const e = Date.parse(d.extracted_at ?? '');
  return Number.isFinite(e) ? e : null;
}

export type Confronto = 'nuovo' | 'uguale' | 'piu-vecchio';

/**
 * Il file scaricato rispetto a quello a schermo. La CDN di GitHub puo
 * servire per qualche minuto la copia precedente: un file piu vecchio di
 * quello che si ha non deve mai sostituirlo.
 */
export function confronta(nuovo: RawDataset, attuale: RawDataset | null): Confronto {
  if (!attuale) return 'nuovo';
  const a = generatoIl(attuale);
  const n = generatoIl(nuovo);
  if (n === null || a === null) return nuovo.stations.length === attuale.stations.length && nuovo.extracted_at === attuale.extracted_at ? 'uguale' : 'nuovo';
  if (n > a) return 'nuovo';
  if (n === a) return 'uguale';
  return 'piu-vecchio';
}

/* ── La riga di stato ────────────────────────────────────────────────── */

export type FaseDati = 'carico' | 'aggiorno' | 'pronto' | 'errore';

export interface DescrizioneDati {
  /** Testo breve per la riga di stato, es. «Aggiornato alle 08:12». */
  testo: string;
  /** true quando i dati mostrati potrebbero non essere quelli di oggi. */
  avviso: boolean;
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function stessoGiorno(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

/** «alle 08:12», «ieri alle 18:03», «il 3 ottobre». */
export function quando(t: number, adesso: number): string {
  const d = new Date(t);
  const oggi = new Date(adesso);
  if (stessoGiorno(d, oggi)) return `alle ${hhmm(d)}`;
  const ieri = new Date(adesso);
  ieri.setDate(ieri.getDate() - 1);
  if (stessoGiorno(d, ieri)) return `ieri alle ${hhmm(d)}`;
  return `il ${d.getDate()} ${MESI[d.getMonth()]}`;
}

/** Oltre questa eta l'ultimo controllo e da considerare vecchio. */
export const DATI_VECCHI_MS = 12 * 60 * 60_000;

/**
 * La riga di stato dei dati.
 *
 * `verificatoIl` e l'ultima volta che il telefono ha controllato con
 * successo che i prezzi fossero quelli di oggi (anche se il file non era
 * cambiato). `datiDel` e la data dei prezzi inclusi nell'app, quando sono
 * loro a schermo.
 */
export function descriviStatoDati(
  fase: FaseDati,
  verificatoIl: number | null,
  adesso: number,
  datiDel: number | null = null,
): DescrizioneDati {
  if (fase === 'carico') return { testo: 'Carico i prezzi…', avviso: false };
  if (fase === 'aggiorno') return { testo: 'Aggiorno i prezzi…', avviso: false };
  if (verificatoIl === null) {
    const del = datiDel !== null ? ` (${quando(datiDel, adesso).replace(/^alle /, 'di oggi alle ').replace(/^il /, 'del ')})` : '';
    return {
      testo: fase === 'errore' ? `Senza rete: prezzi inclusi nell’app${del}` : `Prezzi inclusi nell’app${del}`,
      avviso: true,
    };
  }
  if (fase === 'errore') {
    return { testo: `Senza rete: prezzi controllati ${quando(verificatoIl, adesso)}`, avviso: true };
  }
  return { testo: `Aggiornato ${quando(verificatoIl, adesso)}`, avviso: adesso - verificatoIl > DATI_VECCHI_MS };
}
