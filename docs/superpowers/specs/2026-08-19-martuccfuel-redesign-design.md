# MartuccFuel — Redesign completo

**Data:** 2026-08-19
**Stato:** approvato, pronto per il piano di implementazione
**Repo:** `C:\Users\2005n\martucc-fuel` (branch `main`)

---

## 1. Perché

MartuccFuel funziona, ma tre difetti ne minano il valore alla radice.

**Inventa dati.** `src/services/localAnalysis.ts:79-95` genera lo storico a 7 giorni e il forecast con `Math.sin()`. Sono numeri fabbricati mostrati all'utente come analisi. Quando manca la chiave Gemini, questa è l'unica analisi disponibile — cioè l'esperienza predefinita è basata su dati falsi.

**Butta via i dati veri che ha già.** `public/stations.json` contiene:
- `by_province` — media, minimo, numerosità e scarto tipo per **ogni provincia e ogni carburante**
- `forecast` — direzione, delta in centesimi, orizzonte e **confidenza** per carburante, calcolati dalla pipeline Python
- `history` — serie storica

Il frontend non usa nessuno dei tre. Giudica i prezzi contro la media nazionale (o, peggio, contro la media delle stazioni caricate in quel momento) e sostituisce il forecast reale con l'onda sinusoidale.

**Il "migliore" non è il migliore.** `App.tsx:935` calcola `cheapP = Math.min(...validPrices)`. Nessun costo di deviazione, nessun carburante bruciato per arrivarci, nessuna considerazione sulla freschezza del dato. Un impianto a 22 km che costa 3 centesimi meno viene presentato come la scelta migliore mentre nella realtà ci si rimette.

Problemi secondari, reali ma non esistenziali: `App.tsx` è 1106 righe e `AnalysisTab.tsx` 1248 (logica, rete e rendering mescolati); la mappa nasconde impianti in silenzio con `zoomLimit` (2–60 marker); l'avvio a freddo scarica 7 MB bloccanti.

## 2. Cosa deve fare l'app

Si apre l'app e in tre secondi si ha:

1. **Il distributore più conveniente vicino** — uno solo, grande, motivato
2. **Una minimappa** dei distributori intorno, toccabile per aprire la mappa intera
3. **Un'analisi** — cosa conviene fare oggi
4. **La lista** di tutti gli impianti vicini

Le altre sezioni (Trip, Garage, Pieno, Allerte) restano e vengono riportate allo stesso livello, ma sono di supporto.

## 3. Decisioni prese

| Decisione | Scelta | Motivo |
|---|---|---|
| Criterio del "migliore" | **Risparmio netto reale** | Il prezzo più basso in assoluto fa perdere soldi quando è lontano |
| Motore di analisi | **Deterministico forte, AI opzionale sopra** | Funziona sempre, offline, senza chiave, senza costi, e non può inventare numeri |
| Provider AI | **Multi-provider con pannello di scelta** | Anthropic · Gemini · OpenAI · Mistral · Groq, modello selezionabile |
| Direzione visiva | **Notte** — scura, elegante | Mix fra la precisione di un cruscotto e la chiarezza editoriale |
| Carattere | **Bricolage Grotesque** + DM Mono | Cifre grasse e caratteriali; mono tabulare per i dati |
| Accento | **Ciano `#40DCE6`** | Non confligge con la scala semantica dei prezzi |
| Colore del prezzo | **Cinque livelli su z-score provinciale** | Il colore diventa il dato, non decorazione |
| Widget mappa | **W2 "Tabellone"** | Più pin leggibili possibile, il migliore acceso |
| Peso dati | **File intero, refresh in sottofondo** | Avvio istantaneo dalla cache; nessuna modifica rischiosa alla pipeline |
| Dati vecchi | **Mostrati ma declassati** | Non spariscono impianti nei paesi piccoli, ma non guidano più la raccomandazione |
| Ampiezza | **Tutta l'app, a fasi** | Ogni fase provabile sul telefono prima della successiva |

## 4. Design system

### 4.1 Colori

