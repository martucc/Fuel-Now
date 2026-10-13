import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MapPin, Bell, Settings, Home, BarChart3, Car, Target, Route, Calculator } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { FuelStation, MarketAnalysis, FuelType, Alert } from './types';
import type { RankedStation } from './domain/ranking';
import { getStations, getRows, getRawDataset } from './services/dataService';
import { datasetStore } from './data/dataset';
import { avviaAggiornamentiAutomatici } from './services/aggiornamentiAutomatici';
import { analyzeFuelMarket, ErroreIa, MESSAGGIO_ERRORE } from './services/geminiService';
import { buildAiContext } from './domain/aiContext';
import { computeStats, fillupsForCar } from './services/fillupService';
import { computeBudget } from './services/budgetService';
import { registraConsiglio } from './services/adviceLog';
import { pubblicaWidget } from './services/widget';
import { descriviDati, describeAge } from './domain/freshness';
import { pianificaViaggio, type Piano, type TappaCandidata } from './domain/viaggio';
import { levelForZ, zScore } from './domain/pricing';
import { cohortFor } from './domain/market';
import { buildLocalMarketAnalysis, calculateMarketStats } from './services/localAnalysis';
import { buildCohorts } from './domain/market';
import { toFuelKey, toFuelType } from './domain/fuel';
import { litersFor, kmlFor } from './domain/units';
import { buildHomeModel } from './ui/home/homeModel';
import type { Percorso } from './domain/corridoio';
import { chiediPercorso, percorsoInCache } from './services/percorsoService';
import { buildMarketModel } from './ui/market/marketModel';
import { toFuelStation } from './data/adapter';
import { BlockSheet } from './ui/sheets/BlockSheet';
import { loadHistory } from './services/historyService';
import { MainMapLibre } from './components/MainMapLibre';

import { HomeTab } from './components/tabs/HomeTab';
import { TripTab } from './components/tabs/TripTab';
import { AutoTab } from './components/tabs/AutoTab';
import { checkPriceThresholds, checkDailyTrend, checkBestDeal, checkPienoReminder, checkDeadlines, checkBudget, checkAndRequestStartupPermission } from './services/notificationService';
import { BudgetCalcModal } from './components/BudgetCalcModal';
import { InstallPwaButton } from './components/InstallPwaButton';
import { StationHistoryModal } from './components/StationHistoryModal';
import { recordObservation } from './services/stationHistoryService';
import { AnalysisTab } from './components/tabs/AnalysisTab';
import { AlertsTab } from './components/tabs/AlertsTab';
import { FiltersModal } from './components/modals/FiltersModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { HomeAddressModal } from './components/modals/HomeAddressModal';
import { SplashScreen } from './components/SplashScreen';
import { BottomNav } from './components/BottomNav';

type TabType = 'home'|'map'|'veicolo'|'analysis'|'alerts'|'trip'|'pieno';
const tabOrder: TabType[] = ['home', 'map', 'trip', 'veicolo', 'analysis', 'alerts'];

const pageVariants = {
  initial: (direction: number) => ({
    x: direction > 0 ? 100 : -100,
    scale: 0.96,
    opacity: 0,
  }),
  animate: {
    x: 0,
    scale: 1,
    opacity: 1,
    transition: {
      x: { type: "spring" as const, stiffness: 350, damping: 32, mass: 0.8 },
      scale: { type: "spring" as const, stiffness: 350, damping: 32, mass: 0.8 },
      opacity: { duration: 0.25, ease: "easeOut" as const }
    },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -100 : 100,
    scale: 0.96,
    opacity: 0,
    transition: {
      x: { type: "spring" as const, stiffness: 350, damping: 32, mass: 0.8 },
      scale: { type: "spring" as const, stiffness: 350, damping: 32, mass: 0.8 },
      opacity: { duration: 0.18, ease: "easeIn" as const }
    },
  }),
};

const mapPageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15, ease: "easeOut" as const } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: "easeIn" as const } }
};

function normalizeFuelNews(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.events)) return raw.events.map((e: any) => ({ title: e.title || 'Aggiornamento', summary: e.summary || e.content || '', content: e.content || e.summary || '', impact: e.impact || 'neutral', source: e.source || 'Fuel Now', url: e.url || e.link, date: e.date || raw.generated_at }));
  return [];
}

// @ts-ignore - utility per nome breve veicolo, riservata per usi futuri
// Estrae nome breve veicolo (es. "BMW Serie 3 320d (Diesel)" -> "BMW Serie 3")
function shortCarName(m: string): string {
  if (!m) return '';
  let s = m.split('(')[0].trim();
  const cutRe = /\s+(\d+\.\d+|\d{2,3}(?!cc\b)[a-z]+|[BDT]\d(?:\/[BDT]\d)+|[BDT][2-9]|TSI|TDI|TFSI|JTDm?|MultiJet|BlueHDi|EcoBoost|EcoBlue|dCi|TCe|SkyActiv[-\s]?[A-Z]?|T-Jet|T-GDi|CRDi|PureTech|FireFly|e-Hybrid|e:HEV|Hybrid|MHEV|PHEV|FHEV|TGI|G-Tec|Eco-G|Turbo|Plug-in|sDrive\w*|xDrive\w*|DIG-T|IG-T|VVT-i|e-Tech|e-POWER|BoosterJet|DDiS|HDi|CDTi|cdti|BiTurbo|GPL|Metano|Diesel|Benzina|Mild|Full)\b.*$/i;
  s = s.replace(cutRe, '');
  // Standalone digit at end (codici Audi/Mercedes "25", "180") - non tagliare se preceduto da "Serie"/"Classe"
  if (!/\b(Serie|Classe)\s+\w+$/i.test(s)) s = s.replace(/\s+\d{1,3}$/, '');
  return s.trim();
}

