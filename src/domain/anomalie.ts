import type { FuelKey } from './raw';
import type { StationRow } from './parse';
import { prezzoAllaPompa } from './parse';
import type { CohortIndex } from './market';
import { isLikelyClosed, ORE_PREZZO_VECCHIO, ritardoSulLotto, ultimoPrezzo } from './freshness';

/*
  Un prezzo da non credere: quasi sempre un errore di battitura del gestore
  («1,849» invece di «2,249») o un prezzo vecchio rimasto li mentre gli altri
  sono saliti. Lo stesso giudizio vale per la Home, la mappa e il Viaggio.

  Il metro e la zona, non la provincia: i distributori dello stesso
  carburante con un prezzo recente nel raggio di 25 km (se sono meno di
  cinque, di 50). Della zona si prendono la mediana e la MAD (la mediana
  degli scarti dalla mediana), che due o tre errori non spostano. La media
  di provincia invece si sposta: in provincia di Sondrio Livigno, dove il
  gasolio costa un quarto in meno, la abbassa tanto che un errore fresco 45
  centesimi sotto i vicini di Sondrio sembrava normale.

  Un prezzo al servito si confronta coi prezzi al servito della zona: il
  servito costa per conto suo 20-50 centesimi in piu, e un'isola con una
  sola pompa, al servito, non e «fuori mercato» perche il self in
  terraferma costa meno. All'insu, poi, si giudica solo chi ha altri
  distributori intorno: un prezzo alto conta solo quando fa da metro, e
  l'unica pompa di un'isola non fa da metro a nessuno.

  Livigno e un mercato a se, e lo si dice apertamente (vedi
  COMUNI_EXTRADOGANALI): senza accise il gasolio costa un quarto meno che a
  Bormio, e fra un distributore e l'altro del paese corre un altro quarto
  (1,292 l'Agip, 1,72 gli altri, nei dati del 13 ottobre 2026). I suoi
  impianti fanno zona solo fra loro e non entrano nella zona degli altri.
  Sotto la loro zona sono assurdi solo oltre un terzo: un errore di
  battitura come 0,729 per 1,729.

  Un prezzo anomalo che un altro distributore aperto li vicino conferma (a
  due centesimi, entro dieci km) non e un errore: due errori di battitura
  uguali a un paese di distanza non capitano.
*/

export type Anomalia = 'prezzo-assurdo' | 'prezzo-sospetto-stantio';

/** Il raggio della zona e quello di riserva, quando la zona ha pochi distributori. */
export const RAGGIO_ZONA_PREZZI_KM = 25;
export const RAGGIO_ZONA_LARGO_KM = 50;
/** Sotto questo numero di prezzi la zona si allarga. */
export const MIN_PREZZI_ZONA = 5;

/**
 * Assurdo verso il basso: piu sotto di cosi alla mediana della zona. Il 10%,
 * o quattro MAD se la zona ha prezzi molto diversi fra loro, o tre scarti
 * tipo del mercato nazionale: il metano costa molto diverso da un impianto
 * all'altro (fra 1,60 e 2,20 €/kg nove volte su dieci) e una soglia fissa
 * scartava prezzi veri.
 *
 * Il 10% e non il 15%: nei dati del 13 ottobre 2026, in zone dove i prezzi
 * stanno tutti entro un centesimo (1,995 ± 0,005), passava come affare
 * l'1,719 della benzina di Fano, mandato dal gestore insieme a un gasolio a
 * 1,629. Fra il 10% e il 15% sotto la zona c'erano prezzi cosi: il gasolio
 * sotto la benzina dello stesso impianto, o il self 30 centesimi sotto il
 * suo servito. Restano fuori, in lista e spenti, col motivo scritto.
 */
export const SCARTO_ASSURDO = 0.1;
/**
 * Assurdo verso l'alto: il 15%. Le isole e i passi di montagna costano di
 * piu davvero, e un prezzo alto non si consiglia comunque: conta solo
 * quando farebbe da metro, e li un errore all'insu e di solito di decine di
 * centesimi («2,99» invece di «2,29»).
 */
export const SCARTO_ASSURDO_SU = 0.15;
const MAD_ASSURDO = 4;
const SCARTI_TIPO_ASSURDO = 3;
/**
 * I comuni extradoganali, dove non si pagano le accise sui carburanti e il
 * prezzo lo fa ogni gestore: un mercato a se. Il nome e quello dell'anagrafe
 * del Ministero.
 */
const COMUNI_EXTRADOGANALI = new Set(['LIVIGNO']);
/** Nei comuni extradoganali, sotto la loro zona e assurdo solo chi sta oltre un terzo. */
export const SCARTO_ASSURDO_EXTRADOGANALE = 1 / 3;

