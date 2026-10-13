import type { ListItem } from '../home/homeModel';
import type { PriceLevel } from '../../domain/pricing';
import { levelForZ } from '../../domain/pricing';

export interface Cluster {
  /** Id del membro migliore: e lui a dare posizione, prezzo e colore. */
  bestId: string;
  brand: string;
  name: string;
  lat: number;
  lng: number;
  bestPrice: number;
  /** Risparmio netto del membro migliore: pesa gia distanza e freschezza. */
  bestNet: number;
  level: PriceLevel;
  /** Quante stazioni rappresenta. 1 = pillola singola. */
  count: number;
  members: ListItem[];
}

export interface CellSize {
  lat: number;
  lng: number;
}

/** Larghezza e altezza in pixel della pillola del prezzo, spaziatura inclusa. */
const PILL_W = 62;
const PILL_H = 30;
/** Latitudine media dell'Italia: serve a convertire i gradi di longitudine in pixel. */
const COS_LAT_IT = 0.74;

/**
 * Lato della cella in gradi, dimensionato sulla pillola e non su una
 * frazione arbitraria del mondo. Con celle larghe un ottavo di giro sullo
 * schermo entravano meno di trenta pillole e l'utente vedeva 210 impianti
 * su diciottomila: il raggruppamento nascondeva quello che doveva mostrare.
 */
export function cellSizeForZoom(zoom: number): CellSize {
  const z = Math.max(1, Math.min(20, zoom));
  const degPerPx = 360 / (256 * Math.pow(2, z));
  return {
    lng: PILL_W * degPerPx,
    lat: PILL_H * degPerPx * COS_LAT_IT,
  };
}

/**
 * Quante pillole disegnare a un dato zoom. Piu ci si allontana, meno se ne
 * tengono — e restano i piu economici. Il vecchio zoomLimit faceva lo stesso
 * ma scendeva a due marker e senza dirlo: qui il numero e piu generoso e chi
 * guarda sa sempre quanti ne restano fuori.
 */
export function markerBudgetForZoom(zoom: number): number {
  if (zoom >= 16) return 120;
  if (zoom >= 15) return 90;
  if (zoom >= 14) return 60;
  if (zoom >= 13) return 45;
  if (zoom >= 12) return 30;
  if (zoom >= 10) return 20;
  if (zoom >= 8) return 12;
  return 8;
}

/**
 * Tiene i piu economici, ma non lascia mai fuori il consigliato: sparire
 * proprio l'impianto che la Home indica sarebbe la cosa piu confondente.
 */
export function limitToBudget(clusters: Cluster[], zoom: number, keepId?: string): Cluster[] {
  const budget = markerBudgetForZoom(zoom);
  if (clusters.length <= budget) return clusters;

  // Per netto e non per prezzo: sessantotto impianti con prezzi di due mesi
  // fa risultavano i piu economici d Italia e occupavano tutta la mappa.
  // Il netto porta dentro la freschezza del dato e li rimette al loro posto.
  const perNetto = [...clusters].sort((a, b) => b.bestNet - a.bestNet);
  const tenuti = perNetto.slice(0, budget);

  if (keepId && !tenuti.some((c) => c.members.some((m) => m.id === keepId))) {
    const consigliato = perNetto.find((c) => c.members.some((m) => m.id === keepId));
    if (consigliato) tenuti[tenuti.length - 1] = consigliato;
  }

  // Ordine di disegno: il piu conveniente per ultimo, cosi sta sopra.
  return tenuti.sort((a, b) => a.bestNet - b.bestNet);
}

/** Sotto questo numero di pillole una media non dice niente di utile. */
export const MIN_VIEW_N = 4;

/**
 * Ricolora le pillole rispetto a QUELLO CHE SI VEDE, non alla provincia.
 * Allargando la vista restano i piu economici d'Italia, che rispetto alla
 * loro provincia sono tutti «affarone»: sarebbero tutti verdi e il
 * confronto — il motivo per cui si guarda una mappa — sparirebbe.
 * Sotto MIN_VIEW_N pillole si tiene il livello della coorte: con tre
 * prezzi una media non significa nulla.
 */
export function recolorForView(clusters: Cluster[]): Cluster[] {
  if (clusters.length < MIN_VIEW_N) return clusters;

  const prezzi = clusters.map((c) => c.bestPrice);
  const media = prezzi.reduce((s, p) => s + p, 0) / prezzi.length;
  const varianza = prezzi.reduce((s, p) => s + (p - media) ** 2, 0) / prezzi.length;
  const scarto = Math.sqrt(varianza);
  if (scarto === 0) return clusters;

  return clusters.map((c) => ({ ...c, level: levelForZ((c.bestPrice - media) / scarto) }));
}

export function clusterStations(items: ListItem[], zoom: number): Cluster[] {
  const cell = cellSizeForZoom(zoom);
  const buckets = new Map<string, ListItem[]>();

  for (const it of items) {
    const key = `${Math.floor(it.lat / cell.lat)}|${Math.floor(it.lng / cell.lng)}`;
    const b = buckets.get(key);
    if (b) b.push(it);
    else buckets.set(key, [it]);
  }

  const out: Cluster[] = [];
  for (const members of buckets.values()) {
    // Il rappresentante del gruppo e il piu conveniente, non il piu
    // economico: un prezzo vecchio non deve parlare per tutto il gruppo.
    let best = members[0]!;
    for (const m of members) if (m.net > best.net) best = m;
    out.push({
      bestId: best.id,
      brand: best.brand,
      name: best.name,
      lat: best.lat,
      lng: best.lng,
      bestPrice: best.price,
      bestNet: best.net,
      level: best.level,
      count: members.length,
      members,
    });
  }

  // Il piu conveniente per ultimo: cosi finisce sopra gli altri nel disegno.
  out.sort((a, b) => a.bestNet - b.bestNet);
  return out;
}
