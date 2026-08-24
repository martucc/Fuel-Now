# PROMPT DI REDESIGN — MARTUCC FUEL (PWA prezzi carburante Italia)

> Copia e incolla tutto questo testo in un'AI di design/frontend (Claude, GPT, v0, Figma Make, Lovable…).
> È la specifica completa di cosa fa l'app e di come sono composte TUTTE le schermate.

---

## 0. IL TUO RUOLO

Agisci come **Senior Product Designer + Frontend Engineer** specializzato in app mobile-first,
React 19 + TypeScript + Tailwind CSS v4 + Motion (ex Framer Motion) + Leaflet.

Devi **ridisegnare da zero l'interfaccia** di un'app esistente e funzionante, chiamata **Martucc Fuel**.
La logica di business esiste già e NON va cambiata: devi ridisegnare la pelle, la gerarchia visiva,
il layout, il ritmo e le micro-interazioni, mantenendo **tutte** le informazioni e tutte le funzioni
descritte qui sotto. Se elimini un dato, l'app perde una feature: quindi ogni dato elencato deve
trovare posto da qualche parte nel nuovo design (puoi riorganizzarlo, raggrupparlo, gerarchizzarlo).

---

## 1. COS'È L'APP (dominio e valore)

Martucc Fuel è una **PWA installabile** (buildata anche come app Android via Capacitor) che aiuta
un automobilista italiano a rispondere a tre domande:

1. **Dove faccio benzina adesso al prezzo migliore?**
2. **Conviene fare il pieno oggi o aspettare?**
3. **Quanto mi costa davvero la mia auto (pieni, consumi, budget, scadenze)?**

### Dati reali che l'app usa

- **`public/stations.json`** (~7 MB, ~21.000 distributori italiani): anagrafica MIMIT +
  prezzi Osservaprezzi, aggiornati 6 volte al giorno da una GitHub Action.
  Ogni stazione ha 4 possibili carburanti: **Benzina, Diesel, GPL, Metano**.
- **`data/history.csv` → serie storica** delle medie nazionali per carburante (anni di dati,
  usata per grafici 1M/3M/6M/1Y/5Y/MAX e confronti "un anno fa").
- **`public/cars.json`**: database modelli auto (modello, litri serbatoio, km/l, tag alimentazione).
- **`public/news.json`**: news di mercato generate dalla pipeline AI.
- **Geolocalizzazione browser**: distanza utente ↔ stazione, raggio di ricerca 1–100 km.
- **Gemini (opzionale)**: se l'utente inserisce la sua API key, le analisi di mercato sono generate
  da Gemini; altrimenti c'è un **motore di analisi locale** che produce lo stesso tipo di output.
  L'UI deve rendere sempre evidente **quale delle due fonti** ha prodotto il testo (badge "Locale"
  vs "Gemini").
- Tutto lo stato utente (preferiti, soglie, pieni, spese, scadenze, budget, veicolo) è in
  **localStorage** — nessun account, nessun login. L'app deve funzionare **offline** con cache.

---

## 2. MODELLO DATI (fonte di verità dei contenuti da mostrare)

```ts
type FuelType = 'Benzina' | 'Diesel' | 'GPL' | 'Metano';

FuelStation  { id, name, brand, address, city, distance?, services[], location{lat,lng}, prices[] }
FuelPrice    { type: FuelType, price: number, lastUpdated: string, isSelf: boolean }

MarketAnalysis {
  advice: 'FILL-FULL' | 'WAIT' | 'TEN-EURO' | 'URGENT',
  source: 'ai' | 'local', generatedAt,
  reasoning,             // frase secca, va mostrata come "quote"
  detailedReport,        // testo lungo, collassato in un accordion
  stats { averagePrice, minPrice, maxPrice, spread, sampleSize, cheapestStationName, latestUpdated },
  categories[] { title, content, icon },   // "Approfondimenti"
  tips[] { title, text, impact: 'HIGH'|'MEDIUM'|'LOW' },
  trend: 'UP' | 'DOWN' | 'STABLE',
  historicalData[] { date, price },
  forecast[] { date, price }               // 7 giorni previsti
}

Alert    { id, fuelType, threshold, stationId?, active }
Deadline { id, carModel, type: 'revisione'|'bollo'|'assicurazione'|'tagliando'|'altro', date, recurrence:'none'|'yearly'|'2years', label?, notes? }
Expense  { id, carModel, type: 'manutenzione'|'bollo'|'assicurazione'|'multa'|'pedaggio'|'altro', date, amount, label?, notes? }
Fillup   { id, date, carModel, fuelType, liters, pricePerLiter, total, odometer, full, stationName?, notes? }
```

