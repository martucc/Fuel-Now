import type { LatLng } from './geo';
import { haversineKm } from './geo';
import type { FuelKey } from './raw';
import type { StationRow } from './parse';
import { ageHours, isLikelyClosed } from './freshness';

/**
 * I distributori lungo un percorso, in tutta Italia.
 *
 * Il viaggio di settembre guardava solo gli impianti entro cinquanta km
 * dalla partenza e misurava la distanza dai vertici della spezzata, non dai
 * tratti: su un'autostrada dritta, con un vertice ogni venti km, una pompa
 * a cento metri dalla carreggiata risultava a dieci km dalla strada.
 *
 * Qui il conto e esatto e veloce:
 *  1. la spezzata si semplifica (Douglas–Peucker, ~30 m): OSRM ne manda
 *     decine di migliaia di punti, ma la forma resta la stessa con pochi;
 *  2. i tratti finiscono in una griglia di celle da 0,05° (circa 5 km),
 *     ciascuno in tutte le celle che stanno entro il margine;
 *  3. ogni impianto guarda solo i tratti della propria cella e si proietta
 *     sul piu vicino: distanza laterale vera e km dalla partenza, dalle
 *     lunghezze cumulate calcolate una volta sola;
 *  4. chi sta a meno di cento metri si rimisura sulla spezzata vera, quella
 *     non semplificata: li trenta metri di semplificazione bastano a
 *     spostare un'area di servizio da una carreggiata all'altra.
 *
 * Ventunomila impianti su un percorso di mille km: pochi millisecondi.
 */

/** Oltre questa distanza dalla strada un impianto non e piu «lungo il percorso». */
export const SCOSTAMENTO_MAX_KM = 2.5;
/**
 * Sotto questa distanza dalla linea della strada non si dice da che lato
 * sta un impianto: e sulla strada.
 *
 * La linea di OSRM, in autostrada, corre in mezzo alla nostra carreggiata,
 * e il bordo sinistro sta a sei-otto metri; oltre ci sono lo spartitraffico
 * e, a quindici-venti metri, l'altra carreggiata. Un impianto piu a
 * sinistra di cosi non e sulla nostra strada. Con 25 m, come nella prima
 * versione, restava dentro Lucignano Est (A1, carreggiata nord), che
 * andando verso Roma sta 11 m a sinistra e costa meno del gemello giusto.
 * Sui diciassette percorsi veri provati nessun'area di servizio dalla
 * parte giusta sta a sinistra della linea.
 */
export const SULLA_LINEA_KM = 0.008;
/**
 * Entro questa distanza dalla spezzata semplificata un impianto si
 * rimisura su quella vera: il lato conta, e la semplificazione lo puo
 * cambiare fino a TOLLERANZA_SEMPLIFICAZIONE_KM.
 */
const RIMISURA_KM = 0.1;
/** Tolleranza della semplificazione: sotto i 30 m la forma della strada non cambia. */
export const TOLLERANZA_SEMPLIFICAZIONE_KM = 0.03;
/** Lato delle celle della griglia, in gradi. */
const CELLA_GRADI = 0.05;

const RAD = Math.PI / 180;
/** Km per grado di latitudine (e di longitudine all'equatore). */
const KM_PER_GRADO = 6371 * RAD;

/* ── Semplificazione ──────────────────────────────────────────────────── */

/**
 * Distanza in km del punto p dal segmento a-b, su un piano locale
 * (equirettangolare, scala delle longitudini presa a meta del segmento).
 */
function distanzaPianaKm(p: LatLng, a: LatLng, b: LatLng): number {
  const k = Math.cos(((a.lat + b.lat) / 2) * RAD);
  const vx = (b.lng - a.lng) * k;
  const vy = b.lat - a.lat;
  const px = (p.lng - a.lng) * k;
  const py = p.lat - a.lat;
  const l2 = vx * vx + vy * vy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, (px * vx + py * vy) / l2)) : 0;
  return Math.hypot(px - t * vx, py - t * vy) * KM_PER_GRADO;
}

/**
 * Douglas–Peucker iterativo: tiene il primo e l'ultimo punto e, fra i due,
 * solo quelli che si allontanano dalla corda piu della tolleranza.
 */
