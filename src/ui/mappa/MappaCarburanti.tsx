import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import type { GeoJSONSource, Map as MlMap, MapLayerMouseEvent, StyleSpecification, SymbolLayerSpecification } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { maplibregl } from '../../lib/maplibre';
import type { CollezionePunti } from '../../domain/mappa';
import type { LatLng } from '../../domain/geo';
import { HEX } from '../kit/livelli';
import {
  STILE_SCURO, STILE_RIPIEGO, FONT_GRASSETTO, TINTE_BASE, TESTO_TARGHETTA, TIPI_TARGHETTA,
  daNascondere, disegnaTarghetta,
} from './stileMappa';

/**
 * La mappa dei distributori. Una sola implementazione per Home, Mappa e
 * Viaggio: stessi colori, stesse targhette, stessa logica.
 *
 * Tutto e disegnato da MapLibre in WebGL (sorgenti GeoJSON e strati), niente
 * marcatori HTML: con ventimila impianti i marcatori DOM erano la ragione per
 * cui la mappa di settembre ne mostrava solo una manciata.
 *
 * Cosa si vede:
 *  - da lontano, un puntino colorato per ogni impianto e un alone morbido
 *    dove si spende poco: si vede dove conviene senza leggere niente. Niente
 *    gruppi: cerchi con «da 2,190» ovunque coprivano la mappa e dicevano poco;
 *  - a meta zoom, la targhetta col prezzo solo per i piu economici;
 *  - da vicino, la targhetta per tutti dove c'e posto, prima i piu economici;
 *  - il consigliato in blu, sempre visibile; quello toccato in bianco;
 *  - i prezzi vecchi (oltre una settimana) spenti.
 */

export interface PuntoEvidenziato {
  id: string;
  lat: number;
  lng: number;
  testo: string;
}

export interface Sosta {
  id: string;
  lat: number;
  lng: number;
  numero: number;
}

export interface ComandiMappa {
  /** Porta la vista su un punto. */
  vola(p: LatLng, zoom?: number): void;
  /** Inquadra un insieme di punti. */
  /** Inquadra i punti; `sotto` lascia spazio in piu in basso, per i bottoni sopra la mappa. */
  inquadra(punti: LatLng[], margine?: number, sotto?: number): void;
  centro(): { centro: LatLng; zoom: number } | null;
}

interface Props {
  punti: CollezionePunti | null;
  consigliato?: PuntoEvidenziato | null;
  scelto?: PuntoEvidenziato | null;
  utente?: LatLng | null;
  /** Il percorso del viaggio, come [lng, lat]. */
  percorso?: [number, number][] | null;
  soste?: Sosta[];
  vistaIniziale?: { centro: LatLng; zoom: number };
  /** false per una mappa da guardare e basta: niente gesti, niente tocchi sui punti. */
  interattiva?: boolean;
  /** false quando i crediti della mappa li scrive chi la ospita (la mini mappa della Home). */
  attribuzione?: boolean;
  onScegli?: (id: string | null) => void;
  onMossa?: (v: { centro: LatLng; zoom: number }) => void;
  comandi?: Ref<ComandiMappa | null>;
  className?: string;
}

const ITALIA = { centro: { lat: 42.4, lng: 12.6 }, zoom: 5.2 };
/** Da qui compaiono le targhette, ma solo dei piu economici. */
const ZOOM_TARGHETTE_ECONOMICHE = 9.5;
/** Da qui le targhette di tutti, dove c'e posto. */
const ZOOM_TARGHETTE = 12;
/** Sotto questo zoom toccare un puntino avvicina invece di aprire la scheda. */
const ZOOM_TOCCO_AVVICINA = 10.5;

const VUOTA = { type: 'FeatureCollection' as const, features: [] };

function puntoGeo(p: { lat: number; lng: number }, props: Record<string, unknown> = {}) {
  return { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] }, properties: props };
}

