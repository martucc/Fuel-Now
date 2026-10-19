import { useDeferredValue, useMemo } from 'react';
import type { Modello } from '../../app/modello';
import type { PercorsoViaggio } from '../../services/percorsoService';
import type { IndicePercorso, ImpiantoSulPercorso } from '../../domain/lungoPercorso';
import { impiantiLungoPercorso, indicizzaPercorso } from '../../domain/lungoPercorso';
import type { EsitoViaggio, LivelloSerbatoio, Strategia } from '../../domain/tappeViaggio';
import { calcolaViaggio, serbatoioDi } from '../../domain/tappeViaggio';
import type { Sosta } from '../../domain/viaggio';
import type { StationRow } from '../../domain/parse';
import { dropMisgeocoded } from '../../domain/parse';
import type { CollezionePunti } from '../../domain/mappa';
import { collezionePunti, puntiMappa } from '../../domain/mappa';
import { ultimoPrezzo } from '../../domain/freshness';

export interface SostaMostrata {
  numero: number;
  sosta: Sosta;
  row: StationRow;
  scostamentoKm: number;
}

export interface CalcoloViaggio {
  indice: IndicePercorso | null;
  /** Il percorso per la mappa, come [lng, lat]. */
  linea: [number, number][] | null;
  /** Tutti gli impianti entro 2,5 km dalla strada. Null finche mancano percorso o prezzi. */
  lungo: ImpiantoSulPercorso[] | null;
  esito: EsitoViaggio | null;
  soste: SostaMostrata[];
  /** Sulla mappa solo i distributori che il piano poteva scegliere. */
  punti: CollezionePunti | null;
  serbatoioL: number;
}

/**
 * Dal percorso al piano, in tre passi memorizzati separatamente: cambiare
 * il livello del serbatoio o la priorita rifa solo il piano (un attimo),
 * non la ricerca degli impianti lungo la strada.
 *
 * Livello e priorita passano da useDeferredValue: il controllo segmentato
 * risponde subito, il piano lo segue appena pronto.
 */
export function useCalcoloViaggio(
  m: Modello,
  percorso: PercorsoViaggio | null,
  livello: LivelloSerbatoio,
  strategia: Strategia,
): CalcoloViaggio {
  const fuel = m.impostazioni.carburante;
  const base = m.base;
  const serbatoioL = serbatoioDi(m.auto, fuel);
  const livelloDifferito = useDeferredValue(livello);
  const strategiaDifferita = useDeferredValue(strategia);

  const indice = useMemo(() => (percorso ? indicizzaPercorso(percorso.punti) : null), [percorso]);

  const linea = useMemo(
    () => (indice ? indice.punti.map((p) => [p.lng, p.lat] as [number, number]) : null),
    [indice],
  );

  // Le righe con coordinate sbagliate restano fuori dalle scelte, come nella Home.
  const righe = useMemo(() => (base ? dropMisgeocoded(base.rows) : null), [base]);

  const lungo = useMemo(() => {
    if (!indice || !righe || !percorso) return null;
    return impiantiLungoPercorso(indice, righe, {
      fuel,
      nascosti: m.nascosti,
      kmStradali: percorso.km,
    });
  }, [indice, righe, percorso, fuel, m.nascosti]);

  const esito = useMemo(() => {
    if (!lungo || !base || !righe || !percorso) return null;
    return calcolaViaggio({
      impianti: lungo,
      rows: righe,
      cohorts: base.cohorts,
      fuel,
      adesso: m.adesso,
      strategia: strategiaDifferita,
      distanzaKm: percorso.km,
      kml: m.kml,
      serbatoioL,
      livello: livelloDifferito,
    });
  }, [lungo, base, righe, percorso, fuel, m.adesso, m.kml, serbatoioL, strategiaDifferita, livelloDifferito]);

  const soste = useMemo(() => {
    if (!esito || !lungo) return [];
    const perId = new Map(lungo.map((x) => [x.row.id, x] as const));
    const out: SostaMostrata[] = [];
    for (const sosta of esito.piano.soste) {
      const x = perId.get(sosta.tappa.id);
      if (x) out.push({ numero: out.length + 1, sosta, row: x.row, scostamentoKm: x.scostamentoKm });
    }
    return out;
  }, [esito, lungo]);

  const punti = useMemo(() => {
    if (!esito || !base) return null;
    const scelte: StationRow[] = [];
    for (const t of esito.candidate) {
      const r = base.perId.get(t.id);
      if (r) scelte.push(r);
    }
    return collezionePunti(puntiMappa(scelte, base.cohorts, fuel, ultimoPrezzo(base.rows), m.nascosti, base.rows));
  }, [esito, base, fuel, m.nascosti]);

  return { indice, linea, lungo, esito, soste, punti, serbatoioL };
}
