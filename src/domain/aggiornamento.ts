/**
 * Quando riscaricare i prezzi e come dirlo all'utente.
 *
 * Regola di Nico: ogni volta che l'app si apre i prezzi si aggiornano da
 * soli. «Si apre» vuol dire sia l'avvio a freddo sia il ritorno in primo
 * piano: su Android l'app resta quasi sempre viva dietro, e chi la riapre
 * dal launcher non la sta avviando, la sta riprendendo.
 */

export type MotivoAggiornamento = 'avvio' | 'ripresa' | 'intervallo' | 'manuale';

/** Fra due riprese ravvicinate (cambi app e torni) non serve riscaricare. */
export const PAUSA_MINIMA_RIPRESA_MS = 60_000;
/** Ad app aperta e ferma, un controllo ogni mezz'ora basta: il MIMIT pubblica una volta al giorno. */
export const INTERVALLO_CONTROLLO_MS = 30 * 60_000;

export interface StatoAggiornamento {
  /** Ultimo download riuscito (ms epoch), anche di una sessione precedente. */
  ultimoSuccesso: number | null;
  /** Ultimo tentativo, riuscito o no, di questa sessione. */
  ultimoTentativo: number | null;
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
    case 'ripresa':
      return stato.ultimoTentativo === null || adesso - stato.ultimoTentativo >= PAUSA_MINIMA_RIPRESA_MS;
    case 'intervallo':
      return stato.ultimoSuccesso === null || adesso - stato.ultimoSuccesso >= INTERVALLO_CONTROLLO_MS;
  }
}

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

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

/** Oltre questa eta il download e da considerare vecchio anche se l'ultimo tentativo e andato bene. */
export const DATI_VECCHI_MS = 12 * 60 * 60_000;

/**
 * La riga di stato dei dati. `scaricatoIl` e quando il telefono ha preso il
 * file dalla rete: nullo se si stanno mostrando i prezzi inclusi nell'app.
 */
export function descriviStatoDati(
  fase: FaseDati,
  scaricatoIl: number | null,
  adesso: number,
): DescrizioneDati {
  if (fase === 'carico') return { testo: 'Carico i prezzi…', avviso: false };
  if (fase === 'aggiorno') {
    return { testo: 'Aggiorno i prezzi…', avviso: false };
  }
  if (scaricatoIl === null) {
    return {
      testo: fase === 'errore' ? 'Senza rete: prezzi inclusi nell’app' : 'Prezzi inclusi nell’app',
      avviso: true,
    };
  }
  const vecchio = adesso - scaricatoIl > DATI_VECCHI_MS;
  if (fase === 'errore') {
    return { testo: `Senza rete: prezzi scaricati ${quando(scaricatoIl, adesso)}`, avviso: true };
  }
  return { testo: `Aggiornato ${quando(scaricatoIl, adesso)}`, avviso: vecchio };
}
