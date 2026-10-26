import { useEffect, useMemo } from 'react';
import type { HomeModel } from '../ui/home/homeModel';
import type { QuadroUmore } from '../domain/umore';
import { umoreZona } from '../domain/umore';
import type { Modello } from './modello';

/**
 * L'umore della zona, calcolato dai prezzi della Home e applicato a tutta
 * l'app con `data-umore` su <html>: il tema ne ricava il colore d'atmosfera
 * (vedi tema.css). Contano solo i prezzi buoni: niente chiusi, vecchi o
 * fuori mercato, che sporcherebbero la mediana.
 */
export function useUmore(m: Modello, home: HomeModel | null): QuadroUmore {
  const fuel = m.impostazioni.carburante;
  const media = m.dataset.dati?.national?.[fuel]?.avg ?? null;

  const quadro = useMemo(() => {
    const prezzi = (home?.list ?? []).filter((it) => it.eligible && !it.probabilmenteChiuso && !it.vecchio).map((it) => it.price);
    return umoreZona(prezzi, media);
  }, [home, media]);

  useEffect(() => {
    document.documentElement.dataset.umore = quadro.umore;
  }, [quadro.umore]);

  return quadro;
}
