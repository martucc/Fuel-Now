import type { StationRow } from '../domain/parse';
import type { LatLng } from '../domain/geo';
import { haversineKm } from '../domain/geo';
import { FUEL_KEYS } from '../domain/raw';
import { toFuelType } from '../domain/fuel';
import type { FuelPrice, FuelStation } from '../types';

/**
 * Ponte verso le schermate non ancora migrate (Trip, Analisi, Garage, Pieno,
 * Allerte). Il prezzo confrontabile viene messo prima del servito perche
 * quelle schermate leggono `prices.find(p => p.type === fuel)` e si aspettano
 * di trovare il prezzo su cui si decide.
 */
export function toFuelStation(row: StationRow, user?: LatLng): FuelStation {
  const prices: FuelPrice[] = [];
  const updated = row.updated ?? '';

  for (const k of FUEL_KEYS) {
    const self = row.prices[k];
    if (self !== undefined) prices.push({ type: toFuelType(k), price: self, lastUpdated: updated, isSelf: true });
  }
  for (const k of FUEL_KEYS) {
    const srv = row.servito[k];
    if (srv !== undefined) prices.push({ type: toFuelType(k), price: srv, lastUpdated: updated, isSelf: false });
  }

  const services: string[] = [];
  if (prices.some((p) => p.isSelf)) services.push('Self-Service');
  if (row.isHighway) services.push('Autostrada');

  const distance = user
    ? Math.round(haversineKm(user, { lat: row.lat, lng: row.lng }) * 10) / 10
    : undefined;

  return {
    id: row.id,
    name: row.name,
    brand: row.brand || 'Indipendente',
    address: row.address,
    city: row.city,
    distance,
    services,
    location: { lat: row.lat, lng: row.lng },
    prices,
  };
}

export function toFuelStations(rows: StationRow[], user?: LatLng): FuelStation[] {
  return rows.map((r) => toFuelStation(r, user));
}
