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
- **Versione.** `versionCode`/`versionName` in `android/app/build.gradle`. `VERSIONE_APP` in `src/ui/schermate/FoglioImpostazioni.tsx` va tenuta uguale (sul telefono la versione mostrata la dice Android, nel browser quella costante).
- **Il rilascio lo fa GitHub.** Un tag `vX.Y.Z` uguale a `versionName` fa partire `.github/workflows/rilascio_apk.yml`: test, seme di oggi, build, APK firmato coi segreti `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` e rilascio con l'APK allegato. Il messaggio del tag diventa la nota del rilascio:
  ```bash
  git tag -a v2.2.0 -m "Cosa c'è di nuovo, in una riga" && git push origin v2.2.0
  ```
  L'app chiede l'ultimo rilascio a GitHub all'avvio e alla ripresa (al più ogni sei ore, `domain/versione.ts`) e, se è più nuovo, mostra in Home «È uscita la versione…» con «Scarica e installa»: il download si apre nel browser del telefono e Android chiede di installare. Senza i segreti l'Action si ferma invece di pubblicare un APK con la chiave di debug, che non si installerebbe sopra l'app.

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

**Il piano B.** Se dopo il controllo il prezzo più recente del file ha più di 12 ore (`PIANO_B_DOPO_ORE`), lo script su GitHub è fermo: il telefono chiede i prezzi direttamente all'API live del Ministero (`services/ministero.ts`, le stesse chiamate di `fetch_stations.py`) e li cuce sull'anagrafica che ha (`domain/ministero.ts`), rifacendo le medie con le regole dello script. La riga di stato dice «Presi dal Ministero». Il primo file nuovo di GitHub li sostituisce da solo. Solo sul telefono: l'API non manda intestazioni CORS e serve l'HTTP nativo di Capacitor.

**Le idee principali**
- **Prezzi sempre di oggi.** `data/dataset.ts` mostra subito l'ultima copia salvata e poi ricontrolla il file in rete all'avvio e a ogni ritorno in primo piano (`services/aggiornamentiAutomatici.ts`). La regola di quando ricontrollare è in `domain/aggiornamento.ts`.
- **Il risparmio vero.** `domain/ranking.ts`: il risparmio si misura rispetto al pieno che faresti comunque, cioè il distributore utilizzabile più vicino con un prezzo recente (se è il caro della zona e uno a prezzo normale sta al massimo un km più in là, quello; se è un servito e a portata c'è un self che conviene, il self), meno il carburante della strada in più (linea d'aria × 1,3). Sono euro veri: il tempo pesa nella scelta (ogni minuto in più deve rendere almeno 15 centesimi, mai oltre 20 minuti dal più vicino, servito compreso) ma non nel numero mostrato. Il consigliato non costa mai più del pieno che faresti comunque: «in tasca» non è mai negativo. Non si consigliano e non fanno da metro gli impianti in autostrada, quelli forse chiusi e i prezzi fuori mercato che nessun vicino conferma; restano in lista, spenti, col motivo. Consiglio e ordine della lista escono da `classifica`: il primo della lista è sempre il consigliato. I litri del pieno e il consumo vengono dall'auto scelta (`cars.json`), altrimenti dai valori medi di `domain/units.ts`.
- **Colori dei prezzi.** Il livello (dal più economico al più caro) è lo z-score nella coorte di provincia, strada o autostrada (`domain/market.ts`, `domain/pricing.ts`). È lo stesso metro su mappa, lista e scheda.
- **Il piano del viaggio.** `domain/viaggio.ts` sceglie le soste a costo minimo esatto: programmazione dinamica sul «potenziale» (i litri nel serbatoio riportati al km 0), col conto tenuto come funzione lineare a tratti, così resta esatta anche con l'acquisto minimo. Il conto è il carburante più 0,75 € per sosta (cinque minuti al valore del tempo della Home), che pesano nella scelta ma non entrano nella spesa mostrata; ogni sosta mette almeno 5 L (meno solo per fare il pieno prima di un tratto lungo). Dal conto si toglie quello che l'ultima sosta compra e avanza in fondo oltre la riserva, a metà del litro più economico del viaggio (`FRAZIONE_AVANZO`): così la deviazione si paga anche quando la sosta mette il minimo di 5 L, più del necessario. Prima avanzare valeva zero, i litri bruciati per deviare uscivano dall'avanzo e in Risparmio Milano → Torino con «1/4» si usciva di 2,4 km per la stessa spesa. La riserva, il 12% del serbatoio, si tiene a ogni pompa e all'arrivo; se non si può, alla prima sosta si arriva con almeno metà di quello che c'è (mai più di metà riserva, mai sotto 0,3 L, e mai con meno di quanto si arriverebbe in fondo senza fermarsi), e solo se nemmeno così si ripiega sul piano che scende meno. Il primo gradino ha sempre la precedenza, anche quando costa una sosta in più (col metano capita: 5 kg a 1,929 per arrivare con la riserva alla pompa a 1,644 undici km dopo): è il prezzo della regola «più carburante non dà mai un piano meno sicuro», e cambiarla è una decisione da prendere apposta. Le regole sono scritte in cima al file; i test di proprietà lo confrontano con un risolutore indipendente (`domain/__fixtures__/pianoRiferimento.ts`) su centinaia di viaggi casuali e controllano che con più carburante il piano non peggiori mai. `domain/tappeViaggio.ts` scarta le aree di servizio sulla carreggiata opposta (in autostrada, a sinistra nel verso di marcia e a più di 8 m dalla linea, misurati sulla spezzata vera di OSRM e non su quella semplificata: `aSinistra` in `domain/lungoPercorso.ts`).
- **Gemini è facoltativo.** La chiave la mette l'utente nelle impostazioni e resta sul telefono.

