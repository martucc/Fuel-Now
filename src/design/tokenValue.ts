/**
 * Il valore vero di un token, per i punti che non accettano var().
 *
 * Leaflet scrive stroke e fill come attributi di presentazione sull'SVG, e
 * li' `var(--mf-price-best)` non viene risolto: resta una stringa e il
 * cerchio finisce nero. Qui il token si legge una volta dal foglio di
 * stile, cosi la sorgente di verita resta tokens.css.
 */
const cache = new Map<string, string>();

export function tokenValue(nome: string, ripiego = '#888'): string {
  const gia = cache.get(nome);
  if (gia) return gia;
  if (typeof document === 'undefined') return ripiego;
  const valore = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  const risolto = valore || ripiego;
  cache.set(nome, risolto);
  return risolto;
}