export function extradoganale(row: Pick<StationRow, 'city'>): boolean {
  return COMUNI_EXTRADOGANALI.has(row.city.trim().toUpperCase());
}

/**
 * All'insu si giudica solo chi ha un altro distributore stradale aperto
 * entro questo raggio, quello della Home: altrimenti non fa da metro a
 * nessuno, e scartarlo lascerebbe un'isola senza consiglio.
 */
export const KM_TESTIMONI_SU = 15;

/** Fantasma: piu sotto di cosi e vecchio di due giorni rispetto al lotto. */
export const SCARTO_FANTASMA = 0.07;
const MAD_FANTASMA = 2;
const SCARTI_TIPO_FANTASMA = 1.5;
const ORE_FANTASMA = 48;
/** Una conferma: un altro impianto aperto entro 10 km, a non piu di due centesimi. */
export const KM_CONFERMA = 10;
export const EURO_CONFERMA = 0.02;
/** I prezzi hanno tre decimali: due centesimi esatti sono una conferma, l'errore di virgola mobile no. */
const EPS = 1e-9;

export interface ZonaPrezzi {
  mediana: number;
  /** La mediana degli scarti dalla mediana: quanto sono diversi i prezzi della zona. */
  mad: number;
  campione: number;
  raggioKm: number;
}

const KM_PER_GRADO = 111.32;
const RAD = Math.PI / 180;
/** Celle di un decimo di grado: una ricerca a 25 km ne guarda una quarantina. */
const CELLA = 0.1;

/** I punti di una cella, per colonne: la mappa ne scorre milioni. */
interface Cella {
  id: string[];
  lat: number[];
  lng: number[];
  prezzo: number[];
  autostrada: boolean[];
}

/** Quanti prezzi ci sono intorno, e quanti di loro non superano una soglia. */
interface Conteggio {
  n: number;
  finoA: number;
}

class Griglia {
  private celle = new Map<number, Cella>();
  /** Quanti punti e la loro somma: servono alla media nazionale. */
  n = 0;
  somma = 0;

  aggiungi(id: string, lat: number, lng: number, prezzo: number, autostrada = false): void {
    const k = Math.floor(lat / CELLA) * 10_000 + Math.floor(lng / CELLA);
    let c = this.celle.get(k);
    if (!c) this.celle.set(k, (c = { id: [], lat: [], lng: [], prezzo: [], autostrada: [] }));
    c.id.push(id);
    c.lat.push(lat);
    c.lng.push(lng);
    c.prezzo.push(prezzo);
    c.autostrada.push(autostrada);
    this.n++;
    this.somma += prezzo;
  }

  /**
   * Le celle che toccano il cerchio di `km` intorno al punto, con quel che
   * serve a misurare le distanze (equirettangolari: esatte al metro su
   * queste scale).
   */
  private intorno(lat: number, lng: number, km: number): { celle: Cella[]; kx: number; km2: number } {
    const cos = Math.cos(lat * RAD);
    const dLat = km / KM_PER_GRADO;
    const dLng = km / (KM_PER_GRADO * Math.max(0.1, cos));
    const i0 = Math.floor((lat - dLat) / CELLA);
    const i1 = Math.floor((lat + dLat) / CELLA);
    const j0 = Math.floor((lng - dLng) / CELLA);
    const j1 = Math.floor((lng + dLng) / CELLA);
    const celle: Cella[] = [];
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const c = this.celle.get(i * 10_000 + j);
        if (c) celle.push(c);
      }
    }
    return { celle, kx: KM_PER_GRADO * cos, km2: km * km };
  }

  /**
   * Chiama `fai` per ogni punto entro `km`, tranne `escluso`. Se `fai`
   * risponde true la ricerca si ferma.
   */
  entro(lat: number, lng: number, km: number, escluso: string, fai: (c: Cella, x: number) => boolean | void): void {
    const { celle, kx, km2 } = this.intorno(lat, lng, km);
    for (const c of celle) {
      for (let x = 0; x < c.lat.length; x++) {
        const dy = (c.lat[x]! - lat) * KM_PER_GRADO;
        const dx = (c.lng[x]! - lng) * kx;
        const d2 = dx * dx + dy * dy;
        // Solo a distanza zero puo essere lui: l'id si guarda solo li.
        if (d2 > km2 || (d2 === 0 && c.id[x] === escluso)) continue;
        if (fai(c, x)) return;
      }
    }
  }

  /** I prezzi entro `km`, tranne quello di `escluso`, in ordine. */
  prezzi(lat: number, lng: number, km: number, escluso: string): Float64Array {
    quanti = 0;
    this.entro(lat, lng, km, escluso, (c, x) => {
      if (quanti === buffer.length) {
        const piu = new Float64Array(buffer.length * 2);
        piu.set(buffer);
        buffer = piu;
      }
      buffer[quanti++] = c.prezzo[x]!;
    });
    return buffer.subarray(0, quanti).sort();
  }

  /**
   * Quanti prezzi entro `km`, tranne quello di `escluso`, e quanti non
   * superano `soglia`. E il giro che la mappa fa ventimila volte: niente
   * funzioni chiamate per ogni punto.
   */
  conta(lat: number, lng: number, km: number, escluso: string, soglia: number): Conteggio {
    const { celle, kx, km2 } = this.intorno(lat, lng, km);
    let n = 0;
    let finoA = 0;
    for (const c of celle) {
      const la = c.lat;
      const lo = c.lng;
      const pr = c.prezzo;
      for (let x = 0; x < la.length; x++) {
        const dy = (la[x]! - lat) * KM_PER_GRADO;
        const dx = (lo[x]! - lng) * kx;
        const d2 = dx * dx + dy * dy;
        if (d2 > km2 || (d2 === 0 && c.id[x] === escluso)) continue;
        n++;
        if (pr[x]! <= soglia) finoA++;
      }
    }
    return { n, finoA };
  }
}

