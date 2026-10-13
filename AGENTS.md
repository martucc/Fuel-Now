# Istruzioni per gli agenti (Claude Code, Codex, ecc.)

Prima di toccare qualcosa leggi `LEGGIMI-PRIMA.md`: setup, build e firma dell'APK, architettura e soprattutto la sezione 5 con le trappole del progetto.

In breve:
- La logica va in `src/domain/` con test `*.test.ts` accanto. Lancia `npm test` prima di dire che hai finito.
- Testi dell'interfaccia in italiano normale; numeri e date con `src/lib/formato.ts`.
- Il blu vuol dire «vai qui» e nient'altro.
- `npm run seed` prima di ogni build che va su un telefono; la release si firma con `android/keystore.properties` (mai su git).
- Non unire a `main` senza il via di Nico.
