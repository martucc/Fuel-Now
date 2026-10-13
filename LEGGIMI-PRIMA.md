# MartuccFuel — guida per chi ci lavora

App dei prezzi dei carburanti per Android. È una web app (React 19 + TypeScript + Vite, PWA) impacchettata come app Android con Capacitor 8. Tutta l'interfaccia è in italiano.

Stato al 13 ottobre 2026: ramo `estetica-21ago`, ultimo commit `514e1f4`, 333 test verdi su 30 file.

> Il `README.md` è vecchio (descrive la prima versione). Fa fede questo file.

---

## 1. Cosa serve sul computer

| Strumento | Versione usata | A cosa serve |
|---|---|---|
| Node.js | 24 | sviluppo, build, test |
| JDK | 21 | build Android (Gradle) |
| Android SDK | compileSdk / targetSdk 36, minSdk 24 | build Android |
| Python 3.11 | facoltativo | solo per la vecchia pipeline dati (`fetch_stations.py`) |

Per l'Android SDK basta Android Studio. Se Gradle non trova l'SDK, crea `android/local.properties` con:

```
sdk.dir=C\:\\Users\\<utente>\\AppData\\Local\\Android\\Sdk
```

(il file non è nello zip perché contiene il percorso della macchina).

## 2. Primi passi

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # vitest, ~10 secondi
npm run build        # tsc + vite build in dist/
npm run lint         # c'è debito vecchio: ~130 no-explicit-any, non bloccante
```

`predev` e `prebuild` copiano da soli il worker di MapLibre in `public/maplibre/`: non serve farlo a mano.

## 3. Fare l'APK da installare sul telefono

```bash
npm run seed && npm run build && npx cap sync android && cd android && ./gradlew assembleDebug
```

L'APK esce in `android/app/build/outputs/apk/debug/app-debug.apk` (circa 7 MB).

- **`npm run seed` sempre prima di una build che va su un telefono.** Scarica i prezzi aggiornati in `public/stations.json`, che è quello che l'app mostra al primo avvio senza rete. Se resta indietro l'app mostra prezzi vecchi come se fossero di oggi.
- Se l'APK esce molto più grosso (14 MB invece di ~7) sono avanzi del merge degli asset: `./gradlew assembleDebug --rerun-tasks` lo rifà pulito.
- Esiste solo la build di debug. Non c'è una firma di release configurata.

Provarla dal telefono senza APK: `npm run dev -- --host` e apri `http://<ip-del-pc>:5173`. In HTTP puro però Chrome Android blocca il GPS: serve `chrome://flags` → *Insecure origins treated as secure* con quell'indirizzo.

## 4. Com'è fatto

```
src/
  domain/     logica pura, tutta testata (*.test.ts accanto a ogni modulo)
  services/   rete, salvataggi locali, Gemini, notifiche, percorsi
  components/ ui/   schermate e componenti React (resa sottile, poca logica)
  design/     tokens.css (colori, tipografia), motion.ts (animazioni)
  lib/        formato.ts (numeri e date all'italiana) e utilità
android/app/src/main/java/com/martucc/fuel/   widget e sincronizzazione nativa
scripts/      seed.mjs, copia-worker-maplibre.mjs
docs/superpowers/   spec del redesign e piani delle fasi 1 e 2
```

**Cinque schede**: Home, Mappa, Viaggio, Auto, Mercato.

**Da dove vengono i prezzi.** `npm run seed` scarica `stations.json` dal repo `martucc/Fuel-Now`. In questo repo c'è anche la vecchia pipeline Python (`fetch_stations.py` e la GitHub Action `.github/workflows/update_stations.yml`, che gira sei volte al giorno) che aggiorna `public/stations.json` e `data/history.csv`.

**Le idee principali**
- **Direzione Casa.** La Home non cerca solo la pompa più vicina: sceglie il pieno lungo la strada di casa. `services/percorsoService.ts` chiede il percorso a OSRM, `domain/corridoio.ts` proietta ogni pompa sul percorso, e la deviazione vale il doppio della distanza laterale. Senza OSRM si ripiega sulla linea d'aria, **e la scheda lo dice** («circa», «stima in linea d'aria»). Il costo di una deviazione è tempo perso × `VALORE_TEMPO_EURO_ORA` (in `domain/ranking.ts`) più l'usura dell'auto, così si può dire all'utente «ti costa sei minuti».
- **Il risparmio.** `services/adviceLog.ts` tiene il diario di cosa l'app ha consigliato ogni giorno; quando registri un pieno, `domain/risparmio.ts` calcola quanto hai pagato sotto la media di quel giorno.
- **Gemini è facoltativo.** Senza chiave l'app usa il motore locale. La chiave la inserisce l'utente nelle impostazioni e resta sul telefono: nel repo non ci sono chiavi.

