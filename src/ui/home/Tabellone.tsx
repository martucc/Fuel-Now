import { useMemo, useEffect, useRef, useState } from 'react';
import { maplibregl, STILE_MAPPA } from '../../lib/maplibre';
import { Maximize2, Crosshair } from 'lucide-react';
import type { HomeModel } from './homeModel';
import { priceColor, formatEuro } from '../../design/primitives/PriceText';

/**
 * Quante pillole disegnare.
 *
 * Erano quattordici, le piu vicine, e bastavano finche la mappa stava ferma.
 * Potendola spostare, quattordici finiscono subito: due strade piu in la la
 * mappa diventava vuota e sembrava rotta.
 */
const MAX_PINS = 40;

/** Oltre questi metri ci si e allontanati davvero, e il tasto per tornare ha senso. */
const LONTANO_M = 300;

const ZOOM = 12.5;

interface Props {
  model: HomeModel;
  onOpen: () => void;
}

function pillolaHtml(price: number, color: string, isBest: boolean): string {
  const bg = isBest ? '#3b82f6' : color;
  const ink = isBest ? '#ffffff' : '#0b0f0e';
  const ring = isBest
    ? 'box-shadow: 0 0 0 2px #fff, 0 0 12px rgba(59, 130, 246, 0.85); font-weight: 700;'
    : 'box-shadow: 0 1px 3px rgba(0,0,0,.6);';
  return (
    `<div style="background:${bg};color:${ink};border-radius:999px;padding:2px 6px;` +
    `font:600 10px var(--mf-font-mono),ui-monospace,monospace;white-space:nowrap;` +
    `display:inline-flex;${ring}">${formatEuro(price)}</div>`
  );
}

/**
 * La mini mappa della Home, sulle stesse tessere vettoriali della scheda Mappa.
 *
 * Prima era Leaflet su tessere raster di ArcGIS: due mappe diverse nella
 * stessa app, e si vedeva — grigio piatto qui, strade e isolati di la. Ora e
 * una finestra piccola sulla stessa mappa, non un'altra mappa.
 */
