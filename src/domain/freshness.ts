const TS_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/;

/** "YYYY-MM-DD HH:MM" nel fuso del dispositivo. Vedi assunzione nel piano. */
export function parseUpdatedAt(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = TS_RE.exec(s);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  if (Number.isNaN(date.getTime())) return null;
  // new Date(2026, 12, ...) trabocca invece di fallire: verifichiamo il ritorno.
  if (date.getMonth() !== Number(mo) - 1 || date.getDate() !== Number(d)) return null;
  return date;
}

export function ageHours(updated: string | null | undefined, now: Date): number | null {
  const at = parseUpdatedAt(updated);
  if (!at) return null;
  const h = (now.getTime() - at.getTime()) / 3_600_000;
  return h < 0 ? 0 : h;
}

/**
 * Spec § 6.2. Quanto ci si fida di un prezzo, in base a quanto è vecchio.
 * Un dato senza data vale quanto il più vecchio: non sapere non è una scusa
 * per fidarsi.
 *
 * Gli scalini sono dolci: il gestore comunica il prezzo quando lo cambia, e
 * un prezzo fermo da tre o quattro giorni è normale (l'Eni di via Piratello
 * a Lugo, ottobre 2026). Prima a 72 ore il risparmio si dimezzava e un
 * distributore più vicino e 6 centesimi più economico perdeva contro uno
 * aggiornato da poche ore. Il dubbio vero comincia oltre i cinque giorni:
 * lì un centesimo in meno non deve battere un prezzo di oggi.
 */
export function confidenceFor(ageH: number | null): number {
  if (ageH === null) return 0.3;
  if (ageH <= 24) return 1.0;
  if (ageH <= 72) return 0.95;
  if (ageH <= 120) return 0.9;
  return 0.3;
}

/** Oltre una settimana senza un prezzo nuovo l'impianto e quasi sempre chiuso. */
export const ORE_FORSE_CHIUSO = 168;
/**
 * Oltre tre giorni il prezzo si scrive in arancio: va detto che non e di
 * oggi. Si consiglia lo stesso fino a cinque (ORE_RIFERIMENTO_FRESCO in
 * ranking.ts): il gestore comunica quando cambia.
 */
export const ORE_PREZZO_VECCHIO = 72;

/** Oltre tre giorni il prezzo non e piu «di oggi» e va detto. */
export function isStale(ageH: number | null): boolean {
  return ageH === null || ageH > ORE_PREZZO_VECCHIO;
}

/**
 * Oltre una settimana senza comunicare un prezzo al MIMIT l'impianto e
 * quasi sempre chiuso, non semplicemente fermo sui listini.
 *
 * Data ignota NON vuol dire chiuso: nel dataset ci sono righe vecchie senza
 * timestamp che restano operative. Quelle le sconta gia confidenceFor, che
 * le tratta come le piu vecchie; buttarle fuori dalla scelta perche non
 * sappiamo la data sarebbe punire noi, non loro.
 */
export function isLikelyClosed(ageH: number | null): boolean {
  return ageH !== null && ageH > ORE_FORSE_CHIUSO;
}

/*
  L'eta che conta per giudicare un distributore si misura sul lotto, non
  sull'orologio: il ritardo del suo prezzo rispetto al prezzo piu recente
  del file. Col seme impacchettato di un mese fa, o col telefono senza rete
  da giorni, vecchi sono i dati e non i distributori. Home, scheda, mappa e
  Viaggio usano questo stesso metro, cosi nessuno dice «forse chiuso» di un
  impianto che un altro consiglia.

  L'eta scritta accanto al prezzo («4 giorni fa») resta quella vera,
  dall'orologio: e un fatto, non un giudizio.
*/

const ultimoPerRighe = new WeakMap<readonly { updated: string | null }[], string | null>();

/** Sotto questo numero di prezzi datati vale semplicemente il piu recente. */
const MIN_PREZZI_PER_APPOGGIO = 100;
/** Il punto d'appoggio: la data che si trova lasciando fuori l'1% piu recente del lotto. */
const QUOTA_IN_CIMA = 0.01;
/** Oltre un giorno dopo il punto d'appoggio una data e sbagliata, non recente. */
const ORE_OLTRE_APPOGGIO = 24;

/**
 * Il prezzo piu recente del lotto. Si ricorda per array: le righe del
 * dataset sono ventunomila e non cambiano finche non cambia il file.
 *
 * Non e il massimo grezzo: basterebbe un gestore che scrive una data di
 * una settimana avanti per far sembrare «forse chiusi» tutti gli altri
 * distributori d'Italia. Nei lotti veri gli ultimi prezzi arrivano a
 * centinaia, a pochi minuti l'uno dall'altro; una data piu di un giorno
 * avanti all'1% piu recente non e di quelle e non conta. Un lotto di poche
 * righe non ha abbastanza date per accorgersene: li vale il piu recente.
 */