export function semplificaPercorso(punti: readonly LatLng[], tolleranzaKm = TOLLERANZA_SEMPLIFICAZIONE_KM): LatLng[] {
  return indiciSemplificati(punti, tolleranzaKm).map((i) => punti[i]!);
}

/** Come semplificaPercorso, ma dice quali punti tiene: i loro indici, in ordine. */
function indiciSemplificati(punti: readonly LatLng[], tolleranzaKm: number): number[] {
  const n = punti.length;
  if (n <= 2 || !(tolleranzaKm > 0)) return Array.from({ length: n }, (_, i) => i);

  const tieni = new Uint8Array(n);
  tieni[0] = 1;
  tieni[n - 1] = 1;
  const pila: number[] = [0, n - 1];

  while (pila.length > 0) {
    const fine = pila.pop()!;
    const inizio = pila.pop()!;
    if (fine - inizio < 2) continue;
    const a = punti[inizio]!;
    const b = punti[fine]!;
    let peggiore = -1;
    let massimo = tolleranzaKm;
    for (let i = inizio + 1; i < fine; i++) {
      const d = distanzaPianaKm(punti[i]!, a, b);
      if (d > massimo) {
        massimo = d;
        peggiore = i;
      }
    }
    if (peggiore > 0) {
      tieni[peggiore] = 1;
      pila.push(inizio, peggiore, peggiore, fine);
    }
  }

  const out: number[] = [];
  for (let i = 0; i < n; i++) if (tieni[i]) out.push(i);
  return out;
}

/* ── Indice spaziale ──────────────────────────────────────────────────── */

export interface IndicePercorso {
  /** La spezzata semplificata. */
  punti: LatLng[];
  /** La spezzata vera, com'e arrivata dal router. */
  grezzi: readonly LatLng[];
  /** Per ogni vertice della semplificata, il suo indice nella spezzata vera. */
  daGrezzi: Uint32Array;
  /** Quanto la semplificata puo scostarsi dalla vera, in km. */
  tolleranzaKm: number;
  /** Km dalla partenza a ogni vertice, lungo la spezzata. */
  cumulateKm: Float64Array;
  /** Lunghezza della spezzata in km (in linea d'aria fra vertice e vertice). */
  kmTotali: number;
  /** Fin dove la griglia copre: un impianto piu lontano non viene visto. */
  margineKm: number;
  /** Cella → tratti che passano entro il margine, in ordine di percorso. */
  celle: Map<number, number[]>;
  /** Il riquadro del percorso allargato del margine: fuori non si guarda nemmeno. */
  riquadro: { minLat: number; maxLat: number; minLng: number; maxLng: number };
}

/** Chiave numerica di una cella: piu veloce di una stringa su ventimila ricerche. */
function chiaveCella(cy: number, cx: number): number {
  return (cy + 4000) * 10_000 + (cx + 4000);
}

function aggiungi(celle: Map<number, number[]>, chiave: number, tratto: number): void {
  const lista = celle.get(chiave);
  if (!lista) celle.set(chiave, [tratto]);
  // I tratti arrivano in ordine: un doppione e sempre l'ultimo inserito.
  else if (lista[lista.length - 1] !== tratto) lista.push(tratto);
}

/**
 * Prepara un percorso per le ricerche: semplifica, calcola le lunghezze
 * cumulate e mette ogni tratto nelle celle che stanno entro il margine.
 *
 * Un tratto lungo (un'autostrada dritta per cinquanta km ha due soli
 * vertici) si spezza in pezzi grandi una cella: cosi occupa le celle che
 * attraversa davvero e non tutto il suo riquadro.
 */
