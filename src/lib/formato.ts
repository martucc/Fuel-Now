/**
 * Numeri come li scrive un italiano: virgola per i decimali, punto per le
 * migliaia. Non e pignoleria — «1.888» e «1,888» sono due prezzi diversi
 * per chi legge, e mezzo secondo di esitazione a una pompa e troppo.
 */

export function numero(v: number, dec = 0): string {
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/** Importo in euro: due decimali, simbolo dopo, come sullo scontrino. */
export function euro(v: number, dec = 2): string {
  if (!Number.isFinite(v)) return '—';
  return `${numero(v, dec)} €`;
}

/** Prezzo al litro: tre decimali, sempre, anche se finisce per zero. */
export function prezzo(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '—';
  return numero(v, 3);
}

/** Prezzo al litro col simbolo davanti, per le righe strette. */
export function prezzoEuro(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '—';
  return `€${numero(v, 3)}`;
}

/** Percentuale col segno esplicito: senza segno un delta non si legge. */
export function delta(v: number, dec = 1): string {
  if (!Number.isFinite(v)) return '—';
  const segno = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${segno}${numero(Math.abs(v), dec)}%`;
}

export function chilometri(v: number, dec = 0): string {
  if (!Number.isFinite(v)) return '—';
  return `${numero(v, dec)} km`;
}

export function litri(v: number, dec = 1): string {
  if (!Number.isFinite(v)) return '—';
  return `${numero(v, dec)} L`;
}
