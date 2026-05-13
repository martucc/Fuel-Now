import type { Alert, FuelStation, FuelType, MarketAnalysis } from '../types';

export type NotifCategory = 'priceThresholds' | 'dailyTrend' | 'bestDealZone' | 'pienoReminder';

export interface NotifPrefs {
  enabled: boolean;
  categories: Record<NotifCategory, boolean>;
  lastNotified: Record<string, number>;
  lastTrendDay: Record<string, string>;
}

const PREFS_KEY = 'mf_notif_prefs_v1';
const COOLDOWN_MS = 18 * 3600_000;

const DEFAULTS: NotifPrefs = {
  enabled: false,
  categories: {
    priceThresholds: true,
    dailyTrend: true,
    bestDealZone: false,
    pienoReminder: false,
  },
  lastNotified: {},
  lastTrendDay: {},
};

export function loadPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw);
    return {
      ...DEFAULTS,
      ...p,
      categories: { ...DEFAULTS.categories, ...(p.categories || {}) },
      lastNotified: p.lastNotified || {},
      lastTrendDay: p.lastTrendDay || {},
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(p: NotifPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  try { window.dispatchEvent(new CustomEvent('mf-notif-prefs')); } catch {}
}

export function permissionState(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export async function requestPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

async function show(title: string, body: string, tag?: string, icon?: string) {
  const ICON = icon || '/icon-192x192.png';
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, { body, tag, icon: ICON, badge: ICON, silent: false });
        return true;
      }
    }
    new Notification(title, { body, tag, icon: ICON });
    return true;
  } catch {
    return false;
  }
}

export async function fire(category: NotifCategory, key: string, title: string, body: string, opts?: { force?: boolean }) {
  const prefs = loadPrefs();
  if (!prefs.enabled || !prefs.categories[category]) return false;
  const fullKey = `${category}:${key}`;
  const last = prefs.lastNotified[fullKey] || 0;
  if (!opts?.force && Date.now() - last < COOLDOWN_MS) return false;
  const ok = await show(title, body, fullKey);
  if (ok) {
    prefs.lastNotified[fullKey] = Date.now();
    savePrefs(prefs);
  }
  return ok;
}

export async function fireTest() {
  return show('MartuccFuel · Test', 'Le notifiche sono attive. Ti avviseremo quando serve.', 'test');
}

const FUEL_EMOJI: Record<FuelType, string> = { Benzina: '⛽', Diesel: '🛢️', GPL: '💨', Metano: '🔵' };

export async function checkPriceThresholds(alerts: Alert[], stations: FuelStation[]) {
  const prefs = loadPrefs();
  if (!prefs.enabled || !prefs.categories.priceThresholds) return;
  for (const al of alerts) {
    if (!al.active) continue;
    let triggered: { station: FuelStation; price: number } | null = null;
    for (const s of stations) {
      const fp = s.prices.find(p => p.type === al.fuelType);
      if (!fp || !fp.price) continue;
      if (fp.price <= al.threshold) {
        if (!triggered || fp.price < triggered.price) triggered = { station: s, price: fp.price };
      }
    }
    if (triggered) {
      const key = `${al.id}`;
      await fire(
        'priceThresholds',
        key,
        `${FUEL_EMOJI[al.fuelType]} ${al.fuelType} sotto €${al.threshold.toFixed(3)}`,
        `${triggered.station.brand || triggered.station.name} · €${triggered.price.toFixed(3)}/L · ${triggered.station.city}`,
      );
    }
  }
}

export async function checkDailyTrend(fuel: FuelType, analysis: MarketAnalysis | undefined) {
  const prefs = loadPrefs();
  if (!prefs.enabled || !prefs.categories.dailyTrend) return;
  if (!analysis?.historicalData || analysis.historicalData.length < 2) return;
  const today = new Date().toISOString().slice(0, 10);
  if (prefs.lastTrendDay[fuel] === today) return;
  const hist = analysis.historicalData;
  const last = hist[hist.length - 1];
  const prev = hist[hist.length - 2];
  if (!last || !prev) return;
  const delta = last.price - prev.price;
  const pct = (delta / prev.price) * 100;
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  const direction = delta > 0 ? 'in salita' : delta < 0 ? 'in discesa' : 'stabile';
  const ok = await fire(
    'dailyTrend',
    `${fuel}:${today}`,
    `${arrow} ${fuel} ${direction}`,
    `Media oggi €${last.price.toFixed(3)}/L · ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% vs ieri`,
    { force: true },
  );
  if (ok) {
    prefs.lastTrendDay[fuel] = today;
    savePrefs(prefs);
  }
}

export async function checkBestDeal(fuel: FuelType, stations: FuelStation[], avgPrice: number) {
  const prefs = loadPrefs();
  if (!prefs.enabled || !prefs.categories.bestDealZone || !avgPrice || avgPrice === Infinity) return;
  let best: { s: FuelStation; price: number } | null = null;
  for (const s of stations) {
    const fp = s.prices.find(p => p.type === fuel);
    if (!fp || !fp.price) continue;
    if (!best || fp.price < best.price) best = { s, price: fp.price };
  }
  if (!best) return;
  const saving = avgPrice - best.price;
  const savingPct = (saving / avgPrice) * 100;
  if (savingPct < 4) return;
  const key = `${best.s.id}:${new Date().toISOString().slice(0, 10)}`;
  await fire(
    'bestDealZone',
    key,
    `🔥 Offerta ${fuel} in zona`,
    `${best.s.brand || best.s.name} · €${best.price.toFixed(3)} (-${savingPct.toFixed(1)}% vs media)`,
  );
}

export async function checkPienoReminder(carModel: string | undefined, kml: number | undefined, tankL: number | undefined) {
  const prefs = loadPrefs();
  if (!prefs.enabled || !prefs.categories.pienoReminder) return;
  if (!carModel || !kml || !tankL) return;
  try {
    const raw = localStorage.getItem('mf_fillups_v1');
    if (!raw) return;
    const all = JSON.parse(raw);
    const fills = (all as any[]).filter(f => f.carModel === carModel).sort((a, b) => a.odometer - b.odometer);
    if (fills.length < 2) return;
    const lastFull = [...fills].reverse().find(f => f.full);
    if (!lastFull) return;
    const daysSince = (Date.now() - new Date(lastFull.date).getTime()) / 86400_000;
    if (daysSince < 7) return;
    const fulls = fills.filter(f => f.full);
    if (fulls.length < 2) return;
    const first = fulls[0];
    const last = fulls[fulls.length - 1];
    const daysSpan = Math.max(1, (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400_000);
    const kmSpan = last.odometer - first.odometer;
    const kmPerDay = kmSpan / daysSpan;
    if (kmPerDay <= 0) return;
    const kmSinceLast = kmPerDay * daysSince;
    const litersUsed = kmSinceLast / kml;
    const tankPct = litersUsed / tankL;
    if (tankPct < 0.75) return;
    await fire(
      'pienoReminder',
      `${carModel}:${new Date().toISOString().slice(0, 10)}`,
      `⛽ Probabile riserva`,
      `Stimati ~${Math.round((1 - tankPct) * 100)}% serbatoio · ${Math.round(kmSinceLast)} km dall'ultimo pieno`,
    );
  } catch { /* ignore */ }
}
