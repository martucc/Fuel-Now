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
 */
export function confidenceFor(ageH: number | null): number {
  if (ageH === null) return 0.3;
  if (ageH <= 24) return 1.0;
  if (ageH <= 48) return 0.9;
  if (ageH <= 72) return 0.75;
  if (ageH <= 120) return 0.5;
  return 0.3;
}

/** Oltre tre giorni il prezzo non e piu «di oggi» e va detto. */
export function isStale(ageH: number | null): boolean {
  return ageH === null || ageH > 72;
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
  return ageH !== null && ageH > 168;
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