export default function App() {
  const [tab, setTab] = useState<TabType>(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get('tab') as TabType | null;
    const valid: TabType[] = ['home','map','veicolo','analysis','alerts','trip','pieno'];
    return t && valid.includes(t) ? t : 'home';
  });
  const [userLoc, setUserLoc] = useState<{lat:number;lng:number}|null>(null);
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [nationalStats, setNationalStats] = useState<any>({});
  const [marketAnalyses, setMarketAnalyses] = useState<Record<string, MarketAnalysis>>({});
  const [fuel, setFuel] = useState<FuelType>(() => {
    const p = new URLSearchParams(window.location.search);
    const valid: FuelType[] = ['Benzina','Diesel','GPL','Metano'];
    const fromUrl = p.get('fuel');
    if (fromUrl && (valid as string[]).includes(fromUrl)) return fromUrl as FuelType;
    const stored = localStorage.getItem('mf_fuel');
    if (stored && (valid as string[]).includes(stored)) return stored as FuelType;
    return 'Benzina';
  });
  useEffect(() => { localStorage.setItem('mf_fuel', fuel); }, [fuel]);
  const [loading, setLoading] = useState(true);
  const [favs, setFavs] = useState<string[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [stationDetail, setStationDetail] = useState<FuelStation | null>(null);
  const [blockTarget, setBlockTarget] = useState<FuelStation | null>(null);
  const [heatmapOn, setHeatmapOn] = useState<boolean>(() => localStorage.getItem('mf_heatmap') === '1');
  useEffect(() => { localStorage.setItem('mf_heatmap', heatmapOn ? '1' : '0'); }, [heatmapOn]);
  const [homeAddress, setHomeAddress] = useState<string>(() => localStorage.getItem('mf_home_address') || '');
  const [homeLoc, setHomeLoc] = useState<{ lat: number; lng: number } | null>(() => {
    try {
      const s = localStorage.getItem('mf_home_loc');
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });
  const [homeMode, setHomeMode] = useState<boolean>(() => localStorage.getItem('mf_home_mode') === '1');
  // Il percorso stradale verso casa. null finche il router non risponde, e
  // resta null se non risponde affatto: la Home in quel caso stima e lo dice.
  const [percorsoCasa, setPercorsoCasa] = useState<Percorso | null>(null);
  const [showHomeAddressModal, setShowHomeAddressModal] = useState(false);
  const [brands, setBrands] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [radius, setRadius] = useState(20);
  const [h24, setH24] = useState(false);
  const [noHwy, setNoHwy] = useState(false);
  const [hideAnom, setHideAnom] = useState(false);
  const [tripStart, setTripStart] = useState('Milano');
  const [tripEnd, setTripEnd] = useState('Roma');
  // Zero finche non si calcola: il vecchio 575 era Milano-Roma travestito da stima.
  const [tripDist, setTripDist] = useState(0);
  const [tripKml, setTripKml] = useState(15);
  const [tripUnit, setTripUnit] = useState<'kml'|'l100'>('kml');
  const [tripCurrentFuel, setTripCurrentFuel] = useState<number | null>(null);
  const [tripToll, setTripToll] = useState(true);
  const [tankL, setTankL] = useState(50);
  const [tripRoute, setTripRoute] = useState<any>(null);
  const [tripStops, setTripStops] = useState<any[]>([]);
  const [tripNearby, setTripNearby] = useState<any[]>([]);
  const [tripPiano, setTripPiano] = useState<Piano | null>(null);
  const [tripStatus, setTripStatus] = useState('');
  const [tripStrat, setTripStrat] = useState<'balanced'|'save'|'fast'>('balanced');
  const [tripCalc, setTripCalc] = useState(false);
  const [fuelNews, setFuelNews] = useState<any[]>([]);
  // Lo storico lungo sta in un CSV a parte e arriva al 2020: il dataset
  // ne porta solo l'ultimo anno, fitto. Serve per i confronti a un anno.
  const [storicoLungo, setStoricoLungo] = useState<{ date: string; avg: number }[]>([]);
  const [cars, setCars] = useState<any[]>([]);
  const [selCar, setSelCar] = useState<any>(null);
  const [carQ, setCarQ] = useState('');
  const [apiKey, setApiKey] = useState(localStorage.getItem('martucc_fuel_api_key')||'');
  const [apiModel, setApiModel] = useState(localStorage.getItem('martucc_fuel_api_model')||'gemini-2.5-flash');
  // Lo stato c'e e viene scritto, ma nessuna schermata lo mostra ancora:
  // gli errori dei provider hanno casa nel pannello della fase 3.
  // Se l'IA fallisce con una chiave impostata l'utente deve saperlo:
  // prima il valore veniva scartato e il guasto era invisibile.
  const [aiErr, setAiErr] = useState<string|null>(null);
  const [userQ, setUserQ] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [direction, setDirection] = useState(0);
  const [showSplash, setShowSplash] = useState(true);
  const [mapZoom, setMapZoom] = useState(13);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [mapStyle, setMapStyle] = useState<'dark' | 'voyager'>(() => (localStorage.getItem('mf_map_style') as 'dark' | 'voyager') || 'dark');
  useEffect(() => { localStorage.setItem('mf_map_style', mapStyle); }, [mapStyle]);
  const [aiAnswer, setAiAnswer] = useState<{ question: string; answer: string; ts: number; source: 'ai' | 'local' } | null>(null);
  const [driveMode] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('drive')==='1') localStorage.setItem('mf_drive','on');
    if (p.get('drive')==='0') localStorage.setItem('mf_drive','off');
    return localStorage.getItem('mf_drive')==='on';
  });
  const initDone = useRef(false);
  const [showBottomNav, setShowBottomNav] = useState(true);
  const lastScrollY = useRef(0);

  const fuels: FuelType[] = ['Benzina', 'Diesel', 'GPL', 'Metano'];
  const allAverages = useMemo(() => {
    return fuels.reduce((acc, f) => {
      const vp = stations.map(s => s.prices.find(p => p.type === f)?.price).filter(p => p && p > 0.5) as number[];
      if (vp.length === 0) {
        acc[f] = Infinity;
      } else {
        vp.sort((a, b) => a - b);
        const trim = Math.floor(vp.length * 0.15);
        const trimmed = vp.slice(trim, vp.length - trim || vp.length);
        acc[f] = (trimmed.reduce((a, b) => a + b, 0) / trimmed.length) || (vp.reduce((a, b) => a + b, 0) / vp.length);
      }
      return acc;
    }, {} as Record<FuelType, number>);
  }, [stations]);

  const isPriceAnom = useCallback((s: FuelStation, f: FuelType) => {
    const p = s.prices.find(pp => pp.type === f)?.price || 0;
    const jsonKey = f.toLowerCase();
    const natAvg = nationalStats[jsonKey]?.avg;
    const avg = natAvg || allAverages[f];
    
    // An anomaly is a price <= 0, or < 93% of average, or < 0.5 EUR, or > 3.0 EUR, or > 15% above average
    if (p <= 0) return true;
    if (p < 0.5 || p > 3.0) return true;
    if (avg !== Infinity && (p < avg * 0.93 || p > avg * 1.15)) return true;
    return false;
  }, [nationalStats, allAverages]);

  const activeStations = useMemo(() => {
    return stations.filter(s => {
      const isBlocked = blockedIds.includes(s.id);
      const anom = isPriceAnom(s, fuel);
      return !isBlocked && !anom;
    });
  }, [stations, fuel, blockedIds, isPriceAnom]);

  /**
   * Lo splash resta finche i dati non ci sono, e non un istante di piu.
   *
   * Non carica niente per conto suo: e getStations a far aspettare, e quando
   * i prezzi sono gia in cache l'attesa vera e quasi zero. Prima c'era un
   * minimo di un secondo per non troncare l'animazione; adesso l'animazione
   * dura meno di mezzo secondo e il minimo scende con lei. Restano 420 ms,
   * quel tanto che basta perche non sia un lampo.
   */
  const splashStart = useRef(Date.now());
  useEffect(() => {
    if (loading) return;
    const trascorso = Date.now() - splashStart.current;
    const timer = setTimeout(() => setShowSplash(false), Math.max(60, 420 - trascorso));
    return () => clearTimeout(timer);
  }, [loading]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (tab === 'map') {
      if (!showBottomNav) setShowBottomNav(true);
      return;
    }
    const currentScrollY = e.currentTarget.scrollTop;
    const diff = currentScrollY - lastScrollY.current;
    
    // ignore tiny scrolls to avoid flickering
    if (Math.abs(diff) < 8) return;
    
    if (currentScrollY > lastScrollY.current && currentScrollY > 60) {
      // Scrolling down - hide BottomNav
      setShowBottomNav(false);
    } else {
      // Scrolling up - show BottomNav
      setShowBottomNav(true);
    }
    lastScrollY.current = currentScrollY;
  };

  const handleTabChange = (newTab: TabType) => {
    const currentIndex = tabOrder.indexOf(tab);
    const newIndex = tabOrder.indexOf(newTab);
    setDirection(newIndex > currentIndex ? 1 : -1);
    setTab(newTab);
    setShowBottomNav(true); // Reset BottomNav visibility on tab change!
  };
  const fetchAnalysis = async (f: FuelType, force=false, q?: string, src: FuelStation[] = stations) => {
    const today = new Date().toISOString().split('T')[0];
    const hasKey = apiKey.trim().length > 0;
    const ck = `mf_analysis_${f}_${apiModel}_${hasKey ? 'ai' : 'local'}`;

    if (force && !q) localStorage.removeItem(ck);

    if (!force && !q) {
      const c = localStorage.getItem(ck);
      if (c) {
        const p = JSON.parse(c);
        if (p.date === today && p.analysis?.categories) {
          setMarketAnalyses(pr => ({ ...pr, [f]: { ...p.analysis, source: p.analysis.source || (hasKey ? 'ai' : 'local') } }));
          return;
        }
      }
    }

    setAnalysisLoading(true);
    setAiErr(null);
    let activeSrc = src;
    try {
      if (force && !q) {
        try {
          console.log('Force-refreshing stations from github raw before regenerating analysis...');
          const loc = userLoc || { lat: 45.4642, lng: 9.19 };
          const { stations: d, nationalStats: ns } = await getStations(loc, true);
          if (d && d.length > 0) {
            setStations(d);
            setNationalStats(ns);
            localStorage.setItem('mf_last_fetch_time', String(Date.now()));
            activeSrc = d;
          }
        } catch (e) {
          console.error('Failed to force-refresh stations during manual refresh:', e);
        }
      }

      const mStats = calculateMarketStats(activeSrc, f);

      let analysis: MarketAnalysis;
      if (!hasKey) {
        analysis = buildLocalMarketAnalysis(f, activeSrc, q);
        setAiErr(null);
      } else {
        // Il dossier: la stessa cosa che vede l'utente, non una riga di medie.
        const chiave = toFuelKey(f);
        const history = await loadHistory();
        const storico = (history[chiave] || []).slice(-30).map(pt => ({ date: pt.date, price: pt.avg }));

        const consigliato = f === fuel && homeModel?.best
          ? {
              nome: homeModel.best.row.name || homeModel.best.row.brand || 'il distributore consigliato',
              prezzo: homeModel.best.price,
              km: homeModel.best.distanceKm,
              risparmioEur: homeModel.best.net.net,
            }
          : null;

        const statsPieni = selCar ? computeStats(fillupsForCar(selCar.model), selCar.kml) : null;
        const vistaBudget = selCar ? computeBudget(selCar.model) : null;

        const dossier = buildAiContext({
          fuel: chiave,
          zona: mStats.sampleSize > 0
            ? { media: mStats.average, minimo: mStats.min, massimo: mStats.max, campione: mStats.sampleSize }
            : null,
          consigliato,
          storico,
          news: fuelNews,
          auto: selCar
            ? {
                modello: selCar.model,
                serbatoioL: selCar.liters,
                kml: selCar.kml,
                kmlReale: statsPieni?.realKml ?? undefined,
              }
            : null,
          budget: vistaBudget
            ? { mensile: vistaBudget.budget, speso: vistaBudget.spent, giorniRimasti: vistaBudget.daysLeft }
            : null,
          // I fatti di mercato valgono solo per il carburante che si sta
          // guardando: il modello e costruito su quello.
          mercato: f === fuel && marketModel
            ? {
                prov: marketModel.prov,
                deltaZonaItaliaC: marketModel.deltaZonaItaliaC,
                spreadC: marketModel.spreadC,
                autostradaC: marketModel.autostradaC,
                servitoC: marketModel.servitoC,
                marchiEconomici: marketModel.marchi.slice(0, 3).map((b) => ({ brand: b.brand, avg: b.avg })),
                frescoSuTotale: [marketModel.freschezza.recenti, marketModel.freschezza.totale],
              }
            : null,
        });

        analysis = await analyzeFuelMarket(apiKey, apiModel, f, q, dossier, storico, fuelNews);
      }

      if (q) {
        // domanda one-off: rotta verso aiAnswer separato, non sovrascrivere analisi giornaliera
        const answerText = analysis.detailedReport?.trim() || analysis.reasoning?.trim() || 'Nessuna risposta disponibile.';
        setAiAnswer({ question: q, answer: answerText, ts: Date.now(), source: (hasKey ? 'ai' : 'local') });
        return;
      }

      const enriched = { ...analysis, source: (hasKey ? 'ai' : 'local') as any, generatedAt: new Date().toISOString() };
      setMarketAnalyses(pr => ({ ...pr, [f]: enriched }));
      localStorage.setItem(ck, JSON.stringify({ date: today, analysis: enriched }));
    } catch (e: any) {
      console.error('Analysis error:', e);
      const spiegazione = e instanceof ErroreIa ? e.message : (e?.message || MESSAGGIO_ERRORE.UNKNOWN);
      if (q) {
        setAiAnswer({ question: q, answer: spiegazione, ts: Date.now(), source: hasKey ? 'ai' : 'local' });
      } else if (hasKey) {
        // Chiave configurata: niente ripiego silenzioso, l'utente deve sapere che l'IA non ha risposto.
        setAiErr(e instanceof ErroreIa && e.codice === 'MISSING_KEY' ? null : spiegazione);
      } else {
        // No API key: usa l'analisi locale come prima
        const fallback = buildLocalMarketAnalysis(f, activeSrc, q);
        setMarketAnalyses(pr => ({ ...pr, [f]: { ...fallback, source: 'local' } }));
        setAiErr(null);
      }
    } finally {
      setAnalysisLoading(false);
    }
  };

  // Lo storico lungo si carica una volta e non cambia piu.
  useEffect(() => {
    loadHistory().then((h) => {
      const chiave = toFuelKey(fuel);
      const punti = (h[chiave] || []).map((p) => ({ date: p.date, avg: p.avg }));
      setStoricoLungo(punti);
    });
  }, [fuel]);

  useEffect(() => { driveMode ? document.documentElement.dataset.drive='on' : delete document.documentElement.dataset.drive; }, [driveMode]);
  useEffect(() => { if (!userLoc || !initDone.current) return; fetchAnalysis(fuel, false, undefined, stations); }, [fuel, userLoc]);

  useEffect(() => {
    (async () => { try { const [nR, cR] = await Promise.all([fetch('news.json').then(r=>r.ok?r.json():[]).catch(()=>[]), fetch('cars.json').then(r=>r.json()).catch(()=>[])]); setFuelNews(normalizeFuelNews(nR)); const cd = Array.isArray(cR)?cR:[]; setCars(cd); const sid = localStorage.getItem('mf_car'); if (sid && cd.length) { const c = cd.find((x:any)=>x.model===sid); if (c) { setSelCar(c); if(c.liters) setTankL(c.liters); if(c.kml) setTripKml(c.kml); } } } catch {} })();
    const load = async (loc:{lat:number;lng:number}) => { 
      setLoading(true); 
      setAiErr(null); 
      try { 
        const {stations: d, nationalStats: ns} = await getStations(loc); 
        setStations(d); 
        setNationalStats(ns); 
        // Set loading false as soon as stations are ready to show UI quickly
        setLoading(false);
        initDone.current=true;
        
        // Fire off analysis in the background
        const fuels: FuelType[]=['Benzina','Diesel','GPL','Metano']; 
        Promise.all(fuels.map(f=>fetchAnalysis(f, false, undefined, d))); 
      } catch {
        setLoading(false);
        initDone.current=true;
      }
    };
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(p => { const l={lat:p.coords.latitude,lng:p.coords.longitude}; setUserLoc(l); load(l); }, () => { const l={lat:45.4642,lng:9.19}; setUserLoc(l); load(l); }, {enableHighAccuracy:true,timeout:10000});
    } else { const l={lat:45.4642,lng:9.19}; setUserLoc(l); load(l); }
    
    // Prompt per permessi notifiche all'avvio dopo 3 secondi di attesa (per evitare conflitti con geolocalizzazione GPS)
    setTimeout(() => {
      checkAndRequestStartupPermission();
    }, 3000);

    const sf = localStorage.getItem('mf_favs'); if (sf) setFavs(JSON.parse(sf));
    const sb = localStorage.getItem('mf_blocked'); if (sb) setBlockedIds(JSON.parse(sb));
    const sa = localStorage.getItem('mf_alerts'); if (sa) setAlerts(JSON.parse(sa));
  }, []);

  // I prezzi si riscaricano a ogni apertura: all'avvio ci pensa il negozio
  // dei dati, alla ripresa lo chiede avviaAggiornamentiAutomatici. Quando
  // arriva un dataset nuovo le schermate si ricalcolano.
  useEffect(() => {
    const negozio = datasetStore();
    let versioneVista = negozio.stato().versione;
    const smetti = negozio.iscriviti(() => {
      const v = negozio.stato().versione;
      if (v === versioneVista || !userLoc || !initDone.current) return;
      versioneVista = v;
      getStations(userLoc)
        .then(({ stations: d, nationalStats: ns }) => {
          if (d.length > 0) {
            setStations(d);
            setNationalStats(ns);
          }
        })
        .catch(() => { /* restano i dati gia a schermo */ });
    });
    const ferma = avviaAggiornamentiAutomatici(negozio);
    return () => { smetti(); ferma(); };
  }, [userLoc]);

  useEffect(() => { localStorage.setItem('mf_favs', JSON.stringify(favs)); }, [favs]);
  useEffect(() => { localStorage.setItem('mf_blocked', JSON.stringify(blockedIds)); }, [blockedIds]);
  useEffect(() => { localStorage.setItem('mf_alerts', JSON.stringify(alerts)); }, [alerts]);

  useEffect(() => {
    if (!stations.length) return;
    recordObservation(stations);
    checkPriceThresholds(alerts, stations);
  }, [stations, alerts]);

  useEffect(() => {
    const a = marketAnalyses[fuel];
    if (!a) return;
    checkDailyTrend(fuel, a);
  }, [marketAnalyses, fuel]);

  useEffect(() => {
    if (!stations.length) return;
    const allPrices = stations.flatMap(s => s.prices.filter(p => p.type === fuel).map(p => p.price)).filter(p => p > 0);
    if (!allPrices.length) return;
    const avg = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;
    checkBestDeal(fuel, stations, avg);
  }, [stations, fuel]);

  useEffect(() => {
    if (!selCar) return;
    checkPienoReminder(selCar.model, selCar.kml, selCar.liters);
    checkDeadlines(selCar.model);
    checkBudget(selCar.model);
  }, [selCar]);

  // Prima ogni spostamento della mappa riscaricava e ripassava l'intero
  // dataset per ricalcolare le distanze dal centro. Adesso le righe stanno
  // gia tutte in memoria e i marker vengono da mapModel: spostarsi non
  // deve ripassare 46.000 stazioni.
  const handleMapMove = (_c: {lat:number;lng:number}) => {};
  // Niente confirm(): nella WebView blocca il thread, e «[OK] nascondi /
  // [ANNULLA] segnala» faceva passare due azioni diverse per una conferma.
  const blockStation = (s: FuelStation) => setBlockTarget(s);

  const hideForMe = (s: FuelStation) => {
    setBlockedIds(prev => prev.includes(s.id) ? prev : [...prev, s.id]);
  };

  const reportToCommunity = (s: FuelStation) => {
    hideForMe(s);
    const body = encodeURIComponent(`ID Stazione: ${s.id}
Nome: ${s.name}
Città: ${s.city}
Indirizzo: ${s.address}

Motivo: Segnalata come CHIUSA o ERRATA dal proprietario.`);
    window.open(`https://github.com/martucc/Fuel-Now/issues/new?title=%5BBLOCCHIAMO%5D+Stazione+${s.id}&body=${body}`, '_blank');
  };

  const handleSaveHome = (address: string, loc: { lat: number; lng: number }) => {
    setHomeAddress(address);
    setHomeLoc(loc);
    localStorage.setItem('mf_home_address', address);
    localStorage.setItem('mf_home_loc', JSON.stringify(loc));
  };

  const handleRemoveHome = () => {
    setHomeAddress('');
    setHomeLoc(null);
    setHomeMode(false);
    localStorage.removeItem('mf_home_address');
    localStorage.removeItem('mf_home_loc');
    localStorage.setItem('mf_home_mode', '0');
  };

  const handleSetHomeMode = (active: boolean) => {
    setHomeMode(active);
    localStorage.setItem('mf_home_mode', active ? '1' : '0');
  };

  const handleNavigateHome = useCallback((station: RankedStation) => {
    if (!userLoc || !homeLoc) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&origin=${userLoc.lat},${userLoc.lng}&destination=${homeLoc.lat},${homeLoc.lng}&waypoints=${station.row.lat},${station.row.lng}`,
      '_blank',
      'noreferrer'
    );
  }, [userLoc, homeLoc]);

  const handleSelectCar = (car:any) => { setSelCar(car); if(car.liters) setTankL(car.liters); if(car.kml) setTripKml(car.kml); localStorage.setItem('mf_car', car.model); };

  const geocode = async (q:string) => { const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=it&accept-language=it`); const d = await r.json(); if (!d.length) throw new Error(`Non trovato: ${q}`); return {lat:parseFloat(d[0].lat),lng:parseFloat(d[0].lon),label:d[0].display_name}; };
  const calcTrip = async () => {
    if (!tripStart||!tripEnd) { setTripStatus('Inserisci partenza e arrivo'); return; }
    setTripStatus('Calcolo percorso...');
    try {
      const s = await geocode(tripStart), e = await geocode(tripEnd);
      const rr = await fetch(`https://router.project-osrm.org/route/v1/driving/${s.lng},${s.lat};${e.lng},${e.lat}?overview=full&geometries=geojson`);
      const rd = await rr.json(); if (!rd.routes?.length) throw new Error('Percorso non trovato');
      const coords: [number, number][] = rd.routes[0].geometry.coordinates; // [lng, lat]
      const route = {distanceKm:rd.routes[0].distance/1000, durationMin:rd.routes[0].duration/60, coords, start:s, end:e};
      setTripRoute(route); setTripDist(Math.round(route.distanceKm)); setTripStatus('');

      const kpl = tripUnit==='kml' ? tripKml : 100/tripKml;
      const startLiters = tripCurrentFuel == null ? tankL : Math.max(0, Math.min(tankL, tripCurrentFuel));

      const stops: any[] = [];
      let enriched: { st: any; dist: number; progress: number; price: number }[] = [];
      if (activeStations.length > 0) {
        // Haversine raw (no rounding)
        const hav = (lat1: number, lng1: number, lat2: number, lng2: number) => {
          const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
          const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        };

        // Sample percorso (max ~200 punti) con progresso cumulato
        const stride = Math.max(1, Math.floor(coords.length / 200));
        const samples: { lat: number; lng: number; progressKm: number }[] = [];
        let acc = 0, lastLat = coords[0][1], lastLng = coords[0][0];
        samples.push({ lat: lastLat, lng: lastLng, progressKm: 0 });
        for (let i = 1; i < coords.length; i++) {
          const [lng, lat] = coords[i];
          acc += hav(lastLat, lastLng, lat, lng);
          lastLat = lat; lastLng = lng;
          if (i % stride === 0) samples.push({ lat, lng, progressKm: acc });
        }

        // Bounding box (con padding) per filtro veloce
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        for (const sm of samples) {
          if (sm.lat < minLat) minLat = sm.lat;
          if (sm.lat > maxLat) maxLat = sm.lat;
          if (sm.lng < minLng) minLng = sm.lng;
          if (sm.lng > maxLng) maxLng = sm.lng;
        }
        const pad = 0.1; // ~10km
        minLat -= pad; maxLat += pad; minLng -= pad; maxLng += pad;

        // Per ogni stazione nel BB, calcola distFromRoute + progressKm
        for (const st of activeStations) {
          const lat = st.location.lat, lng = st.location.lng;
          if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) continue;
          const pr = st.prices.find(pp => pp.type === fuel)?.price || 0;
          if (pr <= 0) continue;
          let bestD = Infinity, bestProg = 0;
          for (const sm of samples) {
            const d = hav(sm.lat, sm.lng, lat, lng);
            if (d < bestD) { bestD = d; bestProg = sm.progressKm; }
          }
          if (bestD > 3) continue; // max 3km dal tragitto
          enriched.push({ st, dist: bestD, progress: bestProg, price: pr });
        }
      }

      const nearbyArr = enriched
        .map(x => ({ ...x.st, routeProgressKm: x.progress, routeDetourKm: x.dist }))
        .sort((a, b) => a.routeProgressKm - b.routeProgressKm);
      setTripNearby(nearbyArr);

      // La strategia non pesa piu punteggi arbitrari: decide solo quanto sei
      // disposto a uscire dal percorso. Dove fermarsi lo dice il piano.
      const deviazioneMax = tripStrat === 'save' ? 3 : tripStrat === 'fast' ? 0.7 : 1.6;

      const righeIndex = new Map(getRows().map((r) => [r.id, r]));
      const candidate: TappaCandidata[] = enriched
        .filter((x) => x.dist <= deviazioneMax)
        .map((x) => {
          const riga = righeIndex.get(x.st.id);
          const coorte = riga ? cohortFor(riga, toFuelKey(fuel), cohorts) : null;
          const livello = coorte ? levelForZ(zScore(x.price, coorte)) : 'normal';
          return {
            id: x.st.id,
            nome: x.st.name || x.st.brand,
            brand: x.st.brand || 'Indipendente',
            prezzo: x.price,
            level: livello,
            kmDaPartenza: x.progress,
            deviazioneKm: x.dist,
          };
        });

      const piano = pianificaViaggio({
        distanzaKm: route.distanceKm,
        kml: kpl,
        serbatoioL: tankL,
        litriAdesso: startLiters,
        candidate,
        prezzoPartenza: Number.isFinite(cheapP) ? cheapP : null,
      });
      setTripPiano(piano);

      // Le soste sulla mappa sono quelle del piano, non piu una lista a parte.
      const perId = new Map(nearbyArr.map((x: any) => [x.id, x]));
      for (const sosta of piano.soste) {
        const st = perId.get(sosta.tappa.id);
        if (st) stops.push(st);
      }
      setTripStops(stops);

      setTripCalc(true);
    } catch (e:any) { setTripStatus(e.message); }
  };



  // Le coorti si costruiscono sul dataset intero: una stazione di Bolzano
  // serve a dire se un prezzo di Bolzano e caro, anche se l'utente e a Roma.
  const cohorts = useMemo(() => buildCohorts(getRows()), [stations]);

  // Il percorso si chiede solo in modalita rientro, e una volta sola per
  // ogni coppia posizione-casa: la cache del servizio arrotonda a cento
  // metri, cosi il tremolio del GPS non ribatte al router.
  useEffect(() => {
    if (!homeMode || !homeLoc || !userLoc) {
      setPercorsoCasa(null);
      return;
    }
    const gia = percorsoInCache(userLoc, homeLoc);
    if (gia) {
      setPercorsoCasa(gia);
      return;
    }
    const ctrl = new AbortController();
    chiediPercorso(userLoc, homeLoc, ctrl.signal).then((p) => {
      if (!ctrl.signal.aborted) setPercorsoCasa(p);
    });
    return () => ctrl.abort();
  }, [homeMode, homeLoc, userLoc]);

  const homeModel = useMemo(() => {
    const data = getRawDataset();
    const rows = getRows();
    if (!data || rows.length === 0 || !userLoc) return null;
    return buildHomeModel({
      rows,
      cohorts,
      dataset: data,
      fuel: toFuelKey(fuel),
      user: userLoc,
      home: homeMode && homeLoc ? homeLoc : null,
      homeAddress: homeAddress || null,
      homeMode: homeMode && Boolean(homeLoc),
      percorso: homeMode ? percorsoCasa : null,
      now: new Date(),
      liters: litersFor(selCar),
      kml: kmlFor(selCar, toFuelKey(fuel), null),
      blocked: new Set(blockedIds),
      radiusKm: radius,
      tankPct: null,
    });
  }, [cohorts, stations, fuel, userLoc, selCar, blockedIds, radius, homeMode, homeLoc, homeAddress, percorsoCasa]);

  // Il migliore e quello col netto piu alto, non col prezzo piu basso.
  const cheapP = homeModel?.best?.price ?? Infinity;

  // Quanto sono vecchi i prezzi mostrati, presi alla fonte. Conta soprattutto
  // al primo avvio senza rete, quando in mano c'e il seme impacchettato.
  const freschezzaDati = useMemo(
    () => descriviDati(getRawDataset(), new Date()),
    [stations]
  );

  // Il diario del consiglio: senza, fra un mese non si sa piu cosa l'app
  // aveva detto ne a quanto stava la media di quel giorno, e il risparmio
  // vero diventa impossibile da misurare.
  useEffect(() => {
    const b = homeModel?.best;
    if (!b) return;
    registraConsiglio({
      date: new Date().toISOString().slice(0, 10),
      fuel: toFuelKey(fuel),
      stationId: b.row.id,
      stationName: b.row.name || b.row.brand,
      price: b.price,
      cohortAvg: b.cohort.avg,
      netEur: b.net.net,
    });
  }, [homeModel, fuel]);

  // Il widget sulla schermata home mostra questo, non un calcolo suo: e
  // l'unico modo perche i due schermi indichino lo stesso distributore.
  useEffect(() => {
    pubblicaWidget(homeModel, toFuelKey(fuel), userLoc);
  }, [homeModel, fuel, userLoc]);

  const marketModel = useMemo(() => {
    const data = getRawDataset();
    const rows = getRows();
    if (!data || rows.length === 0 || !userLoc) return null;
    return buildMarketModel({
      rows,
      cohorts,
      dataset: data,
      fuel: toFuelKey(fuel),
      user: userLoc,
      now: new Date(),
      liters: litersFor(selCar),
      kml: kmlFor(selCar, toFuelKey(fuel), null),
      blocked: new Set(blockedIds),
      radiusKm: radius,
      storicoLungo,
    });
  }, [cohorts, stations, fuel, userLoc, selCar, blockedIds, radius, storicoLungo]);

  const marketRef = marketAnalyses[fuel] || null;
  const isLocal = marketRef?.source !== 'ai';
  
  const allBrands = useMemo(() => {
    return [...new Set(stations.map(s=>s.brand))].filter(Boolean).sort();
  }, [stations]);

  // Niente piu cap silenzioso: ogni impianto finisce in un gruppo, e il
  // gruppo dichiara quanti ne contiene.
  // La mappa mostra l'Italia intera, non il raggio della Home: stesso
  // modello, senza limite di distanza.
  const mapModel = useMemo(() => {
    const data = getRawDataset();
    const rows = getRows();
    if (!data || rows.length === 0 || !userLoc) return null;
    return buildHomeModel({
      rows,
      cohorts,
      dataset: data,
      fuel: toFuelKey(fuel),
      user: userLoc,
      now: new Date(),
      liters: litersFor(selCar),
      kml: kmlFor(selCar, toFuelKey(fuel), null),
      blocked: new Set(blockedIds),
      radiusKm: Number.POSITIVE_INFINITY,
      tankPct: null,
    });
  }, [cohorts, stations, fuel, userLoc, selCar, blockedIds]);

  /*
    Quante targhette disegnare, secondo lo zoom. E la scaletta di giugno.

    Non e un raggruppamento: e una selezione. La lista si ordina per prezzo e
    si tengono le prime N — quindi allargando la vista non compaiono gruppi
    con «+3» accanto, spariscono semplicemente i piu cari e restano i piu
    economici. Guardando l'Italia intera resta una targhetta sola: la piu
    conveniente che si vede.
  */
  const zoomLimit =
    mapZoom >= 15 ? 150 :
    mapZoom >= 13 ? 80 :
    mapZoom >= 11 ? 25 :
    mapZoom >= 9 ? 8 :
    mapZoom >= 7 ? 4 :
    mapZoom >= 5 ? 2 : 1;

  const clusters = useMemo(() => {
    // Solo impianti utilizzabili: chi supera i quattro scarti tipo e quasi
    // sempre un dato sbagliato, e ordinando per prezzo finirebbe proprio
    // lui in cima alla mappa.
    const items = (mapModel?.list ?? []).filter((i) => i.eligible);
    // Senza i confini della vista non si disegna niente: a zoom 13 su tutta
    // Italia significherebbe diciassettemila targhette nel DOM. I confini
    // arrivano al montaggio della mappa, un attimo dopo.
    if (!mapBounds) return { list: [], totale: 0 };
    const sw = mapBounds.getSouthWest();
    const ne = mapBounds.getNorthEast();
    // Un decimo di margine oltre il bordo, cosi trascinando le targhette
    // sono gia li invece di comparire dopo.
    const latPad = (ne.lat - sw.lat) * 0.1;
    const lngPad = (ne.lng - sw.lng) * 0.1;
    const inView = items.filter(
      (i) =>
        i.lat >= sw.lat - latPad && i.lat <= ne.lat + latPad &&
        i.lng >= sw.lng - lngPad && i.lng <= ne.lng + lngPad
    );

    const tenuti = [...inView].sort((a, b) => a.price - b.price).slice(0, zoomLimit);

    return {
      list: tenuti.map((i) => ({
        bestId: i.id,
        brand: i.brand,
        name: i.name,
        lat: i.lat,
        lng: i.lng,
        bestPrice: i.price,
        bestNet: i.net,
        level: i.level,
        count: 1,
        members: [i],
      })),
      totale: inView.length,
    };
  }, [mapModel, mapBounds, zoomLimit]);

  const minPriceInView = useMemo(() => {
    if (!clusters || clusters.list.length === 0) return null;
    const valid = clusters.list.map((c) => c.bestPrice).filter((p) => p > 0);
    return valid.length > 0 ? Math.min(...valid) : null;
  }, [clusters]);

  // Si cerca fra TUTTE le righe, non solo fra quelle vicine: sulla mappa
  // si puo toccare un impianto dall'altra parte d'Italia.
  // Il comune dell'impianto piu vicino: basta a dire dove siamo e non
  // costa una chiamata di geocodifica inversa.
  const userCity = useMemo(() => {
    const vicini = homeModel?.list;
    if (!vicini || vicini.length === 0) return null;
    let best = vicini[0]!;
    for (const v of vicini) if (v.distanceKm < best.distanceKm) best = v;
    return best.city || null;
  }, [homeModel]);

  /**
   * «Perche questo?» raccontato a parole.
   *
   * Le righe del foglio restano la verita — sono il conto, voce per voce.
   * Questa e solo un'altra voce che le legge, e riceve esattamente quei
   * numeri: cosi non puo raccontare una storia diversa da quella che
   * l'utente ha davanti.
   */
  const spiegaScelta = useCallback(async (best: RankedStation): Promise<string> => {
    const n = best.net;
    const dettaglio = [
      `Impianto scelto: ${best.row.brand || best.row.name}, ${best.row.city}, a ${best.distanceKm.toFixed(1)} km in linea d'aria.`,
      `Prezzo qui ${best.price.toFixed(3)} euro al litro, media della sua coorte di confronto ${n.cohortAvg.toFixed(3)}.`,
      `Sul pieno considerato di ${n.liters.toFixed(0)} litri il risparmio lordo e ${n.gross.toFixed(2)} euro.`,
      `Andata e ritorno sono ${(n.distanceKm * 2).toFixed(1)} km e a ${n.kml.toFixed(1)} km/l costano ${n.roadCost.toFixed(2)} euro di carburante.`,
      `Il prezzo e stato comunicato ${describeAge(best.ageH)}, quindi il risparmio lordo viene pesato al ${(n.confidence * 100).toFixed(0)}%.`,
      `Netto che resta in tasca: ${n.net.toFixed(2)} euro.`,
      `Livello del prezzo rispetto alla zona: ${best.level}.`,
    ].join(' ');

    const dossier = [
      buildAiContext({
        fuel: toFuelKey(fuel),
        zona: null,
        consigliato: {
          nome: best.row.brand || best.row.name,
          prezzo: best.price,
          km: best.distanceKm,
          risparmioEur: n.net,
        },
        storico: [],
        news: [],
        auto: selCar ? { modello: selCar.model, serbatoioL: selCar.liters, kml: selCar.kml } : null,
        budget: null,
      }),
      'Dettaglio del calcolo, riga per riga, come lo vede l\'utente in questo momento:',
      dettaglio,
    ].join('\n');

    const domanda =
      'Spiegami perche l\'app mi manda proprio qui. Due o tre frasi, non paragrafi, ' +
      'usando i numeri del dettaglio e non altri. Se il vantaggio e piccolo dillo, ' +
      'e se il viaggio si mangia buona parte del risparmio dillo pure.';

    const risposta = await analyzeFuelMarket(apiKey, apiModel, fuel, domanda, dossier);
    const testo = (risposta.detailedReport || '').trim() || (risposta.reasoning || '').trim();
    if (!testo) throw new ErroreIa('PARSE', MESSAGGIO_ERRORE.PARSE);
    return testo;
  }, [apiKey, apiModel, fuel, selCar]);

  const openStationById = useCallback((id: string) => {
    const vicina = stations.find((x) => x.id === id);
    if (vicina) { setStationDetail(vicina); return; }
    const riga = getRows().find((r) => r.id === id);
    if (riga) setStationDetail(toFuelStation(riga, userLoc ?? undefined));
  }, [stations, userLoc]);

  // @ts-ignore - tabs is intended for future menu expansions or logging
  const tabs: {id:TabType;icon:any;label:string}[] = [{id:'home',icon:Home,label:'Home'},{id:'map',icon:MapPin,label:'Mappa'},{id:'trip',icon:Route,label:'Trip'},{id:'veicolo',icon:Car,label:'Garage'},{id:'analysis',icon:BarChart3,label:'Intel'},{id:'pieno',icon:Target,label:'Pieno'}];

  return (
    <div className="min-h-screen bg-black text-[#f5f5f7] font-sans">
      <AnimatePresence>
        {showSplash && <SplashScreen key="splash" />}
      </AnimatePresence>

      <AnimatePresence>
        {blockTarget && (
          <BlockSheet
            stationName={blockTarget.city || blockTarget.name}
            onHide={() => { hideForMe(blockTarget); setBlockTarget(null); }}
            onReport={() => { reportToCommunity(blockTarget); setBlockTarget(null); }}
            onClose={() => setBlockTarget(null)}
          />
        )}
      </AnimatePresence>
      {/* Header / Top Bar */}
      <header
        className="fixed top-0 left-0 right-0 z-[1000] px-5 pb-3 flex items-center justify-between gap-3"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
          background: 'color-mix(in srgb, var(--mf-ground) 82%, transparent)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--mf-hairline)',
        }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <h1
            className="flex-shrink-0"
            style={{ fontFamily: 'var(--mf-font-sans)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.03em', color: 'var(--mf-ink)' }}
          >
            Martucc<span style={{ color: 'var(--mf-accent)' }}>Fuel</span>
          </h1>
          {/* La posizione: da lei dipende ogni numero della schermata, e
              prima non era scritta da nessuna parte. */}
          <span
            className="flex min-w-0 items-center gap-1.5 px-2.5 py-1"
            style={{
              borderRadius: 'var(--mf-radius-pill)',
              border: '1px solid var(--mf-hairline)',
              color: 'var(--mf-ink-2)',
              fontFamily: 'var(--mf-font-sans)',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <MapPin size={11} className="flex-shrink-0" />
            <span className="truncate" style={{ maxWidth: 96 }}>{userCity ?? 'posizione…'}</span>
          </span>
        </div>

        <div className="flex flex-shrink-0 items-center gap-0.5">
          <InstallPwaButton />
          <button
            onClick={() => setShowBudget(true)}
            className="p-2 transition-transform active:scale-90"
            aria-label="Calcolatore budget"
          >
            <Calculator size={18} style={{ color: 'var(--mf-ink-2)' }} />
          </button>
          <button
            onClick={() => setTab('alerts')}
            className="relative p-2 transition-transform active:scale-90"
            aria-label="Allerte"
          >
            <Bell size={18} style={{ color: alerts.filter(a => a.active).length > 0 ? 'var(--mf-accent)' : 'var(--mf-ink-2)' }} />
            {alerts.filter(a => a.active).length > 0 && (
              <span
                className="mf-num absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center px-1"
                style={{
                  borderRadius: 'var(--mf-radius-pill)',
                  background: 'var(--mf-accent)',
                  color: 'var(--mf-accent-ink)',
                  fontSize: 9,
                  fontWeight: 700,
                }}
              >
                {alerts.filter(a => a.active).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 transition-transform active:scale-90"
            aria-label="Impostazioni"
          >
            <Settings size={18} style={{ color: 'var(--mf-ink-2)' }} />
          </button>
        </div>
      </header>
 
      {/* Content Area */}
      <div className="min-h-screen overflow-y-auto no-scrollbar" onScroll={handleScroll} style={{ paddingTop: 'calc(env(safe-area-inset-top) + 80px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 90px)' }}>
        <AnimatePresence mode="wait" custom={direction}>
          {tab === 'map' ? (
            <motion.div
              key="map"
              variants={mapPageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed inset-0 z-[10]"
              style={{ top: 'calc(env(safe-area-inset-top) + 80px)', bottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}
            >
              {/* Quanti impianti la vista sta lasciando fuori. Il vecchio
                  zoomLimit tagliava in silenzio e a zoom basso mostrava due
                  pompe come se fossero tutte. */}
              {!heatmapOn && clusters.totale > clusters.list.length && (
                <div
                  className="mf-num absolute left-1/2 top-4 z-[600] -translate-x-1/2 px-3 py-1.5"
                  style={{
                    background: 'color-mix(in srgb, var(--mf-surface-raised) 85%, transparent)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid var(--mf-hairline)',
                    borderRadius: 'var(--mf-radius-pill)',
                    color: 'var(--mf-ink-2)',
                    fontSize: 11,
                    whiteSpace: 'nowrap',
                  }}
                >
                  i {clusters.list.length} più economici di {clusters.totale} · colori sulla media {fuel.toLowerCase()}
                </div>
              )}
              <MainMapLibre
                userLoc={userLoc}
                clusters={clusters}
                bestStationId={homeModel?.best?.row.id}
                minPriceInView={minPriceInView}
                mediaRiferimento={allAverages[fuel] === Infinity ? null : allAverages[fuel]}
                mapZoom={mapZoom}
                mapStyle={mapStyle}
                heatmapOn={heatmapOn}
                onMove={handleMapMove}
                onZoom={setMapZoom}
                onBoundsChange={setMapBounds}
                onStationClick={openStationById}
                onToggleStyle={() => setMapStyle((s) => (s === 'dark' ? 'voyager' : 'dark'))}
                onToggleHeatmap={() => setHeatmapOn((v) => !v)}
              />
            </motion.div>
          ) : (
            <motion.div
              key={tab}
              custom={direction}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <main className="max-w-md mx-auto px-4 pt-4 relative overflow-hidden">
                {tab==='home' && (
                  <HomeTab
                    model={homeModel}
                    loading={loading}
                    fuel={toFuelKey(fuel)}
                    setFuel={(k) => setFuel(toFuelType(k))}
                    radius={radius}
                    setRadius={setRadius}
                    onOpenMap={() => setTab('map')}
                    onOpenFilters={() => setShowFilters(true)}
                    onStationClick={openStationById}
                    aiNote={marketRef?.source === 'ai' ? marketRef.reasoning : null}
                    onSpiega={apiKey.trim() ? spiegaScelta : undefined}
                    onImpostazioni={() => setShowSettings(true)}
                    datiStantii={freschezzaDati.stantio ? freschezzaDati.etichetta : null}
                    homeMode={homeMode}
                    setHomeMode={handleSetHomeMode}
                    homeAddress={homeAddress}
                    onOpenHomeAddressModal={() => setShowHomeAddressModal(true)}
                    onNavigateHome={handleNavigateHome}
                  />
                )}
                {tab==='trip' && <TripTab tripStart={tripStart} setTripStart={setTripStart} tripEnd={tripEnd} setTripEnd={setTripEnd} tripKml={tripKml} setTripKml={setTripKml} tripUnit={tripUnit} setTripUnit={setTripUnit} tankLiters={tankL} setTankLiters={setTankL} tripStrategy={tripStrat} setTripStrategy={setTripStrat} tripStatus={tripStatus} tripDist={tripDist} tripCalculated={tripCalc} tripRoute={tripRoute} tripStops={tripStops} selectedFuel={fuel} cheapestPrice={cheapP} calculateTripRoute={calcTrip} userLoc={userLoc} stations={activeStations} tripCurrentFuel={tripCurrentFuel} setTripCurrentFuel={setTripCurrentFuel} tripToll={tripToll} setTripToll={setTripToll} tripNearby={tripNearby} onStationClick={setStationDetail} mapStyle={mapStyle} piano={tripPiano}/>}
                {tab==='veicolo' && (
                  <AutoTab
                    cars={cars}
                    selectedCar={selCar}
                    setSelectedCar={setSelCar}
                    carSearchQuery={carQ}
                    setCarSearchQuery={setCarQ}
                    handleSelectCar={handleSelectCar}
                    setTab={setTab}
                    stations={activeStations}
                    selectedFuel={fuel}
                    userLoc={userLoc}
                  />
                )}
                {tab==='analysis' && (
                  <AnalysisTab
                    model={marketModel}
                    marketRef={marketRef}
                    selectedFuel={fuel}
                    setSelectedFuel={setFuel}
                    apiKey={apiKey}
                    analysisLoading={analysisLoading}
                    userQuestion={userQ}
                    setUserQuestion={setUserQ}
                    analysisIsLocal={isLocal}
                    fetchAnalysis={fetchAnalysis}
                    setShowSettings={setShowSettings}
                    tankLiters={litersFor(selCar)}
                    aiAnswer={aiAnswer}
                    clearAiAnswer={() => setAiAnswer(null)}
                    aiError={aiErr}
                    clearAiError={() => setAiErr(null)}
                    freschezzaDati={freschezzaDati.etichetta}
                  />
                )}
                {tab==='alerts' && <AlertsTab selectedFuel={fuel} alerts={alerts} setAlerts={setAlerts}/>}
              </main>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tab Bar */}
      {/* La barra sta a z-index 1000 e lo splash a 100: senza questa
          condizione le cinque schede restavano in vista sopra lo schermo di
          apertura, cioe su una app che non si poteva ancora usare. */}
      <BottomNav activeTab={tab} onTabChange={handleTabChange} visible={showBottomNav && !showSplash} />

      <FiltersModal show={showFilters} setShow={setShowFilters} selectedBrands={brands} setSelectedBrands={setBrands} selectedServices={services} setSelectedServices={setServices} h24={h24} setH24={setH24} noHighway={noHwy} setNoHighway={setNoHwy} hideAnomalies={hideAnom} setHideAnomalies={setHideAnom} radius={radius} setRadius={setRadius} brands={allBrands}/>
      <SettingsModal show={showSettings} setShow={setShowSettings} apiKey={apiKey} setApiKey={setApiKey} apiModel={apiModel} setApiModel={setApiModel} homeAddress={homeAddress} onOpenHomeAddressModal={() => setShowHomeAddressModal(true)}/>
      <HomeAddressModal show={showHomeAddressModal} onClose={() => setShowHomeAddressModal(false)} currentAddress={homeAddress} currentLoc={homeLoc} userLoc={userLoc} onSave={handleSaveHome} onRemove={handleRemoveHome}/>
      <BudgetCalcModal show={showBudget} onClose={() => setShowBudget(false)} fuel={fuel} defaultPrice={allAverages[fuel] === Infinity ? 0 : (allAverages[fuel] || 0)} carKml={selCar?.kml} tankL={selCar?.liters || tankL}/>
      <StationHistoryModal station={stationDetail} fuel={fuel} onClose={() => setStationDetail(null)} onBlock={blockStation}/>
    </div>
  );
}
