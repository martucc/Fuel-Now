import type { Modello } from '../../app/modello';

/** Segnaposto: la scheda Viaggio arriva nel prossimo passo. */
export function Viaggio(_: { m: Modello; onApriImpianto: (id: string) => void }) {
  return <div className="px-4 pt-16"><h1 className="mf-large-title">Viaggio</h1></div>;
}