export function indicizzaPercorso(
  punti: readonly LatLng[],
  opzioni: { tolleranzaKm?: number; margineKm?: number } = {},
): IndicePercorso {
  const margineKm = opzioni.margineKm ?? SCOSTAMENTO_MAX_KM;
  const tolleranzaKm = opzioni.tolleranzaKm ?? TOLLERANZA_SEMPLIFICAZIONE_KM;
  const daGrezzi = Uint32Array.from(indiciSemplificati(punti, tolleranzaKm));
  const semplici = Array.from(daGrezzi, (i) => punti[i]!);
  const n = semplici.length;
  const cumulateKm = new Float64Array(Math.max(1, n));
  const celle = new Map<number, number[]>();
  const riquadro = { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity };

  const margineLat = margineKm / KM_PER_GRADO;

  for (let s = 0; s < n - 1; s++) {
    const a = semplici[s]!;
    const b = semplici[s + 1]!;
    cumulateKm[s + 1] = cumulateKm[s]! + haversineKm(a, b);

    const pezzi = Math.max(1, Math.ceil(Math.max(Math.abs(b.lat - a.lat), Math.abs(b.lng - a.lng)) / CELLA_GRADI));
    for (let k = 0; k < pezzi; k++) {
      const lat0 = a.lat + ((b.lat - a.lat) * k) / pezzi;
      const lat1 = a.lat + ((b.lat - a.lat) * (k + 1)) / pezzi;
      const lng0 = a.lng + ((b.lng - a.lng) * k) / pezzi;
      const lng1 = a.lng + ((b.lng - a.lng) * (k + 1)) / pezzi;
      const minLat = Math.min(lat0, lat1) - margineLat;
      const maxLat = Math.max(lat0, lat1) + margineLat;
      // La scala delle longitudini si prende alla latitudine piu lontana
      // dall'equatore: il margine in gradi viene un po' piu largo, mai stretto.
      const latEstrema = Math.min(89, Math.max(Math.abs(minLat), Math.abs(maxLat)));
      const margineLng = margineKm / (KM_PER_GRADO * Math.cos(latEstrema * RAD));
      const minLng = Math.min(lng0, lng1) - margineLng;
      const maxLng = Math.max(lng0, lng1) + margineLng;

      if (minLat < riquadro.minLat) riquadro.minLat = minLat;
      if (maxLat > riquadro.maxLat) riquadro.maxLat = maxLat;
      if (minLng < riquadro.minLng) riquadro.minLng = minLng;
      if (maxLng > riquadro.maxLng) riquadro.maxLng = maxLng;

      const cy0 = Math.floor(minLat / CELLA_GRADI);
      const cy1 = Math.floor(maxLat / CELLA_GRADI);
      const cx0 = Math.floor(minLng / CELLA_GRADI);
      const cx1 = Math.floor(maxLng / CELLA_GRADI);
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) aggiungi(celle, chiaveCella(cy, cx), s);
      }
    }
  }

  return {
    punti: semplici,
    grezzi: punti,
    daGrezzi,
    tolleranzaKm: Math.max(0, tolleranzaKm),
    cumulateKm,
    kmTotali: n > 1 ? cumulateKm[n - 1]! : 0,
    margineKm,
    celle,
    riquadro,
  };
}

/* ── Ricerca ──────────────────────────────────────────────────────────── */

export interface ImpiantoSulPercorso {
  row: StationRow;
  /** Prezzo del carburante scelto (self quando c'e). */
  prezzo: number;
  /**
   * Distanza in linea d'aria fra l'impianto e il punto piu vicino della
   * strada: sulla spezzata vera entro RIMISURA_KM, altrimenti su quella
   * semplificata (al piu trenta metri di differenza).
   */
  scostamentoKm: number;
  /** Km dalla partenza al punto in cui si lascia la strada. */
  kmDaPartenza: number;
  /**
   * true quando l'impianto sta a sinistra della strada, guardando nel verso
   * di marcia, ad almeno SULLA_LINEA_KM. In autostrada vuol dire l'altra
   * carreggiata: non ci si entra.
   */
  aSinistra: boolean;
}

export interface OpzioniLungoPercorso {
  fuel: FuelKey;
  adesso: Date;
  nascosti?: ReadonlySet<string>;
  /** Distanza massima dalla strada; predefinita 2,5 km. */
  maxScostamentoKm?: number;
  /**
   * La lunghezza stradale dal router. Se c'e, i km dalla partenza si
   * riportano su quella: la spezzata in linea d'aria la sottostima sempre
   * un po', e il piano confronta questi km con la distanza del router.
   */
  kmStradali?: number;
}

/**
 * Gli impianti entro `maxScostamentoKm` dalla strada, in ordine di km.
 *
 * Restano fuori quelli nascosti dall'utente, quelli senza il carburante
 * scelto e quelli con il prezzo fermo da oltre una settimana (quasi sempre
 * chiusi). Un prezzo senza data resta: non sapere non vuol dire chiuso.
 *
 * Se la strada passa due volte vicino allo stesso impianto (andata e
 * ritorno, un tornante) conta il passaggio piu vicino, e a parita il primo.
 */
