import { useEffect, useRef, memo } from 'react';
import { maplibregl, STILE_MAPPA } from '../lib/maplibre';
import type { Cluster } from '../ui/map/cluster';
import { formatEuro } from '../design/primitives/PriceText';
import { getBrandLogo } from '../lib/brandLogos';
import { Crosshair, Moon, Sun, Flame } from 'lucide-react';

/*
  Il ripiego quando le tessere vettoriali non arrivano.

  Prima erano quelle di CARTO, che dal 2026 vogliono una chiave e senza
  rispondono con tessere marchiate «API KEY REQUIRED» in diagonale: e
  proprio il watermark che si vedeva, e arrivava di qui, non da OpenFreeMap.
  ArcGIS e piu spento ma non chiede niente e non scrive niente sopra.
*/
const FALLBACK_DARK: any = {
  version: 8,
  sources: {
    'raster-dark': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256
    }
  },
  layers: [
    {
      id: 'dark-tiles',
      type: 'raster',
      source: 'raster-dark',
      minzoom: 0,
      maxzoom: 20
    }
  ]
};

const FALLBACK_LIGHT: any = {
  version: 8,
  sources: {
    'raster-light': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256
    }
  },
  layers: [
    {
      id: 'light-tiles',
      type: 'raster',
      source: 'raster-light',
      minzoom: 0,
      maxzoom: 20
    }
  ]
};

interface Props {
  userLoc: { lat: number; lng: number } | null;
  clusters: { list: Cluster[]; totale: number };
  bestStationId?: string;
  minPriceInView: number | null;
  /**
   * La media nazionale del carburante scelto, tagliata alle code. E il metro
   * dei colori di giugno: non cambia spostando la mappa, quindi una targhetta
   * verde resta verde anche allargando la vista.
   */
  mediaRiferimento: number | null;
  mapZoom: number;
  mapStyle: 'dark' | 'voyager';
  heatmapOn: boolean;
  onMove: (c: { lat: number; lng: number }) => void;
  onZoom: (z: number) => void;
  onBoundsChange: (bounds: any) => void;
  onStationClick: (id: string) => void;
  onToggleStyle: () => void;
  onToggleHeatmap: () => void;
}

/**
 * Da quale zoom compaiono i loghi dei marchi.
 *
 * Da lontano sono decine di immagini sovrapposte ai prezzi: rallentano la
 * mappa sul telefono e non aggiungono niente, perche a quella scala il
 * marchio non e la domanda. E la soglia dell'8 giugno.
 */
const ZOOM_LOGHI = 15;

/** Oltre un centesimo e mezzo dalla media in vista il prezzo non e piu «in linea». */
const SOGLIA_EUR = 0.015;

interface AspettoPillola {
  fondo: string;
  bordo: string;
  inchiostro: string;
  alone: string;
  opacita: string;
}

/**
 * Il colore di una targhetta, rispetto alla media nazionale del carburante.
 *
 * Il metro e fisso, non dipende da cosa si sta guardando: e la scelta di
 * giugno, e ha un pregio pratico — una targhetta verde resta verde mentre
 * allarghi o stringi. Prendendo come metro la media della vista, invece,
 * allargando restavano in campo solo i piu economici e si ricoloravano tutti
 * in rosso e ambra fra loro, che e proprio il comportamento che dava
 * fastidio allontanandosi.
 */
function aspettoPillola(
  prezzo: number,
  media: number | null,
  migliore: boolean,
  inaffidabile: boolean
): AspettoPillola {
  // Il piu conveniente in vista si riconosce prima di leggere la cifra.
  if (migliore) {
    return {
      fondo: '#2563eb',
      bordo: '#60a5fa',
      inchiostro: '#ffffff',
      alone: 'box-shadow:0 0 15px rgba(59,130,246,.6);',
      opacita: '',
    };
  }

  // Coorte troppo povera per dare un giudizio: si mostra il prezzo e si sta
  // zitti sul colore, invece di spacciare per verdetto un tiro a indovinare.
  if (inaffidabile || media === null) {
    return {
      fondo: 'rgba(0,0,0,.6)',
      bordo: 'rgba(75,85,99,.5)',
      inchiostro: '#9ca3af',
      alone: 'box-shadow:0 1px 3px rgba(0,0,0,.5);',
      opacita: 'opacity:.6;',
    };
  }

  if (prezzo > media + SOGLIA_EUR) {
    return {
      fondo: '#ef4444',
      bordo: '#f87171',
      inchiostro: '#ffffff',
      alone: 'box-shadow:0 0 15px rgba(239,68,68,.6);',
      opacita: '',
    };
  }

  if (prezzo < media - SOGLIA_EUR) {
    return {
      fondo: '#10b981',
      bordo: '#6ee7b7',
      inchiostro: '#000000',
      alone: 'box-shadow:0 0 15px rgba(16,185,129,.6);',
      opacita: '',
    };
  }

  return {
    fondo: '#f59e0b',
    bordo: '#fcd34d',
    inchiostro: '#000000',
    alone: 'box-shadow:0 0 15px rgba(245,158,11,.6);',
    opacita: '',
  };
}

