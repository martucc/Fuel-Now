# Martucc Fuel 2.0 — l'app seria

**Data:** 13 ottobre 2026
**Stato:** decisioni prese con Nico in chat la sera del 12; implementazione nella notte.
**Ramo:** `ccr-0d440925-0qmxsf` (PR #3, bozza). Non si unisce a `main` senza il via di Nico.

---

## 1. Perché

Nico usa l'app per una cosa sola: **trovare il diesel più conveniente vicino a lui**. Più due cose di supporto: il pieno lungo un viaggio e l'andamento dei prezzi con l'analisi IA.

L'app di settembre fa molto di più, e lo fa a fatica. Le cinque schede sono piene di funzioni che lui non usa. La mappa nasconde i distributori quando si allarga lo zoom. E soprattutto i prezzi non si aggiornano da soli: aprendola dice «prezzi di 10 giorni fa».

## 2. Decisioni di Nico (12 ottobre)

| Tema | Scelta |
|---|---|
| Chi la usa | Solo lui. Installa a mano; per questa versione disinstalla la vecchia (firma nuova) |
| Nome | Resta **Martucc Fuel** |
| Stile | **Scuro minimal, tipo Apple** |
| Mappa | Scura, in tinta con l'app |
| Prima schermata | **Consiglio + mappa + lista**: «Vai qui: 1,629 €/L, 1,2 km, risparmi 3,40 € sul pieno», sotto la mappa e la lista |
| Logica del «migliore» | **Risparmio vero**: prezzo, ma anche i km per arrivarci, coi consumi della sua auto |
| Auto | Dal database `cars.json` già nell'app |
| Self / servito | **Tutti e due** visibili |
| Carburante | Diesel (default; gli altri restano selezionabili) |
| Si tiene | Mappa, **Viaggio** (pieno lungo un percorso), **Andamento prezzi + IA** con la sua chiave Gemini |
| Si toglie | Widget Android e sincronizzazione nativa, pieni, spese, scadenze, budget, scontrino, avvisi e notifiche |
| «Portami lì» | Android chiede ogni volta con quale navigatore aprire |
| Dati da salvare | Nessuno: si riparte puliti |

## 3. Cosa resta e cosa sparisce

**Resta** il dominio puro (`src/domain`): parsing, coorti, livelli di prezzo, freschezza, netto, previsione, viaggio, contesto IA. È la parte migliore del progetto ed è tutta testata.

**Sparisce**:
- i widget e tutto il Java che li serve (`MfNotte`, `FuelDataSyncManager`, `DailySyncReceiver`, `MartuccAlarmScheduler`, i tre provider, layout, drawable e xml);
- i permessi che servivano solo a loro (avvio al boot, notifiche, wake lock);
- le schede Pieno e Allerte, le spese, le scadenze, il budget, lo scontrino e le notifiche locali;
- «Direzione Casa» nella Home: la Home risponde a «dove conviene qui vicino». Il pieno lungo un percorso lo fa la scheda Viaggio;
- Leaflet: una sola libreria di mappe, MapLibre;
- la PWA dentro l'APK.

## 4. Architettura

```
src/
  domain/      logica pura e testata (invariata, più quanto serve alla mappa)
  data/        dataset.ts (negozio dei prezzi), archivio.ts (IndexedDB)
  services/    gemini, percorsi (OSRM), geocoding, aggiornamenti automatici
  app/         stato dell'app: hook su dataset, impostazioni, posizione, modello derivato
  ui/          schermate e componenti
  design/      tokens.css, motion.ts, primitive
```

**Lo stato** sta in quattro sorgenti, tutte osservabili:
1. **dataset**: il negozio di `data/dataset.ts`. Si legge con `useSyncExternalStore`.
2. **impostazioni**: carburante, auto, chiave e modello Gemini. Stanno in `localStorage`.
3. **posizione**: GPS una volta all'apertura e a ogni ripresa. Se manca il permesso, l'app lo dice e propone di cercare una città. Mai Milano di nascosto.
4. **modello**: derivato e memorizzato per versione del dataset, carburante, posizione (arrotondata a ~100 m) e auto.

## 5. Dati: sempre quelli di oggi

Fatto nel commit `fix(dati)`:
- all'apertura si mostra subito l'ultima copia;
- poi si riscarica **sempre**, all'avvio e a ogni ritorno in primo piano;
- in cima alla Home una riga discreta dice lo stato: «Aggiornato alle 08:12», «Aggiorno i prezzi…», «Senza rete: prezzi scaricati ieri alle 18:03». Toccandola si riscarica.

## 6. Quali distributori, e in che ordine

**Il consiglio (Home).** `rankStations` + `pickBest`, invariati nella sostanza. Il netto è il risparmio rispetto al distributore utilizzabile più vicino, meno il costo dei km in più, del tempo e dell'usura. Litri del pieno e consumo vengono dall'auto scelta; senza auto si usano i default dichiarati in `units.ts`, e la scheda lo dice.

**La lista (Home).** Gli impianti entro 15 km, ordinabili per *Risparmio* (default), *Prezzo* o *Distanza*. Accanto al prezzo self, quando c'è, il servito.

**La mappa.**
- Tutti gli impianti, non i più economici N per zoom.
- Da lontano, gruppi che dicono quanti sono e il prezzo minimo del gruppo.
- Da vicino, la targhetta col prezzo.
- Colore dal livello della coorte (stesso metro della Home e della lista).
- Il consigliato è blu; i prezzi vecchi (oltre 7 giorni) sono spenti.
- Un tocco apre la scheda del distributore.

**Il viaggio.** Considera tutti gli impianti d'Italia lungo il percorso, non solo quelli entro 50 km dalla partenza.

## 7. Design system

Scuro minimal ispirato a iOS:
- **Fondi**: nero vero e grafite.
- **Testo**: quasi bianco; secondario grigio.
- **Accento**: il blu del consigliato.
- **Prezzi**: verde, bianco, ambra, rosso.
- **Font**: Inter (inclusa nell'app, niente CDN), cifre tabulari per i prezzi. Titoli grandi come le Large Title di iOS.
- **Elementi**: card arrotondate, liste raggruppate, fogli che salgono dal basso con la maniglia.
- **Movimento**: breve, a molla, solo `transform` e `opacity`. Niente sfocature costose.

## 8. Android

- **Firma**: nuova chiave release (`android/keystore.properties`, fuori da git).
- **Versione**: 2.0 (versionCode 3). La build di sicurezza col solo fix dei dati è 1.1 (versionCode 2).
- **Barre di sistema**: in tinta col fondo.