export function impiantiLungoPercorso(
  percorso: IndicePercorso | readonly LatLng[],
  rows: readonly StationRow[],
  o: OpzioniLungoPercorso,
): ImpiantoSulPercorso[] {
  const max = o.maxScostamentoKm ?? SCOSTAMENTO_MAX_KM;
  let indice = 'celle' in percorso ? percorso : indicizzaPercorso(percorso, { margineKm: max });
  // Un indice preparato per un margine piu stretto non vedrebbe tutto.
  if (indice.margineKm < max) indice = indicizzaPercorso(indice.grezzi, { tolleranzaKm: indice.tolleranzaKm, margineKm: max });

  const { punti, grezzi, daGrezzi, cumulateKm, celle, riquadro } = indice;
  const tratti = punti.length - 1;
  if (tratti < 1) return [];

  // I tratti in array piatti: nel ciclo caldo niente oggetti.
  const aLat = new Float64Array(tratti);
  const aLng = new Float64Array(tratti);
  const dLat = new Float64Array(tratti);
  const dLng = new Float64Array(tratti);
  const lunghezza = new Float64Array(tratti);
  for (let s = 0; s < tratti; s++) {
    const a = punti[s]!;
    const b = punti[s + 1]!;
    aLat[s] = a.lat;
    aLng[s] = a.lng;
    dLat[s] = b.lat - a.lat;
    dLng[s] = b.lng - a.lng;
    lunghezza[s] = cumulateKm[s + 1]! - cumulateKm[s]!;
  }

  const scala = o.kmStradali && o.kmStradali > 0 && indice.kmTotali > 0 ? o.kmStradali / indice.kmTotali : 1;
  const maxGradi = max / KM_PER_GRADO;
  const rimisuraGradi = RIMISURA_KM / KM_PER_GRADO;
  const tolleranzaGradi = indice.tolleranzaKm / KM_PER_GRADO;

  /**
   * Il punto piu vicino sulla spezzata vera, fra i punti che la
   * semplificata ha tolto dal tratto s: distanza al quadrato e lato, in
   * gradi come sopra.
   */
  let veraD2 = Infinity;
  let veraLato = 0;
  const rimisura = (s: number, lat: number, lng: number, k: number) => {
    for (let g = daGrezzi[s]!; g < daGrezzi[s + 1]!; g++) {
      const a = grezzi[g]!;
      const b = grezzi[g + 1]!;
      const vx = (b.lng - a.lng) * k;
      const vy = b.lat - a.lat;
      const px = (lng - a.lng) * k;
      const py = lat - a.lat;
      const l2 = vx * vx + vy * vy;
      const t = l2 > 0 ? Math.max(0, Math.min(1, (px * vx + py * vy) / l2)) : 0;
      const ex = px - t * vx;
      const ey = py - t * vy;
      const d2 = ex * ex + ey * ey;
      if (d2 < veraD2) {
        veraD2 = d2;
        veraLato = vx * py - vy * px;
      }
    }
  };
  const nascosti = o.nascosti;
  const out: ImpiantoSulPercorso[] = [];

  for (const r of rows) {
    const lat = r.lat;
    const lng = r.lng;
    if (lat < riquadro.minLat || lat > riquadro.maxLat || lng < riquadro.minLng || lng > riquadro.maxLng) continue;
    const candidati = celle.get(chiaveCella(Math.floor(lat / CELLA_GRADI), Math.floor(lng / CELLA_GRADI)));
    if (!candidati) continue;
    const prezzo = r.prices[o.fuel];
    if (prezzo === undefined || nascosti?.has(r.id)) continue;

    const k = Math.cos(lat * RAD);
    let migliore = Infinity;
    let tratto = -1;
    let piede = 0;
    let lato = 0;
    for (let c = 0; c < candidati.length; c++) {
      const s = candidati[c]!;
      const vx = dLng[s]! * k;
      const vy = dLat[s]!;
      const px = (lng - aLng[s]!) * k;
      const py = lat - aLat[s]!;
      const l2 = vx * vx + vy * vy;
      const t = l2 > 0 ? Math.max(0, Math.min(1, (px * vx + py * vy) / l2)) : 0;
      const ex = px - t * vx;
      const ey = py - t * vy;
      const d2 = ex * ex + ey * ey;
      if (d2 < migliore) {
        migliore = d2;
        tratto = s;
        piede = t;
        // Il prodotto vettoriale fra il verso del tratto e l'impianto:
        // positivo a sinistra, con l'est sulle x e il nord sulle y.
        lato = vx * py - vy * px;
      }
    }
    if (tratto < 0) continue;
    let gradi = Math.sqrt(migliore);
    if (gradi > maxGradi) continue;
    // La data si legge solo per i pochi impianti vicini alla strada.
    if (isLikelyClosed(ageHours(r.updated, o.adesso))) continue;

    if (gradi < rimisuraGradi && tolleranzaGradi > 0) {
      // Sulla spezzata vera: prima il tratto piu vicino, poi ogni altro
      // tratto che, tolleranza compresa, potrebbe nascondere un punto piu
      // vicino (un tornante, un raccordo).
      veraD2 = Infinity;
      rimisura(tratto, lat, lng, k);
      for (let c = 0; c < candidati.length; c++) {
        const s = candidati[c]!;
        if (s === tratto) continue;
        const vx = dLng[s]! * k;
        const vy = dLat[s]!;
        const px = (lng - aLng[s]!) * k;
        const py = lat - aLat[s]!;
        const l2 = vx * vx + vy * vy;
        const t = l2 > 0 ? Math.max(0, Math.min(1, (px * vx + py * vy) / l2)) : 0;
        const d = Math.hypot(px - t * vx, py - t * vy);
        if (d - tolleranzaGradi < Math.sqrt(veraD2)) rimisura(s, lat, lng, k);
      }
      gradi = Math.sqrt(veraD2);
      lato = veraLato;
    }

    const scostamentoKm = gradi * KM_PER_GRADO;
    out.push({
      row: r,
      prezzo,
      scostamentoKm,
      kmDaPartenza: (cumulateKm[tratto]! + piede * lunghezza[tratto]!) * scala,
      aSinistra: lato > 0 && scostamentoKm >= SULLA_LINEA_KM,
    });
  }

  out.sort((x, y) => x.kmDaPartenza - y.kmDaPartenza);
  return out;
}