### Regole di business che l'UI DEVE rendere visibili

- **Media "trimmed"**: la media prezzo scarta il 15% degli estremi. Va mostrata come "Media".
- **Prezzo anomalo**: una stazione è anomala se prezzo ≤ 0, < 0.5 €, > 3.0 €, oppure < 93% o > 115%
  della media nazionale di quel carburante. Le anomalie di solito indicano **distributore chiuso o
  dato sbagliato**. Nel design devono apparire come card **desaturate, opache, non cliccabili**, con
  badge "Anomalia". Non vanno nascoste del tutto: l'utente deve capire perché quel prezzo assurdo
  non è cliccabile.
- **ALPHA / miglior prezzo**: la stazione col prezzo valido più basso nel raggio è l'eroe della Home
  e il marker più evidente sulla mappa.
- **Cache analisi**: l'analisi di mercato è cachata per giorno + carburante + modello. L'UI mostra
  sempre "Aggiornato X min fa" e un pulsante rigenera con stato loading.
- **Deep link / shortcut PWA**: `/?tab=map`, `/?tab=home&fuel=Diesel`, `/?tab=analysis`, `/?drive=1`
  (modalità guida: controlli più grandi). Il design deve prevedere una **modalità guida** leggibile
  a colpo d'occhio.

---

## 3. ARCHITETTURA DI NAVIGAZIONE

**7 schermate**, di cui 6 nella bottom nav e 1 (Allerte) raggiungibile dalla campanella in header:

| id | label bottom nav | icona attuale | contenuto |
|---|---|---|---|
| `home` | HOME | Home | dashboard prezzi + lista stazioni |
| `map` | MAPPA | Map | mappa fullscreen con marker prezzo |
| `trip` | TRIP | Route | pianificatore viaggio + soste |
| `veicolo` | GARAGE | Car | veicolo, scadenze, spese |
| `analysis` | INTEL | Brain | analisi di mercato + AI |
| `pieno` | PIENO | Fuel | storico pieni, budget, consumi |
| `alerts` | *(solo header)* | Bell | notifiche e soglie prezzo |