export function Tabellone({ model, onOpen }: Props) {
  const contenitore = useRef<HTMLDivElement>(null);
  const mappa = useRef<maplibregl.Map | null>(null);
  const marcatori = useRef<maplibregl.Marker[]>([]);
  const [spostata, setSpostata] = useState(false);

  const pins = useMemo(() => {
    const bestId = model.best?.row.id;
    const vicini = [...model.list].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, MAX_PINS);
    if (bestId && !vicini.some((v) => v.id === bestId)) {
      const b = model.list.find((i) => i.id === bestId);
      if (b) vicini.push(b);
    }
    return vicini.map((i) => ({ ...i, isBest: i.id === bestId }));
  }, [model]);

  // Due numeri e non una coppia: un array nuovo a ogni resa farebbe ripartire
  // l'effetto qui sotto sempre, anche quando il consigliato non e cambiato.
  const centroLng = model.best?.row.lng ?? pins[0]?.lng ?? 12.4964;
  const centroLat = model.best?.row.lat ?? pins[0]?.lat ?? 41.9028;

  // Il centro serve dentro a callback che non si ricreano mai. Tenendolo in
  // un ref, cambiare consigliato non ricostruisce la mappa da capo — cosa
  // che butterebbe via anche lo spostamento fatto a mano dall'utente.
  const centroRef = useRef<[number, number]>([centroLng, centroLat]);
  useEffect(() => {
    centroRef.current = [centroLng, centroLat];
  }, [centroLng, centroLat]);

  useEffect(() => {
    if (!contenitore.current || mappa.current) return;

    const m = new maplibregl.Map({
      container: contenitore.current,
      style: STILE_MAPPA.dark,
      center: centroRef.current,
      zoom: ZOOM,
      attributionControl: false,
      // Si trascina e si pizzica: e il punto di tutto questo.
      dragPan: true,
      touchZoomRotate: true,
      doubleClickZoom: true,
      // La rotellina resta spenta di proposito. Su un portatile il dito sul
      // trackpad sopra la mappa vuol dire «scorri la pagina», non «zooma»:
      // accendendola la Home si incastrerebbe ogni volta che ci passi sopra.
      scrollZoom: false,
      // In un riquadro da duecento pixel, ruotare e inclinare servono solo a
      // perdersi e a rendere illeggibili le pillole.
      dragRotate: false,
      pitchWithRotate: false,
      keyboard: false,
    });

    m.on('moveend', () => {
      const [lng, lat] = centroRef.current;
      setSpostata(m.getCenter().distanceTo(new maplibregl.LngLat(lng, lat)) > LONTANO_M);
    });

    mappa.current = m;

    return () => {
      for (const mk of marcatori.current) mk.remove();
      marcatori.current = [];
      m.remove();
      mappa.current = null;
    };
  }, []);

  // Le pillole si rifanno quando cambiano i prezzi: sono qualche decina, si
  // buttano e si ridisegnano. Una riconciliazione, a questi numeri,
  // costerebbe piu codice di quanto risparmi.
  useEffect(() => {
    const m = mappa.current;
    if (!m) return;

    for (const mk of marcatori.current) mk.remove();
    marcatori.current = pins.map((p) => {
      const el = document.createElement('div');
      el.innerHTML = pillolaHtml(p.price, priceColor(p.level), p.isBest);
      return new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(m);
    });
  }, [pins]);

  const tornaAlConsigliato = () => {
    mappa.current?.flyTo({ center: centroRef.current, zoom: ZOOM, duration: 600 });
    setSpostata(false);
  };

  return (
    <div
      className="relative overflow-hidden"
      style={{
        height: 200,
        borderRadius: 'var(--mf-radius-lg)',
        border: '1px solid var(--mf-hairline)',
        background: '#0c0c0e',
      }}
    >
      <div ref={contenitore} style={{ position: 'absolute', inset: 0 }} />

      {/*
        Il tasto per aprire la mappa grande sta solo sulla fascia in basso.
        Prima era un <button> grande quanto tutto il riquadro: copriva la
        mappa e si prendeva ogni gesto. Da qui in su il dito parla con la mappa.
      */}
      <button
        onClick={onOpen}
        className="absolute inset-x-0 bottom-0 z-[500] flex items-center justify-between gap-2 px-4 py-3 text-left"
        aria-label="Apri la mappa a schermo intero"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,.92), transparent)' }}
      >
        <span className="mf-num truncate" style={{ color: 'var(--mf-ink)', fontSize: 11 }}>
          {model.board.count === 0 || model.board.best === null || model.board.worst === null
            ? 'nessun impianto in vista'
            : `${model.board.count} impianti · da ${formatEuro(model.board.best)} a ${formatEuro(model.board.worst)}`}
        </span>
        <Maximize2 size={16} className="flex-shrink-0" style={{ color: 'var(--mf-ink-2)' }} />
      </button>

      {/* Compare solo quando serve: se non ti sei mosso, non c'e dove tornare. */}
      {spostata && (
        <button
          onClick={tornaAlConsigliato}
          className="absolute right-3 top-3 z-[500] flex items-center gap-1.5 px-2.5 py-1.5 active:scale-95"
          style={{
            background: 'rgba(12,12,14,.86)',
            border: '1px solid var(--mf-hairline)',
            borderRadius: 'var(--mf-radius-pill)',
            color: 'var(--mf-ink)',
            fontFamily: 'var(--mf-font-sans)',
            fontSize: 11,
            fontWeight: 600,
            backdropFilter: 'blur(6px)',
            transition: 'transform .12s ease',
          }}
        >
          <Crosshair size={12} style={{ color: 'var(--mf-accent)' }} /> al consigliato
        </button>
      )}
    </div>
  );
}