/* ── Utilita per la mappa ─────────────────────────────────────────────── */

/**
 * Al piu `quanti` punti presi a intervalli regolari, primo e ultimo
 * compresi: bastano per inquadrare il percorso sulla mappa.
 */
export function campionaPercorso(punti: readonly LatLng[], quanti = 64): LatLng[] {
  if (punti.length <= quanti || quanti < 2) return punti.slice();
  const out: LatLng[] = [];
  const passo = (punti.length - 1) / (quanti - 1);
  for (let i = 0; i < quanti; i++) out.push(punti[Math.round(i * passo)]!);
  return out;
}

/** Lato in pixel del mondo intero a zoom 0, come lo misura MapLibre. */
const MONDO_PX = 512;

/**
 * Centro e zoom che inquadrano tutto il percorso in una mappa di queste
 * misure (proiezione di Mercatore, come MapLibre). La mappa nasce gia sul
 * viaggio, invece di partire dalla partenza e attraversare mezza Italia.
 */
export function vistaPercorso(
  punti: readonly LatLng[],
  larghezzaPx = 360,
  altezzaPx = 280,
  marginePx = 36,
): { centro: LatLng; zoom: number } | null {
  if (punti.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of punti) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  const y = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
  const fx = (maxLng - minLng) / 360;
  const fy = (y(maxLat) - y(minLat)) / (2 * Math.PI);
  const w = Math.max(1, larghezzaPx - 2 * marginePx) / MONDO_PX;
  const h = Math.max(1, altezzaPx - 2 * marginePx) / MONDO_PX;
  const zoom = Math.min(15, fx > 0 ? Math.log2(w / fx) : 15, fy > 0 ? Math.log2(h / fy) : 15);
  const ym = (y(minLat) + y(maxLat)) / 2;
  return {
    centro: { lat: (2 * Math.atan(Math.exp(ym)) - Math.PI / 2) / RAD, lng: (minLng + maxLng) / 2 },
    zoom: Math.max(4, zoom),
  };
}
