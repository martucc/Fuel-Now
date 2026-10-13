import { Preferences } from '@capacitor/preferences';
import type { HomeModel } from '../ui/home/homeModel';
import type { FuelKey } from '../domain/raw';
import type { LatLng } from '../domain/geo';
import { componiIstantanea } from '../domain/widget';

/**
 * Il ponte verso la schermata home di Android.
 *
 * Capacitor scrive le sue Preferences nelle SharedPreferences chiamate
 * «CapacitorStorage», che i widget nativi leggono direttamente: e tutto il
 * meccanismo. Qui non c'e logica, solo il deposito — cosa dire lo decide
 * domain/widget.ts, che si puo provare senza un telefono.
 */

/** Quante pompe passa al Radar. Oltre cinque non ci stanno in pianta. */
const VICINE = 5;

export async function pubblicaWidget(
  model: HomeModel | null,
  fuel: FuelKey,
  user: LatLng | null,
  now: Date = new Date()
): Promise<void> {
  try {
    const istantanea = componiIstantanea(model, fuel, now);

    const coppie: [string, string][] = Object.entries(istantanea);

    // Servono al sincronizzatore nativo per rifare i conti da solo quando
    // l'app resta chiusa per ore.
    if (user) {
      coppie.push(['mf_widget_user_lat', String(user.lat)]);
      coppie.push(['mf_widget_user_lng', String(user.lng)]);
    }
    coppie.push(['mf_widget_fuel_type', fuel]);
    coppie.push(['mf_widget_nearby_stations', JSON.stringify(vicine(model))]);

    for (const [key, value] of coppie) {
      await Preferences.set({ key, value });
    }
  } catch (err) {
    // Sul web non esistono widget: fallire qui non deve fermare l'app.
    console.error('widget: non sono riuscito a pubblicare', err);
  }
}

/** Le piu vicine fra quelle che l'app considera scegliibili, per il Radar. */
function vicine(model: HomeModel | null) {
  if (!model) return [];
  return model.list
    .filter((i) => i.eligible && i.price > 0)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, VICINE)
    .map((i) => ({
      id: i.id,
      name: i.brand || i.name,
      lat: i.lat,
      lng: i.lng,
      distance: i.distanceKm,
      price: i.price,
    }));
}