Superfici e testo (tema unico scuro — è una scelta deliberata, non un'omissione):

```
--ground          #08090B    fondo dell'app
--surface         #101418    card e pannelli
--surface-raised  #171C21    elementi sollevati
--hairline        #222A31    filetti e bordi
--ink             #F2F5F4    testo primario
--ink-2           #A5AEB4    testo secondario
--muted           #646E75    etichette e metadati
--accent          #40DCE6    ciano — bottoni, tab attiva, marchio, link
--accent-ink      #02171A    testo sopra l'accento
```

Ogni superficie sollevata porta `box-shadow: inset 0 1px 0 rgba(255,255,255,.05)` — il filo di luce sul bordo alto è ciò che rende le cose materiali su fondo scuro.

Scala semantica del prezzo — **usata solo per i prezzi**, mai per la grafica:

```
--price-best      #2FE0A8    smeraldo
--price-good      #9BE07B    verde chiaro
--price-normal    #F2F5F4    bianco (= --ink)
--price-high      #F2B33C    ambra
--price-worst     #F2645A    corallo
```

Lo smeraldo è stato spostato dal giada originale (`#5FE3B0`) verso un tono più profondo e caldo, per non confondersi con il ciano dell'accento.

**Regola forte:** l'accento non significa mai "risparmio". Verde e rosso appartengono alla scala dei prezzi. Il livello "nella media" è bianco puro: il colore compare solo quando ha qualcosa da dire, ed è per questo che quando compare si vede.

### 4.2 Tipografia

- **Bricolage Grotesque** (400–800) — interfaccia, titoli, prezzi grandi
- **DM Mono** (400, 500) — ogni cifra in tabella, micro-etichette, timestamp, distanze

Regola: **mono solo per i numeri e le micro-etichette maiuscole; sans per tutto ciò che è umano.** Applicata con rigore, è ciò che fa sembrare l'interfaccia un sistema invece di una collezione di schermate.

Prezzo hero: 58px, peso 800, `letter-spacing: -.06em`, `font-variant-numeric: tabular-nums`.

### 4.3 Layout

Filetti da 1px e spazio a fare gerarchia; le scatole si usano solo dove serve contenere davvero. La barra di navigazione è una pillola flottante in vetro con una sfumatura sopra, così il contenuto **sfuma invece di essere tagliato**.

## 5. Architettura

```
src/
  design/
    tokens.css              variabili CSS, unica fonte di verità dei colori
    primitives/             Pill, Card, Row, Sparkline, PriceText…
  domain/                   ── logica pura: nessun React, nessuna rete ──
    pricing.ts              z-score → livello → colore
    ranking.ts              l'algoritmo del migliore
    market.ts               statistiche provinciali e nazionali
    forecast.ts             lettura del forecast di backend
    freshness.ts            età del dato → coefficiente di fiducia
    units.ts                consumi, conversioni, default
  data/
    stationsRepo.ts         fetch, cache, parse, refresh in sottofondo
    historyRepo.ts          serie storiche reali
    prefs.ts                Capacitor Preferences tipizzate
  ai/
    provider.ts             interfaccia comune
    providers/anthropic.ts  gemini.ts  openai.ts  mistral.ts  groq.ts
    analysis.ts             motore deterministico + narrazione AI opzionale
    contract.ts             schema JSON e validazione dell'output
  ui/
    screens/                Home, Mappa, Analisi, Garage, Pieno, Trip, Allerte
    components/
```

`domain/` non importa nulla da React né dalla rete. Si testa con numeri veri. È il punto in cui l'algoritmo smette di essere "sembra funzionare" e diventa verificabile.

Nessun file di dominio supera le ~200 righe; nessun componente di schermata le ~300.

## 6. Dominio

### 6.1 Livello del prezzo (`pricing.ts`)

```
z = (prezzo − media_coorte) / scarto_coorte
```

La **coorte** è: gli impianti dello stesso carburante nella stessa provincia. Un impianto in autostrada viene confrontato con la coorte autostradale, non con quella cittadina — altrimenti sarebbe rosso sempre e il colore smetterebbe di significare qualcosa.

Fonte: `by_province[prov][carburante]` da `stations.json` (`avg`, `std`, `min`, `n`). Se `n < 8`, la coorte è troppo piccola: si ricade sulla media regionale, poi su quella nazionale (`national[carburante]`), e il livello viene marcato come a bassa affidabilità.

| Livello | Condizione | Colore | Voce |
|---|---|---|---|
| `best` | z ≤ −1,5 | smeraldo | «Affarone» |
| `good` | −1,5 < z ≤ −0,5 | verde chiaro | «Conviene» |
| `normal` | −0,5 < z < 0,5 | bianco | «Nella media» |
| `high` | 0,5 ≤ z < 1,5 | ambra | «Caro» |
| `worst` | z ≥ 1,5 | corallo | «Salasso» |

La stessa scala vale su: prezzo hero, pin della mappa, righe della lista, barra dello spettro. Si impara il codice una volta.

### 6.2 Freschezza (`freshness.ts`)

| Età del dato | Fiducia |
|---|---|
| ≤ 24 h | 1,00 |
| ≤ 48 h | 0,90 |
| ≤ 72 h | 0,75 |
| ≤ 5 giorni | 0,50 |
| oltre | 0,30 |

L'età viene sempre mostrata all'utente in chiaro («2h fa», «5 giorni fa»).

### 6.3 L'algoritmo del migliore (`ranking.ts`)

Per ogni impianto candidato:

```
litri        = capacità_serbatoio × 0,85        (45 se l'auto non è nota)
lordo        = (media_coorte − prezzo) × litri
costo_strada = (2 × distanza_km / consumo_kmL) × prezzo
fiducia      = freshness(età_dato)

NETTO = lordo × fiducia − costo_strada
```

`media_coorte` è la stessa coorte usata in `pricing.ts` (§ 6.1): stesso carburante, stessa provincia, e distinzione autostrada/città. Un impianto autostradale viene quindi valutato — sia per il colore sia per il netto — contro le altre autostrade.

Ordinamento per `NETTO` decrescente; a parità entro 0,15 €, vince il più vicino.

**Guardie.** Un impianto non può vincere se:
- il prezzo è fuori dai limiti fisici del carburante (`diesel`/`benzina` 1,0–3,5 · `gpl` 0,3–2,0 · `metano` 0,5–4,0 — gli stessi già in `fetch_stations.py`)
- `|z| > 4` (dato quasi certamente errato)
- l'utente lo ha bloccato, o è nella `community_blocked.json`

**Assunzioni dichiarate:**
- `costo_strada` assume andata e ritorno dedicati. È prudente: se si passa davanti all'impianto, il risparmio reale è maggiore di quello mostrato. Meglio sorprendere in positivo.
- Senza auto selezionata: benzina 15 km/L · diesel 18 km/L · GPL 11 km/L · metano 14 km/kg; serbatoio 45 L.
- Con auto selezionata si usano `kml` e `liters` da `cars.json`; con almeno 3 rifornimenti registrati si usa il **consumo reale** calcolato da `fillupService`.
- La distanza è in linea d'aria (Haversine). Sovrastima leggermente la convenienza degli impianti lontani. Accettabile in fase 2; migliorabile con distanza stradale se emergesse come problema.

**Trasparenza.** Il bottone «Perché?» apre il conto riga per riga con i numeri dell'utente: litri, media provinciale, risparmio lordo, km, consumo, costo strada, età del dato, coefficiente, netto. Nessuna scatola nera.

### 6.4 Mercato e previsione (`market.ts`, `forecast.ts`)

Statistiche dalla coorte provinciale: media, minimo, massimo, spread, numerosità, età del dato più recente.

Il forecast viene **letto** da `stations.json → forecast[carburante]`, che espone `direction`, `delta_c`, `days_ahead`, `confidence`. Non viene mai generato dal client.

**Se `confidence < 0,3` non si mostra alcuna previsione**: si scrive «segnale insufficiente». Meglio tacere che inventare.

Lo storico proviene da `data/history.csv` e dal campo `history` di `stations.json`.

### 6.5 Consiglio del giorno

Derivato da tre ingressi: il livello del miglior prezzo disponibile, la previsione con la sua confidenza, e il livello del serbatoio se noto.

- previsione in calo, confidenza ≥ 0,5, non in riserva → **«metti il minimo»**
- previsione in salita, oppure miglior prezzo di livello `best` → **«fai il pieno»**
- in riserva → **«rifornisci»**, con l'impianto più conveniente raggiungibile con l'autonomia residua
- confidenza insufficiente → consiglio basato solo sul livello del prezzo di oggi, dichiarandolo

## 7. Dati

Avvio: si parte **immediatamente** dalla cache (Cache Storage, con Capacitor Preferences come secondo livello). Il download da 7 MB parte dietro e non blocca nulla; quando arriva, i dati si aggiornano senza far sparire la schermata.

Refresh: alla ripresa in primo piano se sono passate più di 6 ore, e su richiesta esplicita.

Gli impianti vecchi restano visibili con l'età in evidenza. Il filtro rigido a 7 giorni di `dataService.ts:175` viene rimosso: la penalizzazione avviene nell'algoritmo, non nascondendo dati.

## 8. Analisi e AI

**Il motore deterministico calcola tutto**: media, z-score, spread, livello, forecast, consiglio, risparmio netto. Funziona senza chiave, senza rete, istantaneamente.

**L'AI riceve i numeri già calcolati e può solo raccontarli.** Le viene passato un contratto JSON rigido; l'output viene validato campo per campo contro i valori calcolati. Se il modello introduce una cifra che non corrisponde, quel campo viene scartato e si usa il testo deterministico. Il modello non può in nessun caso originare un numero mostrato all'utente.

### 8.1 Pannello provider

Nelle impostazioni: scelta del **provider**, poi del **modello** dalla lista di quel provider, campo per la chiave, e un bottone **Prova** che esegue una chiamata reale e riporta esito e latenza.

| Provider | Modelli proposti |
|---|---|
| Anthropic | Claude Opus 5, Sonnet 5, Haiku 4.5 |
| Google Gemini | Gemini 2.5 Flash, 2.5 Pro |
| OpenAI | da verificare sulla documentazione ufficiale in fase 3 — non si scrivono ID di modello a memoria |
| Mistral | Large, Small |
| Groq | Llama 3.x |

La chiave resta sul dispositivo (Capacitor Preferences). Non transita da alcun server intermedio.

**Vincolo tecnico da gestire:** dal browser e dalla WebView Capacitor, Anthropic richiede `dangerouslyAllowBrowser: true` sul client e l'header `anthropic-dangerous-direct-browser-access: true`; OpenAI ha un requisito analogo. Senza, CORS blocca la chiamata. Va gestito dentro ciascun adattatore, con un messaggio d'errore comprensibile se il provider non è raggiungibile.

## 9. La Home

Ordine verticale, tutto visibile senza scorrere su uno schermo da 6,1":

1. **Barra superiore** — marchio, pillola con la posizione
2. **Tab carburante** — testo con sottolineatura ciano, non chip
3. **Risposta**
   - pillola verdetto: «miglior scelta netta · 1 di 47»
   - marchio, nome, distanza, tempo, età del dato
   - prezzo 58px **colorato dal suo livello**, e a destra il netto in tasca
   - spettro: barra a gradiente sul range provinciale con il segno bianco sulla propria posizione
   - «Portami lì» (ciano) e «Perché?» (fantasma)
4. **Widget minimappa** — W2 Tabellone: più pin leggibili possibile, colorati dalla scala, il migliore acceso; velo in basso con «8 impianti in vista · migliore 1,879 · peggiore 2,079» e l'icona per aprire; tocco ovunque apre la mappa intera
5. **Analisi** — occhiello con provenienza e confidenza, poi una frase in italiano
6. **Lista** — righe con filetto, marchio, nome, metadati mono, prezzo colorato e differenza rispetto al migliore
7. **Navigazione** — pillola flottante in vetro, con sfumatura sopra

## 10. Cosa viene rimosso

- `src/services/localAnalysis.ts` — sostituito interamente da `domain/`
- `buildSeries()` e la generazione sinusoidale di storico e forecast
- `Math.min(...validPrices)` come definizione di "migliore"
- il filtro rigido a 7 giorni in `dataService.ts`
- `zoomLimit` come cap silenzioso sui marker — sostituito da un clustering che dichiara quanti impianti sta raggruppando
- `confirm()` nativo in `blockStation` — sostituito da un foglio proprio

## 11. Rischi

| Rischio | Mitigazione |
|---|---|
| Province con pochi impianti rendono lo z-score instabile | Fallback regione → nazione sotto n=8, livello marcato a bassa affidabilità |
| La distanza in linea d'aria sovrastima gli impianti lontani | Assunzione dichiarata; il costo strada è già prudente (andata+ritorno) |
| L'utente non seleziona l'auto e i default falsano il netto | I default sono conservativi; la card «Perché?» li mostra e invita a scegliere l'auto |
| Un provider AI cambia API e rompe l'analisi | Il motore deterministico è completo da solo: l'AI è narrazione, la sua assenza non degrada i numeri |
| Bricolage Grotesque è variabile e pesante | Si caricano solo i pesi usati; fallback di sistema dichiarato |

## 12. Fasi

1. **Fondamenta** — `design/tokens.css`, primitive, `domain/` completo con test sui dati reali di `public/stations.json`
2. **Home + Mappa** — schermate nuove sopra il dominio; provabile sul telefono
3. **Analisi + pannello provider** — motore deterministico, adattatori AI, contratto e validazione
4. **Garage · Pieno · Trip · Allerte** — portate al nuovo design system
5. **Rifiniture** — movimento, prestazioni, build APK

Ogni fase termina con un'app funzionante e installabile.
