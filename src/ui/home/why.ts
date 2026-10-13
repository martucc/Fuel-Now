import type { RankedStation } from '../../domain/ranking';
import { describeAge } from '../../domain/freshness';

export interface WhyRow {
  label: string;
  value: string;
  emphasis?: boolean;
}

function euro(v: number): string {
  return `${v.toFixed(2).replace('.', ',')} €`;
}

function litri(v: number): string {
  return `${v.toFixed(3).replace('.', ',')} €/L`;
}

function km(v: number): string {
  return `${v.toFixed(1).replace('.', ',')} km`;
}

/** Il conto e costruito dal NetBreakdown gia usato per decidere: mai rifatto. */
export function whyRows(r: RankedStation): WhyRow[] {
  const n = r.net;
  return [
    { label: 'Litri considerati', value: `${n.liters.toFixed(0)} L` },
    { label: 'Media della zona', value: litri(n.cohortAvg) },
    { label: 'Prezzo qui', value: litri(n.price) },
    { label: 'Risparmio lordo', value: euro(n.gross) },
    { label: 'Distanza (andata e ritorno)', value: km(n.distanceKm * 2) },
    { label: 'Consumo stimato', value: `${n.kml.toFixed(1).replace('.', ',')} km/L` },
    { label: 'Costo del viaggio', value: `− ${euro(n.roadCost)}` },
    { label: 'Eta del dato', value: describeAge(r.ageH) },
    { label: 'Coefficiente di fiducia', value: `× ${n.confidence.toFixed(2).replace('.', ',')}` },
    { label: 'In tasca', value: euro(n.net), emphasis: true },
  ];
}
