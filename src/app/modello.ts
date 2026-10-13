import { useEffect, useMemo, useState } from 'react';
import type { LatLng } from '../domain/geo';
import type { Base } from './dati';
import { baseDi, useDataset, useElencoAuto, useNascosti } from './dati';
import { useImpostazioni } from './impostazioni';
import type { Impostazioni } from './impostazioni';
import { usePosizione } from './posizione';
import type { StatoPosizione } from './posizione';
import type { Auto } from './dati';
import { litersFor, kmlFor } from '../domain/units';
import type { HomeModel } from '../ui/home/homeModel';
import { buildHomeModel } from '../ui/home/homeModel';
import type { CollezionePunti } from '../domain/mappa';
import { collezionePunti, puntiMappa } from '../domain/mappa';
import type { StatoDataset } from '../data/dataset';

/** Raggio della Home: oltre, un distributore non e piu «qui vicino». */
export const RAGGIO_HOME_KM = 15;

/**
 * L'ora usata per giudicare l'eta dei prezzi. Avanza da sola ogni minuto
 * (e a ogni ripresa, perche il timer dorme con l'app): senza, un prezzo
 * di ieri continuerebbe a dirsi «di 2 h fa» finche non cambia il file.
 */
export function useAdesso(): Date {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const avanza = () => setT(Date.now());
    const timer = setInterval(avanza, 60_000);
    const vis = () => { if (document.visibilityState === 'visible') avanza(); };
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
  // Arrotondata a cinque minuti: classifica e mappa (ventimila impianti) si
  // ricalcolano di rado, e le eta dei prezzi si leggono in ore.
  const fascia = Math.floor(t / 300_000);
  return useMemo(() => new Date(fascia * 300_000), [fascia]);
}

/** Il punto arrotondato a ~100 m: il GPS che trema non deve ricalcolare tutto. */
function chiavePunto(p: LatLng | null): string {
  return p ? `${p.lat.toFixed(3)},${p.lng.toFixed(3)}` : '';
}

export interface Modello {
  dataset: StatoDataset;
  base: Base | null;
  posizione: StatoPosizione;
  impostazioni: Impostazioni;
  auto: Auto | null;
  /** Litri di un pieno tipico e consumo, dall'auto scelta o dai default. */
  litri: number;
  kml: number;
  adesso: Date;
  nascosti: ReadonlySet<string>;
}

export function useModello(): Modello {
  const dataset = useDataset();
  const posizione = usePosizione();
  const impostazioni = useImpostazioni();
  const elenco = useElencoAuto();
  const nascosti = useNascosti();
  const adesso = useAdesso();

  const base = useMemo(() => (dataset.dati ? baseDi(dataset.dati) : null), [dataset.dati]);
  const auto = useMemo(
    () => (impostazioni.auto && elenco ? elenco.find((a) => a.model === impostazioni.auto) ?? null : null),
    [impostazioni.auto, elenco],
  );
  const litri = litersFor(auto);
  const kml = kmlFor(auto, impostazioni.carburante, null);

  return { dataset, base, posizione, impostazioni, auto, litri, kml, adesso, nascosti };
}

/** Il consiglio e la lista della Home. Null finche mancano dati o posizione. */
export function useHome(m: Modello): HomeModel | null {
  const chiave = chiavePunto(m.posizione.punto);
  return useMemo(() => {
    if (!m.base || !m.posizione.punto) return null;
    return buildHomeModel({
      rows: m.base.rows,
      cohorts: m.base.cohorts,
      dataset: m.base.dataset,
      fuel: m.impostazioni.carburante,
      user: m.posizione.punto,
      now: m.adesso,
      liters: m.litri,
      kml: m.kml,
      blocked: m.nascosti as Set<string>,
      radiusKm: RAGGIO_HOME_KM,
      tankPct: null,
    });
    // `chiave` sostituisce il punto: si ricalcola solo se ci si sposta davvero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.base, chiave, m.impostazioni.carburante, m.adesso, m.litri, m.kml, m.nascosti]);
}

/** Tutti gli impianti del carburante scelto, pronti per la mappa. */
export function usePuntiMappa(m: Modello): CollezionePunti | null {
  return useMemo(() => {
    if (!m.base) return null;
    return collezionePunti(puntiMappa(m.base.rows, m.base.cohorts, m.impostazioni.carburante, m.adesso, m.nascosti));
  }, [m.base, m.impostazioni.carburante, m.adesso, m.nascosti]);
}
