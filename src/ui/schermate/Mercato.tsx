import type { Modello } from '../../app/modello';
import type { HomeModel } from '../home/homeModel';

/** Segnaposto: la scheda Prezzi arriva nel prossimo passo. */
export function Mercato(_: { m: Modello; home: HomeModel | null; onApriImpostazioni: () => void }) {
  return <div className="px-4 pt-16"><h1 className="mf-large-title">Prezzi</h1></div>;
}
