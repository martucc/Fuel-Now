/**
 * Le versioni dell'app e i rilasci su GitHub.
 *
 * La GitHub Action `rilascio_apk.yml` costruisce l'APK firmato quando si
 * spinge un tag `vX.Y.Z` e lo pubblica come rilascio. L'app chiede l'ultimo
 * rilascio a GitHub e, se è più nuovo di lei, lo dice.
 */

/** «v2.2.0», «2.2», «2.10.1-beta» → [2, 2, 0], [2, 2, 0], [2, 10, 1]. Null se non è una versione. */
export function numeriVersione(v: string): [number, number, number] | null {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(v.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}

/** Negativo se `a` è più vecchia di `b`, zero se uguali, positivo se più nuova. Null se una non si legge. */
export function confrontaVersioni(a: string, b: string): number | null {
  const na = numeriVersione(a);
  const nb = numeriVersione(b);
  if (!na || !nb) return null;
  for (let i = 0; i < 3; i++) {
    if (na[i] !== nb[i]) return na[i] - nb[i];
  }
  return 0;
}

export interface Rilascio {
  /** «2.2.0», senza la v. */
  versione: string;
  /** Il link diretto all'APK. */
  apk: string;
  /** La pagina del rilascio, se l'APK non si trova. */
  pagina: string;
  /** Le note scritte nel rilascio, già accorciate. */
  note: string;
}

/** Oltre questa lunghezza le note si tagliano: l'avviso è una riga, non un changelog. */
const NOTE_MAX = 280;

/**
 * La risposta di `GET /repos/{owner}/{repo}/releases/latest`. Null se non
 * è un rilascio pubblicato con un APK: le bozze e le pre-release non si
 * propongono a nessuno.
 */
export function leggiRilascio(json: unknown): Rilascio | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  if (o.draft === true || o.prerelease === true) return null;
  const tag = typeof o.tag_name === 'string' ? o.tag_name : '';
  const numeri = numeriVersione(tag);
  if (!numeri) return null;

  const allegati = Array.isArray(o.assets) ? o.assets : [];
  const apk = allegati
    .map((a) => a as Record<string, unknown>)
    .find((a) => typeof a?.name === 'string' && a.name.toLowerCase().endsWith('.apk') && typeof a.browser_download_url === 'string');
  if (!apk) return null;

  const corpo = typeof o.body === 'string' ? o.body.trim() : '';
  return {
    versione: numeri.join('.'),
    apk: apk.browser_download_url as string,
    pagina: typeof o.html_url === 'string' ? o.html_url : '',
    note: corpo.length > NOTE_MAX ? `${corpo.slice(0, NOTE_MAX - 1).trimEnd()}…` : corpo,
  };
}

/** Il rilascio va proposto: è più nuovo di quella installata e l'utente non l'ha già scartato. */
export function daProporre(installata: string, rilascio: Rilascio | null, scartata: string | null): Rilascio | null {
  if (!rilascio) return null;
  if (scartata && confrontaVersioni(rilascio.versione, scartata) === 0) return null;
  const c = confrontaVersioni(rilascio.versione, installata);
  return c !== null && c > 0 ? rilascio : null;
}

/** Fra due controlli passa almeno questo: GitHub concede 60 richieste l'ora senza chiave. */
export const PAUSA_CONTROLLO_VERSIONE_MS = 6 * 3_600_000;

export function serveControllare(ultimoControllo: number | null, adesso: number): boolean {
  return ultimoControllo === null || adesso - ultimoControllo >= PAUSA_CONTROLLO_VERSIONE_MS || adesso < ultimoControllo;
}