function collezioneDi(feature: ReturnType<typeof puntoGeo> | null) {
  return feature ? { type: 'FeatureCollection' as const, features: [feature] } : VUOTA;
}

export function MappaCarburanti({
  punti, consigliato, scelto, utente, percorso, soste, vistaIniziale, interattiva = true, attribuzione = interattiva,
  onScegli, onMossa, comandi, className = '',
}: Props) {
  const contenitore = useRef<HTMLDivElement>(null);
  const mappa = useRef<MlMap | null>(null);
  const [pronta, setPronta] = useState(false);
  // I callback cambiano a ogni render: la mappa li legge da qui, cosi non va ricreata.
  const richiami = useRef({ onScegli, onMossa });
  useLayoutEffect(() => {
    richiami.current = { onScegli, onMossa };
  });

  useImperativeHandle(comandi, () => ({
    vola(p, zoom) {
      const m = mappa.current;
      if (!m) return;
      m.easeTo({ center: [p.lng, p.lat], zoom: zoom ?? Math.max(m.getZoom(), 13), duration: 650 });
    },
    inquadra(lista, margine = 60, sotto = 0) {
      const m = mappa.current;
      if (!m || lista.length === 0) return;
      if (lista.length === 1) {
        m.easeTo({ center: [lista[0]!.lng, lista[0]!.lat], zoom: 14, duration: 650 });
        return;
      }
      const b = new maplibregl.LngLatBounds();
      for (const p of lista) b.extend([p.lng, p.lat]);
      // Le targhette stanno sopra il loro punto: in alto serve piu spazio,
      // o quella del punto piu a nord esce dal riquadro.
      m.fitBounds(b, { padding: { top: margine + 32, bottom: margine + sotto, left: margine, right: margine }, duration: 650, maxZoom: 15 });
    },
    centro() {
      const m = mappa.current;
      if (!m) return null;
      const c = m.getCenter();
      return { centro: { lat: c.lat, lng: c.lng }, zoom: m.getZoom() };
    },
  }), []);

  /* ── Creazione, una volta sola ─────────────────────────────────────── */
  useEffect(() => {
    if (!contenitore.current) return;
    const vista = vistaIniziale ?? (utente ? { centro: utente, zoom: 13 } : ITALIA);
    let ripiegato = false;

    const m = new maplibregl.Map({
      container: contenitore.current,
      style: STILE_SCURO,
      center: [vista.centro.lng, vista.centro.lat],
      zoom: vista.zoom,
      interactive: interattiva,
      // Nella mini mappa della Home non c'e spazio: i crediti li scrive la Home.
      attributionControl: attribuzione ? { compact: true } : false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      renderWorldCopies: false,
      maxZoom: 18,
      minZoom: 4,
      fadeDuration: 150,
    });
    if (interattiva) m.touchZoomRotate.disableRotation();
    mappa.current = m;

    m.on('error', (e) => {
      // Se lo stile vettoriale non arriva si passa al ripiego, una volta sola.
      const msg = String(e.error?.message ?? '');
      if (!ripiegato && !m.isStyleLoaded() && /style|fetch|Failed|NetworkError/i.test(msg)) {
        ripiegato = true;
        m.setStyle(STILE_RIPIEGO as StyleSpecification);
      }
    });

    m.on('style.load', () => {
      preparaStile(m);
      setPronta(false);
      // Il render che segue ripopola le sorgenti appena create.
      requestAnimationFrame(() => setPronta(true));
    });

    m.on('moveend', () => {
      const c = m.getCenter();
      richiami.current.onMossa?.({ centro: { lat: c.lat, lng: c.lng }, zoom: m.getZoom() });
    });

    if (interattiva) {
      const tocca = (e: MapLayerMouseEvent) => {
        const f = e.features?.[0];
        const id = f?.properties?.id;
        if (typeof id === 'string') {
          e.preventDefault();
          richiami.current.onScegli?.(id);
        }
      };
      m.on('click', 'mf-targhette', tocca);
      m.on('click', 'mf-targhette-economiche', tocca);
      m.on('click', 'mf-consigliato', tocca);
      // Da lontano un puntino e largo un paio di pixel: toccarlo vuol dire
      // «fammi vedere qui», non «aprimi questo distributore».
      m.on('click', 'mf-pallini', (e) => {
        if (m.getZoom() >= ZOOM_TOCCO_AVVICINA) return tocca(e);
        e.preventDefault();
        m.easeTo({ center: e.lngLat, zoom: Math.min(m.getZoom() + 2.5, 13), duration: 600 });
      });
      m.on('click', (e) => {
        if (e.defaultPrevented) return;
        richiami.current.onScegli?.(null);
      });
      for (const strato of ['mf-targhette', 'mf-targhette-economiche', 'mf-pallini', 'mf-consigliato']) {
        m.on('mouseenter', strato, () => { m.getCanvas().style.cursor = 'pointer'; });
        m.on('mouseleave', strato, () => { m.getCanvas().style.cursor = ''; });
      }
    }

    // Il contenitore cambia misura (schede, rotazione): la mappa va avvisata.
    const osservatore = new ResizeObserver(() => m.resize());
    osservatore.observe(contenitore.current);

    return () => {
      osservatore.disconnect();
      m.remove();
      mappa.current = null;
    };
    // La mappa si crea una volta: vista iniziale e interattivita non cambiano dopo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Dati: si aggiornano senza ricreare niente ─────────────────────── */
  useEffect(() => {
    if (!pronta) return;
    imposta(mappa.current, 'mf-impianti', punti ?? VUOTA);
  }, [pronta, punti]);

  useEffect(() => {
    if (!pronta) return;
    imposta(mappa.current, 'mf-consigliato', collezioneDi(consigliato ? puntoGeo(consigliato, { id: consigliato.id, testo: consigliato.testo }) : null));
  }, [pronta, consigliato]);

  useEffect(() => {
    if (!pronta) return;
    imposta(mappa.current, 'mf-scelto', collezioneDi(scelto ? puntoGeo(scelto, { id: scelto.id, testo: scelto.testo }) : null));
  }, [pronta, scelto]);

  useEffect(() => {
    if (!pronta) return;
    imposta(mappa.current, 'mf-utente', collezioneDi(utente ? puntoGeo(utente) : null));
  }, [pronta, utente]);

  useEffect(() => {
    if (!pronta) return;
    imposta(
      mappa.current,
      'mf-percorso',
      percorso && percorso.length > 1
        ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: percorso }, properties: {} }] }
        : VUOTA,
    );
  }, [pronta, percorso]);

  useEffect(() => {
    if (!pronta) return;
    imposta(mappa.current, 'mf-soste', {
      type: 'FeatureCollection',
      features: (soste ?? []).map((s) => puntoGeo(s, { id: s.id, numero: String(s.numero) })),
    });
  }, [pronta, soste]);

  return <div ref={contenitore} className={`relative h-full w-full bg-[#0a0a0b] ${className}`} />;
}

