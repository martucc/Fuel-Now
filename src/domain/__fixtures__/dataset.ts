import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RawDataset } from '../raw';

let cached: RawDataset | null = null;

/** Il vero `public/stations.json`, letto una volta sola per run. ~7 MB. */
export function realDataset(): RawDataset {
  if (!cached) {
    const path = resolve(process.cwd(), 'public/stations.json');
    cached = JSON.parse(readFileSync(path, 'utf8')) as RawDataset;
  }
  return cached;
}