export const MainMapLibre = memo(function MainMapLibre({
  userLoc,
  clusters,
  bestStationId,
  minPriceInView,
  mediaRiferimento,
  mapZoom,
  mapStyle,
  heatmapOn,
  onMove,
  onZoom,
  onBoundsChange,
  onStationClick,
  onToggleStyle,
  onToggleHeatmap,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const clusterMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  const styleUrl = STILE_MAPPA[mapStyle];

  // 1. Inizializzazione Mappa
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter: [number, number] = userLoc ? [userLoc.lng, userLoc.lat] : [9.19, 45.4642];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: initialCenter,
      zoom: mapZoom || 13,
      attributionControl: false,
    });

    mapRef.current = map;

    // Fallback di sicurezza in caso di errori di worker o rete
    map.on('error', (e: any) => {
      console.warn('MapLibre error:', e);
      if (e?.error?.message?.includes('Worker') || e?.error?.message?.includes('fetch') || e?.sourceId === 'openmaptiles') {
        try {
          map.setStyle(mapStyle === 'dark' ? FALLBACK_DARK : FALLBACK_LIGHT);
        } catch {
          // ignora
        }
      }
    });

    map.on('load', () => {
      map.resize();
      const b = map.getBounds();
      onBoundsChange({
        getSouthWest: () => ({ lat: b.getSouth(), lng: b.getWest() }),
        getNorthEast: () => ({ lat: b.getNorth(), lng: b.getEast() }),
      });
    });

    map.on('moveend', () => {
      const c = map.getCenter();
      onMove({ lat: c.lat, lng: c.lng });
      const b = map.getBounds();
      onBoundsChange({
        getSouthWest: () => ({ lat: b.getSouth(), lng: b.getWest() }),
        getNorthEast: () => ({ lat: b.getNorth(), lng: b.getEast() }),
      });
    });

    map.on('zoomend', () => {
      onZoom(map.getZoom());
      const b = map.getBounds();
      onBoundsChange({
        getSouthWest: () => ({ lat: b.getSouth(), lng: b.getWest() }),
        getNorthEast: () => ({ lat: b.getNorth(), lng: b.getEast() }),
      });
    });

    // Resize Observer & loop di refresh
    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(containerRef.current);

    const t1 = setTimeout(() => map.resize(), 100);
    const t2 = setTimeout(() => map.resize(), 300);
    const t3 = setTimeout(() => map.resize(), 800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  /*
    2. Cambio stile (scuro / chiaro).

    Lo stile iniziale lo mette gia il costruttore, e questo effetto parte
    subito dopo: chiamando setStyle con lo stesso indirizzo mentre il primo
    scaricamento e ancora in volo, la seconda chiamata interrompe la prima e
    lo stile resta a meta. Non arriva nessun errore — isStyleLoaded() dice
    solo false per sempre — e la mappa resta nera con sopra i prezzi.
    Ricordarsi qual e l'ultimo stile applicato e tutto quello che serve.
  */
  const stileApplicato = useRef(styleUrl);
  useEffect(() => {
    if (!mapRef.current || stileApplicato.current === styleUrl) return;
    stileApplicato.current = styleUrl;
    mapRef.current.setStyle(styleUrl);
  }, [styleUrl]);

  // 3. User Location Marker
  useEffect(() => {
    if (!mapRef.current || !userLoc) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      return;
    }

    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'user-location-marker';
      el.innerHTML = '<span></span>';
      el.style.width = '28px';
      el.style.height = '28px';
      el.style.display = 'grid';
      el.style.placeItems = 'center';
      el.style.borderRadius = '50%';
      el.style.background = 'rgba(59, 130, 246, 0.25)';
      el.style.boxShadow = '0 0 0 6px rgba(59, 130, 246, 0.15), 0 0 20px rgba(59, 130, 246, 0.8)';

      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([userLoc.lng, userLoc.lat])
        .addTo(mapRef.current);
    } else {
      userMarkerRef.current.setLngLat([userLoc.lng, userLoc.lat]);
    }
  }, [userLoc]);

  // 4. Cluster Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentMap = clusterMarkersRef.current;
    const nextIds = new Set<string>();


    clusters.list.forEach((c) => {
      nextIds.add(c.bestId);
      const isCheapestInView = minPriceInView !== null && Math.abs(c.bestPrice - minPriceInView) < 0.0001;
      const isHomeBest = c.bestId === bestStationId;
      const isBest = isCheapestInView || isHomeBest;

      // Spento e in grigio quando il prezzo non e da prendere sul serio:
      // scartato dai conti, o di un impianto che non aggiorna da una
      // settimana. E il «grayscale opacity-60» dell'8 giugno.
      const migliore = c.members.find((m) => m.id === c.bestId);
      const sospetto = migliore ? !migliore.eligible || migliore.probabilmenteChiuso : false;

      const a = aspettoPillola(c.bestPrice, mediaRiferimento, isBest, sospetto);

      const extra = c.count > 1 ? `<span style="margin-left:4px;opacity:.75;font-size:9px">+${c.count - 1}</span>` : '';

      // Il logo del marchio solo da vicino. Da lontano sono decine di
      // immagini che si accavallano sopra i prezzi e fanno arrancare la
      // mappa sul telefono, per dire una cosa che a quella scala non serve.
      const logoHtml = mapZoom >= ZOOM_LOGHI
        ? `<div style="position:absolute;top:-18px;right:-10px;width:26px;height:26px;border-radius:50%;background:#000;` +
          `border:1px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;overflow:hidden;` +
          `box-shadow:0 2px 6px rgba(0,0,0,.5);pointer-events:none;z-index:50;">` +
          `<img src="${getBrandLogo(c.brand || c.name || '')}" style="width:100%;height:100%;object-fit:contain;padding:2px;" loading="lazy" alt="" /></div>`
        : '';

      /*
        Pillola squadrata col bordo spesso e la punta sotto, ancorata al
        suolo: e la forma dell'8 giugno, e a differenza della pastiglia tonda
        dice a quale puntino appartiene il prezzo quando ce ne sono venti
        vicini. Niente sfocature ne transizioni: erano la ragione per cui la
        mappa arrancava trascinando.
      */
      const html =
        `<div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;` +
        `will-change:transform;${a.opacita}">` +
        logoHtml +
        `<div style="background:${a.fondo};color:${a.inchiostro};border:2px solid ${a.bordo};border-radius:10px;` +
        `padding:2px 7px;font:900 11px var(--mf-font-mono),ui-monospace,monospace;letter-spacing:-.02em;` +
        `white-space:nowrap;${a.alone}">${formatEuro(c.bestPrice)}${extra}</div>` +
        `<div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;` +
        `border-top:7px solid ${a.bordo};margin-top:-1px;"></div></div>`;

      let marker = currentMap.get(c.bestId);
      if (!marker) {
        const el = document.createElement('div');
        el.innerHTML = html;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onStationClick(c.bestId);
        });

        // Ancorato in basso: la punta tocca il distributore, non il centro
        // della pillola.
        marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([c.lng, c.lat])
          .addTo(map);

        currentMap.set(c.bestId, marker);
      } else {
        marker.getElement().innerHTML = html;
        marker.setLngLat([c.lng, c.lat]);
      }
    });

    // Rimuovi marker vecchi non più in vista
    currentMap.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.remove();
        currentMap.delete(id);
      }
    });
  }, [clusters.list, bestStationId, minPriceInView, mediaRiferimento, mapZoom, onStationClick]);

  const handleCenter = () => {
    if (!mapRef.current || !userLoc) return;
    mapRef.current.flyTo({ center: [userLoc.lng, userLoc.lat], zoom: 14, speed: 1.5 });
  };

  return (
    <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#0c0c0e' }} />

      {/* Comandi mappa in basso a destra */}
      <div
        className="absolute right-4 z-[500] flex flex-col gap-2.5"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
      >
        <button
          onClick={onToggleHeatmap}
          aria-label="Mappa di calore"
          title="Mappa di calore"
          className="flex items-center justify-center transition-colors active:scale-95"
          style={{
            width: 46,
            height: 46,
            borderRadius: 'var(--mf-radius-pill)',
            background: heatmapOn
              ? 'var(--mf-accent)'
              : 'color-mix(in srgb, var(--mf-surface-raised) 88%, transparent)',
            color: heatmapOn ? 'var(--mf-accent-ink)' : 'var(--mf-ink)',
            border: `1px solid ${heatmapOn ? 'var(--mf-accent)' : 'var(--mf-hairline)'}`,
            backdropFilter: 'blur(14px)',
            boxShadow: 'var(--mf-edge-light)',
          }}
        >
          <Flame size={20} />
        </button>

        <button
          onClick={onToggleStyle}
          aria-label="Stile chiaro o scuro"
          title="Stile chiaro o scuro"
          className="flex items-center justify-center transition-colors active:scale-95"
          style={{
            width: 46,
            height: 46,
            borderRadius: 'var(--mf-radius-pill)',
            background: 'color-mix(in srgb, var(--mf-surface-raised) 88%, transparent)',
            color: 'var(--mf-ink)',
            border: '1px solid var(--mf-hairline)',
            backdropFilter: 'blur(14px)',
            boxShadow: 'var(--mf-edge-light)',
          }}
        >
          {mapStyle === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {userLoc && (
          <button
            onClick={handleCenter}
            aria-label="Centra sulla tua posizione"
            title="Centra sulla tua posizione"
            className="flex items-center justify-center transition-colors active:scale-95"
            style={{
              width: 46,
              height: 46,
              borderRadius: 'var(--mf-radius-pill)',
              background: 'color-mix(in srgb, var(--mf-surface-raised) 88%, transparent)',
              color: 'var(--mf-ink)',
              border: '1px solid var(--mf-hairline)',
              backdropFilter: 'blur(14px)',
              boxShadow: 'var(--mf-edge-light)',
            }}
          >
            <Crosshair size={20} />
          </button>
        )}
      </div>
    </div>
  );
});
