import { mkdir, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Mette il worker di maplibre dove il browser lo trova anche nella build.
 *
 * maplibre cerca il suo worker cosi:
 *     new URL(dev ? 'maplibre-gl-worker-dev.mjs' : 'maplibre-gl-worker.mjs',
 *             import.meta.url)
 * Il nome lo decide a tempo di esecuzione, quindi il bundler non lo vede e
 * non lo copia: in produzione quell'indirizzo risponde con l'index, il
 * worker non parte e la mappa resta nera — senza un solo errore, perche
 * maplibre non si accorge che il suo worker non ha mai risposto.
 *
 * Importarlo con `?url` non basta: copia il worker ma non
 * maplibre-gl-shared.mjs, che il worker importa come file accanto a se.
 * Servono tutti e due, e nella stessa cartella.
 *
 * Stanno in public/ e non nel repository: sono file del pacchetto, e copiati
 * a ogni build restano per forza della versione che c'e in node_modules.
 */

const qui = dirname(fileURLToPath(import.meta.url));
const daNodeModules = join(qui, '..', 'node_modules', 'maplibre-gl', 'dist');
const versoPublic = join(qui, '..', 'public', 'maplibre');

const FILE = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

await mkdir(versoPublic, { recursive: true });
for (const nome of FILE) {
  await copyFile(join(daNodeModules, nome), join(versoPublic, nome));
}

console.log(`Worker maplibre copiato in public/maplibre (${FILE.join(', ')})`);
