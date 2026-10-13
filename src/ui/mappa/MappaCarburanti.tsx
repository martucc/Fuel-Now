import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import type { GeoJSONSource, Map as MlMap, MapLayerMouseEvent, StyleSpecification } from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
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
 *  - da lontano, gruppi col numero di impianti e il prezzo piu basso;
 *  - da vicino, un pallino per ogni impianto e la targhetta col prezzo dove
 *    c'e posto, dando precedenza ai piu economici;
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
  inquadra(punti: LatLng[], margine?: number): void;
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
  /** false per la mini mappa della Home: niente gesti, niente tocchi sui punti. */
  interattiva?: boolean;
  /**
   * false per il viaggio: gli impianti lungo la strada restano pallini anche
   * da lontano, perche i gruppi grandi coprirebbero il percorso. Si legge
   * solo alla creazione della mappa.
   */
  gruppi?: boolean;
  onScegli?: (id: string | null) => void;
  onMossa?: (v: { centro: LatLng; zoom: number }) => void;
  comandi?: Ref<ComandiMappa | null>;
  className?: string;
}

const ITALIA = { centro: { lat: 42.4, lng: 12.6 }, zoom: 5.2 };
/** Sotto questo zoom gli impianti si raggruppano. */
const ZOOM_GRUPPI = 9;
/** Da qui compaiono le targhette col prezzo. */
const ZOOM_TARGHETTE = 10;

const VUOTA = { type: 'FeatureCollection' as const, features: [] };

function puntoGeo(p: { lat: number; lng: number }, props: Record<string, unknown> = {}) {
  return { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] }, properties: props };
}

function collezioneDi(feature: ReturnType<typeof puntoGeo> | null) {
  return feature ? { type: 'FeatureCollection' as const, features: [feature] } : VUOTA;
}

export function MappaCarburanti({
  punti, consigliato, scelto, utente, percorso, soste, vistaIniziale, interattiva = true, gruppi = true,
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
    inquadra(lista, margine = 60) {
      const m = mappa.current;
      if (!m || lista.length === 0) return;
      if (lista.length === 1) {
        m.easeTo({ center: [lista[0]!.lng, lista[0]!.lat], zoom: 14, duration: 650 });
        return;
      }
      const b = new maplibregl.LngLatBounds();
      for (const p of lista) b.extend([p.lng, p.lat]);
      m.fitBounds(b, { padding: margine, duration: 650, maxZoom: 15 });
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
      // La mini mappa della Home non ha spazio: l'attribuzione la scrive la Home.
      attributionControl: interattiva ? { compact: true } : false,
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
      preparaStile(m, gruppi);
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
      m.on('click', 'mf-pallini', tocca);
      m.on('click', 'mf-consigliato', tocca);
      m.on('click', 'mf-gruppi', (e) => {
        const f = e.features?.[0];
        const sorgente = m.getSource('mf-impianti') as GeoJSONSource | undefined;
        const idGruppo = f?.properties?.cluster_id;
        if (!f || !sorgente || idGruppo === undefined) return;
        e.preventDefault();
        void sorgente.getClusterExpansionZoom(idGruppo).then((z) => {
          const [lng, lat] = (f.geometry as Point).coordinates as [number, number];
          m.easeTo({ center: [lng, lat], zoom: Math.min(z + 0.3, 16), duration: 500 });
        });
      });
      m.on('click', (e) => {
        if (e.defaultPrevented) return;
        richiami.current.onScegli?.(null);
      });
      for (const strato of ['mf-targhette', 'mf-pallini', 'mf-gruppi', 'mf-consigliato']) {
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
function preparaStile(m: MlMap, gruppi: boolean): void {
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
    cluster: gruppi,
    clusterMaxZoom: ZOOM_GRUPPI,
    clusterRadius: 48,
    clusterProperties: { minimo: ['min', ['get', 'minimo']] },
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

  // Gruppi: un cerchio scuro col prezzo minimo e quanti impianti contiene.
  m.addLayer({
    id: 'mf-gruppi', type: 'circle', source: 'mf-impianti', filter: ['has', 'point_count'],
    paint: {
      'circle-color': HEX.surface,
      'circle-opacity': 0.94,
      'circle-stroke-color': 'rgba(255,255,255,0.22)',
      'circle-stroke-width': 1.5,
      'circle-radius': ['step', ['get', 'point_count'], 27, 100, 30, 500, 33],
    },
  });
  m.addLayer({
    id: 'mf-gruppi-testo', type: 'symbol', source: 'mf-impianti', filter: ['has', 'point_count'],
    layout: {
      'text-field': [
        'case',
        ['<', ['get', 'minimo'], 50],
        ['format',
          ['concat', 'da ', ['number-format', ['get', 'minimo'], { locale: 'it-IT', 'min-fraction-digits': 3, 'max-fraction-digits': 3 }]],
          { 'font-scale': 1 },
          '\n', {},
          ['to-string', ['get', 'point_count']],
          { 'font-scale': 0.78, 'text-color': HEX.ink2 },
        ],
        ['to-string', ['get', 'point_count']],
      ],
      'text-font': FONT_GRASSETTO,
      'text-size': 11,
      'text-line-height': 1.2,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: { 'text-color': HEX.ink },
  });

  // Ogni impianto e un pallino: nessuno sparisce, anche se la targhetta non ci sta.
  m.addLayer({
    id: 'mf-pallini', type: 'circle', source: 'mf-impianti', filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3, 13, 4.5, 16, 6],
      'circle-color': [
        'case', ['==', ['get', 'spento'], 1], HEX.stale,
        ['match', ['get', 'livello'],
          'best', TESTO_TARGHETTA.best, 'good', TESTO_TARGHETTA.good, 'high', TESTO_TARGHETTA.high,
          'worst', TESTO_TARGHETTA.worst, TESTO_TARGHETTA.normal],
      ],
      'circle-opacity': ['case', ['==', ['get', 'spento'], 1], 0.5, 0.9],
      'circle-stroke-color': '#000000',
      'circle-stroke-width': 1,
    },
  });

  // Targhette col prezzo, dove c'e posto: vincono i piu economici.
  m.addLayer({
    id: 'mf-targhette', type: 'symbol', source: 'mf-impianti', minzoom: ZOOM_TARGHETTE,
    filter: ['!', ['has', 'point_count']],
    layout: {
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
      'text-padding': 3,
    },
    paint: {
      'text-color': [
        'case', ['==', ['get', 'spento'], 1], TESTO_TARGHETTA.spento,
        ['match', ['get', 'livello'],
          'best', TESTO_TARGHETTA.best, 'good', TESTO_TARGHETTA.good, 'high', TESTO_TARGHETTA.high,
          'worst', TESTO_TARGHETTA.worst, TESTO_TARGHETTA.normal],
      ],
    },
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