function imposta(m: MlMap | null, sorgente: string, dati: unknown): void {
  const s = m?.getSource(sorgente) as GeoJSONSource | undefined;
  s?.setData(dati as FeatureCollection);
}

/** Ripulisce lo stile di base e aggiunge sorgenti e strati dell'app. */
/** Il colore di un puntino: il suo livello di prezzo, grigio se spento. */
const COLORE_PUNTO = [
  'case', ['==', ['get', 'spento'], 1], HEX.stale,
  ['match', ['get', 'livello'],
    'best', TESTO_TARGHETTA.best, 'good', TESTO_TARGHETTA.good, 'high', TESTO_TARGHETTA.high,
    'worst', TESTO_TARGHETTA.worst, TESTO_TARGHETTA.normal],
] as unknown as string;

/** Il testo di una targhetta: come il puntino, ma grigio chiaro se spento. */
const COLORE_TESTO = [
  'case', ['==', ['get', 'spento'], 1], TESTO_TARGHETTA.spento,
  ['match', ['get', 'livello'],
    'best', TESTO_TARGHETTA.best, 'good', TESTO_TARGHETTA.good, 'high', TESTO_TARGHETTA.high,
    'worst', TESTO_TARGHETTA.worst, TESTO_TARGHETTA.normal],
] as unknown as string;