## 5. Trappole che dal codice non si vedono

- **Test:** girano in ambiente `node` e prendono solo `src/**/*.test.ts`, mai `.tsx`. Per questo la logica sta nei moduli puri di `domain/` e i componenti fanno solo la resa. Niente jsdom.
- **I test non devono fissare valori del dataset** (medie, affidabilità): cambiano a ogni `seed`.
- **Token CSS con prefisso `--mf-`.** Tailwind v4 emette il suo `@theme` dopo `:root` e sovrascriverebbe in silenzio nomi come `--font-sans`.
- **Il blu `--mf-recommended` è riservato al distributore consigliato** sulla mappa. Non va mai usato come livello di prezzo.
- **Service worker solo sul web.** Dentro Capacitor serviva la build vecchia e l'app sembrava non aggiornarsi mai. In `vite.config.ts` c'è `injectRegister: false` e la decisione sta tutta in `main.tsx`. Non rimettere la registrazione automatica: registrava e `main.tsx` cancellava, con un esito diverso a ogni avvio.
- **`dropMisgeocoded`** (`domain/parse.ts`) toglie le pompe con coordinate sbagliate dalle scelte ma non dalle statistiche di provincia, che devono restare allineate a `market.test.ts`.
- **La media locale si passa a `priceLevel` solo per gli impianti in autostrada.** Se la applichi a tutti, una pompa dall'altra parte della regione viene giudicata col mercato del quartiere dell'utente.
- **`isLikelyClosed` segnala, non esclude.** Se diventa un motivo per scartare una pompa si svuota il pannello «freschezza» del Mercato, che conta di proposito i prezzi vecchi.
- **L'elenco dei modelli Gemini lo dà l'API** (`chiediModelli` in `services/geminiService.ts`). Non scriverlo a mano: prima conteneva modelli inesistenti.
- **I widget Android non calcolano niente.** Leggono le chiavi `mf_w_*` che scrive `domain/widget.ts`; dall'altra parte c'è `MfNotte.java`, e i due vanno cambiati insieme. `mf_w_modo` dice se la Home sta ragionando sul rientro a casa: senza, il widget consiglierebbe una pompa diversa da quella della Home. Quando `FuelDataSyncManager` riscrive i dati da solo deve rimettere `mf_w_modo` a `zona`.
- **`android/app/src/main/assets/` è generata** da `npx cap sync android`: non modificarla a mano.

## 6. Come si guarda l'app mentre ci lavori

I difetti che contano si vedono solo con l'app che gira davvero, in formato telefono: viewport 390×844 con DPR 3, tocco attivo, geolocalizzazione su Roma (41.9028, 12.4964). Esempi trovati solo così: un pulsante principale rimasto in stile secondario, 140 px di vuoto dentro un foglio, la barra di navigazione che lampeggiava per 180 ms perché a un `motion.div` mancava `initial`.

Per le cose che durano poco (splash, transizioni) conviene uno script che registra i valori in un array su `window` e poi leggerlo, invece di provare a beccare lo screenshot giusto.

## 7. Regole del progetto

- **Testi dell'interfaccia** in italiano normale, con gli accenti giusti e i numeri all'italiana (usa `src/lib/formato.ts`). Niente maiuscolo enfatico e niente gergo tecnico: «Sincronizzazione Nucleo Operativo» è stato bocciato. Vale anche per le etichette corte: «+1,4 km» va bene, «+1,4 km dev.» no.
- **Commit** in italiano, in stile convenzionale: `feat(mappa): …`, `fix(consigli): …`.
- **Unire a `main` o pubblicare** (`npm run deploy` va su gh-pages) lo decide Nico, dopo aver provato. Il ramo `redesign/fase-2-home-mappa` non è ancora unito a `main`.