/*
  La zona di ogni impianto si calcola una volta per lotto e carburante, ma
  la mappa giudica tutti i ventimila impianti: un solo buffer per tutti, un
  solo ordinamento e la MAD senza riordinare.
*/
let buffer = new Float64Array(1024);
let quanti = 0;

/** Self o servito: ognuno ha la sua zona. */
type Modo = 'self' | 'servito';

interface Indice {
  ultimo: string | null;
  /**
   * Stradali con un prezzo recente e non chiusi: fanno il prezzo della
   * zona, uno per il self e uno per il servito.
   */
  testimoni: Record<Modo, Griglia>;
  /** Gli stessi, nei comuni extradoganali: fanno zona solo fra loro. */
  testimoniExtra: Record<Modo, Griglia>;
  /** Tutti gli aperti col carburante, al prezzo che si paga: possono confermare un prezzo. */
  aperti: Griglia;
  /** Le zone gia calcolate, per impianto. */
  zone: Record<Modo, Map<string, ZonaPrezzi | null>>;
}

const indici = new WeakMap<readonly StationRow[], Map<FuelKey, Indice>>();

function indiceDi(rows: readonly StationRow[], fuel: FuelKey): Indice {
  let perFuel = indici.get(rows);
  if (!perFuel) indici.set(rows, (perFuel = new Map()));
  const gia = perFuel.get(fuel);
  if (gia) return gia;

  const ultimo = ultimoPrezzo(rows);
  const testimoni = { self: new Griglia(), servito: new Griglia() };
  const testimoniExtra = { self: new Griglia(), servito: new Griglia() };
  const aperti = new Griglia();
  for (const r of rows) {
    const pompa = prezzoAllaPompa(r, fuel);
    if (!pompa) continue;
    const ritardo = ritardoSulLotto(r.updated, ultimo);
    if (isLikelyClosed(ritardo)) continue;
    aperti.aggiungi(r.id, r.lat, r.lng, pompa.prezzo, r.isHighway);
    if (r.isHighway || ritardo === null || ritardo > ORE_PREZZO_VECCHIO) continue;
    const self = r.prices[fuel];
    const servito = r.servito[fuel];
    const g = extradoganale(r) ? testimoniExtra : testimoni;
    if (self !== undefined) g.self.aggiungi(r.id, r.lat, r.lng, self);
    if (servito !== undefined) g.servito.aggiungi(r.id, r.lat, r.lng, servito);
  }
  const indice: Indice = { ultimo, testimoni, testimoniExtra, aperti, zone: { self: new Map(), servito: new Map() } };
  perFuel.set(fuel, indice);
  return indice;
}

function mediana(v: Float64Array): number {
  const m = v.length >> 1;
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
}

/**
 * La MAD di un elenco gia ordinato: gli scarti dalla mediana crescono
 * allontanandosi dal centro da tutte e due le parti, quindi basta fonderli
 * come due elenchi ordinati fino a meta.
 */