export function ultimoPrezzo(rows: readonly { updated: string | null }[]): string | null {
  if (ultimoPerRighe.has(rows)) return ultimoPerRighe.get(rows) ?? null;
  const date: { t: number; s: string }[] = [];
  for (const r of rows) {
    const at = parseUpdatedAt(r.updated);
    if (at && r.updated) date.push({ t: at.getTime(), s: r.updated });
  }
  let ultimo: string | null = null;
  if (date.length > 0) {
    date.sort((a, b) => b.t - a.t);
    let i = 0;
    if (date.length >= MIN_PREZZI_PER_APPOGGIO) {
      const limite = date[Math.floor(date.length * QUOTA_IN_CIMA)]!.t + ORE_OLTRE_APPOGGIO * 3_600_000;
      while (date[i]!.t > limite) i++;
    }
    ultimo = date[i]!.s;
  }
  ultimoPerRighe.set(rows, ultimo);
  return ultimo;
}

/** Ore di ritardo di un prezzo rispetto al piu recente del lotto; null senza data. */
export function ritardoSulLotto(updated: string | null | undefined, ultimo: string | null): number | null {
  const at = parseUpdatedAt(updated);
  if (!at) return null;
  const lotto = parseUpdatedAt(ultimo);
  if (!lotto) return 0;
  return Math.max(0, (lotto.getTime() - at.getTime()) / 3_600_000);
}

export interface EtaNelLotto {
  /** Ore di ritardo sul lotto, null senza data. */
  ritardoH: number | null;
  /** Prezzo di oltre tre giorni prima degli ultimi arrivati: in arancio. */
  vecchio: boolean;
  /** Fermo da oltre una settimana mentre gli altri no: forse chiuso. */
  forseChiuso: boolean;
}

/** Il giudizio sull'eta di un prezzo, con il metro del lotto. */
export function etaNelLotto(updated: string | null | undefined, ultimo: string | null): EtaNelLotto {
  const ritardoH = ritardoSulLotto(updated, ultimo);
  return {
    ritardoH,
    vecchio: ritardoH !== null && ritardoH > ORE_PREZZO_VECCHIO,
    forseChiuso: isLikelyClosed(ritardoH),
  };
}

export function describeAge(ageH: number | null): string {
  if (ageH === null) return 'data ignota';
  if (ageH < 1) return 'adesso';
  if (ageH < 24) return `${Math.round(ageH)}h fa`;
  const days = Math.round(ageH / 24);
  return days === 1 ? '1 giorno fa' : `${days} giorni fa`;
}

/**
 * Quanto sono vecchi i prezzi che l'app sta mostrando, presi alla fonte.
 *
 * Le età per impianto raccontano il singolo distributore; questa racconta
 * il lotto. Serve soprattutto al caso brutto: primo avvio senza rete, in
 * cui l'app mostra il seme impacchettato mesi prima. Dirlo è l'unica cosa
 * onesta da fare.
 */
export interface FreschezzaDati {
  /** Frase pronta da mostrare, sempre valorizzata. */
  etichetta: string;
  /** Giorni fra il lotto e adesso, null se la data non si legge. */
  giorni: number | null;
  /** Oltre tre giorni i prezzi non sono più «di oggi» e va detto. */
  stantio: boolean;
}

const GIORNI_STANTII = 3;

export function descriviDati(
  d: { extracted_at?: string; source?: { latest_price_at?: string } } | null,
  now: Date
): FreschezzaDati {
  if (!d) return { etichetta: 'Prezzi non ancora scaricati', giorni: null, stantio: true };

  // latest_price_at è il prezzo più recente del lotto: più preciso della
  // data di estrazione, che dice solo quando ha girato la pipeline.
  const preciso = d.source?.latest_price_at;
  const quando = preciso ? Date.parse(preciso.replace(' ', 'T')) : Date.parse(d.extracted_at ?? '');
  if (!Number.isFinite(quando)) {
    return { etichetta: 'Prezzi di data ignota', giorni: null, stantio: true };
  }

  const ore = (now.getTime() - quando) / 3600_000;
  const giorni = Math.floor(ore / 24);

  if (ore < 0) return { etichetta: 'Prezzi appena aggiornati', giorni: 0, stantio: false };
  if (ore < 1) return { etichetta: 'Prezzi di pochi minuti fa', giorni: 0, stantio: false };
  if (ore < 24) {
    const h = Math.floor(ore);
    return { etichetta: `Prezzi di ${h} ${h === 1 ? 'ora' : 'ore'} fa`, giorni: 0, stantio: false };
  }
  if (giorni === 1) return { etichetta: 'Prezzi di ieri', giorni: 1, stantio: false };
  return {
    etichetta: `Prezzi di ${giorni} giorni fa`,
    giorni,
    stantio: giorni > GIORNI_STANTII,
  };
}
