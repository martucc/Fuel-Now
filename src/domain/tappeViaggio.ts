import type { FuelKey } from './raw';
import type { CohortIndex } from './market';
import { cohortFor } from './market';
import type { PriceLevel } from './pricing';
import { priceLevel, Z_ABSURD } from './pricing';
import { ageHours } from './freshness';
import type { CarSpec } from './units';
import { DEFAULT_TANK_L } from './units';
import type { ImpiantoSulPercorso } from './lungoPercorso';
import { SCOSTAMENTO_MAX_KM } from './lungoPercorso';
import type { Piano, TappaCandidata } from './viaggio';
import { MOTIVO_TESTO, pianificaViaggio } from './viaggio';
import { litri, numero } from '../lib/formato';

/**
 * Dagli impianti lungo la strada al piano del viaggio: quali si possono
 * prendere in considerazione, quanto c'e nel serbatoio, a che prezzo si
 * partirebbe, e quanto costa il carburante del viaggio.
 */

/**
 * Quanto si e disposti a uscire dalla strada. La strategia non pesa
 * punteggi: decide solo quali distributori entrano nel piano, e il piano
 * sceglie fra quelli col conto vero.
 */
export type Strategia = 'bilanciato' | 'risparmio' | 'veloce';

export const SCOSTAMENTO_STRATEGIA: Record<Strategia, number> = {
  veloce: 0.5,
  bilanciato: 1,
  risparmio: SCOSTAMENTO_MAX_KM,
};

/** Il livello del serbatoio adesso, come lo legge chi guarda la lancetta. */
export type LivelloSerbatoio = 'riserva' | 'quarto' | 'meta' | 'tre-quarti' | 'pieno';

export const LIVELLI_SERBATOIO: readonly LivelloSerbatoio[] = ['riserva', 'quarto', 'meta', 'tre-quarti', 'pieno'];

export const FRAZIONE_SERBATOIO: Record<LivelloSerbatoio, number> = {
  // La spia della riserva si accende intorno a un decimo del serbatoio.
  riserva: 0.1,
  quarto: 0.25,
  meta: 0.5,
  'tre-quarti': 0.75,
  pieno: 1,
};

/** Entro questi km dalla partenza un distributore e «quello sotto casa». */
export const KM_PARTENZA = 10;

/** Il serbatoio dell'auto scelta, o quello medio se l'auto non e nota o il dato non sta in piedi. */
export function serbatoioDi(auto: CarSpec | null): number {
  const l = auto?.liters;
  return typeof l === 'number' && Number.isFinite(l) && l > 5 && l < 200 ? l : DEFAULT_TANK_L;
}

/**
 * Le tappe da dare al piano: gli impianti entro la deviazione della
 * strategia, col livello di prezzo della loro coorte.
 *
 * Fuori, come nella Home, i prezzi fuori scala (quasi sempre un errore di
 * battitura) e quelli molto bassi e pure vecchi: il dato fantasma che fa
 * fermare per una pompa che in realta costa come le altre.
 *
 * Fuori anche le aree di servizio dell'autostrada a sinistra della strada:
 * sono sull'altra carreggiata, a quaranta metri in linea d'aria ma
 * raggiungibili solo tornando indietro dall'uscita dopo. Il piano, che
 * conta la deviazione al metro, le preferiva proprio perche «vicine».
 */
export function tappeCandidate(
  impianti: readonly ImpiantoSulPercorso[],
  o: { fuel: FuelKey; cohorts: CohortIndex; strategia: Strategia; adesso: Date },
): TappaCandidata[] {
  const max = SCOSTAMENTO_STRATEGIA[o.strategia];
  const out: TappaCandidata[] = [];
  for (const i of impianti) {
    if (i.scostamentoKm > max) continue;
    if (i.row.isHighway && i.aSinistra) continue;
    const coorte = cohortFor(i.row, o.fuel, o.cohorts);
    let level: PriceLevel = 'normal';
    if (coorte) {
      const g = priceLevel(i.prezzo, coorte);
      if (g.z !== null && Math.abs(g.z) > Z_ABSURD) continue;
      const ore = ageHours(i.row.updated, o.adesso);
      if (g.z !== null && g.z < -2.5 && ore !== null && ore > 48) continue;
      level = g.level;
    }
    out.push({
      id: i.row.id,
      nome: i.row.name,
      brand: i.row.brand,
      prezzo: i.prezzo,
      level,
      kmDaPartenza: i.kmDaPartenza,
      // Sola andata: il piano la conta due volte, per uscire e per rientrare.
      deviazioneKm: i.scostamentoKm,
    });
  }
  return out;
}

function mediana(v: number[]): number | null {
  if (v.length === 0) return null;
  const o = [...v].sort((a, b) => a - b);
  const m = o.length >> 1;
  return o.length % 2 ? o[m]! : (o[m - 1]! + o[m]!) / 2;
}