function madOrdinati(v: Float64Array, med: number): number {
  const n = v.length;
  const k = n >> 1;
  // Il primo a destra della mediana e l'ultimo a sinistra.
  let dx = 0;
  while (dx < n && v[dx]! < med) dx++;
  let sx = dx - 1;
  let precedente = 0;
  for (let i = 0; i <= k; i++) {
    const a = sx >= 0 ? med - v[sx]! : Infinity;
    const b = dx < n ? v[dx]! - med : Infinity;
    const scarto = a < b ? a : b;
    if (a < b) sx--;
    else dx++;
    if (n % 2 === 0 && i === k - 1) precedente = scarto;
    if (i === k) return n % 2 ? scarto : (precedente + scarto) / 2;
  }
  return 0;
}

/** I testimoni della zona di `row`: quelli extradoganali per un impianto extradoganale, gli altri per gli altri. */
function testimoniDi(row: StationRow, indice: Indice, modo: Modo): Griglia {
  return (extradoganale(row) ? indice.testimoniExtra : indice.testimoni)[modo];
}

function zonaDi(row: StationRow, indice: Indice, modo: Modo): ZonaPrezzi | null {
  const cache = indice.zone[modo];
  const gia = cache.get(row.id);
  if (gia !== undefined) return gia;

  const griglia = testimoniDi(row, indice, modo);
  let raggioKm = RAGGIO_ZONA_PREZZI_KM;
  let prezzi = griglia.prezzi(row.lat, row.lng, raggioKm, row.id);
  if (prezzi.length < MIN_PREZZI_ZONA) {
    raggioKm = RAGGIO_ZONA_LARGO_KM;
    prezzi = griglia.prezzi(row.lat, row.lng, raggioKm, row.id);
  }
  let zona: ZonaPrezzi | null = null;
  if (prezzi.length > 0) {
    const med = mediana(prezzi);
    zona = { mediana: med, mad: madOrdinati(prezzi, med), campione: prezzi.length, raggioKm };
  }
  cache.set(row.id, zona);
  return zona;
}

/**
 * Mediana e MAD dei prezzi recenti intorno a `row`, lui escluso. Null se nel
 * raggio largo non c'e nessuno. Al self, o al servito se `alServito`.
 */
export function zonaPrezzi(row: StationRow, rows: readonly StationRow[], fuel: FuelKey, alServito = false): ZonaPrezzi | null {
  return zonaDi(row, indiceDi(rows, fuel), alServito ? 'servito' : 'self');
}

/** C'e un altro distributore stradale aperto entro KM_TESTIMONI_SU, per cui questo potrebbe fare da metro? */
function haVicini(row: StationRow, indice: Indice): boolean {
  let si = false;
  indice.aperti.entro(row.lat, row.lng, KM_TESTIMONI_SU, row.id, (c, x) => {
    si = !c.autostrada[x];
    return si;
  });
  return si;
}

/** Un altro distributore aperto, dello stesso tipo, entro 10 km e a due centesimi: il prezzo e vero. */
function confermato(row: StationRow, prezzo: number, indice: Indice): boolean {
  let si = false;
  indice.aperti.entro(row.lat, row.lng, KM_CONFERMA, row.id, (c, x) => {
    si = c.autostrada[x] === row.isHighway && Math.abs(c.prezzo[x]! - prezzo) <= EURO_CONFERMA + EPS;
    return si;
  });
  return si;
}

/** Il piu piccolo dei pavimenti verso il basso: chi sta sopra la mediana meno di cosi e a posto. */
const SCARTO_MINIMO = Math.min(SCARTO_ASSURDO, SCARTO_FANTASMA);

/**
 * Puo stare troppo sotto la sua zona? Se no, la zona non serve calcolarla.
 * La mediana non supera `prezzo / (1 − SCARTO_MINIMO)` se almeno meta piu
 * uno dei prezzi intorno non la supera: basta contarli, senza ordinarli.
 * Sui ventimila impianti della mappa la zona intera serve a pochi.
 */
function forseSotto(row: StationRow, prezzo: number, indice: Indice, modo: Modo): boolean {
  const zona = indice.zone[modo].get(row.id);
  if (zona !== undefined) return zona === null || prezzo < zona.mediana * (1 - SCARTO_MINIMO);
  const soglia = prezzo / (1 - SCARTO_MINIMO) - EPS;
  const griglia = testimoniDi(row, indice, modo);
  let c = griglia.conta(row.lat, row.lng, RAGGIO_ZONA_PREZZI_KM, row.id, soglia);
  if (c.n < MIN_PREZZI_ZONA) c = griglia.conta(row.lat, row.lng, RAGGIO_ZONA_LARGO_KM, row.id, soglia);
  // Senza zona il metro e la media nazionale: si fa il conto intero.
  if (c.n === 0) return true;
  return c.finoA < (c.n >> 1) + 1;
}

