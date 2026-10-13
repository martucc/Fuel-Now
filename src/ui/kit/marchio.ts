/**
 * Il logo del marchio, quando ce l'abbiamo.
 *
 * Prima si cercava una sottostringa: «ip» compare dentro «Indipendente»,
 * e ogni impianto senza marchio finiva col logo IP. Ora si confrontano
 * parole intere.
 */

const LOGHI: Array<[string[], string]> = [
  [['agip', 'eni'], 'assets/logos/eni.png'],
  [['q8', 'kuwait'], 'assets/logos/q8.png'],
  [['esso'], 'assets/logos/esso.png'],
  [['ip', 'api'], 'assets/logos/ip.png'],
  [['tamoil'], 'assets/logos/tamoil.png'],
  [['shell'], 'assets/logos/shell.png'],
  [['conad'], 'assets/logos/conad.png'],
  [['coop', 'enercoop'], 'assets/logos/coop.png'],
  [['repsol'], 'assets/logos/repsol.png'],
];

function parole(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

export function logoMarchio(marchio: string): string | null {
  const p = parole(marchio);
  for (const [chiavi, file] of LOGHI) {
    if (chiavi.some((k) => p.includes(k))) return file;
  }
  return null;
}

/** Due lettere per il monogramma quando il logo non c'e: «Pompe Bianche» → «PB». */
export function iniziali(marchio: string): string {
  const p = marchio.split(/[\s\-_.]+/).filter((x) => /[a-z0-9]/i.test(x));
  if (p.length === 0) return '·';
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
  return (p[0]![0]! + p[1]![0]!).toUpperCase();
}

/** Il nome da mostrare: il marchio «Pompe Bianche» non dice niente, il nome dell'impianto sì. */
export function nomeMarchio(marchio: string): string {
  const m = marchio.trim();
  if (!m || /^(pompe bianche|indipendente)$/i.test(m)) return 'Indipendente';
  if (/^agip eni$/i.test(m)) return 'Eni';
  if (/^api-ip$/i.test(m)) return 'IP';
  return m.length <= 3 ? m.toUpperCase() : m.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\B\w+/g, (w) => w.toLowerCase());
}