## 5. Trappole che dal codice non si vedono

- **Test:** girano in ambiente `node` e prendono solo `src/**/*.test.ts`, mai `.tsx`. La logica sta nei moduli puri; i componenti fanno solo la resa.
- **I test non devono fissare valori del dataset**: cambiano a ogni `seed` (i test del ranking usano una coorte finta apposta).
- **Il risolutore di riferimento del viaggio è esatto solo «sul reticolo»**: km/l interi, distanze a multipli di un centilitro di strada, serbatoio intero. Su istanze qualsiasi rifiuta di rispondere (`fuori reticolo`): i test di proprietà generano apposta istanze così.
- **Nel piano del viaggio non si scarta nessuna pompa prima del conto**, nemmeno quelle «battute» da una vicina non più cara e con meno deviazione. Le soste vanno in ordine di km e due soste non stanno entro 0,4 km: dopo una sosta obbligata la pompa che «batteva» può essere già alle spalle, e quella tolta era l'unica economica rimasta (6 € in più nel test P/A/B/Q di `viaggio.test.ts`). Il conto con tutte le pompe sta comunque sotto i 20 ms su Milano → Reggio in Risparmio.
- **Quello che avanza in fondo vale metà del litro più economico, non il prezzo dell'ultima sosta.** È una regola del conto, da far vedere a Nico. Al prezzo dell'ultima sosta (la prima idea) il piano fa il pieno dove costa meno e poi una sosta inutile dove costa di più, per «rivalutare» quello che avanza (test «non aggiunge una sosta cara che non serve»); al prezzo più basso del viaggio meno un centesimo diventa indifferente fra un rabbocco da 2 L e una sosta da 5 L, e sui 17 percorsi veri la spesa mostrata sale fino a 4 € per qualche litro in più all'arrivo. A metà: sugli stessi 2.295 piani nessun piano con la stessa spesa e più deviazione di quello di una strategia più stretta (prima 29), 115 km di deviazione in meno, la spesa sale al più di 29 centesimi e il risparmio rispetto al pieno prima di partire non scende mai. Il credito vale solo per i litri comprati all'ultima sosta: il carburante portato da prima non si conta.
- **Il blu vuol dire «vai qui»** e nient'altro: distributore consigliato, soste del viaggio, «Portami lì». Mai schede, link, interruttori, la posizione dell'utente o i grafici.
- **Il colore d'atmosfera viene dai prezzi della zona** (`domain/umore.ts`, `app/umore.ts`): la mediana dei prezzi entro 15 km contro la media italiana, nelle stesse cinque fasce dei prezzi (verde, verde chiaro, turchese per la media, ambra, rosso). `<html data-umore>` lo passa a `tema.css` (`--mf-umore`, `--mf-umore-2`), che tinge sfondo, titoli, scheda attiva della barra e carta del consiglio. Mai blu: il blu resta «vai qui».
- **Mai `Haptics.selection*` di Capacitor su Android:** è una vibrazione continua di 100 ms, a ogni cambio di scheda faceva un ronzio. La vibrazione passa da `lib/haptics.ts`, che segue l'impostazione «Vibrazione» (`domain/vibrazione.ts`): «Leggera» (predefinita) usa il tocco di sistema di Android (`VibrazionePlugin.java`, `performHapticFeedback`), «Decisa» gli impatti del plugin, «Spenta» niente.
- **Stili di base dentro `@layer base`.** Una regola CSS fuori dai layer di Tailwind vince sulle classi di utilità: un `button { background: none }` sciolto spegneva tutti i bottoni blu.
- **Niente service worker dentro l'APK.** Serviva la build vecchia e l'app sembrava non aggiornarsi. `main.tsx` toglie quelli rimasti.
- **Il piano B costa una decina di MB** (venti regioni con tutti i carburanti): parte solo con il file fermo, mai senza rete (non si consuma la pausa) e al massimo una volta ogni tre ore. Il file cucito porta l'ora del telefono come `generated_at`, così il file vecchio di GitHub non lo copre e il primo nuovo sì.
- **Il download dei prezzi:** indirizzo fisso e `cache: 'no-cache'`, così GitHub risponde 304 quando il file non è cambiato. Niente parametri per «rompere la cache» (la CDN li ignora) e niente intestazioni fatte a mano (il preflight CORS di raw.githubusercontent risponde 403).
- **La carreggiata si capisce solo dalla geometria, e con le coordinate del MIMIT è al limite.** La linea di OSRM corre in mezzo alla nostra carreggiata; l'altra sta 15-20 m a sinistra. Alcune aree di servizio hanno le coordinate quasi sull'asse: Lucignano Est (A1, carreggiata nord) andando verso Roma sta 11 m a sinistra della linea, e con la vecchia fascia di 25 m il piano la sceglieva perché costa meno di Lucignano Ovest. Per questo la fascia «sulla linea» è di 8 m (`SULLA_LINEA_KM`) e lato e distanza si rimisurano sulla spezzata non semplificata: la semplificazione a 30 m bastava a spostare Cantagallo Ovest da 43 m a 22 m. Sui 17 percorsi veri provati passare da 25 a 8 m cambia solo Lucignano Est. Restano le coordinate sbagliate di decine di metri, che nessuna fascia sistema: Giove Ovest («dir. Roma») andando verso Roma risulta 118 m a sinistra e si perde. Per quelle servirebbe leggere la «dir.» dell'indirizzo, cosa che finora si è deciso di non fare.
- **`dropMisgeocoded`** (`domain/parse.ts`) toglie le pompe con coordinate sbagliate dalle scelte ma non dalle statistiche di provincia.
- **`isLikelyClosed` segnala, non nasconde.** L'impianto resta nei dati e nel pannello freschezza; nella Home sta in lista, spento, ma non si consiglia e non fa da metro. L'età si misura sul lotto (il prezzo più recente del file), non sull'orologio: col seme di un mese fa sono vecchi i dati, non i distributori.
- **Il gasolio a Livigno costa un quarto in meno ed è vero** (zona extradoganale). I prezzi anomali si giudicano sul mercato della zona e si salvano se un altro impianto vicino conferma lo stesso prezzo. Livigno è un mercato a sé, dichiarato in `COMUNI_EXTRADOGANALI` (`domain/anomalie.ts`): i suoi impianti fanno zona solo fra loro e sotto la zona sono assurdi solo oltre un terzo, perché lì l'1,292 dell'Agip sta un quarto sotto gli altri ed è vero. All'insù si scarta solo chi ha un altro distributore entro 15 km: l'unica pompa di un'isola non fa da metro a nessuno. Non stringere le soglie senza riprovare Livigno e le isole.
- **L'elenco dei modelli Gemini lo dà l'API** (`chiediModelli` in `services/geminiService.ts`). Non scriverlo a mano.
- **`android/app/src/main/assets/` è generata** da `npx cap sync android`: non modificarla a mano.
- **Margini sicuri:** Capacitor 8 (SystemBars) passa i margini alla pagina come `--safe-area-inset-*`; `tema.css` li usa con `env()` come ripiego.

## 6. Come si guarda l'app mentre ci lavori

I difetti che contano si vedono solo con l'app che gira davvero, in formato telefono: viewport 390×844 con DPR 3, tocco attivo, geolocalizzazione (per esempio Lugo, 44.4167, 11.9167). Il GPS nel browser funziona solo su `localhost` o in https.

## 7. Regole del progetto

- **Testi dell'interfaccia** in italiano normale, con gli accenti giusti e i numeri all'italiana (usa `src/lib/formato.ts`). Niente maiuscolo enfatico e niente gergo tecnico.
- **Commit** in italiano, in stile convenzionale: `feat(mappa): …`, `fix(consigli): …`.
- **Unire a `main`** lo decide Nico, dopo aver provato.
