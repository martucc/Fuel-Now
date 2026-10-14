# MartuccFuel — guida per chi ci lavora

App dei prezzi dei carburanti per Android. È una web app (React 19 + TypeScript + Vite + Tailwind 4) impacchettata come app Android con Capacitor 8. Tutta l'interfaccia è in italiano.

Stato al 13 ottobre 2026: versione **2.0**, ramo `ccr-0d440925-0qmxsf` (PR #3). La spec delle decisioni è in `docs/superpowers/specs/2026-10-13-martuccfuel-2-0.md`.

> Il `README.md` descrive la prima versione. Fa fede questo file.

---

## 1. Cosa serve sul computer

| Strumento | Versione | A cosa serve |
|---|---|---|
| Node.js | 22 o 24 | sviluppo, build, test |
| JDK | 21 | build Android (Gradle) |
| Android SDK | compileSdk / targetSdk 36, minSdk 24 | build Android |
| Python 3.11 | facoltativo | solo per la pipeline dati (`fetch_stations.py`) |

Se Gradle non trova l'SDK, crea `android/local.properties` con `sdk.dir=…` (non è nel repo perché contiene il percorso della macchina).

## 2. Primi passi

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # vitest, pochi secondi
npm run build        # tsc + vite build in dist/
npm run lint
```

`predev` e `prebuild` copiano da soli il worker di MapLibre in `public/maplibre/`.

## 3. Fare l'APK

```bash
npm run seed && npm run build && npx cap sync android && cd android && ./gradlew assembleRelease
```

L'APK esce in `android/app/build/outputs/apk/release/app-release.apk`.

- **La firma.** La release si firma con la chiave indicata in `android/keystore.properties` (fuori da git, insieme a ogni `.p12`/`.jks`):
  ```
  storeFile=/percorso/martucc-fuel.p12
  storePassword=…
  keyAlias=martucc-fuel
  keyPassword=…
  ```
  Senza quel file la release esce firmata con la chiave di debug del computer. **Per aggiornare l'app installata serve sempre la stessa chiave**: con un'altra Android rifiuta l'aggiornamento e bisogna disinstallare.
- **`npm run seed` prima di una build che va su un telefono.** Mette in `public/stations.json` i prezzi di oggi: sono quelli che l'app mostra al primo avvio senza rete.
- **Versione.** `versionCode`/`versionName` in `android/app/build.gradle`. `VERSIONE_APP` in `src/ui/schermate/FoglioImpostazioni.tsx` va tenuta uguale.

## 4. Com'è fatto

```
src/
  domain/     logica pura, tutta testata (*.test.ts accanto a ogni modulo)
  data/       dataset.ts (il negozio dei prezzi), archivio.ts (copia in IndexedDB)
  app/        stato dell'app: impostazioni, posizione, dati, modello derivato, guscio e schede
  services/   rete: Gemini, percorsi OSRM, ricerca luoghi, aggiornamenti automatici, navigatore
  ui/
    kit/      componenti di base (Pulsante, Gruppo/Riga, Segmentato, Foglio, Prezzo, LogoMarchio…)
    mappa/    MappaCarburanti: l'unica mappa (MapLibre), usata da Home, Mappa e Viaggio
    schermate/ Home, Mappa, Viaggio, Mercato (scheda «Prezzi») e i fogli
  design/     tema.css: colori, caratteri, misure (unica fonte)
  lib/        formato.ts (numeri all'italiana), haptics, maplibre
android/app/src/main/java/com/martucc/fuel/   MainActivity e NavigazionePlugin («Portami lì»)
scripts/      seed.mjs, copia-worker-maplibre.mjs
```

**Quattro schede**: Vicino (Home), Mappa, Viaggio, Prezzi.

**Da dove vengono i prezzi.** La GitHub Action `.github/workflows/update_stations.yml` gira sei volte al giorno, lancia `fetch_stations.py` (dati del MIMIT) e committa `public/stations.json` e `data/history.csv` su `main`. L'app scarica `public/stations.json` da `raw.githubusercontent.com`.

**Le idee principali**
- **Prezzi sempre di oggi.** `data/dataset.ts` mostra subito l'ultima copia salvata e poi ricontrolla il file in rete all'avvio e a ogni ritorno in primo piano (`services/aggiornamentiAutomatici.ts`). La regola di quando ricontrollare è in `domain/aggiornamento.ts`.
- **Il risparmio vero.** `domain/ranking.ts`: il risparmio si misura rispetto al distributore utilizzabile più vicino con un prezzo recente, meno il costo della strada in più (linea d'aria × 1,3), del tempo e dell'usura. I litri del pieno e il consumo vengono dall'auto scelta (`cars.json`), altrimenti dai valori medi di `domain/units.ts`.
- **Colori dei prezzi.** Il livello (dal più economico al più caro) è lo z-score nella coorte di provincia, strada o autostrada (`domain/market.ts`, `domain/pricing.ts`). È lo stesso metro su mappa, lista e scheda.
- **Il piano del viaggio.** `domain/viaggio.ts` sceglie le soste a costo minimo esatto: programmazione dinamica sul «potenziale» (i litri nel serbatoio riportati al km 0), col conto tenuto come funzione lineare a tratti, così resta esatta anche con l'acquisto minimo. Il conto è il carburante più 0,75 € per sosta (cinque minuti al valore del tempo della Home), che pesano nella scelta ma non entrano nella spesa mostrata; ogni sosta mette almeno 5 L (meno solo per fare il pieno prima di un tratto lungo). La riserva, il 12% del serbatoio, si tiene a ogni pompa e all'arrivo; se non si può, alla prima sosta si arriva con almeno metà di quello che c'è (mai più di metà riserva, mai sotto 0,3 L), e solo se nemmeno così si ripiega sul piano che scende meno. Le regole sono scritte in cima al file; i test di proprietà lo confrontano con un risolutore indipendente (`domain/__fixtures__/pianoRiferimento.ts`) su centinaia di viaggi casuali e controllano che con più carburante il piano non peggiori mai. `domain/tappeViaggio.ts` scarta le aree di servizio sulla carreggiata opposta (in autostrada, a sinistra nel verso di marcia e a più di 25 m dalla linea: `aSinistra` in `domain/lungoPercorso.ts`).
- **Gemini è facoltativo.** La chiave la mette l'utente nelle impostazioni e resta sul telefono.

## 5. Trappole che dal codice non si vedono

- **Test:** girano in ambiente `node` e prendono solo `src/**/*.test.ts`, mai `.tsx`. La logica sta nei moduli puri; i componenti fanno solo la resa.
- **I test non devono fissare valori del dataset**: cambiano a ogni `seed` (i test del ranking usano una coorte finta apposta).
- **Il risolutore di riferimento del viaggio è esatto solo «sul reticolo»**: km/l interi, distanze a multipli di un centilitro di strada, serbatoio intero. Su istanze qualsiasi rifiuta di rispondere (`fuori reticolo`): i test di proprietà generano apposta istanze così.
- **Nel piano del viaggio non si scarta nessuna pompa prima del conto**, nemmeno quelle «battute» da una vicina non più cara e con meno deviazione. Le soste vanno in ordine di km e due soste non stanno entro 0,4 km: dopo una sosta obbligata la pompa che «batteva» può essere già alle spalle, e quella tolta era l'unica economica rimasta (6 € in più nel test P/A/B/Q di `viaggio.test.ts`). Il conto con tutte le pompe sta comunque sotto i 20 ms su Milano → Reggio in Risparmio.
- **Il blu vuol dire «vai qui»** e nient'altro: distributore consigliato, soste del viaggio, «Portami lì». Mai schede, link, interruttori, la posizione dell'utente o i grafici.
- **Stili di base dentro `@layer base`.** Una regola CSS fuori dai layer di Tailwind vince sulle classi di utilità: un `button { background: none }` sciolto spegneva tutti i bottoni blu.
- **Niente service worker dentro l'APK.** Serviva la build vecchia e l'app sembrava non aggiornarsi. `main.tsx` toglie quelli rimasti.
- **Il download dei prezzi:** indirizzo fisso e `cache: 'no-cache'`, così GitHub risponde 304 quando il file non è cambiato. Niente parametri per «rompere la cache» (la CDN li ignora) e niente intestazioni fatte a mano (il preflight CORS di raw.githubusercontent risponde 403).
- **`dropMisgeocoded`** (`domain/parse.ts`) toglie le pompe con coordinate sbagliate dalle scelte ma non dalle statistiche di provincia.
- **`isLikelyClosed` segnala, non esclude.**
- **L'elenco dei modelli Gemini lo dà l'API** (`chiediModelli` in `services/geminiService.ts`). Non scriverlo a mano.
- **`android/app/src/main/assets/` è generata** da `npx cap sync android`: non modificarla a mano.
- **Margini sicuri:** Capacitor 8 (SystemBars) passa i margini alla pagina come `--safe-area-inset-*`; `tema.css` li usa con `env()` come ripiego.

## 6. Come si guarda l'app mentre ci lavori

I difetti che contano si vedono solo con l'app che gira davvero, in formato telefono: viewport 390×844 con DPR 3, tocco attivo, geolocalizzazione (per esempio Lugo, 44.4167, 11.9167). Il GPS nel browser funziona solo su `localhost` o in https.

## 7. Regole del progetto

- **Testi dell'interfaccia** in italiano normale, con gli accenti giusti e i numeri all'italiana (usa `src/lib/formato.ts`). Niente maiuscolo enfatico e niente gergo tecnico.
- **Commit** in italiano, in stile convenzionale: `feat(mappa): …`, `fix(consigli): …`.
- **Unire a `main`** lo decide Nico, dopo aver provato.