export interface GiudiceAnomalie {
  (row: StationRow, prezzo: number): Anomalia | undefined;
}

/**
 * Il giudice dei prezzi per un carburante. `rows` sono tutte le righe del
 * dataset (o tutte quelle disponibili): servono a fare la zona e a cercare
 * conferme anche oltre il raggio della lista. Home e mappa gli passano lo
 * stesso array (dropMisgeocoded delle righe), cosi le zone si calcolano una
 * volta sola e dicono la stessa cosa.
 *
 * `prezzo` e quello che si paga: il self, o il servito dove il self non
 * c'e. Il servito si confronta coi serviti della zona.
 *
 * Un prezzo e assurdo se sta sotto la mediana della zona piu della soglia;
 * per gli stradali anche se sta sopra sia alla zona sia alla media
 * nazionale piu della soglia all'insu, perche un errore all'insu sotto casa
 * gonfierebbe il risparmio di tutti: ma solo se intorno c'e qualcuno di cui
 * gonfiarlo. Gli autostradali costano di piu per conto loro: per loro conta
 * solo il basso. E fantasma se sta sotto di meno, ma il suo prezzo e di
 * oltre due giorni prima degli ultimi arrivati. Senza zona (nessun prezzo
 * recente entro 50 km) il metro e la media nazionale. Nei comuni
 * extradoganali la soglia verso il basso e SCARTO_ASSURDO_EXTRADOGANALE,
 * per gli assurdi e per i fantasmi.
 */
export function giudiceAnomalie(rows: readonly StationRow[], fuel: FuelKey, cohorts: CohortIndex): GiudiceAnomalie {
  const indice = indiceDi(rows, fuel);
  const nazionaleSelf = cohorts.bySegment.get(`road|${fuel}`) ?? cohorts.byFuel.get(fuel);
  // Le coorti non contano il servito: la sua media nazionale la fanno i testimoni.
  const serviti = indice.testimoni.servito;
  const mediaServito = serviti.n > 0 ? serviti.somma / serviti.n : undefined;
  const scartoTipo = nazionaleSelf?.std ?? 0;

  return (row, prezzo) => {
    const modo: Modo = row.prices[fuel] === undefined ? 'servito' : 'self';
    const nazionale = modo === 'servito' ? (mediaServito ?? nazionaleSelf?.avg) : nazionaleSelf?.avg;
    // All'insu serve stare sopra la media nazionale del 15%; all'ingiu sotto
    // la zona almeno del 7%. Chi non puo fare ne l'uno ne l'altro e a posto.
    const forseSopra = nazionale === undefined || (!row.isHighway && prezzo > nazionale * (1 + SCARTO_ASSURDO_SU));
    if (!forseSopra && !forseSotto(row, prezzo, indice, modo)) return undefined;

    const zona = zonaDi(row, indice, modo);
    const med = zona?.mediana ?? nazionale;
    if (med === undefined) return undefined;
    const mad = zona?.mad ?? 0;

    const sotto = med - prezzo;
    const extra = extradoganale(row);
    const sogliaAssurdo = Math.max(
      med * (extra ? SCARTO_ASSURDO_EXTRADOGANALE : SCARTO_ASSURDO),
      MAD_ASSURDO * mad,
      SCARTI_TIPO_ASSURDO * scartoTipo
    );
    // All'insu deve essere fuori scala anche per l'Italia (la zona di un
    // paese di montagna puo essere piu bassa del resto del paese), e conta
    // solo per chi puo fare da metro a qualcuno.
    const sopraA = Math.max(med, nazionale ?? med);
    const sogliaSu = Math.max(sopraA * SCARTO_ASSURDO_SU, MAD_ASSURDO * mad, SCARTI_TIPO_ASSURDO * scartoTipo);
    const assurdo =
      sotto > sogliaAssurdo || (!row.isHighway && prezzo - sopraA > sogliaSu && haVicini(row, indice));
    const ritardo = ritardoSulLotto(row.updated, indice.ultimo);
    const sogliaFantasma = extra
      ? sogliaAssurdo
      : Math.max(med * SCARTO_FANTASMA, MAD_FANTASMA * mad, SCARTI_TIPO_FANTASMA * scartoTipo);
    const fantasma = sotto > sogliaFantasma && ritardo !== null && ritardo > ORE_FANTASMA;
    if (!assurdo && !fantasma) return undefined;
    if (confermato(row, prezzo, indice)) return undefined;
    return assurdo ? 'prezzo-assurdo' : 'prezzo-sospetto-stantio';
  };
}