Transizioni attuali: slide orizzontale con spring (direzione calcolata dall'ordine dei tab),
scale 0.96 → 1, la bottom nav **si nasconde scrollando in giù** e riappare scrollando su.
Puoi cambiare la coreografia, ma la navigazione deve restare fluida e mai "a scatto".

---

## 4. COMPONENTI GLOBALI

### 4.1 Splash screen (all'avvio, ~0.5 s)
Logo animato (fulmine), ring rotante, effetto scan-line, nome brand "Martucc**Fuel**",
tagline "Neural Intelligence", barra di progresso e testo "Sincronizzazione Nucleo Operativo…".
Esce con fade + blur. → Ridisegnalo, ma deve restare **corto e non bloccante**.

### 4.2 Header fisso (sempre visibile, safe-area top)
- Sinistra: wordmark "Martucc**Fuel**" + pallino verde pulsante (= dati live).
- Destra, in fila: bottone **Installa PWA** (compare solo se installabile), bottone
  **calcolatrice** (apre "Metti €X"), bottone **campanella** con badge numerico = allerte attive
  (apre tab Allerte), bottone **ingranaggio** (apre Impostazioni).

### 4.3 Bottom navigation
Dock flottante arrotondato, vetro scuro, 6 voci con icona + micro-label uppercase,
indicatore animato che scivola sulla voce attiva (spring), puntino luminoso sotto l'attiva,
feedback aptico al tap. Deve restare utilizzabile con una mano e rispettare la safe-area bottom.

---

## 5. SCHERMATE — SPECIFICA DETTAGLIATA

> Per ogni schermata: ordine reale dei blocchi dall'alto in basso, dati mostrati, stati.

---

### 5.1 HOME — "dove faccio benzina adesso"

Contenuto in ordine:

1. **Campo di ricerca** "Cerca stazione…" (filtra per nome/indirizzo) con, dentro il campo a destra,
   il bottone **filtri**; il bottone si evidenzia quando ci sono filtri attivi.
2. **Segmented control carburante**: Benzina / Diesel / GPL / Metano (4 voci, icona + testo,
   pillola attiva animata). Cambia i dati di **tutta** l'app.
3. **Slider raggio di ricerca**: 1–100 km, con valore corrente in evidenza e le etichette agli estremi.
4. **HERO — card "Miglior prezzo" (ALPHA)** — il blocco più importante della app:
   - logo brand in cerchio, etichetta "Miglior Prezzo", città/nome stazione, brand + distanza km;
   - badge "ALPHA" con corona;
   - **prezzo/litro gigante** (3 decimali, es. `1.719`) + unità "EUR";
   - a destra "Costo Pieno (NN L)" calcolato su serbatoio del veicolo selezionato;
   - CTA piena larghezza **"NAVIGA ORA"** → apre Google Maps directions.
5. **Widget "Intelligence"**:
   - header con pallino live, titolo, chip variazione prevista a 7 giorni (es. `-0.8%`)
     e pulsante rigenera analisi (spin durante il loading);
   - banner "Gemini sta generando l'analisi…" quando c'è la key e sta caricando;
   - **VERDETTO grande, 3 esiti soli**: `Aspetta` (previsione in calo) / `Fai il pieno`
     (previsione in salita) / `Pochi euro` (mercato laterale), ciascuno con icona, colore semantico,
     riga di spiegazione ("prezzo in calo del 1.2% in 7 giorni") e riga
     "Risparmi/Perdi se aspetti (NN L): ±€X.XX";
   - tris di statistiche: **Media**, **Più economico** (evidenziato in verde), **Spread**;
   - card "Strategia IA" con la frase `reasoning` tra virgolette + chip stato
     (Pieno Consigliato / Attendi Calo / Rifornimento Minimo);
   - due mini-card: **Previsione 7G** (%) e **Trend Atteso** (Ribasso/Rialzo/Stabile).
6. **Widget risparmio**: confronto tra il **miglior prezzo locale** e la **media nazionale** dello
   stesso carburante: delta al litro (es. `−€0.084`), risparmio sul pieno, percentuale, e le due
   cifre a confronto. Verde se stai risparmiando, rosso se sei sopra media.
7. **Lista "Altre Stazioni"** con contatore risultati e fino a 40 card. Ogni **StationCard**:
   - logo brand in cerchio;
   - città/nome in evidenza; riga secondaria con brand • distanza • indirizzo • data ultimo rilevamento;
   - prezzo a 3 decimali grande + "Pieno €NN";
   - bottone circolare **naviga**;
   - variante **best** (glow blu) e variante **anomala** (grigia, opaca, badge "Anomalia", non cliccabile).
   - tap sulla card → apre il **modale storico stazione**.
8. **Stato vuoto**: riquadro tratteggiato "Nessun Risultato".

---

### 5.2 MAPPA — fullscreen

- Mappa Leaflet a tutto schermo tra header e bottom nav, tile **dark** o **voyager (chiara)**.
- **Marker prezzo custom**: pillola con `€1.719`, punta a freccia sotto, e — sopra zoom 15 — un
  cerchietto con il logo del brand. Codifica colore:
  - **blu con glow** = miglior prezzo assoluto (ALPHA), leggermente ingrandito;
  - **verde** = sotto la media (> 1.5 cent);
  - **ambra** = in media;
  - **rosso** = sopra la media;
  - **grigio desaturato** = anomalo.
- **Marker utente**: pallino "base operativa" con alone pulsante.
- **Declutter per zoom**: numero massimo di marker per livello di zoom (150 a z≥15 … 1 a z<5),
  tenendo sempre i più economici; si ricaricano i dati al `moveend`.
- **Vista heatmap** alternativa: cerchi colorati per fascia prezzo (verde→rosso su scala HSL)
  invece dei pin.
- Controlli flottanti: **toggle heatmap** (in alto a dx), **toggle stile mappa chiaro/scuro**
  (sotto), **centra sulla mia posizione** (in basso a dx).
- Tap su marker → **modale storico stazione**.

---

### 5.3 TRIP — pianificatore viaggio

1. **Header di sezione**: eyebrow "ITINERARIO", titolo grande "Pianifica il viaggio",
   sottotitolo "Trova il percorso più conveniente con soste mirate".
2. **Card partenza/arrivo**: due campi con autocomplete città (dot grigio = partenza, quadrato blu =
   arrivo), bottone "usa la mia posizione" (reverse geocoding), bottone **swap** verticale.
   La card si illumina di blu quando entrambi i campi sono pieni.
3. **Card Veicolo**: toggle unità **KM/L ↔ L/100**, campo **Consumo**, campo **Serbatoio (L)**,
   e uno slider **"Carburante ora"** (0 → capacità) con lettura `NNL / NNL · ~NNN km` e scorciatoia "Pieno".
4. **Card Strategia**: segmented **Bilanciato / Economico / Veloce** (pesa prezzo vs deviazione vs
   posizione lungo il tragitto) + toggle **pedaggio autostrada** con stima "~NNN km a €0.077/km".
5. **Stima rapida** (live, prima del calcolo): Distanza · Carburante € · Totale/Litri.
6. **CTA "Calcola percorso"** (disabilitata finché mancano i campi).
7. **Risultato** (dopo il calcolo):
   - **mappa del percorso** con polilinea multi-strato (alone nero, glow blu, linea, highlight
     interno), pin partenza/arrivo, pin numerati per le soste, pillole prezzo per le stazioni vicine
     al tragitto (la più economica evidenziata);
   - **card Risultato** con 6 metriche grandi: Distanza, Litri, Carburante €, Pedaggio stimato €,
     Soste, Totale €;
   - **"Soste consigliate"**: lista con logo brand, nome, indirizzo, prezzo, "sosta N";
   - **"Stazioni lungo il percorso"**: contatore, ordinamento a chip **Prezzo / Deviazione / Tappa**,
     lista scrollabile con badge "Min" e "Sosta", km di progresso e deviazione (+X km), prezzo.

---

### 5.4 GARAGE (veicolo)

**Stato A — nessun veicolo selezionato:**
- campo di ricerca "Cerca il tuo modello…", contatore "N modelli rilevati",
- lista scrollabile di card modello: icona auto, nome modello, "NN L • NN KM/L", chevron.

**Stato B — veicolo selezionato:**
1. **Card veicolo attivo**: eyebrow "Veicolo Attivo", nome modello grande, tag alimentazione,
   bottone "Rimuovi"; due tile **Serbatoio (L)** e **Consumo (KM/L)**; riga "Efficienza — Range
   Ottimale" con il valore km/L ripetuto in grande.
2. **Scadenze veicolo** ("Da Ricordare"): lista di scadenze (revisione, bollo, assicurazione,
   tagliando, altro) con data, giorni mancanti, badge **Scaduta** / **Urgente**, bottone **Rinnova**
   (sposta la data di 1 o 2 anni), elimina con conferma inline "Sì/No", e un form a bottom sheet
   (tipo, data, rinnovo automatico Mai/1 Anno/2 Anni, etichetta, note).
3. **Spese auto** ("Costo Totale"): totale 12 mesi, delta % vs mese precedente, **barre mensili
   impilate** (carburante vs altre spese) con linea media e legenda, ripartizione **per categoria**
   con barra di percentuale, **cronologia spese** con importo e data, form a bottom sheet
   (categoria a griglia di icone, importo, data, descrizione, note).

---

### 5.5 INTEL (analisi di mercato) — la schermata più densa

In ordine:

1. **Header**: eyebrow "Intel · IT", titolo "Mercato", badge "Locale" se non c'è Gemini.
2. Banner loading Gemini (se in corso).
3. **Ticker tape**: 4 tessere orizzontali scrollabili (BENZ / DSL / GPL / MTN) con prezzo medio
   nazionale e variazione % giornaliera; tap = cambia carburante attivo.
4. **Hero grafico prezzo**:
   - riga "Benzina · ultimo dato · 12 mag 2026", **prezzo 3 decimali gigantesco**, chip trend %;
   - **grafico storico** interattivo con hover (al passaggio, prezzo e data in testata cambiano);
   - **selettore periodo**: 1M / 3M / 6M / 1Y / 5Y / MAX;
   - 4 statistiche: **High / Low / Avg / Vol (±c)**.
5. **AI PULSE — "Verdetto AI"**:
   - titolo + "Aggiornato X min fa" + rigenera;
   - **verdetto grande**: Aspetta / Fai pieno ora / Aspetta poco / Meglio adesso / Indifferente,
     con la motivazione ("il prezzo scende dell'1.2% in 7 giorni");
   - numero eroe **"Risparmi/Perdi se aspetti 7 giorni €X.XX"** con riferimento "su pieno NN L";
   - confronto **Oggi → +7 giorni** (due tile con freccia in mezzo);
   - **Affidabilità previsione**: 3 segmenti (Bassa/Media/Alta).
6. **"Chiedi all'AI"**:
   - sottotitolo che dichiara la fonte (Gemini vs motore locale);
   - **pulsante microfono** con anelli pulsanti quando ascolta (speech recognition it-IT) e stato
     "Sto ascoltando…";
   - **prompt rapidi** a chip ("Conviene fare il pieno oggi?", "Storico benzina ultimi 3 mesi?"…);
   - textarea + bottone invio circolare (spinner durante la risposta);
   - **card risposta** con badge fonte, domanda citata, testo risposta, bottone **audio on/off**
     (sintesi vocale, con onde animate mentre parla) e chiusura;
   - se manca la key: link "Configura chiave Gemini".
7. **Brief mattutino**: sentiment in una riga, "fast facts" numerici, paragrafo `reasoning`.
8. **Finestra ottimale** (se conviene aspettare): "Fai pieno tra N giorni", data per esteso,
   prezzo previsto, risparmio stimato sul pieno.
9. **"Stesso giorno, anni fa"**: prezzo di oggi + confronti con 1 settimana / 1 mese / 1 anno /
   3 anni fa, ciascuno con delta % colorato, e legenda verde/rosso.
10. **"Affidabilità dell'analisi"**: verdetto complessivo (Alta/Media/Bassa) + 4 indicatori con
    icona, stato e spiegazione in linguaggio umano: **Dati zona** (n. stazioni), **Spread**,
    **Volatilità**, **News** (quante notizie rialziste).
11. **Range 52 settimane**: barra gradiente verde→rosso con cursore sul prezzo di oggi, verdetto
    ("Buon momento per comprare" / "Vicino al massimo") e spiegazione.
12. **Distribuzione zona**: istogramma delle fasce di prezzo delle stazioni vicine, barra verde =
    dove sei tu, con frase tipo "Sei tra le 3 più economiche su 128 stazioni".
13. **Suggerimento**: advice (Fai il pieno / Aspetta / Carico minimo / Azione urgente) + motivazione.
14. **AI Tips**: lista con barra di impatto (Alto/Medio/Basso).
15. **Approfondimenti**: lista di categorie con icona, titolo, contenuto.
16. **AI News Feed**: 3 notizie con icona di impatto (rialzista/ribassista/neutra), fonte, sunto, link.
17. **Report completo**: accordion con il testo lungo.

---

### 5.6 PIENO — costi reali dell'auto

**Stato vuoto** (nessun veicolo): card che invita ad andare in Garage.

**Stato pieno**, in ordine:
1. **Quick fill-up "Sei qui"** (se sei entro 2 km da una stazione): banner blu con nome stazione,
   prezzo €/L, distanza in metri, CTA "Pieno adesso →" che precompila il form.
2. **"Prossimo Pieno"**: giorni stimati alla riserva, data prevista, **% serbatoio consumato**
   con barra (blu → ambra ≥50% → rosso ≥75%), litri usati/rimasti, e tre tile:
   **Autonomia (~km)**, **Km/giorno**, **Da (gg dall'ultimo pieno)**.
3. **Budget mensile**: speso / budget, split carburante vs altro, barra con **overshoot rosso**
   oltre il 100%, "% usato" e "giorni rimasti", **Proiezione mese** (verde/rosso) e **Rimangono**
   (con €/giorno). Se non impostato: card compatta con CTA "Imposta" → bottom sheet con importo,
   preset €100/150/200/300, toggle "includi altre spese", nota sulle notifiche a 75/90/100%.
4. **Spesa mensile (12 mesi)**: totale, n. pieni, litri, delta % vs mese precedente, **istogramma
   12 barre** con linea media e ultimo mese evidenziato, e tre celle Media/mese, Mese peggiore, Ultimo.
5. **Confronto carburanti — "Costo per 100 km"**: per Benzina/Diesel/GPL/Metano mostra media zona
   €/L, km/L stimati per quel carburante e **€/100 km**; evidenzia il più conveniente (trofeo) e
   quello attivo; alert "Con il Diesel risparmieresti il 18% per km"; disclaimer sulle stime.
6. **Pieno Tracker**: 4 statistiche — **Consumo Reale** (con "+/-X% vs WLTP"), **Prezzo Medio
   pagato**, **Spesa Totale** (n. pieni), **Km Percorsi** (€/km) — **grafico trend consumo**
   pieno-per-pieno con linea WLTP tratteggiata, e **cronologia** dei rifornimenti (litri, €/L,
   totale, data, km, stazione) con eliminazione a conferma inline.
   Form a bottom sheet: data, tipo carburante, litri, totale, €/L, contachilometri, stazione,
   toggle "Pieno Completo" (necessario per calcolare il consumo reale).

---

### 5.7 ALLERTE (dalla campanella)

1. Header di sezione "Notification Center" / "Le tue Notifiche".
2. **Master switch** notifiche con stato ("Notifiche attive/spente"), messaggi per permesso negato
   o browser non supportato, e bottone **"Invia notifica di prova"**.
3. **Categorie** (card con icona, titolo, descrizione, toggle):
   Soglia prezzo · Andamento giornaliero · Offerte in zona (−4% sotto media) · Promemoria pieno ·
   Scadenze veicolo (30/7/1 giorni) · Budget mensile (75/90/100%).
4. **Filtra carburanti**: 4 toggle Benzina/Diesel/GPL/Metano.
5. **Soglie prezzo**: selezione carburante, campo prezzo con formattazione automatica
   ("Avvisami se scende sotto € 1.750 /L"), bottone **+**, e lista soglie con switch attivo/spento
   e eliminazione.
6. Nota finale sui limiti delle notifiche web.

---

## 6. MODALI / BOTTOM SHEET

Tutti entrano dal basso con spring, sfondo scuro sfocato, handle grigio in cima, scroll interno,
altezza max ~90vh.

1. **Impostazioni**: campo API key Gemini (password) con badge ACTIVE/MISSING, guida rapida in 2
   passi con link a Google AI Studio, **scelta modello** (Gemini 2.5 Flash / 2.5 Pro / 2.5 Flash-Lite
   / 2.0 Flash / 2.0 Flash-Lite, con etichetta di velocità), toggle **feedback tattile**, slider
   **risoluzione radar del widget Android** (11x–18x con etichette testuali), bottoni **Reset** e **Salva**.
2. **Filtri**: slider **raggio d'azione** (1–100 km), **brand** a chip con logo, **servizi**
   (Self-Service, Bar, Autolavaggio, Officina), **filtri rapidi** (H24, No Autostrada, Nascondi
   Anomalie), bottoni Reset / Applica.
3. **Storico stazione** (tap su card o marker): intestazione con brand e città, selettore dei 4
   carburanti (disabilitati quelli non venduti), **prezzo attuale gigante** con data/ora rilevamento
   e delta % su N giorni, **grafico storico** con linea media, tre celle Min/Media/Max, CTA
   **Naviga**, e azione secondaria **"Segnala chiuso / errato"**.
4. **Calcolatore "Metti €X"** (dalla calcolatrice in header): importo con preset €10/20/30/50,
   risultato **Litri** e **Autonomia km**, barra "% serbatoio coperto", e campo per sovrascrivere
   il prezzo €/L usato.
5. **Form**: nuovo pieno, nuova spesa, nuova scadenza, budget (descritti sopra).

---

## 7. DESIGN SYSTEM ATTUALE (punto di partenza, non una gabbia)

- **Tema**: dark OLED puro. Fondo `#000`, superfici `#09090b` / `#0a0f1d` / `#1c1c1e`,
  testo `#f5f5f7`, testo secondario `#8e8e93`, disabilitato `#48484a`.
- **Accento**: blu (`blue-500/600`, glow `rgba(37,99,235,…)`).
- **Colori semantici (obbligatori, non negoziabili):**
  - **verde/emerald** = conveniente, in calo, risparmio, sotto la media;
  - **rosso** = caro, in salita, perdita, sopra la media, scaduto;
  - **ambra** = neutro/attenzione/mercato laterale;
  - **blu** = selezione, AI, azione primaria;
  - **grigio desaturato** = dato anomalo o non disponibile.
- **Tipografia**: Inter, pesi 300–900. Numeri **sempre** `tabular-nums`. Prezzi a 3 decimali.
  Etichette tecniche: 9–11px, uppercase, `tracking` largo. Titoli: black + italic + tracking stretto.
- **Forma**: raggi molto morbidi (20–48 px), card con bordo `white/5–10`, glow blu diffuso
  dietro le card importanti, blur di sfondo.
- **Micro-interazioni**: `active:scale-95` su ogni elemento premibile, spring per gli indicatori,
  aptica leggera sui tap principali.

Puoi proporre una direzione visiva **diversa** (più editoriale, più "financial terminal", più
neo-brutalista, chiara/light mode, ecc.) purché: resti leggibile alla luce del sole in auto,
mantenga la codifica colore semantica, e regga la densità informativa della schermata INTEL.

---

## 8. VINCOLI TECNICI

- **Mobile-first**, contenitore centrale max ~28rem (`max-w-md`); adattare bene anche a tablet.
- React 19 + TypeScript + **Tailwind v4** + **motion/react** + **react-leaflet** + **lucide-react**.
- **Safe area** iOS/Android (`env(safe-area-inset-*)`) su header e bottom nav.
- Performance: liste lunghe (fino a 21k stazioni filtrate), marker mappa limitati per zoom,
  niente animazioni che facciano scattare il grafico storico su dataset lunghi.
- Target touch ≥ 44 px. Contrasto AA sul testo informativo. `aria-label` su tutti i bottoni icona.
- Lingua UI: **italiano**. Formati: `€1.719` per €/L (3 decimali), `€85,00` per gli importi,
  date `12 mag 2026`, distanze `1.2 km`.
- Deve reggere **stato vuoto, loading e errore** per ogni blocco (niente schermate bianche).

---

## 9. COSA NON DEVI CAMBIARE

- I nomi dei tab e la loro funzione.
- I dati mostrati: se un numero è in questa specifica, deve esistere anche nel nuovo design.
- La semantica dei colori (verde=buono, rosso=caro).
- La distinzione visibile **analisi locale vs Gemini**.
- Il comportamento delle **stazioni anomale** (visibili ma disattivate e spiegate).

## 10. COSA PUOI CAMBIARE LIBERAMENTE

Gerarchia e raggruppamento dei blocchi, sistema tipografico, palette (mantenendo la semantica),
forma delle card, coreografia delle transizioni, layout della mappa e dei marker, il modo in cui la
schermata INTEL viene resa meno opprimente (tab interne, progressive disclosure, "sezione base +
avanzata"), la posizione di Allerte, l'aggiunta di una vera light mode.

---

## 11. COSA DEVI CONSEGNARE

1. **Rationale di design** (max 15 righe): il concetto, e le 3 decisioni più importanti che hai preso.
2. **Design system**: token colore (light + dark), scala tipografica, spaziature, raggi, ombre,
   stati dei componenti.
3. **Libreria componenti**: Header, BottomNav, SegmentedControl carburante, StationCard (varianti
   normale / best / anomala), HeroPriceCard, StatTile, VerdictCard, Chart wrapper, ListRow,
   BottomSheet, FormField, Toggle, Chip, EmptyState, LoadingState, marker mappa.
4. **Le 7 schermate** ridisegnate, blocco per blocco, nell'ordine indicato sopra, con gli stati
   vuoto/loading.
5. **Codice React + Tailwind** dei componenti chiave (Header, BottomNav animata, StationCard,
   HeroPriceCard, VerdictCard, BottomSheet) pronto da incollare, con i tipi TypeScript qui sopra.
6. Note su **accessibilità** e su come si comporta il layout in **modalità guida** (`?drive=1`).

---

## 12. ANTI-PATTERN DA EVITARE

- Prezzi troncati a 2 decimali o senza `tabular-nums` (i numeri "ballano").
- Card che sembrano tutte uguali: la Home ha **un solo eroe** (il miglior prezzo).
- Testo AI lungo mostrato per intero senza accordion.
- Verde/rosso usati per decorazione invece che per significato.
- Bottom nav che copre l'ultima card della lista (serve padding-bottom reale).
- Icone senza etichetta nelle azioni distruttive (eliminare pieni, spese, scadenze).
- Grafici senza asse di riferimento (media/WLTP/52w) — è lì che sta l'informazione.