export interface DatiViaggio {
  impianti: readonly ImpiantoSulPercorso[];
  cohorts: CohortIndex;
  fuel: FuelKey;
  adesso: Date;
  strategia: Strategia;
  /** Km stradali del router. */
  distanzaKm: number;
  kml: number;
  serbatoioL: number;
  livello: LivelloSerbatoio;
}

export interface EsitoViaggio {
  piano: Piano;
  /** Le tappe che il piano ha potuto scegliere. */
  candidate: TappaCandidata[];
  litriAdesso: number;
  /** Il prezzo piu basso entro i primi km: dove faresti il pieno prima di partire. */
  prezzoPartenza: number | null;
  /** Litri bruciati in tutto il viaggio, deviazioni comprese. */
  litriConsumati: number;
  /** Quanto vale il carburante bruciato, a spanne. Null senza nessun prezzo. */
  costoStimato: number | null;
}

/**
 * Il piano del viaggio, pronto da mostrare.
 *
 * Il piano sceglie da solo, col conto del costo minimo: il prezzo di
 * partenza serve solo al confronto col «pieno prima di partire». Se
 * vicino alla partenza non c'e un distributore quel confronto non si fa:
 * sarebbe un confronto con una pompa che non esiste.
 */
export function calcolaViaggio(d: DatiViaggio): EsitoViaggio {
  const candidate = tappeCandidate(d.impianti, d);
  const litriAdesso = d.serbatoioL * FRAZIONE_SERBATOIO[d.livello];

  let prezzoPartenza: number | null = null;
  for (const t of candidate) {
    if (t.kmDaPartenza > KM_PARTENZA) break;
    if (prezzoPartenza === null || t.prezzo < prezzoPartenza) prezzoPartenza = t.prezzo;
  }

  const piano = pianificaViaggio({
    distanzaKm: d.distanzaKm,
    kml: d.kml,
    serbatoioL: d.serbatoioL,
    litriAdesso,
    candidate,
    prezzoPartenza,
  });

  // Il valore del carburante bruciato: al prezzo medio pagato nelle soste,
  // o, senza soste, a quello di partenza o alla mediana della strada.
  const litriConsumati = d.kml > 0 ? d.distanzaKm / d.kml + piano.litriDeviazione : 0;
  const riferimento = prezzoPartenza ?? mediana(candidate.map((t) => t.prezzo));
  const prezzoMedio = piano.litriComprati > 0 ? piano.spesaCarburante / piano.litriComprati : riferimento;

  return {
    piano,
    candidate,
    litriAdesso,
    prezzoPartenza,
    litriConsumati,
    costoStimato: prezzoMedio !== null ? litriConsumati * prezzoMedio : null,
  };
}

/** Perche il piano non si fa, detto in modo che si capisca cosa fare. */
export function testoImpossibile(piano: Piano, strategia: Strategia): string {
  const motivo = piano.motivo ?? 'buco-troppo-lungo';
  if (motivo !== 'buco-troppo-lungo') return MOTIVO_TESTO[motivo];
  const km = piano.bloccoAlKm !== undefined ? Math.max(1, Math.round(piano.bloccoAlKm)) : null;
  const dove = km !== null ? ` intorno al km ${numero(km)}` : '';
  const base =
    piano.soste.length === 0
      ? `Con il carburante che hai resti a secco${dove}, prima di arrivare a un distributore lungo la strada.`
      : `${MOTIVO_TESTO['buco-troppo-lungo']} Anche col pieno all’ultimo distributore che raggiungi resti a secco${dove}.`;
  return strategia === 'risparmio' ? base : `${base} Prova con Risparmio: conta anche i distributori più lontani dalla strada.`;
}

/**
 * Quando ci si arriva sotto la riserva: succede solo se nessun piano la
 * tiene, perche non c'e un distributore dove servirebbe o perche un pieno
 * non basta per l'ultimo tratto. Dice quanto resta e cosa fare, senza
 * negare distributori che magari ci sono.
 */
export function testoSottoRiserva(piano: Piano, strategia: Strategia): string {
  const n = piano.soste.length;
  const arrivi = `arrivi con circa ${litri(piano.litriAllArrivo, 1)}, sotto la riserva. Fai benzina appena puoi.`;
  const base =
    n === 0 ? `Senza fermarti ${arrivi}` : `${n === 1 ? 'Con la sosta qui sotto' : `Con le ${numero(n)} soste qui sotto`} ${arrivi}`;
  return strategia === 'risparmio' ? base : `${base} Con Risparmio il piano guarda anche i distributori più lontani dalla strada.`;
}

/** «Alla prima sosta ci arrivi in riserva.», «Alla sosta 2 ci arrivi in riserva.» */
export function testoSostaInRiserva(numeroSosta: number): string {
  return numeroSosta === 1 ? 'Alla prima sosta ci arrivi in riserva.' : `Alla sosta ${numero(numeroSosta)} ci arrivi in riserva.`;
}