/** La targhetta col prezzo, uguale nei due strati. */
const TARGHETTA: NonNullable<SymbolLayerSpecification['layout']> = {
  'symbol-sort-key': ['get', 'ordine'],
  'icon-image': ['case', ['==', ['get', 'spento'], 1], 'mf-t-spento', ['concat', 'mf-t-', ['get', 'livello']]],
  'icon-text-fit': 'both',
  'icon-text-fit-padding': [3, 7, 3, 7],
  'text-field': ['get', 'testo'],
  'text-font': FONT_GRASSETTO,
  'text-size': 12.5,
  'text-offset': [0, -1.25],
  'icon-offset': [0, 0],
  'text-anchor': 'center',
  'icon-anchor': 'center',
};

function preparaStile(m: MlMap): void {
  const stile = m.getStyle();
  for (const strato of stile.layers ?? []) {
    const sl = 'source-layer' in strato ? (strato['source-layer'] as string | undefined) : undefined;
    if (daNascondere(strato.id, sl)) {
      m.setLayoutProperty(strato.id, 'visibility', 'none');
      continue;
    }
    if (strato.type === 'background') m.setPaintProperty(strato.id, 'background-color', TINTE_BASE.background);
    if (strato.type === 'fill' && /water/i.test(strato.id)) m.setPaintProperty(strato.id, 'fill-color', TINTE_BASE.water);
  }

  for (const t of TIPI_TARGHETTA) {
    const nome = `mf-t-${t}`;
    if (m.hasImage(nome)) continue;
    const img = disegnaTarghetta(t);
    if (img) m.addImage(nome, img.data, img.opzioni as never);
  }

  m.addSource('mf-percorso', { type: 'geojson', data: VUOTA });
  m.addSource('mf-impianti', {
    type: 'geojson',
    data: VUOTA,
  });
  m.addSource('mf-utente', { type: 'geojson', data: VUOTA });
  m.addSource('mf-consigliato', { type: 'geojson', data: VUOTA });
  m.addSource('mf-scelto', { type: 'geojson', data: VUOTA });
  m.addSource('mf-soste', { type: 'geojson', data: VUOTA });

  // Il percorso del viaggio, sotto a tutto il resto.
  m.addLayer({
    id: 'mf-percorso-bordo', type: 'line', source: 'mf-percorso',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#000000', 'line-width': 9, 'line-opacity': 0.6 },
  });
  m.addLayer({
    id: 'mf-percorso', type: 'line', source: 'mf-percorso',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': HEX.ink, 'line-width': 5, 'line-opacity': 0.85 },
  });

  // Da lontano, un alone morbido dove i prezzi sono bassi: le zone che
  // convengono si accendono senza bisogno di leggere un numero.
  m.addLayer({
    id: 'mf-alone', type: 'circle', source: 'mf-impianti', maxzoom: 12,
    filter: ['all', ['==', ['get', 'livello'], 'best'], ['!=', ['get', 'spento'], 1]],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 5, 8, 8, 11, 14],
      'circle-color': TESTO_TARGHETTA.best,
      'circle-blur': 1,
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.16, 10, 0.2, 12, 0],
    },
  });

  // Ogni impianto e un puntino del colore del suo prezzo: piccolo da lontano,
  // piu grande avvicinandosi. Nessuno sparisce, anche se la targhetta non ci sta.
  m.addLayer({
    id: 'mf-pallini', type: 'circle', source: 'mf-impianti',
    layout: { 'circle-sort-key': ['get', 'ordine'] },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 1.4, 8, 2.2, 10, 3, 13, 4.5, 16, 6],
      'circle-color': COLORE_PUNTO,
      // Da lontano quelli nella media si fanno da parte: devono risaltare i
      // verdi e i rossi, che sono la notizia.
      // (Lo zoom va al primo livello dell'espressione: MapLibre non lo
      // accetta dentro un case.)
      'circle-opacity': [
        'interpolate', ['linear'], ['zoom'],
        6, ['case', ['==', ['get', 'spento'], 1], 0.35, ['==', ['get', 'livello'], 'normal'], 0.45, 0.95],
        11, ['case', ['==', ['get', 'spento'], 1], 0.35, ['==', ['get', 'livello'], 'normal'], 0.9, 0.95],
      ],
      'circle-stroke-color': '#000000',
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 9, 0, 12, 1],
    },
  });

  // A meta zoom, la targhetta solo per chi costa poco: vincono i piu economici
  // e restano larghe, cosi si legge una mappa e non un elenco.
  m.addLayer({
    id: 'mf-targhette-economiche', type: 'symbol', source: 'mf-impianti',
    minzoom: ZOOM_TARGHETTE_ECONOMICHE, maxzoom: ZOOM_TARGHETTE,
    filter: ['all', ['match', ['get', 'livello'], ['best', 'good'], true, false], ['!=', ['get', 'spento'], 1]],
    layout: { ...TARGHETTA, 'icon-padding': 10, 'text-padding': 10 },
    paint: { 'text-color': COLORE_PUNTO },
  });

  // Da vicino, le targhette di tutti dove c'e posto: prima i piu economici.
  m.addLayer({
    id: 'mf-targhette', type: 'symbol', source: 'mf-impianti', minzoom: ZOOM_TARGHETTE,
    layout: { ...TARGHETTA, 'text-padding': 3 },
    paint: { 'text-color': COLORE_TESTO },
  });

  // La posizione dell'utente.
  m.addLayer({
    id: 'mf-utente-alone', type: 'circle', source: 'mf-utente',
    paint: { 'circle-radius': 16, 'circle-color': '#ffffff', 'circle-opacity': 0.16 },
  });
  m.addLayer({
    id: 'mf-utente', type: 'circle', source: 'mf-utente',
    // Bianco, non blu: il blu sulla mappa e solo il distributore consigliato.
    paint: { 'circle-radius': 7, 'circle-color': '#ffffff', 'circle-stroke-color': '#000000', 'circle-stroke-width': 2 },
  });

  // Le soste del viaggio, numerate.
  m.addLayer({
    id: 'mf-soste', type: 'circle', source: 'mf-soste',
    paint: { 'circle-radius': 13, 'circle-color': HEX.accent, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 },
  });
  m.addLayer({
    id: 'mf-soste-testo', type: 'symbol', source: 'mf-soste',
    layout: { 'text-field': ['get', 'numero'], 'text-font': FONT_GRASSETTO, 'text-size': 13, 'text-allow-overlap': true, 'text-ignore-placement': true },
    paint: { 'text-color': '#ffffff' },
  });

  // Il consigliato e quello toccato, sempre sopra e sempre visibili.
  for (const [id, tipo] of [['mf-consigliato', 'consigliato'], ['mf-scelto', 'scelto']] as const) {
    m.addLayer({
      id, type: 'symbol', source: id,
      layout: {
        'icon-image': `mf-t-${tipo}`,
        'icon-text-fit': 'both',
        'icon-text-fit-padding': [4, 9, 4, 9],
        'text-field': ['get', 'testo'],
        'text-font': FONT_GRASSETTO,
        'text-size': 14,
        'text-offset': [0, -1.3],
        'text-allow-overlap': true,
        'icon-allow-overlap': true,
        'text-ignore-placement': true,
        'icon-ignore-placement': true,
      },
      paint: { 'text-color': TESTO_TARGHETTA[tipo] },
    });
  }
}
